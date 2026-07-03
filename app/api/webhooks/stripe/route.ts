import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";
import { stripe } from "@/services/billing/stripe";
import { planConfig, planForStripePriceId } from "@/services/billing/plans";

// Statuses that keep the paid plan active. past_due keeps access during the
// Stripe dunning window; a final failure transitions to canceled/unpaid.
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const org = await prisma.organization.findFirst({
    where: sub.metadata?.org_id
      ? { id: sub.metadata.org_id }
      : { stripe_customer_id: customerId },
  });
  if (!org) {
    console.error(`[stripe-webhook] no org for subscription ${sub.id} (customer ${customerId})`);
    return;
  }

  const item = sub.items.data[0];
  const priceId = item?.price.id ?? "";
  const mappedPlan = planForStripePriceId(priceId);
  const isActive = ACTIVE_STATUSES.has(sub.status);

  if (isActive && !mappedPlan) {
    console.error(`[stripe-webhook] unknown price ${priceId} on subscription ${sub.id} — ignoring`);
    return;
  }

  const plan = isActive && mappedPlan ? mappedPlan : "free";
  const config = planConfig(plan);

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      plan,
      plan_status: sub.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: plan === "free" ? null : sub.id,
      current_period_start:
        plan !== "free" && item?.current_period_start
          ? new Date(item.current_period_start * 1000)
          : null,
      current_period_end:
        plan !== "free" && item?.current_period_end
          ? new Date(item.current_period_end * 1000)
          : null,
      render_limit: config.renderLimit,
      seats: config.seats,
    },
  });

  console.log(`[stripe-webhook] org ${org.id} → plan=${plan} status=${sub.status}`);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set");
    return httpError("Webhook not configured", 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return httpError("Missing signature", 400);

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", (err as Error).message);
    return httpError("Invalid signature", 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe().subscriptions.retrieve(subId);
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] failed handling ${event.type}:`, err);
    // 500 so Stripe retries the delivery
    return httpError("Webhook handler failed", 500);
  }

  return Response.json({ received: true });
}

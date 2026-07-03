import { NextRequest } from "next/server";
import { isPreviewMode, requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";
import { stripe } from "@/services/billing/stripe";
import { stripePriceIdForPlan } from "@/services/billing/plans";

export async function POST(request: NextRequest) {
  try {
    if (isPreviewMode()) return httpError("Billing is not available in preview mode", 400);

    const { user, org } = await requireUserWithOrg();
    const body = await request.json();
    const plan = body.plan;

    if (plan !== "pro" && plan !== "team") {
      return httpError("Invalid plan", 400);
    }
    const priceId = stripePriceIdForPlan(plan);
    if (!priceId) {
      return httpError("Billing is not configured for this plan", 500, "stripe_not_configured");
    }

    const client = stripe();

    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await client.customers.create({
        email: user.email,
        metadata: { org_id: org.id },
      });
      customerId = customer.id;
      await prisma.organization.update({
        where: { id: org.id },
        data: { stripe_customer_id: customerId },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const session = await client.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?billing=success`,
      cancel_url: `${appUrl}/settings?billing=cancelled`,
      subscription_data: { metadata: { org_id: org.id } },
      metadata: { org_id: org.id },
      allow_promotion_codes: true,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[billing checkout]", err);
    return httpError("Failed to start checkout", 500);
  }
}

import { NextRequest } from "next/server";
import { isPreviewMode, requireUserWithOrg } from "@/lib/auth";
import { httpError } from "@/lib/errors";
import { stripe } from "@/services/billing/stripe";

export async function POST(request: NextRequest) {
  try {
    if (isPreviewMode()) return httpError("Billing is not available in preview mode", 400);

    const { org } = await requireUserWithOrg();
    if (!org.stripe_customer_id) {
      return httpError("No billing account yet — upgrade to a paid plan first", 400);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const session = await stripe().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl}/settings`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[billing portal]", err);
    return httpError("Failed to open billing portal", 500);
  }
}

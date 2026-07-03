import Stripe from "stripe";
import { AppError } from "@/lib/errors";

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new AppError("Billing is not configured", 500, "stripe_not_configured");
    client = new Stripe(key);
  }
  return client;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

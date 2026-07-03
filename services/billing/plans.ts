import type { PlanTier } from "@prisma/client";

export interface PlanFeatures {
  quoting: boolean;
  branding: boolean;
  watermark: boolean;
}

export interface PlanConfig {
  tier: PlanTier;
  label: string;
  priceUsd: number;
  renderLimit: number;
  seats: number;
  dailyCostCeilingUsd: number;
  features: PlanFeatures;
}

function envInt(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envFloat(name: string, fallback: number): number {
  const parsed = parseFloat(process.env[name] ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Launch pricing (locked 2026-07-02): intentionally low to win early customers;
// raise later with existing subscribers grandfathered via per-org render_limit.
export function planConfig(tier: PlanTier): PlanConfig {
  switch (tier) {
    case "pro":
      return {
        tier,
        label: "Pro",
        priceUsd: 29,
        renderLimit: envInt("RENDER_LIMIT_PRO", 150),
        seats: 1,
        dailyCostCeilingUsd: envFloat("DAILY_COST_CEILING_PRO_USD", 5),
        features: { quoting: true, branding: true, watermark: false },
      };
    case "team":
      return {
        tier,
        label: "Team",
        priceUsd: 49,
        renderLimit: envInt("RENDER_LIMIT_TEAM", 300),
        seats: 3,
        dailyCostCeilingUsd: envFloat("DAILY_COST_CEILING_TEAM_USD", 10),
        features: { quoting: true, branding: true, watermark: false },
      };
    default:
      return {
        tier: "free",
        label: "Free",
        priceUsd: 0,
        renderLimit: envInt("RENDER_LIMIT_FREE", 5),
        seats: 1,
        dailyCostCeilingUsd: envFloat("DAILY_COST_CEILING_FREE_USD", 0.75),
        features: { quoting: false, branding: false, watermark: true },
      };
  }
}

export const PAID_PLANS: PlanTier[] = ["pro", "team"];

export function stripePriceIdForPlan(tier: PlanTier): string | null {
  if (tier === "pro") return process.env.STRIPE_PRICE_ID_PRO ?? null;
  if (tier === "team") return process.env.STRIPE_PRICE_ID_TEAM ?? null;
  return null;
}

export function planForStripePriceId(priceId: string): PlanTier | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_ID_PRO) return "pro";
  if (priceId && priceId === process.env.STRIPE_PRICE_ID_TEAM) return "team";
  return null;
}

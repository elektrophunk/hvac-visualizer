import { prisma } from "@/lib/prisma";
import type { Organization } from "@prisma/client";

// Paid plans meter against the Stripe billing period; free orgs against the
// calendar month (UTC). Falls back to calendar month if Stripe dates are missing.
export function currentPeriodStart(org: Organization): Date {
  if (org.plan !== "free" && org.current_period_start) {
    return org.current_period_start;
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Every non-failed job in the period counts: completed, in-flight (prevents
// parallel-submit bypass), and not-viable analyses (they still cost Claude spend).
// Failed jobs (moderation blocks, API errors) don't count against the user.
export async function getPeriodRenderCount(org: Organization): Promise<number> {
  return prisma.renderJob.count({
    where: {
      user: { org_id: org.id },
      created_at: { gte: currentPeriodStart(org) },
      status: { not: "failed" },
    },
  });
}

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getOrgDailySpendUsd(orgId: string): Promise<number> {
  const agg = await prisma.renderJob.aggregate({
    where: { user: { org_id: orgId }, created_at: { gte: startOfUtcDay() } },
    _sum: { cost_usd: true },
  });
  return Number(agg._sum.cost_usd ?? 0);
}

export async function getGlobalDailySpendUsd(): Promise<number> {
  const agg = await prisma.renderJob.aggregate({
    where: { created_at: { gte: startOfUtcDay() } },
    _sum: { cost_usd: true },
  });
  return Number(agg._sum.cost_usd ?? 0);
}

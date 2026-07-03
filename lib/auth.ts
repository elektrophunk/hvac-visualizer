import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { planConfig } from "@/services/billing/plans";
import type { Organization, User } from "@prisma/client";

const PREVIEW_USER: User = {
  id: "preview-user-id",
  supabase_uid: "preview",
  email: "preview@example.com",
  display_name: "Preview User",
  org_id: "preview-org-id",
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const PREVIEW_ORG: Organization = {
  id: "preview-org-id",
  name: "Preview Company",
  slug: "preview-org",
  owner_id: "preview-user-id",
  created_at: new Date(),
  updated_at: new Date(),
  plan: "free",
  plan_status: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  current_period_start: null,
  current_period_end: null,
  render_limit: 5,
  seats: 1,
  logo_url: null,
  phone: null,
  license_number: null,
  address: null,
  brand_color: null,
  website: null,
  paused_at: null,
  pause_reason: null,
};

export function isPreviewMode() {
  if (process.env.PREVIEW_MODE !== "true") return false;
  // PREVIEW_MODE bypasses ALL auth — refuse to honor it in production
  if (process.env.VERCEL_ENV === "production") {
    throw new AppError("PREVIEW_MODE must not be enabled in production", 500);
  }
  return true;
}

export async function getSupabaseUser() {
  if (isPreviewMode()) return { id: "preview", email: "preview@example.com" };
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

function defaultOrgName(user: User): string {
  const base = user.display_name?.trim() || user.email.split("@")[0];
  return `${base}'s Company`;
}

// Lazy Organization activation: every account gets an owner-billed org on
// first authenticated request. The deterministic slug makes concurrent
// creation idempotent (upsert on slug), and backfills pre-Build-1 accounts.
async function ensureOrg(user: User): Promise<Organization> {
  if (user.org_id) {
    const existing = await prisma.organization.findUnique({
      where: { id: user.org_id },
    });
    if (existing) return existing;
  }

  const free = planConfig("free");
  const org = await prisma.organization.upsert({
    where: { slug: `org-${user.id}` },
    update: {},
    create: {
      name: defaultOrgName(user),
      slug: `org-${user.id}`,
      owner_id: user.id,
      plan: "free",
      render_limit: free.renderLimit,
      seats: free.seats,
    },
  });

  if (user.org_id !== org.id) {
    await prisma.user.update({
      where: { id: user.id },
      data: { org_id: org.id },
    });
  }

  return org;
}

export async function requireUser(): Promise<User> {
  if (isPreviewMode()) return PREVIEW_USER;

  const supabaseUser = await getSupabaseUser();
  if (!supabaseUser) throw new AppError("Unauthorized", 401);

  let user = await prisma.user.findUnique({
    where: { supabase_uid: supabaseUser.id },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        supabase_uid: supabaseUser.id,
        email: supabaseUser.email!,
      },
    });
  }

  if (user.deleted_at) throw new AppError("Account deleted", 403);

  if (!user.org_id) {
    const org = await ensureOrg(user);
    user = { ...user, org_id: org.id };
  }

  return user;
}

export async function requireUserWithOrg(): Promise<{ user: User; org: Organization }> {
  if (isPreviewMode()) return { user: PREVIEW_USER, org: PREVIEW_ORG };

  const user = await requireUser();
  const org = await ensureOrg(user);
  return { user, org };
}

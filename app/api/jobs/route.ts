import { NextRequest } from "next/server";
import { isPreviewMode, requireUserWithOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractIdempotencyKey, validateIdempotencyKey } from "@/lib/idempotency";
import { enqueueRenderJob } from "@/services/queue/enqueue";
import { getEquipmentById } from "@/services/equipment/catalog";
import { httpError } from "@/lib/errors";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { prescreenPrompt } from "@/lib/moderation";
import { planConfig } from "@/services/billing/plans";
import {
  getPeriodRenderCount,
  getOrgDailySpendUsd,
  getGlobalDailySpendUsd,
} from "@/lib/usage";

function envFloat(name: string, fallback: number): number {
  const parsed = parseFloat(process.env[name] ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const { user, org } = await requireUserWithOrg();
    const ip = clientIp(request);

    const idempotencyKey = extractIdempotencyKey(request);
    if (!validateIdempotencyKey(idempotencyKey)) {
      return httpError("Missing or invalid X-Idempotency-Key header (must be a UUID v4)", 400);
    }

    const body = await request.json();
    const { source_image_url, user_prompt, equipment_id, force_generate, quality, project_id } = body;

    if (!source_image_url || !user_prompt?.trim()) {
      return httpError("Missing source_image_url or user_prompt", 400);
    }

    // ── Abuse & cost gates (skipped in local preview mode) ──────────────────
    if (!isPreviewMode()) {
      // 1. Rate limit — per-user and per-IP
      const rate = await checkRateLimit("jobs", user.id, ip);
      if (!rate.ok) {
        return Response.json(
          {
            error: "Too many renders at once. Please wait a moment and try again.",
            code: "rate_limited",
            retry_after_sec: rate.retryAfterSec,
          },
          { status: 429, headers: { "Retry-After": String(rate.retryAfterSec ?? 60) } }
        );
      }

      // 2. Paused account (daily circuit-breaker tripped earlier)
      if (org.paused_at) {
        return httpError(
          "Your account is paused pending review. Contact support to restore access.",
          403,
          "account_paused"
        );
      }

      // 3. Global daily cost cap
      const globalCap = envFloat("GLOBAL_DAILY_COST_CAP_USD", 20);
      const globalSpend = await getGlobalDailySpendUsd();
      if (globalSpend >= globalCap) {
        console.error(
          `[circuit-breaker] GLOBAL daily spend $${globalSpend.toFixed(2)} >= cap $${globalCap} — refusing new jobs`
        );
        return httpError(
          "Renders are temporarily paused. Please try again later.",
          503,
          "global_budget_paused"
        );
      }

      // 4. Plan render cap — the primary dollar gate
      const plan = planConfig(org.plan);
      const limit = org.render_limit || plan.renderLimit;
      const used = await getPeriodRenderCount(org);
      if (used >= limit) {
        return Response.json(
          {
            error: `You've used all ${limit} renders on the ${plan.label} plan this month.`,
            code: "render_limit_reached",
            plan: org.plan,
            used,
            limit,
          },
          { status: 402 }
        );
      }

      // 5. Per-org daily spend ceiling — auto-pause and flag for review
      const orgSpend = await getOrgDailySpendUsd(org.id);
      if (orgSpend >= plan.dailyCostCeilingUsd) {
        await prisma.organization.update({
          where: { id: org.id },
          data: {
            paused_at: new Date(),
            pause_reason: `daily_cost_ceiling_exceeded: $${orgSpend.toFixed(4)} >= $${plan.dailyCostCeilingUsd} (${org.plan})`,
          },
        });
        console.error(
          `[circuit-breaker] org ${org.id} auto-paused: daily spend $${orgSpend.toFixed(4)} >= ceiling $${plan.dailyCostCeilingUsd}`
        );
        return httpError(
          "Your account hit its daily usage ceiling and is paused pending review.",
          403,
          "account_paused"
        );
      }

      // 6. CAPTCHA for free-tier submits (no card on file)
      if (org.plan === "free") {
        const captchaOk = await verifyTurnstileToken(body.turnstile_token, ip);
        if (!captchaOk) {
          return httpError("Verification failed. Please try again.", 403, "turnstile_failed");
        }
      }

      // 7. Free keyword prescreen (the real gate is Claude's content_flag in the worker)
      const prescreen = prescreenPrompt(String(user_prompt));
      if (!prescreen.ok) {
        return httpError(prescreen.reason, 400, "moderation_blocked");
      }
    }

    // Optionally verify equipment if provided
    const equipment = equipment_id ? await getEquipmentById(equipment_id) : null;
    if (equipment_id && (!equipment || !equipment.is_active)) {
      return httpError("Equipment not found", 404);
    }

    // Optionally verify the project belongs to this org
    if (project_id) {
      const project = await prisma.project.findUnique({
        where: { id: project_id },
        select: { org_id: true, owner_id: true },
      });
      if (!project || (project.org_id !== org.id && project.owner_id !== user.id)) {
        return httpError("Project not found", 404);
      }
    }

    // Idempotency check
    const existing = await prisma.renderJob.findUnique({
      where: { idempotency_key: idempotencyKey },
      select: { id: true, status: true },
    });

    if (existing && existing.status !== "failed") {
      return Response.json(
        { jobId: existing.id, status: existing.status },
        { status: 200 }
      );
    }

    const job = await prisma.renderJob.create({
      data: {
        idempotency_key: idempotencyKey,
        user_id: user.id,
        equipment_id: equipment_id ?? null,
        project_id: project_id ?? null,
        user_prompt: user_prompt.trim(),
        force_generate: force_generate === true,
        source_image_url,
        status: "queued",
      },
    });

    // Background: respond immediately instead of holding this request open for
    // the full analyze phase; the job page poller tracks progress from here.
    await enqueueRenderJob(job.id, idempotencyKey, 1, quality ?? "final", {
      background: true,
    });

    return Response.json({ jobId: job.id, status: "queued" }, { status: 201 });
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    console.error("[jobs POST]", err);
    return httpError("Failed to create job", 500);
  }
}

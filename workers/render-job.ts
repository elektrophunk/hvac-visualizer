import { prisma } from "@/lib/prisma";
import { analyzeImage } from "@/services/vision/analyze";
import {
  submitGenerationJob,
  checkGenerationStatus,
  fetchGenerationResult,
  falCostUsd,
  falEndpoint,
  DRAFT_STEPS,
  FINAL_STEPS,
} from "@/services/generation/fal";
import { queueAdapter } from "@/services/queue/vercel-queue-adapter";
import {
  uploadBlob,
  analysisJsonPath,
  renderResultPath,
} from "@/services/storage/blob";
import { computeCostUsd, logJobEvent } from "@/services/observability/metrics";
import sharp from "sharp";
import { watermarkIfRequired } from "@/services/images/watermark";
import { notifyRenderComplete } from "@/services/email/notify";
import { placementConstraintSuffix } from "@/services/vision/placement-rules";
import { nearestAspectRatio, resizeToSourceDims } from "@/services/images/aspect";
import type { FailureReason } from "@/types/jobs";

const BACKOFF_MS: Record<number, number> = { 2: 5_000, 3: 25_000 };
const MAX_ATTEMPTS = 3;
const MAX_POLL_ATTEMPTS = 10;
const POLL_DELAY_MS = 30_000;
const CLAUDE_ESTIMATED_COST_USD = 0.022;

export interface RenderJobPayload {
  jobId: string;
  attempt: number;
  phase: "analyze" | "poll";
  falRequestId?: string;
  pollAttempt?: number;
  quality?: "draft" | "final";
}

async function acquireAdvisoryLock(jobId: string): Promise<boolean> {
  const result = await prisma.$queryRaw<[{ acquired: boolean }]>`
    SELECT pg_try_advisory_xact_lock(
      ('x' || md5(${jobId}))::bit(64)::bigint
    ) AS acquired
  `;
  return result[0]?.acquired ?? false;
}

// ── Phase A: Claude analysis + fal submission ─────────────────────────────────

async function runAnalyzePhase(payload: RenderJobPayload): Promise<void> {
  const { jobId, attempt, quality } = payload;
  const inferenceSteps = quality === "draft" ? DRAFT_STEPS : FINAL_STEPS;
  const jobStart = Date.now();

  const acquired = await acquireAdvisoryLock(jobId);
  if (!acquired) return;

  const job = await prisma.renderJob.findUnique({
    where: { id: jobId },
    include: { equipment: { select: { prompt_description: true, category: true } } },
  });

  if (!job) return;
  if (job.status === "completed" || (job.status === "failed" && job.poison_message)) return;

  const queueLatencyMs = jobStart - job.queued_at.getTime();

  await prisma.renderJob.update({
    where: { id: jobId },
    data: {
      status: "processing",
      attempt_count: attempt,
      started_at: new Date(),
      queue_latency_ms: queueLatencyMs,
    },
  });

  let failureReason: FailureReason = "UNKNOWN";

  try {
    // ── Budget guard ────────────────────────────────────────────────────────
    const totalEstimate = CLAUDE_ESTIMATED_COST_USD + falCostUsd();
    const cap = parseFloat(process.env.RENDER_BUDGET_CAP_USD ?? "0.40");
    if (totalEstimate > cap) {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          failed_at: new Date(),
          last_failure_reason: "UNKNOWN",
          failure_detail: "render_budget_exceeded",
          poison_message: true,
        },
      });
      logJobEvent({ jobId, userId: job.user_id, status: "failed", attempt_count: attempt, failure_reason: "UNKNOWN" });
      return;
    }

    // ── Step 1: Fetch source image ──────────────────────────────────────────
    const sourceRes = await fetch(job.source_image_url);
    if (!sourceRes.ok) {
      failureReason = "STORAGE_ERROR";
      throw new Error("Failed to fetch source image");
    }
    const sourceBuffer = Buffer.from(await sourceRes.arrayBuffer());
    const mimeType = sourceRes.headers.get("content-type") ?? "image/jpeg";

    // Source dimensions drive the aspect ratio sent to fal and the exact-size
    // lock on finalize, so the render is never cropped or reframed.
    const sourceMeta = await sharp(sourceBuffer).metadata();
    const sourceWidth = sourceMeta.width ?? null;
    const sourceHeight = sourceMeta.height ?? null;
    const aspectRatio =
      sourceWidth && sourceHeight ? nearestAspectRatio(sourceWidth, sourceHeight) : undefined;
    if (sourceWidth && sourceHeight) {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: { source_image_width_px: sourceWidth, source_image_height_px: sourceHeight },
      });
    }

    // ── Step 2: Claude vision ───────────────────────────────────────────────
    const visionStart = Date.now();
    let analysisOutput;
    try {
      analysisOutput = await analyzeImage(
        sourceBuffer,
        mimeType,
        job.user_prompt,
        job.equipment?.prompt_description ?? null,
        job.equipment?.category ?? null
      );
    } catch (err) {
      failureReason = "CLAUDE_JSON_INVALID";
      throw err;
    }
    const visionLatencyMs = Date.now() - visionStart;
    const claudeCostUsd = computeCostUsd(analysisOutput.inputTokens, analysisOutput.outputTokens);

    // ── Step 3: Store analysis JSON ─────────────────────────────────────────
    const { url: analysisJsonUrl } = await uploadBlob(
      analysisJsonPath(jobId),
      Buffer.from(JSON.stringify(analysisOutput.result)),
      { contentType: "application/json" }
    );

    // ── Step 4: Moderation gate — NSFW/abusive/off-domain requests never
    // reach fal. Terminal failure, no retry (Claude already saw prompt+image).
    if (analysisOutput.result.content_flag !== "ok") {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          failed_at: new Date(),
          last_failure_reason: "MODERATION_BLOCKED",
          failure_detail:
            analysisOutput.result.flag_reason ?? analysisOutput.result.content_flag,
          poison_message: true,
          analysis_json_url: analysisJsonUrl,
          vision_latency_ms: visionLatencyMs,
          input_tokens: analysisOutput.inputTokens,
          output_tokens: analysisOutput.outputTokens,
          cost_usd: claudeCostUsd,
        },
      });
      logJobEvent({ jobId, userId: job.user_id, status: "moderation_blocked", attempt_count: attempt, vision_latency_ms: visionLatencyMs, cost_usd: claudeCostUsd, failure_reason: "MODERATION_BLOCKED" });
      return;
    }

    // ── Step 5: Viability gate ──────────────────────────────────────────────
    if (!analysisOutput.result.request_viable && !job.force_generate) {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          completed_at: new Date(),
          placement_viable: false,
          result_url: null,
          analysis_json_url: analysisJsonUrl,
          vision_latency_ms: visionLatencyMs,
          input_tokens: analysisOutput.inputTokens,
          output_tokens: analysisOutput.outputTokens,
          cost_usd: claudeCostUsd,
        },
      });
      // No Render row here — an empty result_image_url gives the dashboard a
      // broken render view. The job page shows the not-viable card instead.
      logJobEvent({ jobId, userId: job.user_id, status: "not_viable", attempt_count: attempt, vision_latency_ms: visionLatencyMs, cost_usd: claudeCostUsd });
      return;
    }

    if (!analysisOutput.result.request_viable && job.force_generate) {
      console.warn(`[render-job] force_generate=true for job ${jobId} with request_viable=false`);
    }

    // ── Step 6: Submit to fal ───────────────────────────────────────────────
    // Reinforce the non-negotiable installation physics deterministically, so
    // the exact category's orientation/environment rules reach fal even if
    // Claude's enriched_prompt under-specified them. Category comes from the
    // selected equipment, falling back to Claude's classification.
    // A remove-only edit has no new unit to constrain; add/replace both do.
    const placementCategory = job.equipment?.category ?? analysisOutput.result.detected_category;
    const finalPrompt =
      placementCategory && analysisOutput.result.edit_intent !== "remove"
        ? analysisOutput.result.enriched_prompt + placementConstraintSuffix(placementCategory)
        : analysisOutput.result.enriched_prompt;

    let falRequestId: string;
    try {
      falRequestId = await submitGenerationJob(
        job.source_image_url,
        finalPrompt,
        inferenceSteps,
        { aspectRatio }
      );
    } catch (err) {
      failureReason = "FAL_API_ERROR";
      throw err;
    }

    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        status: "awaiting_fal_result",
        fal_request_id: falRequestId,
        analysis_json_url: analysisJsonUrl,
        vision_latency_ms: visionLatencyMs,
        input_tokens: analysisOutput.inputTokens,
        output_tokens: analysisOutput.outputTokens,
      },
    });

    logJobEvent({
      jobId,
      userId: job.user_id,
      status: "awaiting_fal_result",
      attempt_count: attempt,
      vision_latency_ms: visionLatencyMs,
      input_tokens: analysisOutput.inputTokens,
      output_tokens: analysisOutput.outputTokens,
      model_endpoint: falEndpoint(),
      fal_cost_usd: falCostUsd(),
    });

    await queueAdapter.enqueuePollJob({
      jobId,
      falRequestId,
      pollAttempt: 1,
      delayMs: POLL_DELAY_MS,
    });

  } catch (err) {
    const isMaxed = attempt >= MAX_ATTEMPTS;
    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        attempt_count: attempt,
        last_failure_reason: failureReason,
        failure_detail: (err as Error).message,
        ...(isMaxed ? { status: "failed", failed_at: new Date(), poison_message: true } : {}),
      },
    });

    logJobEvent({ jobId, userId: job?.user_id ?? "unknown", status: isMaxed ? "failed" : "retrying", attempt_count: attempt, failure_reason: failureReason });

    if (!isMaxed) {
      const delayMs = BACKOFF_MS[attempt + 1] ?? 5_000;
      await queueAdapter.requeueWithDelay({ jobId, attempt: attempt + 1, delayMs });
    } else {
      await queueAdapter.recordDeadLetter(jobId, failureReason);
    }

    throw err;
  }
}

// ── Phase B: Poll fal result ──────────────────────────────────────────────────

async function runPollPhase(payload: RenderJobPayload): Promise<void> {
  const { jobId, pollAttempt = 1, falRequestId } = payload;

  if (!falRequestId) throw new Error("falRequestId missing in poll payload");

  const jobStart = Date.now();

  const acquired = await acquireAdvisoryLock(jobId);
  if (!acquired) return;

  const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "completed" || (job.status === "failed" && job.poison_message)) return;

  // Poll timeout
  if (pollAttempt > MAX_POLL_ATTEMPTS) {
    await prisma.renderJob.update({
      where: { id: jobId },
      data: { status: "failed", failed_at: new Date(), last_failure_reason: "TIMEOUT", poison_message: true },
    });
    logJobEvent({ jobId, userId: job.user_id, status: "failed", attempt_count: job.attempt_count, failure_reason: "TIMEOUT" });
    await queueAdapter.recordDeadLetter(jobId, "TIMEOUT");
    return;
  }

  let falStatus;
  try {
    falStatus = await checkGenerationStatus(falRequestId);
  } catch (err) {
    // Re-enqueue to try again (status check error is likely transient)
    await queueAdapter.enqueuePollJob({ jobId, falRequestId, pollAttempt: pollAttempt + 1, delayMs: POLL_DELAY_MS });
    return;
  }

  if (falStatus === "IN_QUEUE" || falStatus === "IN_PROGRESS") {
    await queueAdapter.enqueuePollJob({ jobId, falRequestId, pollAttempt: pollAttempt + 1, delayMs: POLL_DELAY_MS });
    return;
  }

  if (falStatus === "FAILED") {
    const attempt = job.attempt_count;
    const isMaxed = attempt >= MAX_ATTEMPTS;
    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        last_failure_reason: "FAL_API_ERROR",
        failure_detail: "fal.ai generation failed",
        ...(isMaxed ? { status: "failed", failed_at: new Date(), poison_message: true } : {}),
      },
    });
    if (!isMaxed) {
      await queueAdapter.requeueWithDelay({ jobId, attempt: attempt + 1, delayMs: BACKOFF_MS[attempt + 1] ?? 5_000 });
    } else {
      await queueAdapter.recordDeadLetter(jobId, "FAL_API_ERROR");
    }
    return;
  }

  // COMPLETED — fetch, upload, finalize
  try {
    const generationStart = Date.now();
    let resultBuffer = await fetchGenerationResult(falRequestId);
    const generationLatencyMs = Date.now() - generationStart;

    // Lock the result to the exact source dimensions — no crop, and a
    // pixel-aligned before/after. fill (not cover) never crops.
    resultBuffer = await resizeToSourceDims(
      resultBuffer,
      job.source_image_width_px,
      job.source_image_height_px
    );

    // Free-tier watermark (non-fatal; paid plans pass through unchanged)
    resultBuffer = await watermarkIfRequired(resultBuffer, job.user_id);

    const { url: resultUrl } = await uploadBlob(
      renderResultPath(jobId),
      resultBuffer,
      { contentType: "image/jpeg" }
    );

    const totalLatencyMs = Date.now() - jobStart + (job.queue_latency_ms ?? 0) + (job.vision_latency_ms ?? 0);
    const claudeCostUsd = computeCostUsd(job.input_tokens ?? 0, job.output_tokens ?? 0);
    const totalCostUsd = claudeCostUsd + falCostUsd();

    const [, render] = await prisma.$transaction([
      prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          completed_at: new Date(),
          result_url: resultUrl,
          placement_viable: true,
          generation_latency_ms: generationLatencyMs,
          total_latency_ms: totalLatencyMs,
          fal_cost_usd: falCostUsd(),
          cost_usd: totalCostUsd,
        },
      }),
      prisma.render.create({
        data: {
          job_id: jobId,
          user_id: job.user_id,
          source_image_url: job.source_image_url,
          result_image_url: resultUrl,
          analysis_json_url: job.analysis_json_url ?? undefined,
        },
      }),
    ]);

    await notifyRenderComplete(job.user_id, render.id);

    logJobEvent({
      jobId,
      userId: job.user_id,
      status: "completed",
      attempt_count: job.attempt_count,
      generation_latency_ms: generationLatencyMs,
      total_latency_ms: totalLatencyMs,
      input_tokens: job.input_tokens ?? undefined,
      output_tokens: job.output_tokens ?? undefined,
      cost_usd: totalCostUsd,
      fal_cost_usd: falCostUsd(),
      model_endpoint: falEndpoint(),
      equipment_id: job.equipment_id ?? undefined,
    });
  } catch (err) {
    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        failed_at: new Date(),
        last_failure_reason: "STORAGE_ERROR",
        failure_detail: (err as Error).message,
      },
    });
    throw err;
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export async function processRenderJob(payload: RenderJobPayload): Promise<void> {
  if (payload.phase === "poll") {
    await runPollPhase(payload);
  } else {
    await runAnalyzePhase(payload);
  }
}

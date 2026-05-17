import { prisma } from "@/lib/prisma";
import { analyzeImage } from "@/services/vision/analyze";
import { composite } from "@/services/compositing/composite";
import { queueAdapter } from "@/services/queue/vercel-queue-adapter";
import {
  uploadBlob,
  analysisJsonPath,
  renderResultPath,
} from "@/services/storage/blob";
import { getEquipmentById, buildEquipmentSpec } from "@/services/equipment/catalog";
import { computeCostUsd, logJobEvent } from "@/services/observability/metrics";
import type { FailureReason } from "@/types/jobs";

const BACKOFF_MS: Record<number, number> = { 2: 5_000, 3: 25_000 };
const MAX_ATTEMPTS = 3;

export interface RenderJobPayload {
  jobId: string;
  attempt: number;
}

// Deterministic bigint lock key from job UUID (MD5 hex → first 16 hex chars → BigInt)
function lockKey(jobId: string): string {
  // Postgres advisory lock key: use hashtext equivalent via job id length+chars
  // We'll pass this as a raw SQL parameter
  return jobId;
}

export async function processRenderJob(payload: RenderJobPayload): Promise<void> {
  const { jobId, attempt } = payload;
  const jobStart = Date.now();

  // Acquire advisory lock to prevent duplicate processing
  // Uses pg_try_advisory_xact_lock with deterministic bigint from UUID
  const lockResult = await prisma.$queryRaw<[{ acquired: boolean }]>`
    SELECT pg_try_advisory_xact_lock(
      ('x' || md5(${jobId}))::bit(64)::bigint
    ) AS acquired
  `;

  if (!lockResult[0]?.acquired) {
    // Lock not acquired — another worker is processing this job
    return;
  }

  const job = await prisma.renderJob.findUnique({
    where: { id: jobId },
    include: { equipment: true },
  });

  if (!job) return;
  if (job.status === "completed" || (job.status === "failed" && job.poison_message)) {
    return; // stale message
  }

  const queuedAt = job.queued_at.getTime();
  const queueLatencyMs = jobStart - queuedAt;

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
    // ── Step 1: Fetch source image ──────────────────────────────────────────
    const sourceRes = await fetch(job.source_image_url);
    if (!sourceRes.ok) throw Object.assign(new Error("Failed to fetch source image"), { reason: "STORAGE_ERROR" as FailureReason });
    const sourceBuffer = Buffer.from(await sourceRes.arrayBuffer());
    const mimeType = sourceRes.headers.get("content-type") ?? "image/jpeg";

    const equipment = await getEquipmentById(job.equipment_id);
    if (!equipment) throw new Error("Equipment not found");

    const equipmentSpec = buildEquipmentSpec(equipment);

    // ── Step 2: Claude Vision analysis ─────────────────────────────────────
    const visionStart = Date.now();
    let analysisOutput;
    try {
      analysisOutput = await analyzeImage(sourceBuffer, mimeType, equipmentSpec);
    } catch (err) {
      failureReason = "CLAUDE_JSON_INVALID";
      throw err;
    }
    const visionLatencyMs = Date.now() - visionStart;

    // ── Step 3: Store analysis JSON ─────────────────────────────────────────
    const analysisJson = JSON.stringify(analysisOutput.result);
    const { url: analysisJsonUrl } = await uploadBlob(
      analysisJsonPath(jobId),
      Buffer.from(analysisJson),
      { contentType: "application/json" }
    );

    // ── Step 4: Fetch equipment PNG ─────────────────────────────────────────
    const equipRes = await fetch(equipment.asset_url);
    if (!equipRes.ok) throw Object.assign(new Error("Failed to fetch equipment PNG"), { reason: "STORAGE_ERROR" as FailureReason });
    const equipmentBuffer = Buffer.from(await equipRes.arrayBuffer());

    // ── Step 5: Composite ───────────────────────────────────────────────────
    const compositeStart = Date.now();
    let finalPng: Buffer;
    try {
      finalPng = await composite({
        sourceBuffer,
        equipmentBuffer,
        analysis: analysisOutput.result,
        naturalEquipmentW: equipment.natural_width_px,
        naturalEquipmentH: equipment.natural_height_px,
      });
    } catch (err) {
      failureReason = "COMPOSITE_ERROR";
      throw err;
    }
    const compositeLatencyMs = Date.now() - compositeStart;

    // ── Step 6: Upload final render ─────────────────────────────────────────
    const { url: resultUrl } = await uploadBlob(
      renderResultPath(jobId),
      finalPng,
      { contentType: "image/png" }
    );

    const totalLatencyMs = Date.now() - jobStart;
    const costUsd = computeCostUsd(
      analysisOutput.inputTokens,
      analysisOutput.outputTokens
    );

    // ── Step 7: Persist result & create Render record ───────────────────────
    await prisma.$transaction([
      prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          completed_at: new Date(),
          result_url: resultUrl,
          analysis_json_url: analysisJsonUrl,
          placement_viable: analysisOutput.result.placement_viable,
          vision_latency_ms: visionLatencyMs,
          composite_latency_ms: compositeLatencyMs,
          total_latency_ms: totalLatencyMs,
          input_tokens: analysisOutput.inputTokens,
          output_tokens: analysisOutput.outputTokens,
          cost_usd: costUsd,
        },
      }),
      prisma.render.create({
        data: {
          job_id: jobId,
          user_id: job.user_id,
          source_image_url: job.source_image_url,
          result_image_url: resultUrl,
          analysis_json_url: analysisJsonUrl,
        },
      }),
    ]);

    logJobEvent({
      jobId,
      userId: job.user_id,
      status: "completed",
      attempt_count: attempt,
      queue_latency_ms: queueLatencyMs,
      vision_latency_ms: visionLatencyMs,
      composite_latency_ms: compositeLatencyMs,
      total_latency_ms: totalLatencyMs,
      input_tokens: analysisOutput.inputTokens,
      output_tokens: analysisOutput.outputTokens,
      cost_usd: costUsd,
      equipment_id: job.equipment_id,
    });
  } catch (err) {
    const isMaxed = attempt >= MAX_ATTEMPTS;
    const now = new Date();

    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        attempt_count: attempt,
        last_failure_reason: failureReason,
        failure_detail: (err as Error).message,
        ...(isMaxed
          ? { status: "failed", failed_at: now, poison_message: true }
          : {}),
      },
    });

    logJobEvent({
      jobId,
      userId: job?.user_id ?? "unknown",
      status: isMaxed ? "failed" : "retrying",
      attempt_count: attempt,
      failure_reason: failureReason,
      equipment_id: job?.equipment_id,
    });

    if (!isMaxed) {
      const delayMs = BACKOFF_MS[attempt + 1] ?? 5_000;
      await queueAdapter.requeueWithDelay({ jobId, attempt: attempt + 1, delayMs });
    } else {
      await queueAdapter.recordDeadLetter(jobId, failureReason);
    }

    // Re-throw so the caller (queue consumer) knows the attempt failed
    throw err;
  }
}

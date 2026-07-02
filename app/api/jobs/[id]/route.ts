import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";
import type { JobStatusResponse } from "@/types/jobs";
import {
  checkGenerationStatus,
  fetchGenerationResult,
  falCostUsd,
  falEndpoint,
} from "@/services/generation/fal";
import { uploadBlob, renderResultPath } from "@/services/storage/blob";
import { computeCostUsd, logJobEvent } from "@/services/observability/metrics";

const ESTIMATED_WAIT_MS = 45_000;

async function tryCompleteAwaitingJob(jobId: string, falRequestId: string): Promise<void> {
  const falStatus = await checkGenerationStatus(falRequestId);
  console.log(`[fal] job=${jobId} requestId=${falRequestId.slice(0, 8)}… status=${falStatus}`);

  if (falStatus === "FAILED") {
    await prisma.renderJob.update({
      where: { id: jobId },
      data: { status: "failed", failed_at: new Date(), last_failure_reason: "FAL_API_ERROR" },
    });
    return;
  }

  if (falStatus !== "COMPLETED") return; // Still in progress — client polls again in 5s

  const resultBuffer = await fetchGenerationResult(falRequestId);
  const { url: resultUrl } = await uploadBlob(renderResultPath(jobId), resultBuffer, {
    contentType: "image/jpeg",
  });

  const job = await prisma.renderJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const claudeCostUsd = computeCostUsd(job.input_tokens ?? 0, job.output_tokens ?? 0);
  const totalCostUsd = claudeCostUsd + falCostUsd();

  try {
    await prisma.$transaction([
      prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          completed_at: new Date(),
          result_url: resultUrl,
          placement_viable: true,
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

    logJobEvent({
      jobId,
      userId: job.user_id,
      status: "completed",
      attempt_count: job.attempt_count,
      cost_usd: totalCostUsd,
      fal_cost_usd: falCostUsd(),
      model_endpoint: falEndpoint(),
    });
  } catch (err) {
    const msg = (err as Error).message ?? "";
    // Unique constraint = already finalized by a concurrent poll — safe to ignore
    if (!msg.includes("Unique constraint")) {
      await prisma.renderJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          failed_at: new Date(),
          last_failure_reason: "STORAGE_ERROR",
          failure_detail: msg,
        },
      });
    }
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const selectFields = {
      id: true,
      user_id: true,
      status: true,
      attempt_count: true,
      queued_at: true,
      started_at: true,
      completed_at: true,
      result_url: true,
      last_failure_reason: true,
      placement_viable: true,
      analysis_json_url: true,
      fal_request_id: true,
    } as const;

    let job = await prisma.renderJob.findUnique({ where: { id }, select: selectFields });

    if (!job) return httpError("Job not found", 404);
    if (job.user_id !== user.id) return httpError("Forbidden", 403);

    // Eagerly check fal and finalize — works in local dev where queue delays don't fire
    if (job.status === "awaiting_fal_result" && job.fal_request_id) {
      try {
        await tryCompleteAwaitingJob(job.id, job.fal_request_id);
        job = (await prisma.renderJob.findUnique({ where: { id }, select: selectFields })) ?? job;
      } catch (err) {
        console.error("[status] tryCompleteAwaitingJob failed:", (err as Error).message);
      }
    }

    // Surface Claude's reasoning on not-viable placements so the UI can show it
    let viabilityReason: string | null = null;
    if (job.placement_viable === false && job.analysis_json_url) {
      try {
        const res = await fetch(job.analysis_json_url);
        if (res.ok) {
          const analysis = (await res.json()) as { viability_reason?: string };
          viabilityReason = analysis.viability_reason ?? null;
        }
      } catch {
        // Non-fatal — the UI copes with a null reason
      }
    }

    const response: JobStatusResponse = {
      jobId: job.id,
      status: job.status,
      attempt_count: job.attempt_count,
      queued_at: job.queued_at.toISOString(),
      started_at: job.started_at?.toISOString() ?? null,
      completed_at: job.completed_at?.toISOString() ?? null,
      result_url: job.result_url,
      failure_reason: job.last_failure_reason,
      placement_viable: job.placement_viable,
      analysis_json_url: job.analysis_json_url,
      viability_reason: viabilityReason,
      estimated_wait_ms: ESTIMATED_WAIT_MS,
    };

    return Response.json(response);
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode === 401) {
      return httpError("Unauthorized", 401);
    }
    return httpError("Failed to fetch job", 500);
  }
}

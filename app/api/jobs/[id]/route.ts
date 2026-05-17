import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { httpError } from "@/lib/errors";
import type { JobStatusResponse } from "@/types/jobs";

const ESTIMATED_WAIT_MS = 12_000;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const job = await prisma.renderJob.findUnique({
      where: { id },
      select: {
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
      },
    });

    if (!job) return httpError("Job not found", 404);
    if (job.user_id !== user.id) return httpError("Forbidden", 403);

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

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueRenderJob } from "@/services/queue/enqueue";
import { queueAdapter } from "@/services/queue/vercel-queue-adapter";
import { httpError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return httpError("Unauthorized", 401);
  }

  const staleThreshold = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
  const queuedThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

  // 1. Jobs stuck mid-analyze (worker died during Phase A)
  const stuckProcessing = await prisma.renderJob.findMany({
    where: {
      status: "processing",
      started_at: { lt: staleThreshold },
      poison_message: false,
    },
    select: { id: true, idempotency_key: true, attempt_count: true },
  });

  // 2. Jobs whose poll chain died (after() callback lost between poll hops)
  const stuckAwaiting = await prisma.renderJob.findMany({
    where: {
      status: "awaiting_fal_result",
      fal_request_id: { not: null },
      updated_at: { lt: staleThreshold },
      poison_message: false,
    },
    select: { id: true, fal_request_id: true },
  });

  // 3. Jobs created but never picked up (background enqueue send died)
  const stuckQueued = await prisma.renderJob.findMany({
    where: {
      status: "queued",
      queued_at: { lt: queuedThreshold },
      started_at: null,
      poison_message: false,
    },
    select: { id: true, idempotency_key: true, attempt_count: true },
  });

  const requeued: string[] = [];
  const repolled: string[] = [];

  for (const job of [...stuckProcessing, ...stuckQueued]) {
    try {
      await enqueueRenderJob(
        job.id,
        job.idempotency_key,
        job.attempt_count + 1
      );
      requeued.push(job.id);
    } catch (err) {
      console.error(`[watchdog] Failed to requeue job ${job.id}:`, err);
    }
  }

  for (const job of stuckAwaiting) {
    try {
      await queueAdapter.enqueuePollJob({
        jobId: job.id,
        falRequestId: job.fal_request_id as string,
        pollAttempt: 1,
        delayMs: 0,
      });
      repolled.push(job.id);
    } catch (err) {
      console.error(`[watchdog] Failed to re-poll job ${job.id}:`, err);
    }
  }

  const total =
    stuckProcessing.length + stuckAwaiting.length + stuckQueued.length;
  console.log(
    `[watchdog] stuck=${total} requeued=${requeued.join(",")} repolled=${repolled.join(",")}`
  );
  return Response.json({ requeued, repolled, total });
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueRenderJob } from "@/services/queue/enqueue";
import { httpError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return httpError("Unauthorized", 401);
  }

  const stuckThreshold = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago

  const stuckJobs = await prisma.renderJob.findMany({
    where: {
      status: "processing",
      started_at: { lt: stuckThreshold },
    },
    select: { id: true, idempotency_key: true, attempt_count: true },
  });

  const requeued: string[] = [];
  for (const job of stuckJobs) {
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

  console.log(`[watchdog] Found ${stuckJobs.length} stuck jobs, requeued: ${requeued.join(", ")}`);
  return Response.json({ requeued, total: stuckJobs.length });
}

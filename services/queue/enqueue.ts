import { queueAdapter } from "./vercel-queue-adapter";

export async function enqueueRenderJob(
  jobId: string,
  idempotencyKey: string,
  attempt = 1
): Promise<void> {
  await queueAdapter.enqueueRenderJob({ jobId, idempotencyKey, attempt });
}

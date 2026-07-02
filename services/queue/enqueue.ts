import { queueAdapter } from "./vercel-queue-adapter";

export async function enqueueRenderJob(
  jobId: string,
  idempotencyKey: string,
  attempt = 1,
  quality: "draft" | "final" = "final",
  options: { background?: boolean } = {}
): Promise<void> {
  await queueAdapter.enqueueRenderJob({
    jobId,
    idempotencyKey,
    attempt,
    quality,
    background: options.background,
  });
}

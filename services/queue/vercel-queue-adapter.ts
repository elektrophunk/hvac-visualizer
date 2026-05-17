import type { QueueAdapter, EnqueuePayload, RequeuePayload } from "./adapter";
import { prisma } from "@/lib/prisma";

const QUEUE_URL = process.env.VERCEL_QUEUE_URL ?? "/api/webhooks/queue";
const QUEUE_TOKEN = process.env.VERCEL_QUEUE_TOKEN ?? "";

async function sendToQueue(
  payload: object,
  delayMs?: number
): Promise<void> {
  const body: Record<string, unknown> = { ...payload };
  if (delayMs) body._delayMs = delayMs;

  const res = await fetch(QUEUE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${QUEUE_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Queue enqueue failed: ${res.status} ${await res.text()}`);
  }
}

export class VercelQueueAdapter implements QueueAdapter {
  async enqueueRenderJob(payload: EnqueuePayload): Promise<void> {
    await sendToQueue({
      jobId: payload.jobId,
      idempotencyKey: payload.idempotencyKey,
      attempt: payload.attempt ?? 1,
    });
  }

  async requeueWithDelay(payload: RequeuePayload): Promise<void> {
    await sendToQueue(
      {
        jobId: payload.jobId,
        attempt: payload.attempt,
      },
      payload.delayMs
    );
  }

  async recordDeadLetter(jobId: string, reason: string): Promise<void> {
    await prisma.renderJob.update({
      where: { id: jobId },
      data: {
        poison_message: true,
        failure_detail: `Dead-lettered: ${reason}`,
      },
    });
  }
}

// Singleton — swap this export for BullMQAdapter when migrating
export const queueAdapter: QueueAdapter = new VercelQueueAdapter();

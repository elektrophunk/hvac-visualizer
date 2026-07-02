import { after } from "next/server";
import type { QueueAdapter, EnqueuePayload, RequeuePayload, PollPayload } from "./adapter";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const QUEUE_URL = process.env.VERCEL_QUEUE_URL ?? `${BASE_URL}/api/webhooks/queue`;
const QUEUE_TOKEN = process.env.VERCEL_QUEUE_TOKEN ?? "";

async function postToQueue(payload: object): Promise<void> {
  const res = await fetch(QUEUE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${QUEUE_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Queue enqueue failed: ${res.status} ${await res.text()}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Runs a task after the current response is sent. On Vercel, after() maps to
// waitUntil() and keeps the function alive — a plain setTimeout would be frozen
// the moment the response goes out, silently killing the poll chain.
function scheduleBackground(task: () => Promise<void>, label: string): void {
  const run = () =>
    task().catch((err) => console.error(`[queue] ${label} failed:`, err));
  try {
    after(run);
  } catch {
    // Not in a request scope (scripts, tests) — plain fire-and-forget.
    void run();
  }
}

async function sendToQueue(
  payload: object,
  delayMs?: number
): Promise<void> {
  if (delayMs && delayMs > 0) {
    scheduleBackground(async () => {
      await sleep(delayMs);
      await postToQueue(payload);
    }, "delayed send");
    return;
  }
  await postToQueue(payload);
}

export class VercelQueueAdapter implements QueueAdapter {
  async enqueueRenderJob(payload: EnqueuePayload): Promise<void> {
    const message = {
      phase: "analyze",
      jobId: payload.jobId,
      idempotencyKey: payload.idempotencyKey,
      attempt: payload.attempt ?? 1,
      quality: payload.quality ?? "final",
    };
    if (payload.background) {
      // Don't block the caller's response on the whole analyze phase — the
      // webhook only responds after Phase A completes (~15-25s). Orphans
      // (background send dies) are recovered by the watchdog cron.
      scheduleBackground(() => postToQueue(message), "background enqueue");
      return;
    }
    await sendToQueue(message);
  }

  async requeueWithDelay(payload: RequeuePayload): Promise<void> {
    await sendToQueue(
      {
        phase: "analyze",
        jobId: payload.jobId,
        attempt: payload.attempt,
      },
      payload.delayMs
    );
  }

  async enqueuePollJob(payload: PollPayload): Promise<void> {
    await sendToQueue(
      {
        phase: "poll",
        jobId: payload.jobId,
        falRequestId: payload.falRequestId,
        pollAttempt: payload.pollAttempt,
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

export interface EnqueuePayload {
  jobId: string;
  idempotencyKey: string;
  attempt?: number;
  quality?: "draft" | "final";
  // Enqueue after the response is sent instead of awaiting the webhook
  // round-trip (which blocks until Phase A finishes).
  background?: boolean;
}

export interface RequeuePayload {
  jobId: string;
  attempt: number;
  delayMs: number;
}

export interface PollPayload {
  jobId: string;
  falRequestId: string;
  pollAttempt: number;
  delayMs: number;
}

export interface QueueAdapter {
  enqueueRenderJob(payload: EnqueuePayload): Promise<void>;
  requeueWithDelay(payload: RequeuePayload): Promise<void>;
  enqueuePollJob(payload: PollPayload): Promise<void>;
  // Persists dead-letter metadata to DB only — Vercel Queue has no app-accessible DLQ
  recordDeadLetter(jobId: string, reason: string): Promise<void>;
}

export interface EnqueuePayload {
  jobId: string;
  idempotencyKey: string;
  attempt?: number;
}

export interface RequeuePayload {
  jobId: string;
  attempt: number;
  delayMs: number;
}

export interface QueueAdapter {
  enqueueRenderJob(payload: EnqueuePayload): Promise<void>;
  requeueWithDelay(payload: RequeuePayload): Promise<void>;
  // Persists dead-letter metadata to DB only — Vercel Queue has no app-accessible DLQ
  recordDeadLetter(jobId: string, reason: string): Promise<void>;
}

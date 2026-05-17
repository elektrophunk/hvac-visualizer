import type { FailureReason } from "@/types/jobs";

export interface JobMetrics {
  jobId: string;
  userId: string;
  status: string;
  attempt_count: number;
  queue_latency_ms?: number;
  vision_latency_ms?: number;
  composite_latency_ms?: number;
  total_latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  failure_reason?: FailureReason;
  equipment_id?: string;
}

export function computeCostUsd(inputTokens: number, outputTokens: number): number {
  // claude-3-5-sonnet: $3.00/MTok input, $15.00/MTok output
  const inputCost = (inputTokens / 1_000_000) * 3.0;
  const outputCost = (outputTokens / 1_000_000) * 15.0;
  return inputCost + outputCost;
}

export function logJobEvent(metrics: JobMetrics) {
  const entry = {
    ts: new Date().toISOString(),
    ...metrics,
  };

  if (process.env.NODE_ENV === "production" && process.env.AXIOM_API_TOKEN) {
    // Fire-and-forget to Axiom — don't await so it never blocks a request
    fetch(`https://api.axiom.co/v1/datasets/${process.env.AXIOM_DATASET}/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AXIOM_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([entry]),
    }).catch(() => {
      // Observability must never throw
    });
  } else {
    console.log("[job-event]", JSON.stringify(entry));
  }
}

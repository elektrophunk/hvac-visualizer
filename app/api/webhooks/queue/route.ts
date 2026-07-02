import { NextRequest } from "next/server";
import { processRenderJob } from "@/workers/render-job";
import { httpError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = process.env.VERCEL_QUEUE_TOKEN ?? "";
  if (!token) {
    // Fail closed outside development — an unauthenticated queue webhook lets
    // anyone drive the paid worker pipeline.
    if (process.env.NODE_ENV !== "development") {
      console.error("[queue-consumer] VERCEL_QUEUE_TOKEN is not configured");
      return httpError("Queue token not configured", 500);
    }
  } else if (auth !== `Bearer ${token}`) {
    return httpError("Unauthorized", 401);
  }

  let body: {
    jobId: string;
    attempt?: number;
    phase?: "analyze" | "poll";
    falRequestId?: string;
    pollAttempt?: number;
    quality?: "draft" | "final";
  };
  try {
    body = await request.json();
  } catch {
    return httpError("Invalid JSON", 400);
  }

  const { jobId, attempt = 1, phase = "analyze", falRequestId, pollAttempt, quality } = body;
  if (!jobId) return httpError("Missing jobId", 400);

  try {
    await processRenderJob({ jobId, attempt, phase, falRequestId, pollAttempt, quality });
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`[queue-consumer] job=${jobId} phase=${phase}`, err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { processRenderJob } from "@/workers/render-job";
import { httpError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  // In production Vercel Queue sets this header; in dev we check it too
  const auth = request.headers.get("authorization");
  const token = process.env.VERCEL_QUEUE_TOKEN ?? "";
  if (token && auth !== `Bearer ${token}`) {
    return httpError("Unauthorized", 401);
  }

  let body: { jobId: string; attempt?: number };
  try {
    body = await request.json();
  } catch {
    return httpError("Invalid JSON", 400);
  }

  const { jobId, attempt = 1 } = body;
  if (!jobId) return httpError("Missing jobId", 400);

  try {
    await processRenderJob({ jobId, attempt });
    return Response.json({ ok: true });
  } catch (err) {
    // Log the error but return 200 if max attempts exhausted (worker handles terminal state)
    // Return non-2xx to trigger Vercel Queue platform retry for unexpected errors
    console.error(`[queue-consumer] job=${jobId} attempt=${attempt}`, err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

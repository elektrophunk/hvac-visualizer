import { fal } from "@fal-ai/client";

function configureFal() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("[FAL_API_ERROR] FAL_KEY environment variable is not set");
  fal.config({ credentials: key });
}

export type FalStatus = "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export function falEndpoint(): string {
  const tier = process.env.FAL_MODEL_TIER ?? "max";
  // "max" → fal-ai/flux-pro/kontext/max; anything else → fal-ai/flux-pro/kontext (base)
  return tier === "max" ? "fal-ai/flux-pro/kontext/max" : "fal-ai/flux-pro/kontext";
}

export function falCostUsd(): number {
  return parseFloat(process.env.FAL_COST_PER_IMAGE_USD ?? "0.055");
}

function isPublicUrl(url: string): boolean {
  return url.startsWith("https://") && !url.includes("localhost");
}

async function resolveImageUrl(sourceImageUrl: string): Promise<string> {
  if (isPublicUrl(sourceImageUrl)) return sourceImageUrl;

  // Not a public URL — upload to fal storage so the model can access it
  const res = await fetch(sourceImageUrl);
  if (!res.ok) throw new Error(`[FAL_API_ERROR] Failed to fetch source image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const blob = new Blob([buffer]);
  const uploaded = await fal.storage.upload(blob);
  return uploaded;
}

export const DRAFT_STEPS = 8;
export const FINAL_STEPS = 28;

export async function submitGenerationJob(
  sourceImageUrl: string,
  enrichedPrompt: string,
  numInferenceSteps = FINAL_STEPS
): Promise<string> {
  configureFal();
  try {
    const resolvedUrl = await resolveImageUrl(sourceImageUrl);
    const result = await fal.queue.submit(falEndpoint(), {
      input: {
        prompt: enrichedPrompt,
        image_url: resolvedUrl,
        num_inference_steps: numInferenceSteps,
      },
    });
    return result.request_id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("[FAL_API_ERROR]")) throw err;
    throw new Error(`[FAL_API_ERROR] Submit failed: ${msg}`);
  }
}

export async function checkGenerationStatus(falRequestId: string): Promise<FalStatus> {
  configureFal();
  try {
    const status = await fal.queue.status(falEndpoint(), {
      requestId: falRequestId,
      logs: false,
    });
    return status.status as FalStatus;
  } catch (err) {
    throw new Error(`[FAL_API_ERROR] Status check failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function fetchGenerationResult(falRequestId: string): Promise<Buffer> {
  configureFal();
  try {
    const result = await fal.queue.result(falEndpoint(), { requestId: falRequestId });
    const data = (result as { data?: { images?: Array<{ url: string }> } }).data ?? result;
    const images = (data as { images?: Array<{ url: string }> }).images;
    const imageUrl = images?.[0]?.url;
    if (!imageUrl) throw new Error("No image in fal result");

    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to download fal result: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[FAL_API_ERROR] Result fetch failed: ${msg}`);
  }
}

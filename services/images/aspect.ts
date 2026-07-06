import sharp from "sharp";

// fal Kontext accepts only a fixed enum of aspect ratios (no "match input"),
// so we map the source photo to the nearest allowed bucket to minimize the
// reframing, then lock the final result back to the exact source dimensions.

export const FAL_ASPECT_RATIOS = [
  "21:9",
  "16:9",
  "4:3",
  "3:2",
  "1:1",
  "2:3",
  "3:4",
  "9:16",
  "9:21",
] as const;

export type FalAspectRatio = (typeof FAL_ASPECT_RATIOS)[number];

const RATIO_VALUES: Array<{ label: FalAspectRatio; ratio: number }> = FAL_ASPECT_RATIOS.map(
  (label) => {
    const [w, h] = label.split(":").map(Number);
    return { label, ratio: w / h };
  }
);

// Returns the allowed bucket whose width/height ratio is closest to the source.
export function nearestAspectRatio(width: number, height: number): FalAspectRatio {
  if (!width || !height) return "1:1";
  const target = width / height;
  let best = RATIO_VALUES[0];
  let bestDiff = Infinity;
  for (const candidate of RATIO_VALUES) {
    const diff = Math.abs(candidate.ratio - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return best.label;
}

// Locks a render result to the exact source pixel dimensions so the output is
// never cropped and the before/after slider aligns edge-to-edge. `fit: "fill"`
// never crops (the aspect bucket was already matched, so any rescale is tiny).
// Non-fatal: on any failure the original buffer is returned unchanged.
export async function resizeToSourceDims(
  buffer: Buffer,
  width: number | null,
  height: number | null
): Promise<Buffer> {
  if (!width || !height) return buffer;
  try {
    return await sharp(buffer)
      .resize(width, height, { fit: "fill" })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (err) {
    console.warn("[aspect] resizeToSourceDims failed, using original:", (err as Error).message);
    return buffer;
  }
}

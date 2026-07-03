import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { planConfig } from "@/services/billing/plans";

const WATERMARK_TEXT = "Made with HVAC Visualizer";

// Whether the job owner's org plan requires a watermark. Missing org means
// the account predates org activation — treat as free.
export async function shouldWatermark(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { org: { select: { plan: true } } },
  });
  const plan = user?.org?.plan ?? "free";
  return planConfig(plan).features.watermark;
}

// Composites a semi-transparent corner badge onto the bottom-right of the
// image and returns a JPEG buffer. Badge scales with image width.
export async function applyWatermark(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer);
  const meta = await image.metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 768;

  const fontSize = Math.max(14, Math.min(28, Math.round(width * 0.022)));
  const padX = Math.round(fontSize * 0.9);
  const padY = Math.round(fontSize * 0.55);
  const textWidth = Math.round(WATERMARK_TEXT.length * fontSize * 0.56);
  const badgeWidth = textWidth + padX * 2;
  const badgeHeight = fontSize + padY * 2;
  const margin = Math.round(fontSize * 0.8);

  const svg = `<svg width="${badgeWidth}" height="${badgeHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${badgeWidth}" height="${badgeHeight}" rx="${Math.round(badgeHeight / 2)}" fill="rgba(15,23,42,0.62)"/>
  <text x="${badgeWidth / 2}" y="${badgeHeight / 2}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="600" fill="rgba(255,255,255,0.92)" text-anchor="middle" dominant-baseline="central">${WATERMARK_TEXT}</text>
</svg>`;

  return image
    .composite([
      {
        input: Buffer.from(svg),
        left: Math.max(0, width - badgeWidth - margin),
        top: Math.max(0, height - badgeHeight - margin),
      },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}

// Non-fatal wrapper for the finalize paths: a watermark failure must never
// fail a render the user already paid latency for.
export async function watermarkIfRequired(buffer: Buffer, userId: string): Promise<Buffer> {
  try {
    if (await shouldWatermark(userId)) {
      return await applyWatermark(buffer);
    }
  } catch (err) {
    console.warn("[watermark] failed, using original image:", (err as Error).message);
  }
  return buffer;
}

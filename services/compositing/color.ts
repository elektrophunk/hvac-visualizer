import sharp from "sharp";

// Sample the average RGB of the region under the bounding box
async function sampleRegionColorTemp(
  sourceBuffer: Buffer,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<number> {
  const { data } = await sharp(sourceBuffer)
    .extract({ left: x, top: y, width: Math.max(w, 1), height: Math.max(h, 1) })
    .resize(8, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < data.length; i += 3) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
    count++;
  }
  const r = rSum / count;
  const g = gSum / count;
  const b = bSum / count;

  // Rough color temperature estimate (McCamy's approximation)
  const n = (r - b) / (g || 1);
  const cct = 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
  return Math.max(2000, Math.min(10000, cct));
}

// Apply a color temperature tint to bring equipment PNG closer to scene lighting
export async function matchColorTemperature(
  equipmentBuffer: Buffer,
  sourceBuffer: Buffer,
  bboxX: number,
  bboxY: number,
  bboxW: number,
  bboxH: number
): Promise<Buffer> {
  const sceneCct = await sampleRegionColorTemp(
    sourceBuffer,
    bboxX,
    bboxY,
    bboxW,
    bboxH
  );

  // Neutral equipment is assumed at ~6500K.
  // Shift: warm scene (< 5000K) → add red/reduce blue; cool scene (> 7000K) → add blue/reduce red.
  const diff = sceneCct - 6500; // negative = warmer than neutral
  const warmShift = Math.max(-30, Math.min(30, -diff / 50));

  if (Math.abs(warmShift) < 3) return equipmentBuffer; // close enough, skip

  // Apply tint via linear color adjustment
  return sharp(equipmentBuffer)
    .modulate({
      brightness: 1,
      saturation: 1,
      hue: warmShift > 0 ? 5 : -5,
    })
    .png()
    .toBuffer();
}

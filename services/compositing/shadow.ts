import sharp from "sharp";

export async function generateShadowLayer(
  equipmentBuffer: Buffer,
  blurRadius: number,
  opacity: number = 0.4
): Promise<Buffer> {
  // Get equipment dimensions after any resize/transform
  const { width = 100, height = 100 } = await sharp(equipmentBuffer).metadata();

  // Create a black rectangle the same size as the equipment PNG
  const shadow = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: Math.round(opacity * 255) },
    },
  })
    .blur(blurRadius)
    .png()
    .toBuffer();

  return shadow;
}

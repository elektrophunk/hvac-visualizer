import sharp from "sharp";
import type { AnalysisResult, Placement } from "@/types/analysis";
import {
  deriveShear,
  deriveScaledDimensions,
  shadowBlurFromBand,
} from "./transform";
import { generateShadowLayer } from "./shadow";
import { matchColorTemperature } from "./color";

interface CompositeInput {
  sourceBuffer: Buffer;
  equipmentBuffer: Buffer;
  analysis: AnalysisResult;
  naturalEquipmentW: number;
  naturalEquipmentH: number;
}

async function compositeWithPlacement(
  sourceBuffer: Buffer,
  equipmentBuffer: Buffer,
  placement: Placement,
  naturalW: number,
  naturalH: number,
  sceneDescription: string
): Promise<Buffer> {
  const sourceMeta = await sharp(sourceBuffer).metadata();
  const srcW = sourceMeta.width ?? analysis_width_fallback(placement);
  const srcH = sourceMeta.height ?? analysis_height_fallback(placement);

  // 1. Translate normalized bbox → pixel coordinates
  const pixelX = Math.round(placement.bounding_box.x * srcW);
  const pixelY = Math.round(placement.bounding_box.y * srcH);
  const pixelW = Math.max(20, Math.round(placement.bounding_box.w * srcW));
  const pixelH = Math.max(20, Math.round(placement.bounding_box.h * srcH));

  // 2. Determine resize strategy
  const { width: resizeW, height: resizeH, fit } = deriveScaledDimensions(
    pixelW,
    pixelH,
    naturalW,
    naturalH
  );

  // 3. Apply rotation from placement hint
  let processedEquipment = sharp(equipmentBuffer);
  if (Math.abs(placement.rotation_hint_deg) > 0.5) {
    processedEquipment = processedEquipment.rotate(placement.rotation_hint_deg, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  // 4. Resize to bounding box
  processedEquipment = processedEquipment.resize(resizeW, resizeH, {
    fit: fit === "fill" ? "fill" : "inside",
    withoutEnlargement: false,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  // 5. Apply perspective shear
  const shear = deriveShear(placement, sceneDescription);
  if (shear.shearX !== 0 || shear.shearY !== 0) {
    processedEquipment = processedEquipment.affine(
      [1, shear.shearX, shear.shearY, 1],
      { background: { r: 0, g: 0, b: 0, alpha: 0 }, interpolator: "nohalo" }
    );
  }

  let equipBuf = await processedEquipment.png().toBuffer();
  const { width: finalW = pixelW, height: finalH = pixelH } = await sharp(equipBuf).metadata();

  // 6. Color temperature matching
  equipBuf = await matchColorTemperature(
    equipBuf,
    sourceBuffer,
    pixelX,
    pixelY,
    pixelW,
    pixelH
  );

  // 7. Generate shadow layer
  const blurRadius = shadowBlurFromBand(placement.distance_band);
  const shadowBuf = await generateShadowLayer(equipBuf, blurRadius, 0.4);

  const shadowOffsetX = 4;
  const shadowOffsetY = 4;

  // 8. Composite: source → shadow → equipment
  const result = await sharp(sourceBuffer)
    .composite([
      {
        input: shadowBuf,
        left: Math.max(0, pixelX + shadowOffsetX),
        top: Math.max(0, pixelY + shadowOffsetY),
        blend: "multiply",
      },
      {
        input: equipBuf,
        left: pixelX,
        top: pixelY,
      },
    ])
    .png()
    .toBuffer();

  return result;
}

function analysis_width_fallback(p: Placement): number {
  return Math.round(1 / p.bounding_box.w);
}
function analysis_height_fallback(p: Placement): number {
  return Math.round(1 / p.bounding_box.h);
}

export async function composite(input: CompositeInput): Promise<Buffer> {
  const placement = input.analysis.placements[0]; // always use rank-1

  const result = await compositeWithPlacement(
    input.sourceBuffer,
    input.equipmentBuffer,
    placement,
    input.naturalEquipmentW,
    input.naturalEquipmentH,
    input.analysis.scene.description
  );

  // If placement was not viable, add a notice overlay
  if (!input.analysis.placement_viable) {
    return addFallbackNotice(result);
  }

  return result;
}

async function addFallbackNotice(imageBuffer: Buffer): Promise<Buffer> {
  const { width = 800, height = 600 } = await sharp(imageBuffer).metadata();
  const bannerH = 48;

  const bannerSvg = `<svg width="${width}" height="${bannerH}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${bannerH}" fill="rgba(0,0,0,0.65)" rx="4"/>
    <text x="${width / 2}" y="30" font-family="Arial,sans-serif" font-size="15" fill="white" text-anchor="middle">
      No optimal placement found — this render shows a suggested fallback position. Review with your customer.
    </text>
  </svg>`;

  return sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(bannerSvg),
        top: height - bannerH - 12,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}

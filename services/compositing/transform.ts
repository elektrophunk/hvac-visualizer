import type { Placement } from "@/types/analysis";

export interface ShearParams {
  shearX: number;
  shearY: number;
}

// Heuristic: parse scene description for wall direction cues
export function deriveShear(
  placement: Placement,
  sceneDescription: string
): ShearParams {
  if (placement.mount_surface !== "wall") return { shearX: 0, shearY: 0 };

  const desc = sceneDescription.toLowerCase();
  const magnitude = 0.12 + (placement.confidence - 0.5) * 0.04; // 0.10–0.14 range

  if (desc.includes("left wall") || desc.includes("angled left")) {
    return { shearX: -magnitude, shearY: 0 };
  }
  if (desc.includes("right wall") || desc.includes("angled right")) {
    return { shearX: magnitude, shearY: 0 };
  }
  return { shearX: 0, shearY: 0 };
}

export interface ScaledDimensions {
  width: number;
  height: number;
  fit: "fill" | "inside";
}

export function deriveScaledDimensions(
  bboxPixelW: number,
  bboxPixelH: number,
  naturalW: number,
  naturalH: number
): ScaledDimensions {
  const bboxRatio = bboxPixelW / bboxPixelH;
  const equipRatio = naturalW / naturalH;
  const ratioDiff = Math.abs(bboxRatio - equipRatio) / equipRatio;

  if (ratioDiff < 0.2) {
    return { width: bboxPixelW, height: bboxPixelH, fit: "fill" };
  }
  return { width: bboxPixelW, height: bboxPixelH, fit: "inside" };
}

export function shadowBlurFromBand(band: "near" | "mid" | "far"): number {
  return band === "near" ? 12 : band === "mid" ? 8 : 4;
}

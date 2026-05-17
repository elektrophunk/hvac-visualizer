import { z } from "zod";
import type { AnalysisResult } from "@/types/analysis";

const BoundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

const PlacementSchema = z.object({
  rank: z.number().int().min(1).max(3),
  confidence: z.number().min(0).max(1),
  occlusion_risk: z.enum(["low", "medium", "high"]),
  mount_surface: z.enum(["wall", "ceiling", "floor"]),
  rotation_hint_deg: z.number().min(-45).max(45),
  distance_band: z.enum(["near", "mid", "far"]),
  reason: z.string().min(1).max(300),
  bounding_box: BoundingBoxSchema,
});

export const AnalysisResultSchema = z.object({
  scene: z.object({
    width_px: z.number().int().positive(),
    height_px: z.number().int().positive(),
    description: z.string().min(1).max(500),
  }),
  placements: z.array(PlacementSchema).min(1).max(3),
  alternate_placements_required: z.boolean(),
  placement_viable: z.boolean(),
  schema_version: z.literal("1.0"),
});

export type ValidatedAnalysis = z.infer<typeof AnalysisResultSchema>;

function coercePlacement(p: Record<string, unknown>): Record<string, unknown> {
  const coerced = { ...p };

  // Clamp confidence
  if (typeof coerced.confidence === "number") {
    coerced.confidence = Math.max(0, Math.min(1, coerced.confidence));
  }

  // Normalize enum strings
  if (typeof coerced.occlusion_risk === "string") {
    coerced.occlusion_risk = coerced.occlusion_risk.toLowerCase();
  }
  if (typeof coerced.mount_surface === "string") {
    coerced.mount_surface = coerced.mount_surface.toLowerCase();
  }
  if (typeof coerced.distance_band === "string") {
    coerced.distance_band = coerced.distance_band.toLowerCase();
  }

  // Fix bounding box geometry
  if (coerced.bounding_box && typeof coerced.bounding_box === "object") {
    const bb = coerced.bounding_box as Record<string, number>;
    if (bb.x + bb.w > 1) bb.w = 1 - bb.x;
    if (bb.y + bb.h > 1) bb.h = 1 - bb.y;
    if (bb.w < 0.03) bb.w = 0.15; // fallback to reasonable width
    if (bb.h < 0.02) bb.h = 0.08; // fallback to reasonable height
    coerced.bounding_box = bb;
  }

  return coerced;
}

export function validateAnalysis(raw: unknown): AnalysisResult {
  // Tier 2: Zod validate — if fails, attempt coercion
  const first = AnalysisResultSchema.safeParse(raw);
  if (first.success) return first.data as AnalysisResult;

  // Coerce and retry
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.placements)) {
      obj.placements = obj.placements.map(coercePlacement);
    }
    // Strip unknown top-level keys
    const stripped = {
      scene: obj.scene,
      placements: obj.placements,
      alternate_placements_required: obj.alternate_placements_required,
      placement_viable: obj.placement_viable,
      schema_version: obj.schema_version,
    };
    const second = AnalysisResultSchema.safeParse(stripped);
    if (second.success) return second.data as AnalysisResult;
  }

  throw new Error(
    `Analysis validation failed: ${first.error.issues.map((i) => i.message).join(", ")}`
  );
}

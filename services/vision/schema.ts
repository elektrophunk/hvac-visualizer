import { z } from "zod";
import { EquipmentCategory } from "@prisma/client";
import type { AnalysisResult } from "@/types/analysis";

export const AnalysisResultSchema = z.object({
  scene: z.object({
    description: z.string().min(1).max(600),
    room_type: z.string().min(1).max(100),
    lighting: z.enum(["bright", "dim", "natural", "artificial"]),
  }),
  request_viable: z.boolean(),
  viability_reason: z.string().min(1).max(400),
  enriched_prompt: z.string().min(10).max(1000),
  content_flag: z.enum(["ok", "nsfw_or_abusive", "off_domain"]),
  flag_reason: z.string().max(300).optional(),
  // Prisma-generated enum keeps this in sync with the catalog automatically
  detected_category: z.nativeEnum(EquipmentCategory),
  schema_version: z.literal("2.2"),
});

const ALLOWED_KEYS = new Set([
  "scene", "request_viable", "viability_reason", "enriched_prompt",
  "content_flag", "flag_reason", "detected_category", "schema_version",
]);

export function validateAnalysis(raw: unknown): AnalysisResult {
  const first = AnalysisResultSchema.safeParse(raw);
  if (first.success) return first.data as AnalysisResult;

  // Strip unknown top-level keys and retry
  if (raw !== null && typeof raw === "object") {
    const stripped = Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(([k]) => ALLOWED_KEYS.has(k))
    );
    const second = AnalysisResultSchema.safeParse(stripped);
    if (second.success) return second.data as AnalysisResult;
  }

  throw new Error(
    `Vision schema validation failed: ${first.error.issues.map((i) => i.message).join(", ")}`
  );
}

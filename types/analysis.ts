import type { EquipmentCategory } from "@/types/equipment";

export interface SceneInfo {
  description: string;
  room_type: string;
  lighting: "bright" | "dim" | "natural" | "artificial";
}

export type ContentFlag = "ok" | "nsfw_or_abusive" | "off_domain";

// Whether the request adds new equipment, replaces existing equipment, or
// only removes it — inferred by Claude from the natural-language prompt.
export type EditIntent = "add" | "replace" | "remove";

export interface AnalysisResult {
  scene: SceneInfo;
  request_viable: boolean;
  viability_reason: string;
  enriched_prompt: string;
  content_flag: ContentFlag;
  flag_reason?: string;
  // Claude's classification of the requested equipment — drives the
  // deterministic placement constraint when no equipment_id was selected.
  detected_category: EquipmentCategory;
  edit_intent: EditIntent;
  schema_version: "2.3";
}

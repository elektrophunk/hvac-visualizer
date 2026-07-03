export interface SceneInfo {
  description: string;
  room_type: string;
  lighting: "bright" | "dim" | "natural" | "artificial";
}

export type ContentFlag = "ok" | "nsfw_or_abusive" | "off_domain";

export interface AnalysisResult {
  scene: SceneInfo;
  request_viable: boolean;
  viability_reason: string;
  enriched_prompt: string;
  content_flag: ContentFlag;
  flag_reason?: string;
  schema_version: "2.1";
}

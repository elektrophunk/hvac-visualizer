export interface SceneInfo {
  description: string;
  room_type: string;
  lighting: "bright" | "dim" | "natural" | "artificial";
}

export interface AnalysisResult {
  scene: SceneInfo;
  request_viable: boolean;
  viability_reason: string;
  enriched_prompt: string;
  schema_version: "2.0";
}

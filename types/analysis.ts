export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Placement {
  rank: number;
  confidence: number;
  occlusion_risk: "low" | "medium" | "high";
  mount_surface: "wall" | "ceiling" | "floor";
  rotation_hint_deg: number;
  distance_band: "near" | "mid" | "far";
  reason: string;
  bounding_box: BoundingBox;
}

export interface SceneInfo {
  width_px: number;
  height_px: number;
  description: string;
}

export interface AnalysisResult {
  scene: SceneInfo;
  placements: Placement[];
  alternate_placements_required: boolean;
  placement_viable: boolean;
  schema_version: "1.0";
}

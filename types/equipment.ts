export type EquipmentCategory =
  | "mini_split_head"
  | "mini_split_condenser"
  | "central_air_handler"
  | "furnace"
  | "heat_pump_condenser"
  | "boiler"
  | "ductless_cassette"
  | "ventilator"
  | "other";

export interface EquipmentMetadata {
  scale_hint: number;
  typical_height_fraction: number;
  color_temp_k: number;
  shear_hint: "neutral" | "left" | "right";
}

export interface Equipment {
  id: string;
  name: string;
  slug: string;
  category: EquipmentCategory;
  manufacturer: string;
  model_number: string | null;
  btu_rating: number | null;
  asset_url: string;
  asset_version: string;
  thumbnail_url: string | null;
  natural_width_px: number;
  natural_height_px: number;
  metadata: EquipmentMetadata;
  is_active: boolean;
}

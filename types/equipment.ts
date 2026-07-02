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

export interface Equipment {
  id: string;
  name: string;
  slug: string;
  category: EquipmentCategory;
  manufacturer: string | null;
  model_number: string | null;
  btu_rating: number | null;
  thumbnail_url: string | null;
  prompt_description: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
}

export type EquipmentCategory =
  // Ductless
  | "mini_split_head"
  | "ductless_cassette"
  | "mini_split_condenser"
  | "ducted_mini_split"
  | "floor_mount_mini_split"
  | "ceiling_suspended_mini_split"
  // Central cooling
  | "heat_pump_condenser"
  | "central_air_handler"
  | "evaporator_coil"
  | "packaged_unit"
  | "window_ac"
  | "ptac"
  // Heating
  | "furnace"
  | "boiler"
  | "baseboard_heater"
  | "radiator"
  | "unit_heater"
  // Water heating
  | "gas_water_heater"
  | "tankless_water_heater"
  // Ventilation & air quality
  | "ventilator"
  | "exhaust_fan"
  | "whole_house_humidifier"
  | "whole_house_dehumidifier"
  | "air_cleaner"
  // Commercial
  | "rooftop_unit"
  | "vrf_outdoor"
  | "vrf_branch_box"
  | "air_handling_unit"
  | "fan_coil_unit"
  | "air_cooled_chiller"
  | "water_cooled_chiller"
  | "cooling_tower"
  | "makeup_air_unit"
  // Infrastructure
  | "ductwork"
  | "refrigerant_lineset"
  // Fallback
  | "other";

// Grouping for the /new equipment picker (system-type sections).
export type EquipmentGroup =
  | "Ductless"
  | "Cooling"
  | "Heating"
  | "Water Heating"
  | "Ventilation"
  | "Commercial"
  | "Infrastructure"
  | "Other";

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

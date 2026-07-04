import type { EquipmentCategory, EquipmentGroup } from "@/types/equipment";

// Friendly display names (single source — also used by prisma/seed.ts).
export const EQUIPMENT_NAMES: Record<EquipmentCategory, string> = {
  mini_split_head: "Mini-Split Head",
  ductless_cassette: "Ceiling Cassette",
  mini_split_condenser: "Mini-Split Condenser",
  ducted_mini_split: "Ducted Mini-Split",
  floor_mount_mini_split: "Floor Console Mini-Split",
  ceiling_suspended_mini_split: "Ceiling-Suspended Mini-Split",
  heat_pump_condenser: "Heat Pump Condenser",
  central_air_handler: "Air Handler",
  evaporator_coil: "Evaporator Coil",
  packaged_unit: "Packaged Unit (Gas-Pack)",
  window_ac: "Window AC",
  ptac: "PTAC",
  furnace: "Gas Furnace",
  boiler: "Boiler",
  baseboard_heater: "Baseboard Heater",
  radiator: "Radiator",
  unit_heater: "Unit Heater",
  gas_water_heater: "Gas Water Heater",
  tankless_water_heater: "Tankless Water Heater",
  ventilator: "HRV/ERV Ventilator",
  exhaust_fan: "Exhaust Fan",
  whole_house_humidifier: "Whole-House Humidifier",
  whole_house_dehumidifier: "Whole-House Dehumidifier",
  air_cleaner: "Air Cleaner / UV",
  rooftop_unit: "Rooftop Unit (RTU)",
  vrf_outdoor: "VRF Outdoor Unit",
  vrf_branch_box: "VRF Branch Box",
  air_handling_unit: "Air Handling Unit (AHU)",
  fan_coil_unit: "Fan Coil Unit",
  air_cooled_chiller: "Air-Cooled Chiller",
  water_cooled_chiller: "Water-Cooled Chiller",
  cooling_tower: "Cooling Tower",
  makeup_air_unit: "Make-Up Air Unit",
  ductwork: "Ductwork",
  refrigerant_lineset: "Refrigerant Line Set",
  other: "Other / Custom",
};

// Picker grouping (system-type sections).
export const EQUIPMENT_GROUPS: Record<EquipmentCategory, EquipmentGroup> = {
  mini_split_head: "Ductless",
  ductless_cassette: "Ductless",
  mini_split_condenser: "Ductless",
  ducted_mini_split: "Ductless",
  floor_mount_mini_split: "Ductless",
  ceiling_suspended_mini_split: "Ductless",
  heat_pump_condenser: "Cooling",
  central_air_handler: "Cooling",
  evaporator_coil: "Cooling",
  packaged_unit: "Cooling",
  window_ac: "Cooling",
  ptac: "Cooling",
  furnace: "Heating",
  boiler: "Heating",
  baseboard_heater: "Heating",
  radiator: "Heating",
  unit_heater: "Heating",
  gas_water_heater: "Water Heating",
  tankless_water_heater: "Water Heating",
  ventilator: "Ventilation",
  exhaust_fan: "Ventilation",
  whole_house_humidifier: "Ventilation",
  whole_house_dehumidifier: "Ventilation",
  air_cleaner: "Ventilation",
  rooftop_unit: "Commercial",
  vrf_outdoor: "Commercial",
  vrf_branch_box: "Commercial",
  air_handling_unit: "Commercial",
  fan_coil_unit: "Commercial",
  air_cooled_chiller: "Commercial",
  water_cooled_chiller: "Commercial",
  cooling_tower: "Commercial",
  makeup_air_unit: "Commercial",
  ductwork: "Infrastructure",
  refrigerant_lineset: "Infrastructure",
  other: "Other",
};

// Display order of the groups in the picker.
export const EQUIPMENT_GROUP_ORDER: EquipmentGroup[] = [
  "Ductless",
  "Cooling",
  "Heating",
  "Water Heating",
  "Ventilation",
  "Commercial",
  "Infrastructure",
];

// APPEARANCE only (dimensions/finish). Placement physics comes from the
// rulebook in services/vision/placement-rules.ts — keep these two separate.
export const EQUIPMENT_DEFAULT_PROMPTS: Record<EquipmentCategory, string> = {
  mini_split_head:
    "Add a white wall-mounted mini-split indoor head unit (approximately 30 inches wide by 10 inches tall, slim rectangular profile with horizontal louvered vents along the bottom edge)",
  ductless_cassette:
    "Add a ceiling-recessed ductless cassette unit (square white panel approximately 24 inches by 24 inches with louvered vents on all four sides)",
  mini_split_condenser:
    "Add a white outdoor mini-split condenser unit (approximately 30 inches wide by 24 inches tall, rectangular box with a front grille)",
  ducted_mini_split:
    "Add a concealed slim-duct mini-split air handler (low-profile light-grey metal cabinet) with a slim linear supply grille visible in the ceiling",
  floor_mount_mini_split:
    "Add a floor-mounted mini-split console (white low rectangular unit approximately 24 inches wide by 22 inches tall)",
  ceiling_suspended_mini_split:
    "Add a ceiling-suspended mini-split (long slim white unit approximately 40 inches wide) surface-mounted just below the ceiling",
  heat_pump_condenser:
    "Add an outdoor heat pump condenser unit (approximately 35 inches wide by 35 inches tall, beige or grey square cabinet with a top fan grille)",
  central_air_handler:
    "Add a vertical central air handler unit (approximately 18 inches wide by 48 inches tall, light grey metal cabinet with supply/return connections)",
  evaporator_coil:
    "Add a cased evaporator A-coil (light grey sheet-metal plenum box approximately 18 inches wide) sitting atop the furnace",
  packaged_unit:
    "Add a residential packaged gas-pack unit (large beige/grey all-in-one metal cabinet approximately 4 feet long)",
  window_ac:
    "Add a window air conditioner (white boxy unit with a front vent grille and side accordion panels)",
  ptac:
    "Add a PTAC unit (long low white cabinet with a front grille, approximately 42 inches wide by 16 inches tall)",
  furnace:
    "Add a natural gas furnace (approximately 18 inches wide by 42 inches tall, grey metal cabinet with a flue pipe at the top)",
  boiler:
    "Add a wall-hung boiler unit (approximately 18 inches wide by 28 inches tall, white metal cabinet with pipes below and a flue connection at the top)",
  baseboard_heater:
    "Add a hydronic baseboard heater (low white finned metal enclosure approximately 6 inches tall) running along the base of the wall",
  radiator:
    "Add a radiator (white steel panel or cast-iron sectional, approximately 24 inches tall) standing against the wall",
  unit_heater:
    "Add a suspended unit heater (compact grey box approximately 24 inches wide with a front fan grille and discharge louvers)",
  gas_water_heater:
    "Add a gas storage water heater (tall white/grey cylindrical tank approximately 18 inches in diameter by 60 inches tall with a draft hood on top)",
  tankless_water_heater:
    "Add a tankless water heater (compact white wall-mounted box approximately 18 inches wide by 28 inches tall)",
  ventilator:
    "Add an HRV/ERV ventilator unit (approximately 20 inches wide by 14 inches tall, light grey rectangular box with two circular duct connections)",
  exhaust_fan:
    "Add an exhaust fan (white flush ceiling grille approximately 10 inches square)",
  whole_house_humidifier:
    "Add a whole-house humidifier (small white unit approximately 14 inches tall) mounted on the side of the furnace plenum",
  whole_house_dehumidifier:
    "Add a whole-house dehumidifier (grey rectangular ducted cabinet approximately 25 inches wide)",
  air_cleaner:
    "Add a media air cleaner cabinet (wide low-profile metal box approximately 20 inches wide with an access door)",
  rooftop_unit:
    "Add a commercial rooftop packaged unit (large beige/grey metal cabinet approximately 6 to 10 feet long)",
  vrf_outdoor:
    "Add a VRF outdoor condensing unit (tall modular white/grey cabinet with top fan grilles)",
  vrf_branch_box:
    "Add a VRF branch selector box (small enclosed light-grey metal box with insulated refrigerant connections)",
  air_handling_unit:
    "Add a commercial air handling unit (long multi-section grey metal cabinet)",
  fan_coil_unit:
    "Add a fan coil unit (compact metal cabinet approximately 3 feet wide with a supply grille)",
  air_cooled_chiller:
    "Add an air-cooled chiller (long low metal skid unit with a row of fans across the top)",
  water_cooled_chiller:
    "Add a water-cooled chiller (large horizontal cylindrical metal cabinet)",
  cooling_tower:
    "Add a cooling tower (open-topped louvered box structure with a large fan on top)",
  makeup_air_unit:
    "Add a make-up air unit (large rooftop metal cabinet with an intake hood)",
  ductwork:
    "Add rigid galvanized sheet-metal ductwork (rectangular trunk with round branch takeoffs)",
  refrigerant_lineset:
    "Add a white line-set cover (slimduct raceway approximately 3 inches wide) concealing the refrigerant lines",
  other:
    "Add an HVAC unit appropriate for the visible space",
};

// Fallback quick-picks (used only when the catalog table is empty). The live
// picker builds from the seeded catalog and groups via EQUIPMENT_GROUPS.
const QUICK_PICK_ORDER: EquipmentCategory[] = (
  Object.keys(EQUIPMENT_NAMES) as EquipmentCategory[]
).filter((c) => c !== "other");

export const QUICK_PICK_BUTTONS: Array<{ label: string; category: EquipmentCategory }> =
  QUICK_PICK_ORDER.map((category) => ({ label: EQUIPMENT_NAMES[category], category }));

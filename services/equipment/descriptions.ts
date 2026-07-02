import type { EquipmentCategory } from "@/types/equipment";

export const EQUIPMENT_DEFAULT_PROMPTS: Record<EquipmentCategory, string> = {
  mini_split_head:
    "Add a white wall-mounted mini-split indoor head unit (approximately 30 inches wide by 10 inches tall, slim rectangular profile with horizontal louvered vents along the bottom edge) mounted high on the wall",
  mini_split_condenser:
    "Add a white outdoor mini-split condenser unit (approximately 30 inches wide by 24 inches tall, rectangular box with front grille) mounted on the exterior wall or sitting on a pad",
  central_air_handler:
    "Add a vertical central air handler unit (approximately 18 inches wide by 48 inches tall, light grey metal cabinet with supply/return connections) in the utility area",
  furnace:
    "Add a natural gas furnace (approximately 18 inches wide by 42 inches tall, grey metal cabinet with a flue pipe at the top) standing upright against the wall",
  heat_pump_condenser:
    "Add an outdoor heat pump condenser unit (approximately 35 inches wide by 35 inches tall, beige or grey square cabinet with top fan grille) sitting on a concrete pad",
  boiler:
    "Add a wall-hung boiler unit (approximately 18 inches wide by 28 inches tall, white metal cabinet with pipes below and a flue connection at the top) mounted on the wall",
  ductless_cassette:
    "Add a ceiling-recessed ductless cassette unit (square white panel approximately 24 inches by 24 inches with louvered vents on all four sides) flush-mounted in the ceiling",
  ventilator:
    "Add an HRV/ERV ventilator unit (approximately 20 inches wide by 14 inches tall, light grey rectangular box with two circular duct connections) mounted on the wall or ceiling",
  other:
    "Add an HVAC unit appropriate for the visible wall space in the room",
};

export const QUICK_PICK_BUTTONS: Array<{ label: string; category: EquipmentCategory }> = [
  { label: "Mini-Split", category: "mini_split_head" },
  { label: "Furnace", category: "furnace" },
  { label: "Outdoor Condenser", category: "heat_pump_condenser" },
  { label: "Boiler", category: "boiler" },
  { label: "Heat Pump", category: "mini_split_condenser" },
  { label: "Ceiling Cassette", category: "ductless_cassette" },
];

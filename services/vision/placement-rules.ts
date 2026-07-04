import type { EquipmentCategory } from "@/types/equipment";

// Real-world HVAC installation physics, keyed by equipment category. Sourced
// from how contractors actually mount this equipment (manufacturer install
// manuals + code clearances) — NOT appearance (that lives in prompt_description).
// This is the domain knowledge that stops the model placing a wall head unit
// vertically or an outdoor condenser indoors.

export interface PlacementRule {
  label: string;
  environment: "indoor" | "outdoor" | "utility";
  mountSurface: string;
  orientation: string;
  mountHeight: string;
  airflow: string;
  clearances: string;
  typicalLocation: string;
  // Failure modes to forbid explicitly — the model responds better to hard "never" rules
  forbidden: string[];
}

export const EQUIPMENT_PLACEMENT_RULES: Record<EquipmentCategory, PlacementRule> = {
  mini_split_head: {
    label: "Ductless mini-split indoor head unit",
    environment: "indoor",
    mountSurface: "mounted flat against a wall (interior or exterior wall)",
    orientation: "horizontal, long axis parallel to the floor, perfectly level",
    mountHeight: "high on the wall near the ceiling (about 6–7 ft up), with a few inches of clearance below the ceiling",
    airflow: "louvered vents along the bottom edge face down and outward into the room",
    clearances: "a few inches of clear wall above and to each side; unobstructed air path in front",
    typicalLocation: "a clear, unobstructed high section of wall, often above a window or door",
    forbidden: [
      "never vertical or rotated onto its short edge",
      "never tilted or angled",
      "never upside down",
      "never at floor or mid-wall height",
      "never mounted on the ceiling",
    ],
  },
  mini_split_condenser: {
    label: "Ductless mini-split outdoor condenser",
    environment: "outdoor",
    mountSurface: "sitting on a ground pad or stand, or wall-mounted on brackets, against an exterior wall",
    orientation: "upright and level",
    mountHeight: "at ground level or mounted about a foot or more off the ground on brackets",
    airflow: "front fan grille faces outward horizontally",
    clearances: "clear space in front of the fan grille; held a few inches off the wall",
    typicalLocation: "outside against the exterior wall of the building, near the ground",
    forbidden: [
      "never indoors or inside a room",
      "never on its side or tilted",
      "never upside down",
      "never floating unsupported",
    ],
  },
  heat_pump_condenser: {
    label: "Outdoor heat pump / AC condenser",
    environment: "outdoor",
    mountSurface: "sitting flat on a concrete pad on the ground",
    orientation: "upright and level, square cabinet",
    mountHeight: "at ground level on the pad",
    airflow: "top-mounted fan grille faces straight up",
    clearances: "12–24 inches of clear space on all sides and above the fan",
    typicalLocation: "outside on the ground beside the house, against or near the exterior wall",
    forbidden: [
      "never indoors or inside a room",
      "never on its side or tilted",
      "never wall-mounted (too heavy)",
      "never upside down",
    ],
  },
  central_air_handler: {
    label: "Central air handler",
    environment: "utility",
    mountSurface: "floor-standing against a wall, or horizontal on an attic platform",
    orientation: "upright vertical cabinet (or horizontal in an attic), right-side up and level",
    mountHeight: "on the floor or platform",
    airflow: "connected to supply/return ducting",
    clearances: "service clearance in front of the access panel",
    typicalLocation: "utility room, closet, basement, or attic — not in finished living space",
    forbidden: [
      "never in a finished living room or bedroom setting",
      "never tilted or upside down",
    ],
  },
  furnace: {
    label: "Gas furnace",
    environment: "utility",
    mountSurface: "floor-standing, upright against a wall",
    orientation: "vertical cabinet, upright and level, flue exiting the top",
    mountHeight: "on the floor",
    airflow: "connected to ductwork; flue vents up",
    clearances: "front service clearance for the burner access panel",
    typicalLocation: "basement, utility closet, or garage — not in finished living space",
    forbidden: [
      "never on its side or upside down",
      "never in a finished living room or bedroom setting",
    ],
  },
  boiler: {
    label: "Wall-hung boiler",
    environment: "utility",
    mountSurface: "hung flat on a wall",
    orientation: "upright and level, pipes below and flue connection at the top",
    mountHeight: "mounted on the wall at roughly chest-to-head height",
    airflow: "flue vents out; hydronic pipes run below",
    clearances: "clear space below for pipe connections and in front for service",
    typicalLocation: "utility room or basement wall",
    forbidden: [
      "never upside down or tilted",
      "never sitting on the floor",
    ],
  },
  ductless_cassette: {
    label: "Ceiling-recessed ductless cassette",
    environment: "indoor",
    mountSurface: "recessed flush into the ceiling",
    orientation: "face-down, flush with the ceiling plane, square edges aligned to the ceiling",
    mountHeight: "in the ceiling",
    airflow: "louvered vents on all four sides blow down and outward",
    clearances: "sits flush; grille flush with the ceiling surface",
    typicalLocation: "centered in an open area of the ceiling",
    forbidden: [
      "never mounted on a wall",
      "never protruding far below the ceiling or hanging",
      "never tilted",
    ],
  },
  ventilator: {
    label: "HRV/ERV ventilator",
    environment: "utility",
    mountSurface: "wall-mounted or suspended from the ceiling in a mechanical space",
    orientation: "level, with the two circular duct connections attached",
    mountHeight: "high on a utility wall or hung from the basement ceiling",
    airflow: "ducted intake and exhaust via the circular connections",
    clearances: "clear space for the duct runs and access",
    typicalLocation: "utility/mechanical room or unfinished basement ceiling — not in finished living space",
    forbidden: [
      "never in a finished living room or bedroom setting",
      "never tilted or upside down",
    ],
  },
  other: {
    label: "HVAC equipment",
    environment: "indoor",
    mountSurface: "mounted in the manner appropriate for this equipment type",
    orientation: "right-side up and level",
    mountHeight: "at the height this equipment is normally installed",
    airflow: "oriented so vents/fans face the correct direction",
    clearances: "realistic service and airflow clearance",
    typicalLocation: "a location appropriate for this equipment type",
    forbidden: ["never upside down or tilted at an unrealistic angle"],
  },
};

// Full rulebook text for the Claude system prompt (all categories).
export function renderPlacementManual(): string {
  return Object.values(EQUIPMENT_PLACEMENT_RULES)
    .map((r) => {
      return `• ${r.label} (${r.environment}): ${r.mountSurface}; ${r.orientation}; ${r.mountHeight}; airflow — ${r.airflow}; clearance — ${r.clearances}; typical location — ${r.typicalLocation}. Rules: ${r.forbidden.join("; ")}.`;
    })
    .join("\n");
}

// The single most important rule for one category, inlined into the user
// message when the contractor has selected a specific equipment type.
export function placementRuleLine(category: EquipmentCategory): string {
  const r = EQUIPMENT_PLACEMENT_RULES[category];
  return `${r.label}: ${r.mountSurface}; ${r.orientation}; ${r.mountHeight}. ${r.forbidden.join("; ")}.`;
}

// Deterministic, non-negotiable physics constraint appended to the enriched
// prompt before it goes to fal. Belt-and-suspenders against the exact failure
// modes (vertical / upside-down / wrong environment).
export function placementConstraintSuffix(category: EquipmentCategory): string {
  const r = EQUIPMENT_PLACEMENT_RULES[category];
  return ` CRITICAL PLACEMENT: the ${r.label} must be ${r.orientation}, ${r.mountSurface}, ${r.mountHeight}. ${r.forbidden.join("; ")}. Keep perspective, scale, lighting, and shadows consistent with the photo.`;
}

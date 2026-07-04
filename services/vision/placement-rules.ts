import type { EquipmentCategory } from "@/types/equipment";
import {
  type InfrastructureKey,
  INFRASTRUCTURE_RULES,
  renderInfrastructureManual,
  infrastructureConnectionText,
} from "./infrastructure-rules";

// Real-world HVAC installation physics, keyed by equipment category. Sourced
// from how contractors actually mount this equipment (manufacturer install
// manuals + code clearances) — NOT appearance (that lives in prompt_description).
// This is the domain knowledge that stops the model placing a wall head unit
// vertically or an outdoor condenser indoors, and that pulls in the correct
// connective infrastructure (line sets, flues, condensate, ductwork).

export interface PlacementRule {
  label: string;
  environment: "indoor" | "outdoor" | "utility" | "rooftop";
  mountSurface: string;
  orientation: string;
  mountHeight: string;
  airflow: string;
  clearances: string;
  typicalLocation: string;
  forbidden: string[];
  // Pipes/ducts that visibly accompany this unit in a real install
  connectedInfrastructure: InfrastructureKey[];
}

export const EQUIPMENT_PLACEMENT_RULES: Record<EquipmentCategory, PlacementRule> = {
  // ── Ductless ────────────────────────────────────────────────────────────
  mini_split_head: {
    label: "Ductless mini-split indoor head unit",
    environment: "indoor",
    mountSurface: "mounted flat against a wall",
    orientation: "horizontal, long axis parallel to the floor, perfectly level",
    mountHeight: "high on the wall near the ceiling (about 6–7 ft up), with clearance below the ceiling",
    airflow: "louvered vents along the bottom edge face down and outward into the room",
    clearances: "a few inches of clear wall above and to each side",
    typicalLocation: "a clear, unobstructed high section of wall, often above a window or door",
    forbidden: [
      "never vertical or rotated onto its short edge",
      "never tilted, angled, or upside down",
      "never at floor or mid-wall height",
      "never mounted on the ceiling",
    ],
    connectedInfrastructure: ["refrigerant_lineset", "condensate_drain"],
  },
  ductless_cassette: {
    label: "Ceiling-recessed ductless cassette",
    environment: "indoor",
    mountSurface: "recessed flush into the ceiling",
    orientation: "face-down, flush with the ceiling plane, square edges aligned to the ceiling",
    mountHeight: "in the ceiling",
    airflow: "louvered vents on all four sides blow down and outward",
    clearances: "grille flush with the ceiling surface",
    typicalLocation: "centered in an open area of the ceiling",
    forbidden: [
      "never mounted on a wall",
      "never protruding far below the ceiling or hanging",
      "never tilted",
    ],
    connectedInfrastructure: ["refrigerant_lineset", "condensate_drain"],
  },
  mini_split_condenser: {
    label: "Ductless mini-split outdoor condenser",
    environment: "outdoor",
    mountSurface: "sitting on a ground pad or stand, or wall-mounted on brackets, against an exterior wall",
    orientation: "upright and level",
    mountHeight: "at ground level or a foot or more off the ground on brackets",
    airflow: "front fan grille faces outward horizontally",
    clearances: "clear space in front of the fan grille; held a few inches off the wall",
    typicalLocation: "outside against the exterior wall, near the ground",
    forbidden: [
      "never indoors or inside a room",
      "never on its side or tilted",
      "never upside down or floating unsupported",
    ],
    connectedInfrastructure: ["refrigerant_lineset"],
  },
  ducted_mini_split: {
    label: "Concealed ducted (slim-duct) mini-split air handler",
    environment: "utility",
    mountSurface: "suspended horizontally above a dropped ceiling, in a soffit, or in an attic",
    orientation: "horizontal and level, hidden with only the grille visible",
    mountHeight: "above the ceiling / in the soffit",
    airflow: "connected to short duct runs feeding slim ceiling supply grilles",
    clearances: "service access to the unit and filter",
    typicalLocation: "concealed above a hallway or closet ceiling",
    forbidden: [
      "never fully exposed hanging in a finished room",
      "never tilted or vertical",
    ],
    connectedInfrastructure: ["ductwork", "refrigerant_lineset", "condensate_drain"],
  },
  floor_mount_mini_split: {
    label: "Floor-mounted mini-split console",
    environment: "indoor",
    mountSurface: "sitting on the floor against a wall, or mounted low on the wall just above the floor",
    orientation: "upright, level, front face into the room",
    mountHeight: "at floor level (bottom near the floor)",
    airflow: "vents on the front/top blow outward and up into the room",
    clearances: "clear floor space in front",
    typicalLocation: "low against a wall, often under a window",
    forbidden: [
      "never high on the wall (that is a wall head unit)",
      "never tilted or upside down",
    ],
    connectedInfrastructure: ["refrigerant_lineset", "condensate_drain"],
  },
  ceiling_suspended_mini_split: {
    label: "Ceiling-suspended mini-split",
    environment: "indoor",
    mountSurface: "surface-mounted flush under the ceiling (not recessed)",
    orientation: "horizontal and level, long unit running along the ceiling, discharge facing along/down into the room",
    mountHeight: "just below the ceiling",
    airflow: "long front louver directs air outward and down along the room",
    clearances: "a few inches below the ceiling",
    typicalLocation: "along a ceiling edge in a large open room",
    forbidden: [
      "never recessed into the ceiling (that is a cassette)",
      "never on a wall or tilted",
    ],
    connectedInfrastructure: ["refrigerant_lineset", "condensate_drain"],
  },
  // ── Central cooling ─────────────────────────────────────────────────────
  heat_pump_condenser: {
    label: "Outdoor heat pump / AC condenser",
    environment: "outdoor",
    mountSurface: "sitting flat on a concrete pad on the ground",
    orientation: "upright and level, square cabinet",
    mountHeight: "at ground level on the pad",
    airflow: "top-mounted fan grille faces straight up",
    clearances: "12–24 inches of clear space on all sides and above the fan",
    typicalLocation: "outside on the ground beside the house, near the exterior wall",
    forbidden: [
      "never indoors or inside a room",
      "never on its side, wall-mounted, or upside down",
    ],
    connectedInfrastructure: ["refrigerant_lineset"],
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
    connectedInfrastructure: ["ductwork", "condensate_drain"],
  },
  evaporator_coil: {
    label: "Evaporator (A-coil)",
    environment: "utility",
    mountSurface: "sitting on top of the furnace inside a plenum, or in the air handler cabinet",
    orientation: "upright A-shaped coil, level, enclosed in its cased plenum",
    mountHeight: "directly above the furnace in the supply plenum",
    airflow: "air passes up through the coil into the supply duct",
    clearances: "sealed inside the plenum with the condensate drain at the base",
    typicalLocation: "on top of the furnace in a utility/mechanical space",
    forbidden: [
      "never exposed in a finished room",
      "never inverted or on its side",
    ],
    connectedInfrastructure: ["condensate_drain", "refrigerant_lineset"],
  },
  packaged_unit: {
    label: "Residential packaged unit (gas-pack)",
    environment: "outdoor",
    mountSurface: "all-in-one cabinet on a concrete pad on the ground, or on a roof curb",
    orientation: "upright and level, large single cabinet",
    mountHeight: "ground level on the pad or on the roof",
    airflow: "supply and return air enter/leave through the bottom or side into the building",
    clearances: "clear service space around the cabinet",
    typicalLocation: "outside beside the building or on a flat roof",
    forbidden: [
      "never indoors",
      "never on its side or upside down",
    ],
    connectedInfrastructure: ["ductwork", "gas_piping"],
  },
  window_ac: {
    label: "Window air conditioner",
    environment: "indoor",
    mountSurface: "set into an open window, resting on the sill with the sash lowered onto it",
    orientation: "level side-to-side, tilted very slightly down toward the outside for drainage; front face into the room",
    mountHeight: "at the window opening",
    airflow: "front grille blows into the room; rear (outdoor) portion sheds heat outside",
    clearances: "side accordion panels fill the window gap",
    typicalLocation: "in a window opening",
    forbidden: [
      "never mounted in a solid wall with no window",
      "never upside down or tilted into the room",
    ],
    connectedInfrastructure: [],
  },
  ptac: {
    label: "PTAC (packaged terminal AC)",
    environment: "indoor",
    mountSurface: "in a through-wall sleeve at the base of an exterior wall, with an exterior grille outside",
    orientation: "upright and level, long low cabinet along the floor",
    mountHeight: "low on the wall near the floor, typically under a window",
    airflow: "front grille blows up and out into the room",
    clearances: "clear floor space in front",
    typicalLocation: "under a window on an exterior wall (hotels, apartments)",
    forbidden: [
      "never high on the wall",
      "never tilted or upside down",
    ],
    connectedInfrastructure: [],
  },
  // ── Heating ─────────────────────────────────────────────────────────────
  furnace: {
    label: "Gas furnace",
    environment: "utility",
    mountSurface: "floor-standing, upright against a wall",
    orientation: "vertical cabinet, upright and level, flue exiting the top",
    mountHeight: "on the floor",
    airflow: "connected to ductwork; flue vents up or out a sidewall",
    clearances: "front service clearance for the burner access panel",
    typicalLocation: "basement, utility closet, or garage — not in finished living space",
    forbidden: [
      "never on its side or upside down",
      "never in a finished living room or bedroom setting",
    ],
    connectedInfrastructure: ["flue_vent", "gas_piping", "ductwork"],
  },
  boiler: {
    label: "Wall-hung boiler",
    environment: "utility",
    mountSurface: "hung flat on a wall",
    orientation: "upright and level, pipes below and flue at the top",
    mountHeight: "mounted on the wall at roughly chest-to-head height",
    airflow: "flue vents out; hydronic pipes run below",
    clearances: "clear space below for pipe connections and in front for service",
    typicalLocation: "utility room or basement wall",
    forbidden: [
      "never upside down or tilted",
      "never sitting on the floor",
    ],
    connectedInfrastructure: ["flue_vent", "gas_piping", "hydronic_piping"],
  },
  baseboard_heater: {
    label: "Baseboard heater",
    environment: "indoor",
    mountSurface: "mounted along the base of a wall at floor level",
    orientation: "long, low, horizontal strip running along the wall, level",
    mountHeight: "at the floor line",
    airflow: "warm air rises off the top fins",
    clearances: "clear of furniture and drapes above",
    typicalLocation: "along the base of an exterior wall, often under a window",
    forbidden: [
      "never up high on the wall",
      "never vertical or tilted",
    ],
    connectedInfrastructure: ["hydronic_piping"],
  },
  radiator: {
    label: "Radiator",
    environment: "indoor",
    mountSurface: "standing on the floor against a wall (or wall-hung panel), upright",
    orientation: "upright, flat against the wall, level",
    mountHeight: "at floor level against the wall",
    airflow: "radiant/convective heat off the fins",
    clearances: "a little clearance from the wall behind",
    typicalLocation: "against a wall, commonly under a window",
    forbidden: [
      "never mounted high or on the ceiling",
      "never tilted or on its side",
    ],
    connectedInfrastructure: ["hydronic_piping"],
  },
  unit_heater: {
    label: "Suspended unit heater",
    environment: "utility",
    mountSurface: "suspended from the ceiling on threaded rods or brackets, up high",
    orientation: "upright, angled slightly down to blow air toward the floor",
    mountHeight: "high in the space near the ceiling",
    airflow: "fan blows warm air downward and outward across the room",
    clearances: "clearance around the unit and the flue",
    typicalLocation: "high in a garage, shop, or warehouse",
    forbidden: [
      "never at floor level",
      "never upside down",
    ],
    connectedInfrastructure: ["gas_piping", "flue_vent"],
  },
  // ── Water heating ───────────────────────────────────────────────────────
  gas_water_heater: {
    label: "Gas storage water heater",
    environment: "utility",
    mountSurface: "standing upright on the floor",
    orientation: "vertical cylindrical tank, upright and level, flue draft hood on top",
    mountHeight: "on the floor",
    airflow: "flue vents up from the top of the tank",
    clearances: "service clearance around the tank",
    typicalLocation: "utility closet, basement, or garage",
    forbidden: [
      "never on its side or tilted",
      "never wall-hung (a tank is floor-standing)",
    ],
    connectedInfrastructure: ["flue_vent", "gas_piping"],
  },
  tankless_water_heater: {
    label: "Tankless water heater",
    environment: "utility",
    mountSurface: "hung flat on a wall",
    orientation: "upright compact box, level, water lines below and vent at top/side",
    mountHeight: "mounted on the wall at roughly chest height",
    airflow: "sealed combustion vents out a sidewall or up",
    clearances: "clear space below for the water/gas connections",
    typicalLocation: "utility wall, garage, or exterior wall",
    forbidden: [
      "never sitting on the floor",
      "never upside down or tilted",
    ],
    connectedInfrastructure: ["flue_vent", "gas_piping", "condensate_drain"],
  },
  // ── Ventilation & air quality ───────────────────────────────────────────
  ventilator: {
    label: "HRV/ERV ventilator",
    environment: "utility",
    mountSurface: "wall-mounted or suspended from the ceiling in a mechanical space",
    orientation: "level, with the circular duct connections attached",
    mountHeight: "high on a utility wall or hung from the basement ceiling",
    airflow: "ducted intake and exhaust via the circular connections",
    clearances: "clear space for the duct runs and access",
    typicalLocation: "utility/mechanical room or unfinished basement ceiling",
    forbidden: [
      "never in a finished living room or bedroom setting",
      "never tilted or upside down",
    ],
    connectedInfrastructure: ["ductwork"],
  },
  exhaust_fan: {
    label: "Exhaust fan",
    environment: "indoor",
    mountSurface: "recessed flush in the ceiling (bath/kitchen) or mounted on a roof/wall for larger fans",
    orientation: "face-down and flush when in a ceiling; upright on a roof curb when exterior",
    mountHeight: "in the ceiling, or on the roof for commercial",
    airflow: "pulls room air up into a duct to the exterior",
    clearances: "flush grille; ducted to outside",
    typicalLocation: "bathroom/kitchen ceiling, or a commercial roof",
    forbidden: [
      "never venting into the room or attic (must reach outside)",
      "never tilted when ceiling-mounted",
    ],
    connectedInfrastructure: ["ductwork"],
  },
  whole_house_humidifier: {
    label: "Whole-house humidifier",
    environment: "utility",
    mountSurface: "mounted on the side of the furnace supply plenum or return duct",
    orientation: "upright, level, attached flat to the ductwork",
    mountHeight: "on the plenum beside the furnace",
    airflow: "adds moisture to the ducted supply air, with a small water line and drain",
    clearances: "access to the pad/panel",
    typicalLocation: "on the furnace plenum in a utility space",
    forbidden: [
      "never a free-standing unit in a finished room",
      "never tilted or upside down",
    ],
    connectedInfrastructure: ["ductwork"],
  },
  whole_house_dehumidifier: {
    label: "Whole-house dehumidifier",
    environment: "utility",
    mountSurface: "free-standing on the floor or suspended, ducted into the HVAC system",
    orientation: "upright and level rectangular cabinet",
    mountHeight: "on the floor or hung in the mechanical space",
    airflow: "ducted intake and dry-air supply, with a condensate drain",
    clearances: "clear space for the duct collars and drain",
    typicalLocation: "basement or mechanical room",
    forbidden: [
      "never in a finished living space",
      "never tilted or upside down",
    ],
    connectedInfrastructure: ["ductwork", "condensate_drain"],
  },
  air_cleaner: {
    label: "Media air cleaner / UV air purifier",
    environment: "utility",
    mountSurface: "installed in-line on the return duct at the air handler/furnace",
    orientation: "upright, level cabinet flush with the ductwork (UV lamp inside the plenum)",
    mountHeight: "at the return connection beside the furnace",
    airflow: "return air passes through the media/UV before the blower",
    clearances: "access door to change the media",
    typicalLocation: "on the return-air side of the furnace in a utility space",
    forbidden: [
      "never a free-standing appliance in a finished room",
      "never tilted or disconnected from the ductwork",
    ],
    connectedInfrastructure: ["ductwork"],
  },
  // ── Commercial ──────────────────────────────────────────────────────────
  rooftop_unit: {
    label: "Rooftop packaged unit (RTU)",
    environment: "rooftop",
    mountSurface: "sitting on a raised roof curb on a flat roof",
    orientation: "upright and level, large single cabinet",
    mountHeight: "on the roof, raised on its curb",
    airflow: "supply and return ducts drop straight down through the curb into the building",
    clearances: "clear service space around the cabinet and access panels",
    typicalLocation: "on a commercial flat roof",
    forbidden: [
      "never inside the building",
      "never directly on the roof deck without a curb",
      "never on its side or tilted",
    ],
    connectedInfrastructure: ["ductwork", "gas_piping"],
  },
  vrf_outdoor: {
    label: "VRF/VRV outdoor condensing unit",
    environment: "outdoor",
    mountSurface: "on a ground pad or roof dunnage, upright",
    orientation: "upright and level, tall modular cabinet(s) with top fans",
    mountHeight: "ground level on a pad or on the roof",
    airflow: "top fans discharge upward",
    clearances: "generous clearance around and above for airflow",
    typicalLocation: "beside or on the roof of a commercial building",
    forbidden: [
      "never indoors",
      "never on its side or upside down",
    ],
    connectedInfrastructure: ["refrigerant_lineset"],
  },
  vrf_branch_box: {
    label: "VRF branch selector box",
    environment: "utility",
    mountSurface: "suspended above a dropped ceiling or in a mechanical space",
    orientation: "horizontal and level, small enclosed box with refrigerant connections",
    mountHeight: "above the ceiling / in the mechanical space",
    airflow: "distributes refrigerant to multiple indoor units (no direct airflow)",
    clearances: "service access to the connections",
    typicalLocation: "concealed above a ceiling near the indoor units",
    forbidden: [
      "never exposed in a finished occupied room",
      "never tilted",
    ],
    connectedInfrastructure: ["refrigerant_lineset"],
  },
  air_handling_unit: {
    label: "Commercial air handling unit (AHU)",
    environment: "utility",
    mountSurface: "large floor-mounted modular unit in a mechanical room, or on a roof",
    orientation: "upright and level, long multi-section cabinet",
    mountHeight: "on the floor/pad or roof",
    airflow: "large supply and return duct connections at each end",
    clearances: "service clearance along the access side",
    typicalLocation: "mechanical room or rooftop of a commercial building",
    forbidden: [
      "never in an occupied finished space",
      "never tilted or upside down",
    ],
    connectedInfrastructure: ["ductwork", "condensate_drain", "hydronic_piping"],
  },
  fan_coil_unit: {
    label: "Fan coil unit (FCU)",
    environment: "indoor",
    mountSurface: "concealed above a ceiling, or a visible cabinet on the wall/floor",
    orientation: "level, right-side up, discharge toward the room",
    mountHeight: "above the ceiling or low on the wall/floor depending on type",
    airflow: "blows conditioned air into the space via a grille",
    clearances: "access to the coil and filter",
    typicalLocation: "hotel rooms, offices — one per zone",
    forbidden: [
      "never tilted or upside down",
    ],
    connectedInfrastructure: ["ductwork", "condensate_drain", "hydronic_piping"],
  },
  air_cooled_chiller: {
    label: "Air-cooled chiller",
    environment: "outdoor",
    mountSurface: "on a pad on the ground or on the roof, upright",
    orientation: "upright and level, long unit with a row of top fans",
    mountHeight: "ground level on a pad or on the roof",
    airflow: "top fans discharge upward; chilled-water pipes leave the end",
    clearances: "large clearance around and above for airflow",
    typicalLocation: "beside or on the roof of a commercial building",
    forbidden: [
      "never indoors",
      "never on its side or upside down",
    ],
    connectedInfrastructure: ["hydronic_piping"],
  },
  water_cooled_chiller: {
    label: "Water-cooled chiller",
    environment: "utility",
    mountSurface: "floor-mounted in an indoor mechanical room",
    orientation: "upright and level, large horizontal cylindrical/box cabinet",
    mountHeight: "on the floor",
    airflow: "no air discharge; chilled-water and condenser-water pipes at the ends (paired with a cooling tower)",
    clearances: "tube-pull clearance at one end plus service access",
    typicalLocation: "indoor mechanical/chiller room",
    forbidden: [
      "never outdoors or on a roof",
      "never tilted or upside down",
    ],
    connectedInfrastructure: ["hydronic_piping"],
  },
  cooling_tower: {
    label: "Cooling tower",
    environment: "rooftop",
    mountSurface: "on a structural roof frame or ground pad, upright",
    orientation: "upright and level, open-topped box structure with a fan on top",
    mountHeight: "on the roof or a ground pad",
    airflow: "fan on top draws air up; warm condenser water is cooled inside",
    clearances: "large clearance for air intake on the louvered sides",
    typicalLocation: "on the roof or beside a commercial building",
    forbidden: [
      "never indoors",
      "never on its side or upside down",
    ],
    connectedInfrastructure: ["hydronic_piping"],
  },
  makeup_air_unit: {
    label: "Make-up air unit (MAU)",
    environment: "rooftop",
    mountSurface: "on a roof curb or exterior wall, upright",
    orientation: "upright and level cabinet",
    mountHeight: "on the roof or high on an exterior wall",
    airflow: "draws in and tempers outdoor air, ducting it into the building",
    clearances: "clear intake and service space",
    typicalLocation: "commercial rooftop, often near a kitchen exhaust",
    forbidden: [
      "never inside the occupied space",
      "never on its side or tilted",
    ],
    connectedInfrastructure: ["ductwork", "gas_piping"],
  },
  // ── Infrastructure (also selectable) ────────────────────────────────────
  ductwork: {
    label: INFRASTRUCTURE_RULES.ductwork.label,
    environment: "utility",
    mountSurface: "run along the ceiling/joists, suspended level on straps",
    orientation: "straight, level, square rigid trunk with clean right-angle branches",
    mountHeight: "at the ceiling / along the joists",
    airflow: "distributes supply air to registers and returns air to the unit",
    clearances: "supported per SMACNA; flex only for final register connections",
    typicalLocation: "basement ceiling, attic, or above a commercial ceiling",
    forbidden: INFRASTRUCTURE_RULES.ductwork.forbidden,
    connectedInfrastructure: ["ductwork"],
  },
  refrigerant_lineset: {
    label: INFRASTRUCTURE_RULES.refrigerant_lineset.label,
    environment: "outdoor",
    mountSurface: "run in a white line-set cover hugging the exterior wall",
    orientation: "straight vertical and horizontal runs with gentle sweeping bends, clipped every 4–6 ft",
    mountHeight: "along the exterior wall between the indoor and outdoor units",
    airflow: "carries refrigerant (no airflow), sloped downhill through the wall to the condenser",
    clearances: "secured to the wall; sealed wall penetration",
    typicalLocation: "on the exterior wall between the mini-split head and condenser",
    forbidden: INFRASTRUCTURE_RULES.refrigerant_lineset.forbidden,
    connectedInfrastructure: ["refrigerant_lineset"],
  },
  // ── Fallback ────────────────────────────────────────────────────────────
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
    connectedInfrastructure: [],
  },
};

// Concise cheat sheet for the Claude system prompt: one line per category plus
// the infrastructure summary. Kept short so it scales as the catalog grows.
export function renderPlacementManual(): string {
  const equipment = Object.values(EQUIPMENT_PLACEMENT_RULES)
    .map((r) => `• ${r.label} (${r.environment}): ${r.orientation}; ${r.mountSurface}. ${r.forbidden.slice(0, 2).join("; ")}.`)
    .join("\n");
  return `EQUIPMENT PLACEMENT:\n${equipment}\n\nDUCTWORK & PIPING:\n${renderInfrastructureManual()}`;
}

// Full detailed rule for one category (selected equipment), inlined into the
// user message — including the connective infrastructure it ships with.
export function placementRuleLine(category: EquipmentCategory): string {
  const r = EQUIPMENT_PLACEMENT_RULES[category];
  const base = `${r.label}: ${r.mountSurface}; ${r.orientation}; ${r.mountHeight}; airflow — ${r.airflow}. ${r.forbidden.join("; ")}.`;
  return base + infrastructureConnectionText(r.connectedInfrastructure);
}

// Deterministic, non-negotiable physics constraint appended to the enriched
// prompt before it goes to fal — the exact category's orientation/environment
// rules plus its visible connective infrastructure.
export function placementConstraintSuffix(category: EquipmentCategory): string {
  const r = EQUIPMENT_PLACEMENT_RULES[category];
  return (
    ` CRITICAL PLACEMENT: the ${r.label} must be ${r.orientation}, ${r.mountSurface}, ${r.mountHeight}. ${r.forbidden.join("; ")}.` +
    infrastructureConnectionText(r.connectedInfrastructure) +
    ` Keep perspective, scale, lighting, and shadows consistent with the photo.`
  );
}

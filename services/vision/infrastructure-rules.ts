// Code-grounded installation rules for the connective infrastructure that
// accompanies HVAC equipment — ductwork, refrigerant line sets, condensate
// drains, venting/flues, gas piping, hydronic piping. Sources: SMACNA Metal &
// Flexible (via IMC ch.6), IRC M1411.3 / IMC 307 (condensate), IFGC 408.4
// (gas sediment trap), manufacturer line-set practice.
//
// These describe the *visible connection near the unit* so a single-equipment
// render shows the correct pipe/duct stub — not an entire building system.

export type InfrastructureKey =
  | "ductwork"
  | "refrigerant_lineset"
  | "condensate_drain"
  | "flue_vent"
  | "gas_piping"
  | "hydronic_piping";

export interface InfraRule {
  label: string;
  // One-line summary for the system-prompt cheat sheet
  summary: string;
  // The visible-connection instruction appended near connected equipment
  visibleConnection: string;
  forbidden: string[];
}

export const INFRASTRUCTURE_RULES: Record<InfrastructureKey, InfraRule> = {
  ductwork: {
    label: "Sheet-metal ductwork",
    summary:
      "rigid rectangular or round galvanized sheet-metal trunk-and-branch running straight along the ceiling/joists, level and square; flexible duct only for the final short connection to a ceiling/floor register",
    visibleConnection:
      "a rigid galvanized sheet-metal supply plenum/trunk connecting to the unit, running straight and level along the ceiling or joists with clean right-angle branches",
    forbidden: [
      "never flexible duct used as a main trunk or long run",
      "never sagging, crushed, or kinked duct",
      "never ducts crossing a finished room mid-air at an unrealistic angle",
    ],
  },
  refrigerant_lineset: {
    label: "Refrigerant line set",
    summary:
      "a pair of insulated copper lines (plus condensate hose and control cable) run inside a white line-set cover that hugs the exterior wall, clipped every 4–6 ft, sloping slightly downhill through the wall toward the outdoor unit",
    visibleConnection:
      "a white line-set cover (slimduct) carrying the insulated refrigerant lines running neatly down the exterior wall from the unit, straight vertical and horizontal runs with gentle sweeping bends, to the outdoor condenser",
    forbidden: [
      "never bare uninsulated copper looping across a wall",
      "never sharp kinked bends",
      "never running up and over in unrealistic loops",
    ],
  },
  condensate_drain: {
    label: "Condensate drain",
    summary:
      "¾-inch white Sch-40 PVC (or clear vinyl tubing) leaving the coil/air-handler, trapped, sloping continuously downhill (≥ 1/8 in per ft) to discharge; a secondary drain/pan where overflow could cause damage",
    visibleConnection:
      "a small white PVC condensate drain line leaving the bottom of the unit and sloping downward away from it",
    forbidden: [
      "never sloping uphill or running flat",
      "never a large-diameter pipe (it is a small ¾-inch line)",
    ],
  },
  flue_vent: {
    label: "Flue / vent",
    summary:
      "high-efficiency appliances vent with white PVC/CPVC pitched back toward the unit and terminating out a sidewall or roof; standard-efficiency use round metal B-vent rising up through the roof",
    visibleConnection:
      "a flue vent leaving the top of the unit — white PVC intake/exhaust pipes for a high-efficiency unit, or a round metal B-vent pipe rising upward for a standard unit",
    forbidden: [
      "never a flue terminating inside the room",
      "never a downward-sloping metal vent (metal vents rise)",
    ],
  },
  gas_piping: {
    label: "Gas piping",
    summary:
      "black-iron or yellow CSST gas pipe to the appliance with a shutoff valve and a sediment-trap drip leg (a short capped vertical nipple) at the inlet",
    visibleConnection:
      "a black-iron gas pipe reaching the unit with a shutoff valve and a short capped vertical sediment-trap drip leg at the connection",
    forbidden: [
      "never gas pipe without a visible shutoff at the appliance",
      "never flexible plastic tubing as the gas line",
    ],
  },
  hydronic_piping: {
    label: "Hydronic piping",
    summary:
      "insulated copper or PEX supply and return water lines leaving the boiler/unit, running in a neat parallel pair with isolation valves",
    visibleConnection:
      "a neat parallel pair of insulated supply and return water pipes leaving the unit with isolation valves",
    forbidden: [
      "never a single unpaired pipe (hydronic is always supply + return)",
      "never tangled or crossing runs",
    ],
  },
};

// Concise infra section for the system-prompt cheat sheet.
export function renderInfrastructureManual(): string {
  return Object.values(INFRASTRUCTURE_RULES)
    .map((r) => `• ${r.label}: ${r.summary}. ${r.forbidden.join("; ")}.`)
    .join("\n");
}

// The visible-connection lines for a set of infrastructure keys, appended to
// the enriched prompt / constraint suffix for connected equipment.
export function infrastructureConnectionText(keys: InfrastructureKey[]): string {
  if (keys.length === 0) return "";
  const parts = keys.map((k) => INFRASTRUCTURE_RULES[k].visibleConnection);
  return ` Also include ${parts.join("; and ")} — kept realistic and to code.`;
}

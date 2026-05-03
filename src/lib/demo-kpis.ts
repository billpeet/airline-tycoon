import type { Kpi } from "@/components/shell/kpi-strip";

/**
 * Placeholder KPIs rendered in the topbar until the simulation lands.
 * Phase 2 will replace this with values pulled from the player's game state.
 */
export const demoKpis: Kpi[] = [
  { code: "CASH", label: "Cash", value: "$2.40M", delta: "+$12K", tone: "positive", flap: true },
  { code: "FLEET", label: "Aircraft", value: "01", flap: true },
  { code: "ROUTES", label: "Active routes", value: "00", flap: true },
  { code: "PAX/DAY", label: "Daily pax", value: "0", flap: true },
  { code: "OTP", label: "On-time", value: "—", tone: "neutral", flap: true },
  { code: "REP", label: "Reputation", value: "32", delta: "+1", tone: "positive", flap: true },
];

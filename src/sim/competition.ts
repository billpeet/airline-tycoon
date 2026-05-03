/**
 * Competition signal — how many real-world carriers already have a hub at
 * either endpoint of a route. Crude proxy for "they're already flying it".
 *
 * Returns a multiplier ≤ 1 for use against base demand.
 */

export function competitionPenalty(competitorCount: number): number {
  // 0 → 1.0, 1 → 0.80, 2 → 0.67, 4 → 0.50
  return 1 / (1 + 0.25 * competitorCount);
}

/**
 * Build a per-pair competitor counter from an `airline_hub` snapshot. Each
 * carrier with at least one hub at either endpoint counts as one competitor.
 */
export function buildCompetitorIndex(
  hubs: { airlineId: string; airportId: string }[],
): { count(fromAirportId: string, toAirportId: string): number } {
  const byAirport = new Map<string, Set<string>>();
  for (const h of hubs) {
    let s = byAirport.get(h.airportId);
    if (!s) {
      s = new Set();
      byAirport.set(h.airportId, s);
    }
    s.add(h.airlineId);
  }
  return {
    count(fromAirportId: string, toAirportId: string) {
      const a = byAirport.get(fromAirportId);
      const b = byAirport.get(toAirportId);
      if (!a && !b) return 0;
      const u = new Set<string>();
      a?.forEach((id) => u.add(id));
      b?.forEach((id) => u.add(id));
      return u.size;
    },
  };
}

/**
 * Demand model — Phase 2 placeholder, intentionally simple but tunable.
 *
 *   demand_per_day = base(citySize, distance, hubBonus)
 *                  × fareElasticity(yourFare, marketFare)
 *                  × seasonality(gameDay, hemisphereFromLat)
 *                  × reputationFactor
 *
 * Returns expected paying passengers per day for the city pair.
 * The tick clamps this against the seats actually offered.
 */

import type { Airport } from "@/db/schema";

const SIZE_WEIGHT: Record<Airport["size"], number> = {
  small: 0.25,
  medium: 0.7,
  large: 1.4,
};

/** Bell-ish curve over distance: peaks ~1500km, falls off short and long. */
function distanceFactor(km: number): number {
  if (km < 200) return 0.15;
  // Lognormal-ish: log-distance mapped through cos peak.
  const lk = Math.log(km / 1500);
  return Math.max(0.15, Math.exp(-(lk * lk) / 1.6));
}

/** Soft fare elasticity: 1.0 at market, drops as fare exceeds, rises a bit if undercut. */
function fareElasticity(yourCents: number, marketCents: number): number {
  if (marketCents <= 0) return 1;
  const ratio = yourCents / marketCents;
  // exp(-1.4 * (ratio - 1)) gives ~1.0 at parity, 0.49 at +50%, ~2.0 at -50%, clamped.
  return Math.max(0.15, Math.min(1.8, Math.exp(-1.4 * (ratio - 1))));
}

/** Yearly sine wave; peak northern summer (~day 210), trough northern winter. */
function seasonality(gameDay: number, lat: number): number {
  const dayOfYear = ((gameDay % 365) + 365) % 365;
  const peakDay = lat >= 0 ? 210 : 28; // flip for southern hemisphere
  const phase = ((dayOfYear - peakDay) / 365) * Math.PI * 2;
  return 0.85 + 0.18 * Math.cos(phase); // 0.67 .. 1.03
}

function reputationFactor(reputation: number): number {
  // 0 → 0.6, 50 → 1.0, 100 → 1.4
  return 0.6 + (reputation / 100) * 0.8;
}

/** Heuristic "market fare" — what an established carrier would charge. */
export function suggestedMarketFareCents(distanceKm: number): number {
  // $40 base + ~$0.12/km, soft floor + ceiling.
  const base = 4000 + Math.round(distanceKm * 12);
  return Math.max(4500, Math.min(120_000, base));
}

import { competitionPenalty } from "./competition";

export interface DemandInput {
  from: Pick<Airport, "lat" | "size" | "slotConstrained">;
  to: Pick<Airport, "lat" | "size" | "slotConstrained">;
  distanceKm: number;
  fareCents: number;
  gameDay: number;
  reputation: number;
  /** Number of competing real-world carriers operating this pair (rough). */
  competitorCount?: number;
  /** Tunable global coefficient — turn the whole world up or down. */
  globalCoef?: number;
}

export interface DemandResult {
  expectedPaxPerDay: number;
  marketFareCents: number;
  fareElasticity: number;
  seasonality: number;
  basePotential: number;
  competitionMultiplier: number;
}

export function computeDemand(input: DemandInput): DemandResult {
  const { from, to, distanceKm, fareCents, gameDay, reputation } = input;
  const globalCoef = input.globalCoef ?? 380;

  const sizeMix = (SIZE_WEIGHT[from.size] + SIZE_WEIGHT[to.size]) / 2;
  const hubBonus =
    (from.slotConstrained ? 1.35 : 1) * (to.slotConstrained ? 1.35 : 1);
  const distFactor = distanceFactor(distanceKm);

  const basePotential = sizeMix * hubBonus * distFactor * globalCoef;
  const market = suggestedMarketFareCents(distanceKm);
  const elastic = fareElasticity(fareCents, market);
  const season = seasonality(gameDay, (from.lat + to.lat) / 2);
  const rep = reputationFactor(reputation);
  const compMul = competitionPenalty(input.competitorCount ?? 0);

  const expectedPaxPerDay = Math.max(
    0,
    Math.round(basePotential * elastic * season * rep * compMul),
  );

  return {
    expectedPaxPerDay,
    marketFareCents: market,
    fareElasticity: elastic,
    seasonality: season,
    basePotential: Math.round(basePotential),
    competitionMultiplier: compMul,
  };
}

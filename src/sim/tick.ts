/**
 * One game-day, one transaction. Pure function over (state) → (state, ledger).
 */

import type { RNG } from "./rng";
import type { Airport, AircraftType } from "@/db/schema";
import { computeDemand } from "./demand";

export interface TickRoute {
  id: string;
  fromAirportId: string;
  toAirportId: string;
  aircraftId: string;
  distanceKm: number;
  fareEconomyCents: number;
  frequencyPerWeek: number;
  status: "active" | "closed";
}

export interface TickAircraft {
  id: string;
  typeId: string;
  baseAirportId: string;
}

export interface TickInputs {
  gameDay: number;
  fuelPriceCentsPerLiter: number;
  reputation: number;
  rng: RNG;
  routes: TickRoute[];
  aircraft: TickAircraft[];
  airports: Map<string, Airport>;
  aircraftTypes: Map<string, AircraftType>;
}

export interface RouteTick {
  routeId: string;
  paxCarried: number;
  loadFactor: number;
  revenueCents: number;
  fuelCents: number;
  crewCents: number;
  landingCents: number;
  flightHours: number;
}

export interface AircraftIdleCost {
  aircraftId: string;
  costCents: number;
}

export interface TickOutput {
  routeTicks: RouteTick[];
  idleCosts: AircraftIdleCost[];
  fuelDriftPct: number;          // signed pct change to fuel price
  newFuelPriceCentsPerLiter: number;
}

const KTS_TO_KMH = 1.852;
const DAILY_FIXED_COST_CENTS = 50_000; // $500/day per aircraft (parking, insurance, admin)

export function runTick(input: TickInputs): TickOutput {
  const routeTicks: RouteTick[] = [];

  for (const r of input.routes) {
    if (r.status !== "active") continue;

    const acft = input.aircraft.find((a) => a.id === r.aircraftId);
    if (!acft) continue;
    const type = input.aircraftTypes.get(acft.typeId);
    const from = input.airports.get(r.fromAirportId);
    const to = input.airports.get(r.toAirportId);
    if (!type || !from || !to) continue;

    // Per day: how many round-trips, how many seats, how many flight hours.
    const dailyFreq = r.frequencyPerWeek / 7; // round trips per day
    const seatsPerDay = type.typicalPax * dailyFreq;
    // Each round trip = 2 legs × distance / cruise speed (in km/h).
    const flightHoursPerDay = (r.distanceKm / (type.cruiseSpeedKts * KTS_TO_KMH)) * 2 * dailyFreq;

    // Demand
    const dem = computeDemand({
      from,
      to,
      distanceKm: r.distanceKm,
      fareCents: r.fareEconomyCents,
      gameDay: input.gameDay,
      reputation: input.reputation,
    });

    // Stochastic noise: ±12% of expected demand
    const noise = 0.88 + input.rng() * 0.24;
    const wantPax = Math.round(dem.expectedPaxPerDay * noise);
    const paxCarried = Math.min(seatsPerDay, wantPax);
    const loadFactor = seatsPerDay > 0 ? paxCarried / seatsPerDay : 0;

    const revenueCents = paxCarried * r.fareEconomyCents;

    // Fuel: liters/hour × hours × price/liter
    const fuelCents = Math.round(
      flightHoursPerDay * type.fuelBurnLph * input.fuelPriceCentsPerLiter,
    );

    // Crew: USD/hour by type class (flight crew + cabin crew loaded cost)
    const crewRatePerHourUsd =
      type.typeClass === "turboprop"
        ? 250
        : type.typeClass === "regional_jet"
          ? 400
          : type.typeClass === "narrowbody"
            ? 700
            : 1500; // widebody
    const crewCents = Math.round(flightHoursPerDay * crewRatePerHourUsd * 100);

    // Landing fees per movement (round trip = 2 movements). Slot fees are real money.
    const landingFeeUsd = (ap: Airport): number => {
      const base =
        ap.size === "small" ? 200 : ap.size === "medium" ? 450 : 950;
      return base + (ap.slotConstrained ? 1500 : 0);
    };
    const landingCents = Math.round((landingFeeUsd(from) + landingFeeUsd(to)) * 100 * dailyFreq);

    routeTicks.push({
      routeId: r.id,
      paxCarried,
      loadFactor,
      revenueCents,
      fuelCents,
      crewCents,
      landingCents,
      flightHours: flightHoursPerDay,
    });
  }

  // Aircraft fixed daily cost
  const idleCosts: AircraftIdleCost[] = input.aircraft.map((a) => ({
    aircraftId: a.id,
    costCents: DAILY_FIXED_COST_CENTS,
  }));

  // Fuel price drift — small daily walk, ±0.6%, slight upward bias.
  const drift = (input.rng() - 0.45) * 0.012;
  const newFuelPrice = Math.max(
    50,
    Math.min(160, Math.round(input.fuelPriceCentsPerLiter * (1 + drift))),
  );

  return {
    routeTicks,
    idleCosts,
    fuelDriftPct: drift * 100,
    newFuelPriceCentsPerLiter: newFuelPrice,
  };
}

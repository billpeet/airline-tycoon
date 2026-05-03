#!/usr/bin/env bun
/**
 * Idempotent reference-data seeder. Reads JSON in src/data/seeds/ and
 * upserts into the airport / aircraft_type / airline / airline_hub tables.
 *
 * Usage:  bun run db:seed
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { sql } from "drizzle-orm";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { airport, aircraftType, airline, airlineHub } from "@/db/schema/reference";

import airportsSeed from "@/data/seeds/airports.json";
import aircraftSeed from "@/data/seeds/aircraft.json";
import airlinesSeed from "@/data/seeds/airlines.json";

type AirportSeed = (typeof airportsSeed.airports)[number];
type AircraftSeed = (typeof aircraftSeed.aircraft)[number];
type AirlineSeed = (typeof airlinesSeed.airlines)[number];

const url = process.env.DATABASE_URL ?? "./data/airline-tycoon.sqlite";
mkdirSync(dirname(url), { recursive: true });

const sqlite = new Database(url, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");
const db = drizzle(sqlite);

console.log(`Seeding reference data into ${url}`);
const t0 = Date.now();

db.transaction((tx) => {
  // -------------------- airports --------------------
  const airports = airportsSeed.airports as AirportSeed[];
  console.log(`  airports (${airports.length})…`);
  // Use INSERT … ON CONFLICT DO UPDATE for idempotency (Drizzle SQLite supports onConflictDoUpdate per-row,
  // but for bulk we issue a single SQL statement via `sql` to avoid 2887 round-trips).
  for (const chunk of chunks(airports, 500)) {
    tx.insert(airport)
      .values(
        chunk.map((a) => ({
          id: a.id,
          iata: a.iata,
          icao: a.icao,
          name: a.name,
          city: a.city,
          country: a.country,
          continent: a.continent,
          lat: a.lat,
          lon: a.lon,
          elevationFt: a.elevation_ft,
          size: a.size as "small" | "medium" | "large",
          slotConstrained: a.slot_constrained,
          timezone: a.timezone,
        })),
      )
      .onConflictDoUpdate({
        target: airport.id,
        set: {
          iata: sql`excluded.iata`,
          icao: sql`excluded.icao`,
          name: sql`excluded.name`,
          city: sql`excluded.city`,
          country: sql`excluded.country`,
          continent: sql`excluded.continent`,
          lat: sql`excluded.lat`,
          lon: sql`excluded.lon`,
          elevationFt: sql`excluded.elevation_ft`,
          size: sql`excluded.size`,
          slotConstrained: sql`excluded.slot_constrained`,
          timezone: sql`excluded.timezone`,
        },
      })
      .run();
  }

  // -------------------- aircraft types --------------------
  const acTypes = aircraftSeed.aircraft as AircraftSeed[];
  console.log(`  aircraft_type (${acTypes.length})…`);
  for (const a of acTypes) {
    tx.insert(aircraftType)
      .values({
        id: a.id,
        icaoCode: a.icao_code,
        manufacturer: a.manufacturer,
        family: a.family,
        model: a.model,
        typeClass: a.type_class as "turboprop" | "regional_jet" | "narrowbody" | "widebody",
        rangeKm: a.range_km,
        typicalPax: a.typical_pax,
        maxPax: a.max_pax,
        cargoKg: a.cargo_kg,
        cruiseSpeedKts: a.cruise_speed_kts,
        mtowKg: a.mtow_kg,
        listPriceMusd: a.list_price_musd,
        leaseRateKusdMonth: a.lease_rate_kusd_month,
        fuelBurnLph: a.fuel_burn_lph,
        crewCockpit: a.crew_cockpit,
        crewCabin: a.crew_cabin,
        introYear: a.intro_year,
        retiredYear: a.retired_year,
      })
      .onConflictDoUpdate({
        target: aircraftType.id,
        set: {
          icaoCode: sql`excluded.icao_code`,
          manufacturer: sql`excluded.manufacturer`,
          family: sql`excluded.family`,
          model: sql`excluded.model`,
          typeClass: sql`excluded.type_class`,
          rangeKm: sql`excluded.range_km`,
          typicalPax: sql`excluded.typical_pax`,
          maxPax: sql`excluded.max_pax`,
          cargoKg: sql`excluded.cargo_kg`,
          cruiseSpeedKts: sql`excluded.cruise_speed_kts`,
          mtowKg: sql`excluded.mtow_kg`,
          listPriceMusd: sql`excluded.list_price_musd`,
          leaseRateKusdMonth: sql`excluded.lease_rate_kusd_month`,
          fuelBurnLph: sql`excluded.fuel_burn_lph`,
          crewCockpit: sql`excluded.crew_cockpit`,
          crewCabin: sql`excluded.crew_cabin`,
          introYear: sql`excluded.intro_year`,
          retiredYear: sql`excluded.retired_year`,
        },
      })
      .run();
  }

  // -------------------- airlines + hubs --------------------
  const airlines = airlinesSeed.airlines as AirlineSeed[];
  console.log(`  airline (${airlines.length})…`);
  for (const al of airlines) {
    tx.insert(airline)
      .values({
        id: al.id,
        iata: al.iata,
        icao: al.icao,
        name: al.name,
        country: al.country,
        type: al.type as "legacy" | "lcc" | "ulcc" | "regional" | "charter",
        alliance: (al.alliance ?? null) as "star" | "oneworld" | "skyteam" | null,
        founded: al.founded,
        fleetSize: al.fleet_size,
        aiAggression: al.ai_aggression,
        aiExpansion: al.ai_expansion,
        color: al.color ?? null,
      })
      .onConflictDoUpdate({
        target: airline.id,
        set: {
          iata: sql`excluded.iata`,
          icao: sql`excluded.icao`,
          name: sql`excluded.name`,
          country: sql`excluded.country`,
          type: sql`excluded.type`,
          alliance: sql`excluded.alliance`,
          founded: sql`excluded.founded`,
          fleetSize: sql`excluded.fleet_size`,
          aiAggression: sql`excluded.ai_aggression`,
          aiExpansion: sql`excluded.ai_expansion`,
          color: sql`excluded.color`,
        },
      })
      .run();
  }

  // Wipe + re-seed hubs (small table, easier than computing diff).
  console.log(`  airline_hub (refresh)…`);
  tx.delete(airlineHub).run();
  const hubRows: { airlineId: string; airportId: string; priority: number }[] = [];
  for (const al of airlines) {
    for (const h of al.hubs) {
      hubRows.push({ airlineId: al.id, airportId: h.airport, priority: h.priority });
    }
  }
  for (const chunk of chunks(hubRows, 500)) {
    tx.insert(airlineHub).values(chunk).run();
  }
});

const dt = Date.now() - t0;

const counts = {
  airports: sqlite.query("SELECT COUNT(*) AS n FROM airport").get() as { n: number },
  aircraft: sqlite.query("SELECT COUNT(*) AS n FROM aircraft_type").get() as { n: number },
  airlines: sqlite.query("SELECT COUNT(*) AS n FROM airline").get() as { n: number },
  hubs: sqlite.query("SELECT COUNT(*) AS n FROM airline_hub").get() as { n: number },
};

console.log(
  `Done in ${dt}ms. ${counts.airports.n} airports · ${counts.aircraft.n} aircraft types · ${counts.airlines.n} airlines · ${counts.hubs.n} hubs.`,
);

sqlite.close();

function* chunks<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}

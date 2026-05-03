import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

/**
 * Reference data — read-only at runtime, seeded from
 * `src/data/seeds/*.json` via `bun run db:seed`.
 *
 * Player gameplay tables will live in a separate file once Phase 2 lands.
 */

// -----------------------------------------------------------------------------
// Airports — sourced from OurAirports (https://ourairports.com/data/, public domain).
// -----------------------------------------------------------------------------

export const airport = sqliteTable(
  "airport",
  {
    id: text("id").primaryKey(),               // IATA where present, else "ICAO:" + ICAO
    iata: text("iata"),
    icao: text("icao"),
    name: text("name").notNull(),
    city: text("city"),
    country: text("country").notNull(),         // ISO-3166-1 alpha-2
    continent: text("continent"),               // EU / NA / AS / OC / SA / AF / AN
    lat: real("lat").notNull(),
    lon: real("lon").notNull(),
    elevationFt: integer("elevation_ft"),
    size: text("size", { enum: ["small", "medium", "large"] }).notNull(),
    slotConstrained: integer("slot_constrained", { mode: "boolean" }).notNull().default(false),
    timezone: text("timezone"),
  },
  (t) => [
    index("airport_country_idx").on(t.country),
    index("airport_continent_idx").on(t.continent),
    index("airport_size_idx").on(t.size),
    index("airport_iata_idx").on(t.iata),
  ],
);

export type Airport = typeof airport.$inferSelect;

// -----------------------------------------------------------------------------
// Aircraft types — hand-curated from manufacturer data.
// -----------------------------------------------------------------------------

export const aircraftType = sqliteTable(
  "aircraft_type",
  {
    id: text("id").primaryKey(),                // ICAO type code, e.g. "A20N"
    icaoCode: text("icao_code").notNull(),
    manufacturer: text("manufacturer").notNull(),  // "Airbus" / "Boeing" / "Embraer" / "ATR" / "De Havilland Canada"
    family: text("family").notNull(),              // "A320 family" / "737 NG" / "E-Jet E2"
    model: text("model").notNull(),                // "A320neo"
    typeClass: text("type_class", {
      enum: ["turboprop", "regional_jet", "narrowbody", "widebody"],
    }).notNull(),
    rangeKm: integer("range_km").notNull(),
    typicalPax: integer("typical_pax").notNull(),
    maxPax: integer("max_pax").notNull(),
    cargoKg: integer("cargo_kg").notNull(),
    cruiseSpeedKts: integer("cruise_speed_kts").notNull(),
    mtowKg: integer("mtow_kg").notNull(),
    listPriceMusd: real("list_price_musd").notNull(),
    leaseRateKusdMonth: real("lease_rate_kusd_month").notNull(),
    fuelBurnLph: integer("fuel_burn_lph").notNull(),
    crewCockpit: integer("crew_cockpit").notNull(),
    crewCabin: integer("crew_cabin").notNull(),
    introYear: integer("intro_year").notNull(),
    retiredYear: integer("retired_year"),       // null = still in production / service
  },
  (t) => [
    index("aircraft_type_class_idx").on(t.typeClass),
    index("aircraft_type_manufacturer_idx").on(t.manufacturer),
  ],
);

export type AircraftType = typeof aircraftType.$inferSelect;

// -----------------------------------------------------------------------------
// Airlines — hand-curated focused list (AU / NA / EU + key global hubs).
// -----------------------------------------------------------------------------

export const airline = sqliteTable(
  "airline",
  {
    id: text("id").primaryKey(),                // ICAO airline code, e.g. "QFA"
    iata: text("iata"),
    icao: text("icao").notNull(),
    name: text("name").notNull(),
    country: text("country").notNull(),         // ISO-3166-1 alpha-2
    type: text("type", {
      enum: ["legacy", "lcc", "ulcc", "regional", "charter"],
    }).notNull(),
    alliance: text("alliance", { enum: ["star", "oneworld", "skyteam"] }), // null = unaligned
    founded: integer("founded").notNull(),
    fleetSize: integer("fleet_size").notNull(),
    aiAggression: real("ai_aggression").notNull(),  // 0..1 — how hard they defend / encroach routes
    aiExpansion: real("ai_expansion").notNull(),    // 0..1 — appetite for opening new routes
    color: text("color"),                            // brand colour, used on globe
  },
  (t) => [
    index("airline_country_idx").on(t.country),
    index("airline_alliance_idx").on(t.alliance),
  ],
);

export type Airline = typeof airline.$inferSelect;

// Many-to-many: airlines × hub airports (priority 1 = primary, 2 = secondary).
export const airlineHub = sqliteTable(
  "airline_hub",
  {
    airlineId: text("airline_id")
      .notNull()
      .references(() => airline.id, { onDelete: "cascade" }),
    airportId: text("airport_id")
      .notNull()
      .references(() => airport.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(1), // 1 = primary, 2 = secondary, 3 = focus city
  },
  (t) => [
    primaryKey({ columns: [t.airlineId, t.airportId] }),
    index("airline_hub_airport_idx").on(t.airportId),
  ],
);

export type AirlineHub = typeof airlineHub.$inferSelect;

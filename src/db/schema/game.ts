import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { airport, aircraftType } from "./reference";

/**
 * Player game state. One game per user (MVP); multiple slots later.
 *
 * Money is stored in INTEGER CENTS everywhere. Avoids floating-point
 * drift over thousands of ticks. Convert at the UI boundary only.
 */

export const game = sqliteTable(
  "game",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    airlineName: text("airline_name").notNull(),
    airlineCode: text("airline_code").notNull(), // 3-char IATA-style id chosen by player
    homeAirportId: text("home_airport_id")
      .notNull()
      .references(() => airport.id),

    // Time
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),  // real wallclock
    lastSimulatedAt: integer("last_simulated_at", { mode: "timestamp_ms" }).notNull(),
    currentDay: integer("current_day").notNull().default(0), // game-days since start
    rateMultiplier: integer("rate_multiplier").notNull().default(1), // 1 / 2 / 4 / 8

    // RNG
    rngSeed: integer("rng_seed").notNull(),

    // Money
    cashCents: integer("cash_cents").notNull(),

    // Macro
    reputation: integer("reputation").notNull().default(32),
    fuelPriceCentsPerLiter: integer("fuel_price_cents_per_liter").notNull().default(85),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("game_user_idx").on(t.userId),
  ],
);

export type Game = typeof game.$inferSelect;

// -----------------------------------------------------------------------------
// Player aircraft
// -----------------------------------------------------------------------------

export const aircraft = sqliteTable(
  "aircraft",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    typeId: text("type_id")
      .notNull()
      .references(() => aircraftType.id),

    tail: text("tail").notNull(),                    // e.g. "CMA-001"
    baseAirportId: text("base_airport_id")
      .notNull()
      .references(() => airport.id),

    status: text("status", {
      enum: ["in_service", "maintenance", "retired"],
    })
      .notNull()
      .default("in_service"),
    acquiredOnDay: integer("acquired_on_day").notNull(),
    acquisitionMode: text("acquisition_mode", {
      enum: ["cash", "finance", "lease", "starter"],
    })
      .notNull()
      .default("cash"),

    // Total cycle hours flown — drives maintenance later
    cycleHours: real("cycle_hours").notNull().default(0),
  },
  (t) => [
    index("aircraft_game_idx").on(t.gameId),
    index("aircraft_base_idx").on(t.baseAirportId),
  ],
);

export type Aircraft = typeof aircraft.$inferSelect;

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------

export const route = sqliteTable(
  "route",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),

    fromAirportId: text("from_airport_id")
      .notNull()
      .references(() => airport.id),
    toAirportId: text("to_airport_id")
      .notNull()
      .references(() => airport.id),

    aircraftId: text("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "cascade" }),

    distanceKm: real("distance_km").notNull(),
    fareEconomyCents: integer("fare_economy_cents").notNull(),
    frequencyPerWeek: integer("frequency_per_week").notNull(),

    openedOnDay: integer("opened_on_day").notNull(),
    closedOnDay: integer("closed_on_day"),
    status: text("status", { enum: ["active", "closed"] }).notNull().default("active"),

    // Last-tick-cached metrics, surfaced to UI without recomputing
    lastDailyPax: integer("last_daily_pax").notNull().default(0),
    lastDailyRevenueCents: integer("last_daily_revenue_cents").notNull().default(0),
    lastDailyCostCents: integer("last_daily_cost_cents").notNull().default(0),
    lastLoadFactor: real("last_load_factor").notNull().default(0),
  },
  (t) => [
    index("route_game_idx").on(t.gameId),
    index("route_aircraft_idx").on(t.aircraftId),
  ],
);

export type Route = typeof route.$inferSelect;

// -----------------------------------------------------------------------------
// Transactions ledger — one row per (route × day) for revenue/cost + ad-hoc rows
// -----------------------------------------------------------------------------

export const txn = sqliteTable(
  "txn",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    gameDay: integer("game_day").notNull(),

    kind: text("kind", {
      enum: [
        "route_revenue",
        "route_fuel",
        "route_crew",
        "route_landing",
        "aircraft_idle",
        "aircraft_purchase",
        "starter_grant",
      ],
    }).notNull(),

    amountCents: integer("amount_cents").notNull(), // positive = inflow, negative = outflow
    refTable: text("ref_table"),
    refId: text("ref_id"),
    note: text("note"),
  },
  (t) => [
    index("txn_game_day_idx").on(t.gameId, t.gameDay),
    index("txn_kind_idx").on(t.kind),
  ],
);

export type Txn = typeof txn.$inferSelect;

// -----------------------------------------------------------------------------
// News events — the structured cards the newsroom renders
// -----------------------------------------------------------------------------

export const newsEvent = sqliteTable(
  "news_event",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),

    gameDay: integer("game_day").notNull(),
    category: text("category", {
      enum: ["fleet", "routes", "finance", "market", "operations", "milestone"],
    }).notNull(),
    severity: text("severity", { enum: ["info", "good", "warn", "bad"] })
      .notNull()
      .default("info"),

    headline: text("headline").notNull(),
    body: text("body"),
    meta: text("meta"), // JSON-encoded blob, optional

    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    seen: integer("seen", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("news_game_day_idx").on(t.gameId, t.gameDay),
    index("news_seen_idx").on(t.gameId, t.seen),
  ],
);

export type NewsEvent = typeof newsEvent.$inferSelect;

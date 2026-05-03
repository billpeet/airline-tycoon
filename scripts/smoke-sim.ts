#!/usr/bin/env bun
/**
 * End-to-end sim smoke test (no HTTP). Spins up:
 *   - a synthetic user
 *   - a game founded at LHR
 *   - opens LHR↔CDG, then advances the sim by N game-days
 *   - prints the resulting cash, route stats and news rows
 *
 * Usage:  bun run scripts/smoke-sim.ts
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { eq, and, desc } from "drizzle-orm";
import {
  user,
  airport,
  aircraftType,
  game,
  aircraft,
  route,
  txn,
  newsEvent,
  financeInstrument,
} from "@/db/schema";
import { monthlyPaymentCents, DEFAULT_LOAN_RATE_BPS } from "@/sim/finance";
import * as schema from "@/db/schema";
import { randomId } from "@/lib/id";
import { seedFromString } from "@/sim/rng";
import { greatCircleKm } from "@/sim/geo";
import { ensureSimUpToDate } from "@/sim/catchup";
import { formatUsdCents } from "@/lib/money";

const DAYS_TO_RUN = parseInt(process.env.SIM_DAYS ?? "30", 10);
const url = process.env.DATABASE_URL ?? "./data/airline-tycoon.sqlite";
mkdirSync(dirname(url), { recursive: true });

const sqlite = new Database(url, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

// Re-export the global db client uses bun:sqlite separately, so just point this
// script at the same file via a parallel drizzle instance.
const db = drizzle(sqlite, { schema });

const userId = "smoke-user";
const gameId = "smoke-game";

// Clean prior smoke run
db.delete(newsEvent).where(eq(newsEvent.gameId, gameId)).run();
db.delete(txn).where(eq(txn.gameId, gameId)).run();
db.delete(route).where(eq(route.gameId, gameId)).run();
db.delete(aircraft).where(eq(aircraft.gameId, gameId)).run();
db.delete(financeInstrument).where(eq(financeInstrument.gameId, gameId)).run();
db.delete(game).where(eq(game.id, gameId)).run();
db.delete(user).where(eq(user.id, userId)).run();

const now = new Date();

db.insert(user).values({
  id: userId,
  name: "Smoke",
  email: "smoke@example.com",
  emailVerified: true,
  image: null,
  createdAt: now,
  updatedAt: now,
}).run();

const lhr = db.select().from(airport).where(eq(airport.id, "LHR")).get();
const cdg = db.select().from(airport).where(eq(airport.id, "CDG")).get();
const starter = db.select().from(aircraftType).where(eq(aircraftType.id, "AT43")).get();
if (!lhr || !cdg || !starter) {
  throw new Error("Reference data missing — did you run `bun run db:seed`?");
}

const aircraftId = "smoke-acft";

db.insert(game).values({
  id: gameId,
  userId,
  airlineName: "SmokeJet",
  airlineCode: "SJT",
  homeAirportId: lhr.id,
  startedAt: now,
  lastSimulatedAt: now,
  currentDay: 0,
  rateMultiplier: 1,
  rngSeed: seedFromString(`${userId}:${gameId}`),
  cashCents: 5_000_000_00,
  reputation: 32,
  fuelPriceCentsPerLiter: 85,
  createdAt: now,
}).run();

db.insert(aircraft).values({
  id: aircraftId,
  gameId,
  typeId: starter.id,
  tail: "SJT-001",
  baseAirportId: lhr.id,
  status: "in_service",
  acquiredOnDay: 0,
  acquisitionMode: "starter",
  cycleHours: 0,
}).run();

db.insert(route).values({
  id: "smoke-rte",
  gameId,
  fromAirportId: lhr.id,
  toAirportId: cdg.id,
  aircraftId,
  distanceKm: greatCircleKm(lhr.lat, lhr.lon, cdg.lat, cdg.lon),
  fareEconomyCents: 9000, // $90 fare
  frequencyPerWeek: 14,    // 2/day
  openedOnDay: 0,
  status: "active",
}).run();

// Test Phase 3: take a $2M loan over 60 months
const loanPrincipal = 2_000_000_00;
const loanTerm = 60;
const loanMonthly = monthlyPaymentCents(loanPrincipal, DEFAULT_LOAN_RATE_BPS, loanTerm);
const loanId = "smoke-loan";
db.insert(financeInstrument).values({
  id: loanId,
  gameId,
  kind: "loan",
  status: "active",
  principalCents: loanPrincipal,
  outstandingCents: loanPrincipal,
  monthlyPaymentCents: loanMonthly,
  rateBps: DEFAULT_LOAN_RATE_BPS,
  termMonths: loanTerm,
  monthsPaid: 0,
  collateralAircraftId: null,
  startedOnDay: 0,
  endsOnDay: loanTerm * 30,
  notes: "Smoke test loan",
}).run();
db.update(game).set({ cashCents: 5_000_000_00 + loanPrincipal }).where(eq(game.id, gameId)).run();

console.log(`Founded SmokeJet · cash $7.00M (incl. $2M loan @ ${(DEFAULT_LOAN_RATE_BPS / 100).toFixed(2)}% × ${loanTerm}mo, monthly $${(loanMonthly / 100).toLocaleString()})`);
console.log(`Route: LHR ↔ CDG, 14×/wk @ $90 econ`);
console.log(`Advancing ${DAYS_TO_RUN} game-days …`);

// Pretend lastSimulatedAt was N hours ago so catch-up advances the right
// number of game-days at the offline rate (1 real hour = 1 game day at base,
// 0.5× offline). N hours offline → N/2 game-days. We want DAYS_TO_RUN game
// days, so set lastSimulatedAt to (DAYS_TO_RUN * 2) real hours ago.
const fakeLastMs = Date.now() - DAYS_TO_RUN * 2 * 60 * 60 * 1000;
db.update(game).set({ lastSimulatedAt: new Date(fakeLastMs) }).where(eq(game.id, gameId)).run();

const t0 = Date.now();
const out = await ensureSimUpToDate(gameId);
const dt = Date.now() - t0;
console.log(`Catch-up: ran ${out.ranDays} game-days in ${dt}ms (rate=${out.rateClass} ${out.effectiveRate}×).`);

const fresh = db.select().from(game).where(eq(game.id, gameId)).get()!;
const r = db.select().from(route).where(eq(route.gameId, gameId)).get()!;
const loan = db.select().from(financeInstrument).where(eq(financeInstrument.id, loanId)).get()!;
const news = db.select().from(newsEvent).where(eq(newsEvent.gameId, gameId)).orderBy(desc(newsEvent.gameDay)).all();

const expectedMonthsPaid = Math.floor(fresh.currentDay / 30);
console.log(`\n— Result —`);
console.log(`Cash:   ${formatUsdCents(fresh.cashCents)}  (start $7.00M)`);
console.log(`Day:    ${fresh.currentDay}`);
console.log(`Fuel:   $${(fresh.fuelPriceCentsPerLiter / 100).toFixed(2)}/L`);
console.log(`Rep:    ${fresh.reputation} of 100`);
console.log(`Route:  ${r.lastDailyPax} pax/day · ${(r.lastLoadFactor * 100).toFixed(0)}% load · ${formatUsdCents(r.lastDailyRevenueCents)} rev · ${formatUsdCents(r.lastDailyCostCents)} cost`);
console.log(`Loan:   outstanding ${formatUsdCents(loan.outstandingCents)} · ${loan.monthsPaid}/${loan.termMonths} mo paid (expected ${expectedMonthsPaid})`);
console.log(`\n— Newsroom (${news.length}) —`);
for (const n of news.slice(0, 10)) {
  console.log(`  [day ${n.gameDay}] ${n.category.padEnd(9)} ${n.severity.padEnd(5)} ${n.headline}`);
}

sqlite.close();

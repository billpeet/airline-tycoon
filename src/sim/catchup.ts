/**
 * Catch-up runner. Reads game state, advances N whole game-days, writes
 * aggregated transactions and structured news cards.
 *
 * One database transaction wraps the whole catch-up — partial sims are not
 * a thing.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import {
  game,
  aircraft,
  route,
  txn,
  newsEvent,
  airport,
  aircraftType,
  airlineHub,
  financeInstrument,
} from "@/db/schema";
import { decideElapsed } from "./time";
import { dailyRng } from "./rng";
import { runTick, type TickAircraft, type TickRoute } from "./tick";
import { randomId } from "@/lib/id";
import { buildCompetitorIndex } from "./competition";
import {
  loanMonthlyTick,
  monthsElapsedSinceStart,
  revolverDailyInterestCents,
  REVOLVER_MONTHLY_FEE_CENTS,
} from "./finance";

export interface CatchupResult {
  ranDays: number;
  cappedOffline: boolean;
  rateClass: "connected" | "offline";
  effectiveRate: number;
  newsWritten: number;
}

const NOOP_RESULT: CatchupResult = {
  ranDays: 0,
  cappedOffline: false,
  rateClass: "connected",
  effectiveRate: 1,
  newsWritten: 0,
};

/**
 * Advance the named game up to "now". Idempotent and safe to call from any
 * authenticated request. Returns a small summary the caller can show.
 */
export async function ensureSimUpToDate(gameId: string): Promise<CatchupResult> {
  const g = await db.query.game.findFirst({ where: eq(game.id, gameId) });
  if (!g) return NOOP_RESULT;

  const now = Date.now();
  const decision = decideElapsed(g.lastSimulatedAt, g.lastActiveAt, now, g.rateMultiplier);

  if (decision.gameDays <= 0) {
    // Touch lastActiveAt so the next call's classification stays "connected".
    await db.update(game).set({ lastActiveAt: new Date(now) }).where(eq(game.id, gameId));
    return { ...NOOP_RESULT, rateClass: decision.rateClass, effectiveRate: decision.effectiveRate };
  }

  // Snapshot reference data once
  const [airports, types, hubs] = await Promise.all([
    db.select().from(airport),
    db.select().from(aircraftType),
    db.select({ airlineId: airlineHub.airlineId, airportId: airlineHub.airportId }).from(airlineHub),
  ]);
  const airportMap = new Map(airports.map((a) => [a.id, a]));
  const typeMap = new Map(types.map((t) => [t.id, t]));
  const competitor = buildCompetitorIndex(hubs);

  const [playerAircraft, playerRoutes, instruments] = await Promise.all([
    db.select().from(aircraft).where(eq(aircraft.gameId, gameId)),
    db.select().from(route).where(eq(route.gameId, gameId)),
    db.select().from(financeInstrument).where(
      and(eq(financeInstrument.gameId, gameId), eq(financeInstrument.status, "active")),
    ),
  ]);

  const tickAircraft: TickAircraft[] = playerAircraft.map((a) => ({
    id: a.id,
    typeId: a.typeId,
    baseAirportId: a.baseAirportId,
  }));
  const tickRoutes: TickRoute[] = playerRoutes.map((r) => ({
    id: r.id,
    fromAirportId: r.fromAirportId,
    toAirportId: r.toAirportId,
    aircraftId: r.aircraftId,
    distanceKm: r.distanceKm,
    fareEconomyCents: r.fareEconomyCents,
    frequencyPerWeek: r.frequencyPerWeek,
    status: r.status,
  }));

  // Per-route running totals across the whole catch-up window
  const perRoute = new Map<
    string,
    { revenue: number; cost: number; pax: number; loadSum: number; days: number }
  >();
  for (const r of tickRoutes) perRoute.set(r.id, { revenue: 0, cost: 0, pax: 0, loadSum: 0, days: 0 });

  let cash = g.cashCents;
  let fuelPrice = g.fuelPriceCentsPerLiter;
  let reputation = g.reputation;
  let runningDay = g.currentDay;
  const txnRows: (typeof txn.$inferInsert)[] = [];
  const fuelHistory: number[] = [fuelPrice];
  const reputationHistory: number[] = [reputation];

  // Mutable copies so we can update outstanding balances over the catch-up
  type InstrumentMut = typeof instruments[number];
  const instrumentsMut: InstrumentMut[] = instruments.map((i) => ({ ...i }));
  const revolver = instrumentsMut.find((i) => i.kind === "revolver");

  for (let i = 0; i < decision.gameDays; i++) {
    runningDay++;
    const rng = dailyRng(g.rngSeed, runningDay);
    const out = runTick({
      gameDay: runningDay,
      fuelPriceCentsPerLiter: fuelPrice,
      reputation,
      rng,
      routes: tickRoutes,
      aircraft: tickAircraft,
      airports: airportMap,
      aircraftTypes: typeMap,
      competitorCount: (a, b) => competitor.count(a, b),
    });

    let dayNet = 0;
    let avgLoad = 0;
    for (const rt of out.routeTicks) {
      const acc = perRoute.get(rt.routeId)!;
      const cost = rt.fuelCents + rt.crewCents + rt.landingCents;
      acc.revenue += rt.revenueCents;
      acc.cost += cost;
      acc.pax += rt.paxCarried;
      acc.loadSum += rt.loadFactor;
      acc.days += 1;
      avgLoad += rt.loadFactor;

      dayNet += rt.revenueCents - cost;

      if (rt.revenueCents) txnRows.push(row(gameId, runningDay, "route_revenue", rt.revenueCents, "route", rt.routeId));
      if (rt.fuelCents) txnRows.push(row(gameId, runningDay, "route_fuel", -rt.fuelCents, "route", rt.routeId));
      if (rt.crewCents) txnRows.push(row(gameId, runningDay, "route_crew", -rt.crewCents, "route", rt.routeId));
      if (rt.landingCents) txnRows.push(row(gameId, runningDay, "route_landing", -rt.landingCents, "route", rt.routeId));
    }
    if (out.routeTicks.length > 0) avgLoad /= out.routeTicks.length;

    let idleTotal = 0;
    for (const ic of out.idleCosts) idleTotal += ic.costCents;
    if (idleTotal) {
      txnRows.push(row(gameId, runningDay, "aircraft_idle", -idleTotal, "fleet", null, `Idle costs · ${out.idleCosts.length} aircraft`));
      dayNet -= idleTotal;
    }

    cash += dayNet;

    // Reputation drift from average load factor (small daily delta, clamped 0..100)
    if (out.routeTicks.length > 0) {
      let repDelta = 0;
      if (avgLoad >= 0.75) repDelta = 0.05;
      else if (avgLoad >= 0.45) repDelta = 0.02;
      else if (avgLoad >= 0.20) repDelta = -0.02;
      else repDelta = -0.05;
      reputation = Math.max(0, Math.min(100, reputation + repDelta));
    }

    // ----- Finance: monthly P&I + lease + revolver fee -----
    for (const inst of instrumentsMut) {
      if (inst.status !== "active") continue;
      if (inst.kind === "revolver") {
        // Daily interest on overdrawn cash
        const dailyInt = revolverDailyInterestCents(cash, inst.rateBps);
        if (dailyInt > 0) {
          cash -= dailyInt;
          txnRows.push(row(gameId, runningDay, "revolver_interest", -dailyInt, "finance", inst.id, "Revolver interest"));
        }
        // Monthly facility fee on month boundaries since instrument start
        const monthsNow = monthsElapsedSinceStart(runningDay, inst.startedOnDay);
        if (monthsNow > inst.monthsPaid) {
          const monthsDue = monthsNow - inst.monthsPaid;
          const feeTotal = REVOLVER_MONTHLY_FEE_CENTS * monthsDue;
          cash -= feeTotal;
          txnRows.push(row(gameId, runningDay, "revolver_fee", -feeTotal, "finance", inst.id, "Revolver facility fee"));
          inst.monthsPaid = monthsNow;
        }
        continue;
      }

      // Loans and leases — month-boundary auto-debit
      const monthsNow = monthsElapsedSinceStart(runningDay, inst.startedOnDay);
      while (inst.monthsPaid < monthsNow && inst.outstandingCents > 0 && inst.status === "active") {
        if (inst.kind === "loan") {
          const t = loanMonthlyTick(inst.outstandingCents, inst.rateBps, inst.termMonths, inst.monthlyPaymentCents);
          const total = t.principalCents + t.interestCents;
          cash -= total;
          txnRows.push(row(gameId, runningDay, "loan_payment", -t.principalCents, "finance", inst.id, "Loan principal"));
          if (t.interestCents) {
            txnRows.push(row(gameId, runningDay, "loan_interest", -t.interestCents, "finance", inst.id, "Loan interest"));
          }
          inst.outstandingCents = t.newOutstandingCents;
          inst.monthsPaid += 1;
          if (t.isFinalPayment) {
            inst.status = "paid_off";
          }
        } else if (inst.kind === "lease") {
          cash -= inst.monthlyPaymentCents;
          txnRows.push(row(gameId, runningDay, "lease_payment", -inst.monthlyPaymentCents, "finance", inst.id, "Lease payment"));
          inst.outstandingCents = Math.max(0, inst.outstandingCents - inst.monthlyPaymentCents);
          inst.monthsPaid += 1;
          if (inst.monthsPaid >= inst.termMonths) {
            inst.status = "closed";
          }
        }
      }
    }

    fuelPrice = out.newFuelPriceCentsPerLiter;
    fuelHistory.push(fuelPrice);
    reputationHistory.push(reputation);
  }

  // -------------------- Persist --------------------
  const newsToWrite: (typeof newsEvent.$inferInsert)[] = buildNews(
    gameId,
    g.currentDay,
    runningDay,
    perRoute,
    tickRoutes,
    airportMap,
    fuelHistory,
    cash - g.cashCents,
    g.reputation,
    Math.round(reputation),
  );

  db.transaction((tx) => {
    if (txnRows.length) {
      for (let i = 0; i < txnRows.length; i += 500) {
        tx.insert(txn).values(txnRows.slice(i, i + 500)).run();
      }
    }
    if (newsToWrite.length) tx.insert(newsEvent).values(newsToWrite).run();

    for (const [routeId, acc] of perRoute) {
      if (!acc.days) continue;
      tx
        .update(route)
        .set({
          lastDailyPax: Math.round(acc.pax / acc.days),
          lastDailyRevenueCents: Math.round(acc.revenue / acc.days),
          lastDailyCostCents: Math.round(acc.cost / acc.days),
          lastLoadFactor: acc.loadSum / acc.days,
        })
        .where(eq(route.id, routeId))
        .run();
    }

    // Persist finance instrument updates
    for (const inst of instrumentsMut) {
      tx.update(financeInstrument)
        .set({
          outstandingCents: inst.outstandingCents,
          monthsPaid: inst.monthsPaid,
          status: inst.status,
        })
        .where(eq(financeInstrument.id, inst.id))
        .run();
    }

    tx
      .update(game)
      .set({
        currentDay: runningDay,
        cashCents: cash,
        fuelPriceCentsPerLiter: fuelPrice,
        reputation: Math.round(reputation),
        lastSimulatedAt: new Date(g.lastSimulatedAt.getTime() + decision.consumedRealMs),
        lastActiveAt: new Date(now),
      })
      .where(eq(game.id, gameId))
      .run();
  });

  return {
    ranDays: decision.gameDays,
    cappedOffline: decision.cappedOffline,
    rateClass: decision.rateClass,
    effectiveRate: decision.effectiveRate,
    newsWritten: newsToWrite.length,
  };
}

function row(
  gameId: string,
  day: number,
  kind: typeof txn.$inferInsert["kind"],
  amountCents: number,
  refTable: string | null,
  refId: string | null,
  note?: string,
): typeof txn.$inferInsert {
  return {
    id: randomId("tx"),
    gameId,
    gameDay: day,
    kind,
    amountCents,
    refTable,
    refId,
    note: note ?? null,
  };
}

function buildNews(
  gameId: string,
  startDay: number,
  endDay: number,
  perRoute: Map<string, { revenue: number; cost: number; pax: number; loadSum: number; days: number }>,
  routes: TickRoute[],
  airports: Map<string, ReturnType<typeof Map.prototype.get>>,
  fuelHistory: number[],
  cashDelta: number,
  repBefore: number,
  repAfter: number,
): (typeof newsEvent.$inferInsert)[] {
  const out: (typeof newsEvent.$inferInsert)[] = [];
  const now = new Date();
  const days = endDay - startDay;
  const headlineDay = endDay;

  // Top-line "while you were away" card if the gap is long enough
  if (days >= 1) {
    const cashStr = formatUsdCents(cashDelta);
    out.push({
      id: randomId("news"),
      gameId,
      gameDay: headlineDay,
      category: "milestone",
      severity: cashDelta >= 0 ? "good" : "bad",
      headline:
        days === 1
          ? `One game-day on the books · net ${cashStr}`
          : `${days} game-days on the books · net ${cashStr}`,
      body:
        cashDelta >= 0
          ? "Routes flew, cash came in. The board is yours."
          : "Costs outran revenue. Trim something or grow into it.",
      meta: JSON.stringify({ days, cashDelta }),
      pinned: false,
      seen: false,
      createdAt: now,
    });
  }

  // Per-route summaries (only material ones)
  for (const r of routes) {
    const acc = perRoute.get(r.id);
    if (!acc || !acc.days) continue;
    const net = acc.revenue - acc.cost;
    if (Math.abs(net) < 50_000) continue; // skip < $500 noise

    const from = airports.get(r.fromAirportId) as { iata?: string | null; city?: string | null } | undefined;
    const to = airports.get(r.toAirportId) as { iata?: string | null; city?: string | null } | undefined;
    const tag = `${from?.iata ?? "—"} → ${to?.iata ?? "—"}`;
    const avgLoad = (acc.loadSum / acc.days) * 100;
    out.push({
      id: randomId("news"),
      gameId,
      gameDay: headlineDay,
      category: "routes",
      severity: net >= 0 ? "good" : "warn",
      headline: `${tag} · net ${formatUsdCents(net)} over ${acc.days}d`,
      body: `Carried ${acc.pax.toLocaleString()} pax · avg load ${avgLoad.toFixed(0)}%`,
      meta: JSON.stringify({
        routeId: r.id,
        revenueCents: acc.revenue,
        costCents: acc.cost,
        pax: acc.pax,
      }),
      pinned: false,
      seen: false,
      createdAt: now,
    });
  }

  // Reputation milestone (every 10 points crossed)
  const beforeBucket = Math.floor(repBefore / 10);
  const afterBucket = Math.floor(repAfter / 10);
  if (afterBucket !== beforeBucket) {
    const climbing = afterBucket > beforeBucket;
    const milestone = (climbing ? afterBucket : beforeBucket) * 10;
    out.push({
      id: randomId("news"),
      gameId,
      gameDay: headlineDay,
      category: "milestone",
      severity: climbing ? "good" : "warn",
      headline: climbing ? `Reputation crossed ${milestone}` : `Reputation slipped below ${milestone}`,
      body: `Now sitting at ${repAfter} of 100.`,
      meta: JSON.stringify({ from: repBefore, to: repAfter }),
      pinned: false,
      seen: false,
      createdAt: now,
    });
  }

  // Fuel summary
  if (fuelHistory.length > 1) {
    const first = fuelHistory[0]!;
    const last = fuelHistory[fuelHistory.length - 1]!;
    const dPct = ((last - first) / first) * 100;
    if (Math.abs(dPct) >= 1.5) {
      out.push({
        id: randomId("news"),
        gameId,
        gameDay: headlineDay,
        category: "market",
        severity: dPct > 0 ? "warn" : "good",
        headline: `Jet fuel ${dPct > 0 ? "up" : "down"} ${Math.abs(dPct).toFixed(1)}%`,
        body: `From ${(first / 100).toFixed(2)}/L to ${(last / 100).toFixed(2)}/L`,
        meta: JSON.stringify({ from: first, to: last }),
        pinned: false,
        seen: false,
        createdAt: now,
      });
    }
  }

  return out;
}

function formatUsdCents(c: number): string {
  const sign = c < 0 ? "-" : "+";
  const abs = Math.abs(c) / 100;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

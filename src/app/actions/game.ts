"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  financeInstrument,
} from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { randomId } from "@/lib/id";
import { seedFromString } from "@/sim/rng";
import { greatCircleKm, routeFlightHoursPerDay, MAX_DAILY_FLIGHT_HOURS } from "@/sim/geo";
import { ensureSimUpToDate } from "@/sim/catchup";
import {
  monthlyPaymentCents,
  DEFAULT_LOAN_RATE_BPS,
  DEFAULT_REVOLVER_RATE_BPS,
  FINANCE_DOWNPAYMENT_PCT,
  LEASE_DEPOSIT_MONTHS,
} from "@/sim/finance";

const STARTER_CASH_CENTS = 5_000_000_00; // $5M
const STARTER_AIRCRAFT_TYPE = "AT43";    // ATR 42-600

// ---------------------------------------------------------------------------
// Found a new airline
// ---------------------------------------------------------------------------

export async function createGame(input: {
  airlineName: string;
  airlineCode: string;
  homeAirportId: string;
}) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");

  const existing = await db.query.game.findFirst({
    where: eq(game.userId, session.user.id),
  });
  if (existing) redirect("/dashboard");

  const code = input.airlineCode.trim().toUpperCase().slice(0, 3);
  if (!/^[A-Z0-9]{2,3}$/.test(code)) {
    throw new Error("Call-sign must be 2–3 letters or digits");
  }
  const name = input.airlineName.trim().slice(0, 60);
  if (name.length < 3) throw new Error("Airline name is too short");

  const homeAirport = await db.query.airport.findFirst({
    where: eq(airport.id, input.homeAirportId),
  });
  if (!homeAirport) throw new Error("Home airport not recognised");

  const starter = await db.query.aircraftType.findFirst({
    where: eq(aircraftType.id, STARTER_AIRCRAFT_TYPE),
  });
  if (!starter) throw new Error("Starter aircraft missing — seed not run?");

  const now = new Date();
  const gameId = randomId("game");
  const aircraftRowId = randomId("acft");

  db.transaction((tx) => {
    tx.insert(game).values({
      id: gameId,
      userId: session.user.id,
      airlineName: name,
      airlineCode: code,
      homeAirportId: homeAirport.id,
      startedAt: now,
      lastSimulatedAt: now,
      lastActiveAt: now,
      currentDay: 0,
      rateMultiplier: 1,
      rngSeed: seedFromString(`${session.user.id}:${gameId}`),
      cashCents: STARTER_CASH_CENTS,
      reputation: 32,
      fuelPriceCentsPerLiter: 85,
      createdAt: now,
    }).run();

    tx.insert(aircraft).values({
      id: aircraftRowId,
      gameId,
      typeId: starter.id,
      tail: `${code}-001`,
      baseAirportId: homeAirport.id,
      status: "in_service",
      acquiredOnDay: 0,
      acquisitionMode: "starter",
      cycleHours: 0,
    }).run();

    tx.insert(txn).values({
      id: randomId("tx"),
      gameId,
      gameDay: 0,
      kind: "starter_grant",
      amountCents: STARTER_CASH_CENTS,
      refTable: null,
      refId: null,
      note: "Founding capital",
    }).run();

    tx.insert(newsEvent).values({
      id: randomId("news"),
      gameId,
      gameDay: 0,
      category: "milestone",
      severity: "good",
      headline: `${name} certified to fly`,
      body: `Operator certificate granted at ${homeAirport.city ?? homeAirport.name}. Starter ATR 42-600 delivered, $5M in the bank.`,
      meta: JSON.stringify({ home: homeAirport.id, code }),
      pinned: true,
      seen: false,
      createdAt: now,
    }).run();
  });

  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Acquire an aircraft (cash purchase)
// ---------------------------------------------------------------------------

export type AcquireMode =
  | { kind: "cash" }
  | { kind: "finance"; termMonths: number }
  | { kind: "lease"; termMonths: number };

export async function buyAircraft(input: {
  typeId: string;
  baseAirportId: string;
  mode?: AcquireMode;
}) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");

  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) throw new Error("No active game");

  await ensureSimUpToDate(g.id);

  const type = await db.query.aircraftType.findFirst({
    where: eq(aircraftType.id, input.typeId),
  });
  if (!type) throw new Error("Unknown aircraft type");
  const home = await db.query.airport.findFirst({
    where: eq(airport.id, input.baseAirportId),
  });
  if (!home) throw new Error("Base airport not recognised");

  const fresh = await db.query.game.findFirst({ where: eq(game.id, g.id) });
  if (!fresh) throw new Error("Game vanished");

  const priceCents = Math.round(type.listPriceMusd * 1_000_000 * 100);
  const mode: AcquireMode = input.mode ?? { kind: "cash" };

  // Compute upfront cash + monthly outflow for the chosen mode
  let upfrontCents = 0;
  let monthlyCents = 0;
  let principalCents = 0;
  let termMonths = 0;
  let acquisitionMode: "cash" | "finance" | "lease" = "cash";

  if (mode.kind === "cash") {
    upfrontCents = priceCents;
    acquisitionMode = "cash";
  } else if (mode.kind === "finance") {
    if (![24, 60, 120].includes(mode.termMonths)) throw new Error("Invalid loan term");
    acquisitionMode = "finance";
    termMonths = mode.termMonths;
    upfrontCents = Math.round(priceCents * FINANCE_DOWNPAYMENT_PCT);
    principalCents = priceCents - upfrontCents;
    monthlyCents = monthlyPaymentCents(principalCents, DEFAULT_LOAN_RATE_BPS, termMonths);
  } else {
    if (![24, 36, 60].includes(mode.termMonths)) throw new Error("Invalid lease term");
    acquisitionMode = "lease";
    termMonths = mode.termMonths;
    monthlyCents = Math.round(type.leaseRateKusdMonth * 1000 * 100);
    upfrontCents = monthlyCents * LEASE_DEPOSIT_MONTHS;
  }

  if (fresh.cashCents < upfrontCents) {
    throw new Error(
      `Not enough cash for the upfront payment ($${(upfrontCents / 100 / 1_000_000).toFixed(2)}M)`,
    );
  }

  const owned = await db.select().from(aircraft).where(eq(aircraft.gameId, g.id));
  const tailNumber = (owned.length + 1).toString().padStart(3, "0");
  const aircraftRowId = randomId("acft");
  const now = new Date();
  const instrumentId = mode.kind !== "cash" ? randomId("fin") : null;

  db.transaction((tx) => {
    tx.insert(aircraft).values({
      id: aircraftRowId,
      gameId: g.id,
      typeId: type.id,
      tail: `${fresh.airlineCode}-${tailNumber}`,
      baseAirportId: home.id,
      status: "in_service",
      acquiredOnDay: fresh.currentDay,
      acquisitionMode,
      financeInstrumentId: instrumentId,
      cycleHours: 0,
    }).run();

    if (mode.kind === "finance" && instrumentId) {
      tx.insert(financeInstrument).values({
        id: instrumentId,
        gameId: g.id,
        kind: "loan",
        status: "active",
        principalCents,
        outstandingCents: principalCents,
        monthlyPaymentCents: monthlyCents,
        rateBps: DEFAULT_LOAN_RATE_BPS,
        termMonths,
        monthsPaid: 0,
        collateralAircraftId: aircraftRowId,
        startedOnDay: fresh.currentDay,
        endsOnDay: fresh.currentDay + termMonths * 30,
        notes: `Aircraft loan · ${type.manufacturer} ${type.model}`,
      }).run();
      tx.insert(txn).values({
        id: randomId("tx"),
        gameId: g.id,
        gameDay: fresh.currentDay,
        kind: "loan_drawdown",
        amountCents: principalCents,
        refTable: "finance_instrument",
        refId: instrumentId,
        note: `Loan drawdown · ${type.model}`,
      }).run();
    }

    if (mode.kind === "lease" && instrumentId) {
      tx.insert(financeInstrument).values({
        id: instrumentId,
        gameId: g.id,
        kind: "lease",
        status: "active",
        principalCents: monthlyCents * termMonths, // notional total
        outstandingCents: monthlyCents * termMonths,
        monthlyPaymentCents: monthlyCents,
        rateBps: 0,
        termMonths,
        monthsPaid: 0,
        collateralAircraftId: aircraftRowId,
        startedOnDay: fresh.currentDay,
        endsOnDay: fresh.currentDay + termMonths * 30,
        notes: `Operating lease · ${type.manufacturer} ${type.model}`,
      }).run();
      tx.insert(txn).values({
        id: randomId("tx"),
        gameId: g.id,
        gameDay: fresh.currentDay,
        kind: "lease_deposit",
        amountCents: -upfrontCents,
        refTable: "finance_instrument",
        refId: instrumentId,
        note: `Lease deposit (${LEASE_DEPOSIT_MONTHS} months)`,
      }).run();
    }

    if (mode.kind === "cash") {
      tx.insert(txn).values({
        id: randomId("tx"),
        gameId: g.id,
        gameDay: fresh.currentDay,
        kind: "aircraft_purchase",
        amountCents: -priceCents,
        refTable: "aircraft",
        refId: aircraftRowId,
        note: `${type.manufacturer} ${type.model} · cash`,
      }).run();
    } else if (mode.kind === "finance") {
      tx.insert(txn).values({
        id: randomId("tx"),
        gameId: g.id,
        gameDay: fresh.currentDay,
        kind: "aircraft_purchase",
        amountCents: -upfrontCents,
        refTable: "aircraft",
        refId: aircraftRowId,
        note: `${type.manufacturer} ${type.model} · ${(FINANCE_DOWNPAYMENT_PCT * 100).toFixed(0)}% down`,
      }).run();
    }

    tx.update(game)
      .set({ cashCents: fresh.cashCents - upfrontCents })
      .where(eq(game.id, g.id))
      .run();

    const modeLabel =
      mode.kind === "cash"
        ? "cash"
        : mode.kind === "finance"
          ? `loan · ${termMonths}mo`
          : `lease · ${termMonths}mo`;
    tx.insert(newsEvent).values({
      id: randomId("news"),
      gameId: g.id,
      gameDay: fresh.currentDay,
      category: "fleet",
      severity: "good",
      headline: `New tail: ${fresh.airlineCode}-${tailNumber}`,
      body: `${type.manufacturer} ${type.model} delivered to ${home.city ?? home.name} · ${modeLabel}.`,
      meta: JSON.stringify({ aircraftId: aircraftRowId, typeId: type.id, mode: mode.kind }),
      pinned: false,
      seen: false,
      createdAt: now,
    }).run();
  });

  revalidatePath("/fleet");
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Open a route
// ---------------------------------------------------------------------------

export async function openRoute(input: {
  fromAirportId: string;
  toAirportId: string;
  aircraftId: string;
  fareEconomyCents: number;
  frequencyPerWeek: number;
}) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");

  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) throw new Error("No active game");
  await ensureSimUpToDate(g.id);

  if (input.fromAirportId === input.toAirportId) {
    throw new Error("Origin and destination must differ");
  }
  if (input.frequencyPerWeek < 1 || input.frequencyPerWeek > 21) {
    throw new Error("Frequency must be 1–21 per week");
  }
  if (input.fareEconomyCents < 1000) throw new Error("Fare too low");

  const [from, to, acftRow] = await Promise.all([
    db.query.airport.findFirst({ where: eq(airport.id, input.fromAirportId) }),
    db.query.airport.findFirst({ where: eq(airport.id, input.toAirportId) }),
    db.query.aircraft.findFirst({
      where: and(eq(aircraft.id, input.aircraftId), eq(aircraft.gameId, g.id)),
    }),
  ]);
  if (!from || !to) throw new Error("Airport not recognised");
  if (!acftRow) throw new Error("Aircraft not in your fleet");

  const type = await db.query.aircraftType.findFirst({
    where: eq(aircraftType.id, acftRow.typeId),
  });
  if (!type) throw new Error("Aircraft type missing");

  const distance = greatCircleKm(from.lat, from.lon, to.lat, to.lon);
  if (distance > type.rangeKm) {
    throw new Error(`Beyond aircraft range (${Math.round(distance)} km > ${type.rangeKm} km)`);
  }
  if (acftRow.baseAirportId !== from.id && acftRow.baseAirportId !== to.id) {
    throw new Error(`Aircraft must operate from its base (${acftRow.baseAirportId})`);
  }

  // Utilisation cap: an aircraft can only fly so many flight-hours/day.
  const existingRoutes = await db
    .select({
      distanceKm: route.distanceKm,
      frequencyPerWeek: route.frequencyPerWeek,
    })
    .from(route)
    .where(and(eq(route.aircraftId, acftRow.id), eq(route.status, "active")));
  const existingHours = existingRoutes.reduce(
    (s, r) => s + routeFlightHoursPerDay(r.distanceKm, r.frequencyPerWeek, type.cruiseSpeedKts),
    0,
  );
  const newHours = routeFlightHoursPerDay(distance, input.frequencyPerWeek, type.cruiseSpeedKts);
  if (existingHours + newHours > MAX_DAILY_FLIGHT_HOURS) {
    throw new Error(
      `${acftRow.tail} is over its daily utilisation cap: ${existingHours.toFixed(1)}h used + ${newHours.toFixed(1)}h new > ${MAX_DAILY_FLIGHT_HOURS}h max. Drop frequency or assign a different tail.`,
    );
  }

  const routeId = randomId("rte");
  const now = new Date();

  db.transaction((tx) => {
    tx.insert(route).values({
      id: routeId,
      gameId: g.id,
      fromAirportId: from.id,
      toAirportId: to.id,
      aircraftId: acftRow.id,
      distanceKm: distance,
      fareEconomyCents: input.fareEconomyCents,
      frequencyPerWeek: input.frequencyPerWeek,
      openedOnDay: g.currentDay,
      status: "active",
    }).run();

    tx.insert(newsEvent).values({
      id: randomId("news"),
      gameId: g.id,
      gameDay: g.currentDay,
      category: "routes",
      severity: "info",
      headline: `Opened ${from.iata ?? from.id} → ${to.iata ?? to.id}`,
      body: `${input.frequencyPerWeek}× weekly · ${(input.fareEconomyCents / 100).toFixed(0)} USD economy · ${Math.round(distance)} km · ${acftRow.tail}`,
      meta: JSON.stringify({ routeId, distance }),
      pinned: false,
      seen: false,
      createdAt: now,
    }).run();
  });

  revalidatePath("/routes");
  revalidatePath("/dashboard");
  revalidatePath("/globe");
}

export async function closeRoute(routeId: string) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) throw new Error("No active game");
  await ensureSimUpToDate(g.id);

  await db
    .update(route)
    .set({ status: "closed", closedOnDay: g.currentDay })
    .where(and(eq(route.id, routeId), eq(route.gameId, g.id)));

  revalidatePath("/routes");
  revalidatePath("/dashboard");
  revalidatePath("/globe");
}

// ---------------------------------------------------------------------------
// Update route — fare, frequency, optionally swap aircraft
// ---------------------------------------------------------------------------

export async function updateRoute(input: {
  routeId: string;
  fareEconomyCents?: number;
  frequencyPerWeek?: number;
  aircraftId?: string;
}) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) throw new Error("No active game");
  await ensureSimUpToDate(g.id);

  const existing = await db.query.route.findFirst({
    where: and(eq(route.id, input.routeId), eq(route.gameId, g.id)),
  });
  if (!existing) throw new Error("Route not found");

  const newFare = input.fareEconomyCents ?? existing.fareEconomyCents;
  const newFreq = input.frequencyPerWeek ?? existing.frequencyPerWeek;
  const newAircraftId = input.aircraftId ?? existing.aircraftId;

  if (newFare < 1000) throw new Error("Fare too low");
  if (newFreq < 1 || newFreq > 21) throw new Error("Frequency must be 1–21 per week");

  const acftRow = await db.query.aircraft.findFirst({
    where: and(eq(aircraft.id, newAircraftId), eq(aircraft.gameId, g.id)),
  });
  if (!acftRow) throw new Error("Aircraft not in your fleet");

  const type = await db.query.aircraftType.findFirst({
    where: eq(aircraftType.id, acftRow.typeId),
  });
  if (!type) throw new Error("Aircraft type missing");

  // Range check (defensive — distance is fixed for the route)
  if (existing.distanceKm > type.rangeKm) {
    throw new Error(`Beyond aircraft range (${Math.round(existing.distanceKm)} km > ${type.rangeKm} km)`);
  }
  // Aircraft must operate from one of the route's endpoints
  if (acftRow.baseAirportId !== existing.fromAirportId && acftRow.baseAirportId !== existing.toAirportId) {
    throw new Error("Aircraft must be based at one of the route's endpoints");
  }

  // Utilisation: sum existing routes for the new aircraft EXCLUDING this route
  // (since we're re-assigning), then add the new hours.
  const otherRoutes = await db
    .select({ id: route.id, distanceKm: route.distanceKm, frequencyPerWeek: route.frequencyPerWeek })
    .from(route)
    .where(and(eq(route.aircraftId, newAircraftId), eq(route.status, "active")));
  const existingHours = otherRoutes
    .filter((r) => r.id !== existing.id)
    .reduce(
      (s, r) => s + routeFlightHoursPerDay(r.distanceKm, r.frequencyPerWeek, type.cruiseSpeedKts),
      0,
    );
  const newHours = routeFlightHoursPerDay(existing.distanceKm, newFreq, type.cruiseSpeedKts);
  if (existingHours + newHours > MAX_DAILY_FLIGHT_HOURS) {
    throw new Error(
      `${acftRow.tail} would be over its daily utilisation cap: ${existingHours.toFixed(1)}h other + ${newHours.toFixed(1)}h this route > ${MAX_DAILY_FLIGHT_HOURS}h max.`,
    );
  }

  await db
    .update(route)
    .set({
      fareEconomyCents: newFare,
      frequencyPerWeek: newFreq,
      aircraftId: newAircraftId,
    })
    .where(eq(route.id, existing.id));

  revalidatePath("/routes");
  revalidatePath("/dashboard");
  revalidatePath("/globe");
}

// ---------------------------------------------------------------------------
// Reopen a closed route (re-validates everything)
// ---------------------------------------------------------------------------

export async function reopenRoute(routeId: string) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) throw new Error("No active game");
  await ensureSimUpToDate(g.id);

  const r = await db.query.route.findFirst({
    where: and(eq(route.id, routeId), eq(route.gameId, g.id)),
  });
  if (!r) throw new Error("Route not found");
  if (r.status === "active") return; // already open

  const acftRow = await db.query.aircraft.findFirst({
    where: and(eq(aircraft.id, r.aircraftId), eq(aircraft.gameId, g.id)),
  });
  if (!acftRow) throw new Error("Original aircraft is no longer in your fleet");
  if (acftRow.status !== "in_service") throw new Error(`${acftRow.tail} is currently ${acftRow.status.replace("_", " ")}`);

  const type = await db.query.aircraftType.findFirst({ where: eq(aircraftType.id, acftRow.typeId) });
  if (!type) throw new Error("Aircraft type missing");
  if (r.distanceKm > type.rangeKm) {
    throw new Error(`Beyond aircraft range (${Math.round(r.distanceKm)} km > ${type.rangeKm} km)`);
  }

  // Utilisation cap with current routes
  const otherRoutes = await db
    .select({ distanceKm: route.distanceKm, frequencyPerWeek: route.frequencyPerWeek })
    .from(route)
    .where(and(eq(route.aircraftId, acftRow.id), eq(route.status, "active")));
  const existingHours = otherRoutes.reduce(
    (s, x) => s + routeFlightHoursPerDay(x.distanceKm, x.frequencyPerWeek, type.cruiseSpeedKts),
    0,
  );
  const myHours = routeFlightHoursPerDay(r.distanceKm, r.frequencyPerWeek, type.cruiseSpeedKts);
  if (existingHours + myHours > MAX_DAILY_FLIGHT_HOURS) {
    throw new Error(
      `${acftRow.tail} can't take this route back — would push utilisation to ${(existingHours + myHours).toFixed(1)}h > ${MAX_DAILY_FLIGHT_HOURS}h.`,
    );
  }

  const now = new Date();
  db.transaction((tx) => {
    tx.update(route)
      .set({ status: "active", closedOnDay: null })
      .where(eq(route.id, r.id))
      .run();

    tx.insert(newsEvent).values({
      id: randomId("news"),
      gameId: g.id,
      gameDay: g.currentDay,
      category: "routes",
      severity: "info",
      headline: `Reopened route on ${acftRow.tail}`,
      body: `${r.frequencyPerWeek}× weekly · $${(r.fareEconomyCents / 100).toFixed(0)} economy.`,
      meta: JSON.stringify({ routeId: r.id }),
      pinned: false,
      seen: false,
      createdAt: now,
    }).run();
  });

  revalidatePath("/routes");
  revalidatePath("/dashboard");
  revalidatePath("/globe");
}

export async function setRateMultiplier(rate: 1 | 2 | 4 | 8) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) throw new Error("No active game");
  await ensureSimUpToDate(g.id);

  await db.update(game).set({ rateMultiplier: rate }).where(eq(game.id, g.id));
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Finance — apply for a stand-alone loan
// ---------------------------------------------------------------------------

export async function applyForLoan(input: {
  principalCents: number;
  termMonths: number;
}) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) throw new Error("No active game");
  await ensureSimUpToDate(g.id);

  if (![24, 60, 120].includes(input.termMonths)) throw new Error("Invalid loan term");
  if (input.principalCents < 100_000_00 || input.principalCents > 200_000_000_00) {
    throw new Error("Principal must be between $100K and $200M");
  }

  const monthly = monthlyPaymentCents(input.principalCents, DEFAULT_LOAN_RATE_BPS, input.termMonths);
  const fresh = await db.query.game.findFirst({ where: eq(game.id, g.id) });
  if (!fresh) throw new Error("Game vanished");

  const instrumentId = randomId("fin");
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(financeInstrument).values({
      id: instrumentId,
      gameId: g.id,
      kind: "loan",
      status: "active",
      principalCents: input.principalCents,
      outstandingCents: input.principalCents,
      monthlyPaymentCents: monthly,
      rateBps: DEFAULT_LOAN_RATE_BPS,
      termMonths: input.termMonths,
      monthsPaid: 0,
      collateralAircraftId: null,
      startedOnDay: fresh.currentDay,
      endsOnDay: fresh.currentDay + input.termMonths * 30,
      notes: "General-purpose bank loan",
    }).run();

    tx.insert(txn).values({
      id: randomId("tx"),
      gameId: g.id,
      gameDay: fresh.currentDay,
      kind: "loan_drawdown",
      amountCents: input.principalCents,
      refTable: "finance_instrument",
      refId: instrumentId,
      note: `Loan drawdown · ${input.termMonths}mo`,
    }).run();

    tx.update(game)
      .set({ cashCents: fresh.cashCents + input.principalCents })
      .where(eq(game.id, g.id))
      .run();

    tx.insert(newsEvent).values({
      id: randomId("news"),
      gameId: g.id,
      gameDay: fresh.currentDay,
      category: "finance",
      severity: "info",
      headline: `Drew down a ${input.termMonths}-month loan`,
      body: `Principal $${(input.principalCents / 100 / 1_000_000).toFixed(2)}M · monthly P&I $${(monthly / 100).toLocaleString()}.`,
      meta: JSON.stringify({ instrumentId }),
      pinned: false,
      seen: false,
      createdAt: now,
    }).run();
  });

  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

export async function repayLoan(input: { instrumentId: string; amountCents: number }) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) throw new Error("No active game");
  await ensureSimUpToDate(g.id);

  const inst = await db.query.financeInstrument.findFirst({
    where: and(eq(financeInstrument.id, input.instrumentId), eq(financeInstrument.gameId, g.id)),
  });
  if (!inst || inst.kind !== "loan" || inst.status !== "active") {
    throw new Error("Loan not found or already paid");
  }
  const fresh = await db.query.game.findFirst({ where: eq(game.id, g.id) });
  if (!fresh) throw new Error("Game vanished");

  const pay = Math.max(0, Math.min(input.amountCents, inst.outstandingCents));
  if (pay <= 0) throw new Error("Nothing to repay");
  if (fresh.cashCents < pay) throw new Error("Not enough cash for early repayment");

  const newOutstanding = inst.outstandingCents - pay;
  db.transaction((tx) => {
    tx.update(financeInstrument)
      .set({
        outstandingCents: newOutstanding,
        status: newOutstanding <= 0 ? "paid_off" : "active",
      })
      .where(eq(financeInstrument.id, inst.id))
      .run();
    tx.insert(txn).values({
      id: randomId("tx"),
      gameId: g.id,
      gameDay: fresh.currentDay,
      kind: "loan_payment",
      amountCents: -pay,
      refTable: "finance_instrument",
      refId: inst.id,
      note: "Early repayment",
    }).run();
    tx.update(game).set({ cashCents: fresh.cashCents - pay }).where(eq(game.id, g.id)).run();
  });

  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Revolver
// ---------------------------------------------------------------------------

export async function openRevolver(input: { limitCents: number }) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) throw new Error("No active game");
  await ensureSimUpToDate(g.id);

  const existing = await db.query.financeInstrument.findFirst({
    where: and(
      eq(financeInstrument.gameId, g.id),
      eq(financeInstrument.kind, "revolver"),
      eq(financeInstrument.status, "active"),
    ),
  });
  if (existing) throw new Error("A revolver is already open");
  if (input.limitCents < 100_000_00 || input.limitCents > 50_000_000_00) {
    throw new Error("Limit must be between $100K and $50M");
  }

  const id = randomId("fin");
  const now = new Date();
  db.transaction((tx) => {
    tx.insert(financeInstrument).values({
      id,
      gameId: g.id,
      kind: "revolver",
      status: "active",
      principalCents: input.limitCents,
      outstandingCents: 0,
      monthlyPaymentCents: 0,
      rateBps: DEFAULT_REVOLVER_RATE_BPS,
      termMonths: 0,
      monthsPaid: 0,
      collateralAircraftId: null,
      startedOnDay: g.currentDay,
      endsOnDay: null,
      notes: `Revolver · $${(input.limitCents / 100 / 1_000_000).toFixed(2)}M limit`,
    }).run();
    tx.insert(newsEvent).values({
      id: randomId("news"),
      gameId: g.id,
      gameDay: g.currentDay,
      category: "finance",
      severity: "info",
      headline: `Opened a revolving credit facility`,
      body: `$${(input.limitCents / 100 / 1_000_000).toFixed(2)}M limit · ${(DEFAULT_REVOLVER_RATE_BPS / 100).toFixed(2)}% APR on overdrawn balance.`,
      meta: JSON.stringify({ instrumentId: id }),
      pinned: false,
      seen: false,
      createdAt: now,
    }).run();
  });

  revalidatePath("/finance");
}

export async function closeRevolver(instrumentId: string) {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) throw new Error("No active game");
  await ensureSimUpToDate(g.id);

  const fresh = await db.query.game.findFirst({ where: eq(game.id, g.id) });
  if (!fresh) throw new Error("Game vanished");
  if (fresh.cashCents < 0) throw new Error("Bring your cash above zero before closing the revolver");

  await db.update(financeInstrument)
    .set({ status: "closed" })
    .where(and(eq(financeInstrument.id, instrumentId), eq(financeInstrument.gameId, g.id)));
  revalidatePath("/finance");
}

// ---------------------------------------------------------------------------
export async function markAllNewsSeen() {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) return;
  await db.update(newsEvent).set({ seen: true }).where(eq(newsEvent.gameId, g.id));
  revalidatePath("/news");
  revalidatePath("/dashboard");
}

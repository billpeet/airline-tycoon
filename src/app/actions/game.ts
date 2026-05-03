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
} from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { randomId } from "@/lib/id";
import { seedFromString } from "@/sim/rng";
import { greatCircleKm, routeFlightHoursPerDay, MAX_DAILY_FLIGHT_HOURS } from "@/sim/geo";
import { ensureSimUpToDate } from "@/sim/catchup";

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

export async function buyAircraft(input: {
  typeId: string;
  baseAirportId: string;
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

  const priceCents = Math.round(type.listPriceMusd * 1_000_000 * 100);
  const fresh = await db.query.game.findFirst({ where: eq(game.id, g.id) });
  if (!fresh) throw new Error("Game vanished");
  if (fresh.cashCents < priceCents) throw new Error("Not enough cash for this purchase");

  // Generate next tail: count existing + 1, zero-padded
  const owned = await db.select().from(aircraft).where(eq(aircraft.gameId, g.id));
  const tailNumber = (owned.length + 1).toString().padStart(3, "0");

  const aircraftRowId = randomId("acft");
  const now = new Date();

  db.transaction((tx) => {
    tx.insert(aircraft).values({
      id: aircraftRowId,
      gameId: g.id,
      typeId: type.id,
      tail: `${fresh.airlineCode}-${tailNumber}`,
      baseAirportId: home.id,
      status: "in_service",
      acquiredOnDay: fresh.currentDay,
      acquisitionMode: "cash",
      cycleHours: 0,
    }).run();

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

    tx.update(game)
      .set({ cashCents: fresh.cashCents - priceCents })
      .where(eq(game.id, g.id))
      .run();

    tx.insert(newsEvent).values({
      id: randomId("news"),
      gameId: g.id,
      gameDay: fresh.currentDay,
      category: "fleet",
      severity: "good",
      headline: `New tail: ${fresh.airlineCode}-${tailNumber}`,
      body: `${type.manufacturer} ${type.model} delivered to ${home.city ?? home.name}.`,
      meta: JSON.stringify({ aircraftId: aircraftRowId, typeId: type.id }),
      pinned: false,
      seen: false,
      createdAt: now,
    }).run();
  });

  revalidatePath("/fleet");
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

export async function markAllNewsSeen() {
  const session = await getSessionUser();
  if (!session) throw new Error("Not authenticated");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) return;
  await db.update(newsEvent).set({ seen: true }).where(eq(newsEvent.gameId, g.id));
  revalidatePath("/news");
  revalidatePath("/dashboard");
}

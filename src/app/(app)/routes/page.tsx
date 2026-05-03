import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { aircraft, aircraftType, airport, game, route } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { BoardingCard, BoardingCardEyebrow } from "@/components/shell/boarding-card";
import { OpenRouteButton } from "./open-route";
import { CloseRouteButton } from "./close-route";
import { EditRouteButton } from "./edit-route";
import { ReopenRouteButton } from "./reopen-route";
import { formatUsdCents } from "@/lib/money";
import { alias } from "drizzle-orm/sqlite-core";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) redirect("/onboarding");

  const fromA = alias(airport, "from_a");
  const toA = alias(airport, "to_a");

  const routes = await db
    .select({
      id: route.id,
      fromId: route.fromAirportId,
      toId: route.toAirportId,
      fromIata: fromA.iata,
      fromCity: fromA.city,
      toIata: toA.iata,
      toCity: toA.city,
      distanceKm: route.distanceKm,
      fareCents: route.fareEconomyCents,
      freq: route.frequencyPerWeek,
      pax: route.lastDailyPax,
      revenue: route.lastDailyRevenueCents,
      cost: route.lastDailyCostCents,
      load: route.lastLoadFactor,
      tail: aircraft.tail,
      aircraftId: aircraft.id,
      typeId: aircraft.typeId,
      typicalPax: aircraftType.typicalPax,
      cruiseSpeedKts: aircraftType.cruiseSpeedKts,
      status: route.status,
    })
    .from(route)
    .innerJoin(fromA, eq(route.fromAirportId, fromA.id))
    .innerJoin(toA, eq(route.toAirportId, toA.id))
    .innerJoin(aircraft, eq(route.aircraftId, aircraft.id))
    .innerJoin(aircraftType, eq(aircraft.typeId, aircraftType.id))
    .where(and(eq(route.gameId, g.id)));

  const fleet = await db
    .select({
      id: aircraft.id,
      tail: aircraft.tail,
      baseId: aircraft.baseAirportId,
      typeId: aircraft.typeId,
      rangeKm: aircraftType.rangeKm,
      pax: aircraftType.typicalPax,
      cruiseSpeedKts: aircraftType.cruiseSpeedKts,
      family: aircraftType.family,
      model: aircraftType.model,
    })
    .from(aircraft)
    .innerJoin(aircraftType, eq(aircraft.typeId, aircraftType.id))
    .where(and(eq(aircraft.gameId, g.id), eq(aircraft.status, "in_service")));

  // Build per-aircraft used-hours so the wizards can preview headroom.
  const usedHoursByAircraft: Record<string, number> = {};
  for (const r of routes) {
    if (r.status !== "active") continue;
    const ac = fleet.find((f) => f.id === r.aircraftId);
    if (!ac) continue;
    const KTS_TO_KMH = 1.852;
    const h = (r.distanceKm / (ac.cruiseSpeedKts * KTS_TO_KMH)) * 2 * (r.freq / 7);
    usedHoursByAircraft[ac.id] = (usedHoursByAircraft[ac.id] ?? 0) + h;
  }

  const baseIds = Array.from(new Set(fleet.map((f) => f.baseId)));
  const bases = baseIds.length
    ? await db.select().from(airport).where(inArray(airport.id, baseIds))
    : [];

  const active = routes.filter((r) => r.status === "active");
  const closed = routes.filter((r) => r.status === "closed");

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="NET · 04"
        meta="Routes"
        title="Open a city pair. Watch the demand."
        description={`${active.length} active · ${closed.length} closed.`}
        actions={
          <OpenRouteButton
            fleet={fleet}
            bases={bases}
            reputation={g.reputation}
            usedHoursByAircraft={usedHoursByAircraft}
          />
        }
      />

      <BoardingCard>
        <BoardingCardEyebrow code="NET" title="Active routes" meta={`${active.length}`} />
        {active.length === 0 ? (
          <div className="px-6 py-10 text-center text-ink-soft">
            No routes filed. Pick a city pair and start flying.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-paper-deep text-ink-soft">
              <tr className="border-b border-ink/15">
                <Th>Pair</Th>
                <Th>Tail</Th>
                <Th>Distance</Th>
                <Th>Fare</Th>
                <Th>Freq/wk</Th>
                <Th>Daily hrs</Th>
                <Th>Load</Th>
                <Th>Daily net</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => {
                const net = r.revenue - r.cost;
                const dailyFreq = r.freq / 7;
                const seatsPerDay = Math.round(r.typicalPax * dailyFreq);
                const dailyHrs = (r.distanceKm / (r.cruiseSpeedKts * 1.852)) * 2 * dailyFreq;
                const loadPct = r.load * 100;
                const loadTone =
                  loadPct >= 75 ? "bg-hangar" : loadPct >= 45 ? "bg-runway" : "bg-beacon";
                const loadText =
                  loadPct >= 75 ? "text-hangar" : loadPct >= 45 ? "text-runway" : "text-beacon";
                return (
                  <tr key={r.id} className="border-b border-ink/10 last:border-b-0">
                    <Td>
                      <span className="font-mono text-[12px] text-persimmon">
                        {r.fromIata} → {r.toIata}
                      </span>
                      <div className="text-[11px] text-ink-faint">
                        {r.fromCity} · {r.toCity}
                      </div>
                    </Td>
                    <Td className="font-mono text-[11px]">{r.tail}</Td>
                    <Td className="num-tabular">{Math.round(r.distanceKm).toLocaleString()} km</Td>
                    <Td className="num-tabular">${(r.fareCents / 100).toFixed(0)}</Td>
                    <Td className="num-tabular">{r.freq}</Td>
                    <Td className="num-tabular">{dailyHrs.toFixed(1)}h</Td>
                    <Td>
                      <div className={cn("num-tabular text-[13px]", loadText)}>
                        {r.pax.toLocaleString()} <span className="text-ink-faint">/ {seatsPerDay.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 h-1 w-28 bg-ink/10">
                        <div
                          className={cn("h-full", loadTone)}
                          style={{ width: `${Math.min(100, loadPct)}%` }}
                        />
                      </div>
                      <div className="mt-0.5 num-tabular text-[10px] text-ink-faint">
                        {loadPct.toFixed(0)}%
                      </div>
                    </Td>
                    <Td className={`num-tabular ${net >= 0 ? "text-hangar" : "text-beacon"}`}>
                      {formatUsdCents(net, { sign: "always" })}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <EditRouteButton
                          route={{
                            id: r.id,
                            fromId: r.fromId,
                            toId: r.toId,
                            fromIata: r.fromIata,
                            toIata: r.toIata,
                            fromCity: r.fromCity,
                            toCity: r.toCity,
                            aircraftId: r.aircraftId,
                            distanceKm: r.distanceKm,
                            fareEconomyCents: r.fareCents,
                            frequencyPerWeek: r.freq,
                          }}
                          fleet={fleet}
                          reputation={g.reputation}
                          usedHoursByAircraft={usedHoursByAircraft}
                        />
                        <CloseRouteButton routeId={r.id} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </BoardingCard>

      {closed.length > 0 && (
        <BoardingCard>
          <BoardingCardEyebrow code="NET" title="Closed" meta={`${closed.length}`} />
          <ul className="divide-y divide-ink/10 text-[12.5px]">
            {closed.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-ink-soft"
              >
                <span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {r.fromIata} → {r.toIata}
                  </span>{" "}
                  · {r.fromCity} → {r.toCity}{" "}
                  <span className="text-[11px] text-ink-faint">
                    · {r.freq}×/wk @ ${(r.fareCents / 100).toFixed(0)} on {r.tail}
                  </span>
                </span>
                <ReopenRouteButton routeId={r.id} />
              </li>
            ))}
          </ul>
        </BoardingCard>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.22em]">{children}</th>
  );
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ""}`}>{children}</td>;
}

import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { aircraft, aircraftType, airport, game, route } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { BoardingCard, BoardingCardEyebrow } from "@/components/shell/boarding-card";
import { OpenRouteButton } from "./open-route";
import { CloseRouteButton } from "./close-route";
import { formatUsdCents } from "@/lib/money";
import { alias } from "drizzle-orm/sqlite-core";

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
      status: route.status,
    })
    .from(route)
    .innerJoin(fromA, eq(route.fromAirportId, fromA.id))
    .innerJoin(toA, eq(route.toAirportId, toA.id))
    .innerJoin(aircraft, eq(route.aircraftId, aircraft.id))
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

  // Build per-aircraft used-hours so the wizard can preview headroom.
  const usedHoursByAircraft: Record<string, number> = {};
  for (const r of routes) {
    if (r.status !== "active") continue;
    const ac = fleet.find((f) => f.tail === r.tail);
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
                <Th>Daily pax</Th>
                <Th>Load</Th>
                <Th>Daily net</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => {
                const net = r.revenue - r.cost;
                const ac = fleet.find((f) => f.tail === r.tail);
                const dailyHrs = ac
                  ? (r.distanceKm / (ac.cruiseSpeedKts * 1.852)) * 2 * (r.freq / 7)
                  : 0;
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
                    <Td className="num-tabular">{r.pax.toLocaleString()}</Td>
                    <Td className="num-tabular">{(r.load * 100).toFixed(0)}%</Td>
                    <Td className={`num-tabular ${net >= 0 ? "text-hangar" : "text-beacon"}`}>
                      {formatUsdCents(net, { sign: "always" })}
                    </Td>
                    <Td>
                      <CloseRouteButton routeId={r.id} />
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
              <li key={r.id} className="px-4 py-2 text-ink-soft">
                <span className="font-mono text-[11px] text-ink-faint">
                  {r.fromIata} → {r.toIata}
                </span>{" "}
                · {r.fromCity} → {r.toCity}
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
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}


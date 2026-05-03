import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { aircraft, aircraftType, airport, game, route } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { BoardingCard, BoardingCardEyebrow } from "@/components/shell/boarding-card";
import { FleetActions } from "./actions";
import { formatUsdCents } from "@/lib/money";
import { routeFlightHoursPerDay, MAX_DAILY_FLIGHT_HOURS } from "@/sim/geo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) redirect("/onboarding");

  const fleet = await db
    .select({
      id: aircraft.id,
      tail: aircraft.tail,
      status: aircraft.status,
      mode: aircraft.acquisitionMode,
      base: airport.id,
      baseCity: airport.city,
      baseIata: airport.iata,
      typeId: aircraft.typeId,
      manufacturer: aircraftType.manufacturer,
      model: aircraftType.model,
      typeClass: aircraftType.typeClass,
      pax: aircraftType.typicalPax,
      rangeKm: aircraftType.rangeKm,
      cruiseSpeedKts: aircraftType.cruiseSpeedKts,
      acquiredOnDay: aircraft.acquiredOnDay,
    })
    .from(aircraft)
    .innerJoin(aircraftType, eq(aircraft.typeId, aircraftType.id))
    .innerJoin(airport, eq(aircraft.baseAirportId, airport.id))
    .where(eq(aircraft.gameId, g.id));

  // Active routes per aircraft, for utilisation
  const activeRoutes = await db
    .select({
      aircraftId: route.aircraftId,
      distanceKm: route.distanceKm,
      frequencyPerWeek: route.frequencyPerWeek,
    })
    .from(route)
    .where(and(eq(route.gameId, g.id), eq(route.status, "active")));

  const utilByAircraft = new Map<string, { hours: number; routes: number }>();
  for (const r of activeRoutes) {
    const ac = fleet.find((f) => f.id === r.aircraftId);
    if (!ac) continue;
    const h = routeFlightHoursPerDay(r.distanceKm, r.frequencyPerWeek, ac.cruiseSpeedKts);
    const cur = utilByAircraft.get(r.aircraftId) ?? { hours: 0, routes: 0 };
    cur.hours += h;
    cur.routes += 1;
    utilByAircraft.set(r.aircraftId, cur);
  }

  // Catalogue for the acquire dialog
  const catalogue = await db.select().from(aircraftType);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="FLT · 03"
        meta="Fleet"
        title="Tails, types and tin."
        description={`${fleet.length} ${fleet.length === 1 ? "aircraft" : "aircraft"} on the certificate. Cash on hand ${formatUsdCents(g.cashCents)}.`}
        actions={
          <FleetActions
            cashCents={g.cashCents}
            homeAirportId={g.homeAirportId}
            catalogue={catalogue}
          />
        }
      />

      <BoardingCard>
        <BoardingCardEyebrow code="FLT" title="Active fleet" meta={`${fleet.length} TAILS`} />
        {fleet.length === 0 ? (
          <div className="px-6 py-10 text-center text-ink-soft">
            No aircraft on the books. Acquire your first to start flying.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-paper-deep text-ink-soft">
              <tr className="border-b border-ink/15">
                <Th>Tail</Th>
                <Th>Type</Th>
                <Th>Base</Th>
                <Th>Seats</Th>
                <Th>Range</Th>
                <Th>Routes</Th>
                <Th>Utilisation / day</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((a) => {
                const u = utilByAircraft.get(a.id) ?? { hours: 0, routes: 0 };
                const pct = (u.hours / MAX_DAILY_FLIGHT_HOURS) * 100;
                const tone =
                  pct >= 95 ? "text-beacon" : pct >= 75 ? "text-runway" : "text-hangar";
                return (
                  <tr key={a.id} className="border-b border-ink/10 last:border-b-0">
                    <Td className="font-mono text-[12px] tracking-[0.1em]">{a.tail}</Td>
                    <Td>
                      <div className="text-ink">{a.manufacturer} {a.model}</div>
                      <div className="label-code text-ink-faint">{a.typeClass.replace("_", " ")}</div>
                    </Td>
                    <Td>
                      <span className="font-mono text-[11px] text-persimmon">{a.baseIata ?? a.base}</span>{" "}
                      <span className="text-ink-soft">{a.baseCity ?? ""}</span>
                    </Td>
                    <Td className="num-tabular">{a.pax}</Td>
                    <Td className="num-tabular">{a.rangeKm.toLocaleString()} km</Td>
                    <Td className="num-tabular">{u.routes}</Td>
                    <Td>
                      <div className={cn("num-tabular text-[13px]", tone)}>
                        {u.hours.toFixed(1)}h <span className="text-ink-faint">/ {MAX_DAILY_FLIGHT_HOURS}h</span>
                      </div>
                      <div className="mt-1 h-1 w-24 bg-ink/10">
                        <div
                          className={cn(
                            "h-full",
                            pct >= 95 ? "bg-beacon" : pct >= 75 ? "bg-runway" : "bg-hangar",
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </Td>
                    <Td>
                      <span className="label-code text-hangar">● {a.status.replace("_", " ")}</span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </BoardingCard>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.22em]">
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>;
}

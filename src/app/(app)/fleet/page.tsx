import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aircraft, aircraftType, airport, game } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { BoardingCard, BoardingCardEyebrow } from "@/components/shell/boarding-card";
import { FleetActions } from "./actions";
import { formatUsdCents } from "@/lib/money";

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
      acquiredOnDay: aircraft.acquiredOnDay,
    })
    .from(aircraft)
    .innerJoin(aircraftType, eq(aircraft.typeId, aircraftType.id))
    .innerJoin(airport, eq(aircraft.baseAirportId, airport.id))
    .where(eq(aircraft.gameId, g.id));

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
                <Th>Class</Th>
                <Th>Base</Th>
                <Th>Seats</Th>
                <Th>Range</Th>
                <Th>Mode</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {fleet.map((a) => (
                <tr key={a.id} className="border-b border-ink/10 last:border-b-0">
                  <Td className="font-mono text-[12px] tracking-[0.1em]">{a.tail}</Td>
                  <Td>
                    <span className="text-ink">{a.manufacturer} {a.model}</span>
                  </Td>
                  <Td className="label-code text-ink-soft">{a.typeClass.replace("_", " ")}</Td>
                  <Td>
                    <span className="font-mono text-[11px] text-persimmon">{a.baseIata ?? a.base}</span>{" "}
                    <span className="text-ink-soft">{a.baseCity ?? ""}</span>
                  </Td>
                  <Td className="num-tabular">{a.pax}</Td>
                  <Td className="num-tabular">{a.rangeKm.toLocaleString()} km</Td>
                  <Td className="label-code text-ink-soft">{a.mode}</Td>
                  <Td>
                    <span className="label-code text-hangar">● {a.status.replace("_", " ")}</span>
                  </Td>
                </tr>
              ))}
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

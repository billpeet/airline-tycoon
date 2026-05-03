import { db } from "@/db/client";
import { airport, airline, route, game } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Globe } from "@/components/globe/globe";
import { PageHeader } from "@/components/shell/page-header";
import {
  BoardingCard,
  BoardingCardEyebrow,
} from "@/components/shell/boarding-card";
import { getSessionUser } from "@/lib/session";
import type { GlobeRoute } from "@/components/globe/routes-layer";

export const dynamic = "force-dynamic";

export default async function GlobePage() {
  const session = await getSessionUser();
  const playerGame = session
    ? await db.query.game.findFirst({ where: eq(game.userId, session.user.id) })
    : null;

  const airports = await db
    .select({
      id: airport.id,
      iata: airport.iata,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      lat: airport.lat,
      lon: airport.lon,
      size: airport.size,
      slot_constrained: airport.slotConstrained,
    })
    .from(airport);

  // Player's active routes as great-circle arcs on the globe
  let playerRoutes: GlobeRoute[] = [];
  if (playerGame) {
    const fromA = alias(airport, "from_a");
    const toA = alias(airport, "to_a");
    const rows = await db
      .select({
        id: route.id,
        fromLat: fromA.lat,
        fromLon: fromA.lon,
        toLat: toA.lat,
        toLon: toA.lon,
        revenue: route.lastDailyRevenueCents,
        cost: route.lastDailyCostCents,
      })
      .from(route)
      .innerJoin(fromA, eq(route.fromAirportId, fromA.id))
      .innerJoin(toA, eq(route.toAirportId, toA.id))
      .where(and(eq(route.gameId, playerGame.id), eq(route.status, "active")));
    playerRoutes = rows.map((r) => {
      const net = r.revenue - r.cost;
      const tone: GlobeRoute["tone"] =
        net > 0 ? "good" : net < 0 ? "warn" : "neutral";
      return {
        id: r.id,
        fromLat: r.fromLat,
        fromLon: r.fromLon,
        toLat: r.toLat,
        toLon: r.toLon,
        tone,
      };
    });
  }

  const slotHubs = airports
    .filter((a) => a.slot_constrained)
    .sort((a, b) => (a.iata ?? "").localeCompare(b.iata ?? ""));

  const topCarriers = await db
    .select({
      id: airline.id,
      iata: airline.iata,
      icao: airline.icao,
      name: airline.name,
      country: airline.country,
      type: airline.type,
      alliance: airline.alliance,
      fleet: airline.fleetSize,
      color: airline.color,
    })
    .from(airline)
    .orderBy(desc(airline.fleetSize))
    .limit(8);

  const regions = await db
    .select({
      continent: airport.continent,
      n: sql<number>`count(*)`,
    })
    .from(airport)
    .groupBy(airport.continent);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        code="GLB · 02"
        meta="World Map"
        title="The whole world, on one table."
        description="Every commercial airport worth flying to, every hub worth fighting for. Persimmon marks the slot-constrained giants — the hardest doors to get into."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <BoardingCard className="overflow-hidden">
          <BoardingCardEyebrow
            code="MAP"
            title="The world network"
            meta="DRAG · ROTATE · SCROLL · ZOOM"
          />
          <div className="relative h-[640px] bg-paper-deep">
            <div className="halftone pointer-events-none absolute inset-0 opacity-[0.05]" />
            <Globe airports={airports} routes={playerRoutes} />

            <div className="pointer-events-none absolute bottom-4 left-4 flex gap-4 bg-paper/90 px-3 py-2 backdrop-blur">
              <LegendDot color="#D8451B" label="Slot-constrained hub" />
              <LegendDot color="#E8B339" label="Major airport" />
              <LegendDot color="#0F1B2D" label="Regional" subtle />
            </div>
          </div>
        </BoardingCard>

        <div className="flex flex-col gap-6">
          <BoardingCard>
            <BoardingCardEyebrow code="HUB" title="Slot-constrained" meta={`${slotHubs.length}`} />
            <ul className="max-h-[280px] divide-y divide-ink/10 overflow-y-auto scroll-jet">
              {slotHubs.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px]"
                >
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-[11px] tracking-[0.1em] text-persimmon">
                      {a.iata}
                    </span>
                    <span className="text-ink">{a.city ?? a.name}</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                    {a.country}
                  </span>
                </li>
              ))}
            </ul>
          </BoardingCard>

          <BoardingCard>
            <BoardingCardEyebrow code="OPR" title="Largest carriers" meta={`${topCarriers.length}`} />
            <ul className="divide-y divide-ink/10">
              {topCarriers.map((al) => (
                <li
                  key={al.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px]"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ background: al.color ?? "#0F1B2D" }}
                    />
                    <span className="font-mono text-[11px] tracking-[0.1em] text-ink">
                      {al.iata}
                    </span>
                    <span className="text-ink">{al.name}</span>
                  </span>
                  <span className="num-tabular text-[11px] text-ink-faint">{al.fleet}</span>
                </li>
              ))}
            </ul>
          </BoardingCard>

          <BoardingCard>
            <BoardingCardEyebrow code="GEO" title="Coverage by continent" />
            <ul className="divide-y divide-ink/10">
              {regions
                .filter((r) => r.continent)
                .sort((a, b) => Number(b.n) - Number(a.n))
                .map((r) => (
                  <li
                    key={r.continent}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-[12px]"
                  >
                    <span className="label-code text-ink-soft">{r.continent}</span>
                    <span className="num-tabular text-[12px] text-ink">
                      {Number(r.n).toLocaleString()}
                    </span>
                  </li>
                ))}
            </ul>
          </BoardingCard>
        </div>
      </div>
    </div>
  );
}

function LegendDot({
  color,
  label,
  subtle,
}: {
  color: string;
  label: string;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
      <span
        className={`size-2 rounded-full ${subtle ? "opacity-60" : ""}`}
        style={{ background: color }}
      />
      {label}
    </div>
  );
}

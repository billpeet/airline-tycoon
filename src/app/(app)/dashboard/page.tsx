import Link from "next/link";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  game,
  aircraft,
  aircraftType,
  airport,
  route,
  newsEvent,
  txn,
} from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import {
  BoardingCard,
  BoardingCardEyebrow,
  StatBlock,
} from "@/components/shell/boarding-card";
import { formatUsdCents } from "@/lib/money";
import { formatGameDate } from "@/sim/time";
import { cn } from "@/lib/utils";
import { alias } from "drizzle-orm/sqlite-core";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) redirect("/onboarding");

  const today = g.currentDay;
  const ledgerWindow = 7;

  const [{ fleetN }] = await db
    .select({ fleetN: sql<number>`count(*)` })
    .from(aircraft)
    .where(eq(aircraft.gameId, g.id));
  const [{ activeRouteN }] = await db
    .select({ activeRouteN: sql<number>`count(*)` })
    .from(route)
    .where(and(eq(route.gameId, g.id), eq(route.status, "active")));

  // 7-day ledger
  const ledger = await db
    .select({
      kind: txn.kind,
      total: sql<number>`coalesce(sum(${txn.amountCents}), 0)`,
    })
    .from(txn)
    .where(and(eq(txn.gameId, g.id), gte(txn.gameDay, today - ledgerWindow + 1)))
    .groupBy(txn.kind);

  const sumWhere = (kinds: string[]) =>
    ledger.filter((l) => kinds.includes(l.kind)).reduce((s, l) => s + Number(l.total), 0);
  const revenue = sumWhere(["route_revenue"]);
  const operatingCost = -sumWhere(["route_fuel", "route_crew", "route_landing", "aircraft_idle"]);
  const netIncome = revenue - operatingCost;

  // Daily net for the last 12 game-days (sparkline)
  const dailyNets = await db
    .select({
      day: txn.gameDay,
      net: sql<number>`sum(${txn.amountCents})`,
    })
    .from(txn)
    .where(
      and(
        eq(txn.gameId, g.id),
        gte(txn.gameDay, today - 11),
        sql`${txn.kind} != 'aircraft_purchase' AND ${txn.kind} != 'starter_grant'`,
      ),
    )
    .groupBy(txn.gameDay)
    .orderBy(txn.gameDay);
  const bars = padDays(dailyNets, today, 12);

  // Fleet snapshot
  const fleetRows = await db
    .select({
      id: aircraft.id,
      tail: aircraft.tail,
      base: airport.iata,
      baseCity: airport.city,
      typeName: aircraftType.model,
    })
    .from(aircraft)
    .innerJoin(airport, eq(aircraft.baseAirportId, airport.id))
    .innerJoin(aircraftType, eq(aircraft.typeId, aircraftType.id))
    .where(eq(aircraft.gameId, g.id))
    .limit(4);

  // Latest news
  const news = await db
    .select()
    .from(newsEvent)
    .where(eq(newsEvent.gameId, g.id))
    .orderBy(desc(newsEvent.gameDay), desc(newsEvent.createdAt))
    .limit(4);

  const dateLabel = formatGameDate(today);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="OPS · 01"
        meta="Operations Centre"
        title={`Good morning, Captain.`}
        description={`${g.airlineName} · ${dateLabel.date}, ${dateLabel.year}.`}
        actions={
          <Link
            href="/routes"
            className="group flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.2em] text-paper transition-all hover:bg-persimmon hover:border-persimmon"
          >
            File a flight plan
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <BoardingCard>
          <BoardingCardEyebrow code="A" title="Today on the board" meta={dateLabel.date.toUpperCase()} />
          <div className="grid grid-cols-2">
            <StatBlock
              label="Cash on hand"
              value={formatUsdCents(g.cashCents)}
              hint={runwayHint(g.cashCents, dailyNets)}
              tone={g.cashCents < 0 ? "negative" : "positive"}
            />
            <StatBlock
              label="Net last 24h"
              value={formatUsdCents(bars.at(-1)?.net ?? 0, { sign: "always" })}
              hint={`vs. ${formatUsdCents(bars.at(-2)?.net ?? 0, { sign: "always" })} prior day`}
              tone={(bars.at(-1)?.net ?? 0) >= 0 ? "positive" : "negative"}
              className="border-l border-ink/10"
            />
            <StatBlock
              label="Fuel index"
              value={`$${(g.fuelPriceCentsPerLiter / 100).toFixed(2)}`}
              hint="USD / litre"
              className="border-t border-ink/10"
            />
            <StatBlock
              label="Reputation"
              value={g.reputation.toString()}
              hint={reputationLabel(g.reputation)}
              className="border-t border-l border-ink/10"
            />
          </div>
        </BoardingCard>

        <BoardingCard>
          <BoardingCardEyebrow code="B" title="Fleet status" meta={`${Number(fleetN)} TAIL${Number(fleetN) === 1 ? "" : "S"}`} />
          <div className="flex flex-col gap-3 px-4 py-5">
            {fleetRows.length === 0 ? (
              <p className="text-[13px] text-ink-soft">No aircraft yet.</p>
            ) : (
              fleetRows.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-3">
                    <span className="size-2 rounded-full bg-hangar pulse-beacon" />
                    <div>
                      <div className="font-mono text-[12px] tracking-[0.08em]">{a.tail}</div>
                      <div className="text-[11px] text-ink-faint">
                        {a.typeName} · {a.base} · {a.baseCity}
                      </div>
                    </div>
                  </div>
                  <span className="label-code text-ink-faint">In service</span>
                </div>
              ))
            )}
            <Link
              href="/fleet"
              className="group mt-1 flex items-center justify-between border border-dashed border-ink/30 px-3 py-2.5 text-[12px] text-ink-soft hover:border-ink hover:text-ink"
            >
              <span>{Number(fleetN) === 0 ? "Acquire your first aircraft" : "Manage fleet"}</span>
              <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </BoardingCard>

        <BoardingCard>
          <BoardingCardEyebrow code="C" title="Network" meta={`${Number(activeRouteN)} OPEN`} />
          <div className="flex flex-col gap-2 px-4 py-5">
            {Number(activeRouteN) === 0 ? (
              <p className="text-[13px] text-ink-soft">
                You're certified — now open a city pair to start carrying passengers.
              </p>
            ) : (
              <p className="text-[13px] text-ink-soft">
                {Number(activeRouteN)} active route{Number(activeRouteN) === 1 ? "" : "s"} on the schedule.
              </p>
            )}
            <Link
              href="/routes"
              className="group mt-2 flex items-center justify-between border border-dashed border-ink/30 px-3 py-2.5 text-[12px] text-ink-soft hover:border-ink hover:text-ink"
            >
              <span>{Number(activeRouteN) === 0 ? "Open a route" : "Manage routes"}</span>
              <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </BoardingCard>
      </section>

      {/* Two-up: ledger + news */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <BoardingCard>
          <BoardingCardEyebrow code="D" title={`Ledger · last ${ledgerWindow} game-days`} meta="USD" />
          <div className="grid grid-cols-3 divide-x divide-ink/10">
            <LedgerCol label="Revenue" value={formatUsdCents(revenue)} tone="positive" />
            <LedgerCol label="Operating cost" value={formatUsdCents(operatingCost)} tone="warning" />
            <LedgerCol label="Net income" value={formatUsdCents(netIncome, { sign: "always" })} tone={netIncome >= 0 ? "positive" : "negative"} />
          </div>
          <div className="border-t border-ink/10 px-4 py-5">
            <Sparkline bars={bars} />
            <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              <span>{ledgerWindow}d ago</span>
              <span>Today</span>
            </div>
          </div>
        </BoardingCard>

        <BoardingCard>
          <BoardingCardEyebrow code="E" title="Newsroom" meta={`${news.length}`} />
          {news.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-ink-soft">
              No news yet. The press starts running once you're flying.
            </div>
          ) : (
            <ol className="divide-y divide-ink/10">
              {news.map((n) => (
                <li key={n.id} className="flex flex-col gap-1.5 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase tracking-[0.2em]",
                        n.severity === "good"
                          ? "text-hangar"
                          : n.severity === "warn"
                            ? "text-runway"
                            : n.severity === "bad"
                              ? "text-beacon"
                              : "text-persimmon",
                      )}
                    >
                      {n.category}
                    </span>
                    <span className="label-code text-ink-faint">DAY {n.gameDay}</span>
                  </div>
                  <p className="text-[14px] leading-snug text-ink">{n.headline}</p>
                  {n.body && <p className="text-[12px] text-ink-soft">{n.body}</p>}
                </li>
              ))}
            </ol>
          )}
          <Link
            href="/news"
            className="group flex items-center justify-between border-t border-ink/15 bg-paper-deep px-4 py-2.5 text-[11.5px] uppercase tracking-[0.2em] text-ink-soft hover:bg-paper hover:text-ink"
          >
            Read the newsroom
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </BoardingCard>
      </section>
    </div>
  );
}

// ---------- helpers ----------

function padDays(rows: { day: number; net: number }[], today: number, n: number) {
  const map = new Map(rows.map((r) => [r.day, Number(r.net)]));
  const out: { day: number; net: number }[] = [];
  for (let d = today - n + 1; d <= today; d++) {
    out.push({ day: d, net: map.get(d) ?? 0 });
  }
  return out;
}

function LedgerCol({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "warning";
}) {
  const cls = tone === "positive" ? "text-hangar" : tone === "negative" ? "text-beacon" : "text-ink";
  return (
    <div className="flex flex-col gap-1.5 px-4 py-5">
      <span className="label-eyebrow">{label}</span>
      <span className={cn("num-tabular text-[22px] font-medium leading-none", cls)}>{value}</span>
    </div>
  );
}

function Sparkline({ bars }: { bars: { day: number; net: number }[] }) {
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.net)));
  return (
    <div className="flex h-24 items-end gap-1.5">
      {bars.map((b, i) => {
        const h = Math.min(100, (Math.abs(b.net) / max) * 100);
        const positive = b.net >= 0;
        return (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-t-sm",
              i === bars.length - 1 ? "bg-persimmon" : positive ? "bg-ink/35" : "bg-beacon/40",
            )}
            style={{ height: `${Math.max(4, h)}%` }}
            title={`Day ${b.day}: ${formatUsdCents(b.net, { sign: "always" })}`}
          />
        );
      })}
    </div>
  );
}

function reputationLabel(r: number) {
  if (r >= 80) return "of 100 · global brand";
  if (r >= 60) return "of 100 · trusted name";
  if (r >= 40) return "of 100 · known carrier";
  if (r >= 20) return "of 100 · regional carrier";
  return "of 100 · new entrant";
}

function runwayHint(cashCents: number, daily: { day: number; net: number }[]): string {
  if (daily.length === 0) return "Cash position";
  const recent = daily.slice(-7);
  const avgDailyNet = recent.reduce((s, d) => s + d.net, 0) / recent.length;
  if (avgDailyNet >= 0) return "Burn-positive";
  const days = Math.floor(cashCents / -avgDailyNet);
  return `Runway · ${days} game-days`;
}

import { redirect } from "next/navigation";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  game,
  aircraft,
  route,
  financeInstrument,
} from "@/db/schema";
import { getActiveGame } from "@/lib/session";
import { AppShell } from "@/components/shell/app-shell";
import { SimPoller } from "@/components/shell/sim-poller";
import { nextTickAt } from "@/sim/time";
import { formatUsdCents } from "@/lib/money";
import type { Kpi } from "@/components/shell/kpi-strip";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getActiveGame();
  if (!ctx) redirect("/");
  if (!ctx.game) redirect("/onboarding");

  const g = ctx.game;
  const [{ fleetN }] = await db
    .select({ fleetN: sql<number>`count(*)` })
    .from(aircraft)
    .where(eq(aircraft.gameId, g.id));
  const [{ routeN }] = await db
    .select({ routeN: sql<number>`count(*)` })
    .from(route)
    .where(eq(route.gameId, g.id));
  const [{ paxN }] = await db
    .select({ paxN: sql<number>`coalesce(sum(${route.lastDailyPax}), 0)` })
    .from(route)
    .where(eq(route.gameId, g.id));
  const [{ debtN }] = await db
    .select({ debtN: sql<number>`coalesce(sum(${financeInstrument.outstandingCents}), 0)` })
    .from(financeInstrument)
    .where(and(eq(financeInstrument.gameId, g.id), eq(financeInstrument.kind, "loan"), eq(financeInstrument.status, "active")));

  // Effective rate: connected uses the player's chosen multiplier, offline forces 0.5×.
  const effectiveRate =
    (ctx.catchup?.rateClass ?? "connected") === "offline" ? 0.5 : g.rateMultiplier;
  const nextTickMs = nextTickAt(g.lastSimulatedAt, effectiveRate);
  const lastSimulatedAtMs = g.lastSimulatedAt.getTime();

  const kpis: Kpi[] = [
    {
      code: "CASH",
      label: "Cash",
      value: formatUsdCents(g.cashCents),
      tone: g.cashCents < 0 ? "negative" : "positive",
      flap: ctx.catchup ? ctx.catchup.ranDays > 0 : false,
    },
    {
      code: "DEBT",
      label: "Outstanding",
      value: Number(debtN) > 0 ? formatUsdCents(Number(debtN)) : "—",
      tone: Number(debtN) > 0 ? "warning" : "neutral",
    },
    { code: "FLEET", label: "Aircraft", value: pad(Number(fleetN)), flap: false },
    { code: "ROUTES", label: "Active routes", value: pad(Number(routeN)), flap: false },
    { code: "PAX/DAY", label: "Daily pax", value: Number(paxN).toLocaleString(), flap: false },
    {
      code: "REP",
      label: "Reputation",
      value: g.reputation.toString().padStart(2, "0"),
      tone: g.reputation >= 50 ? "positive" : "neutral",
    },
  ];

  return (
    <>
      <SimPoller rateMultiplier={g.rateMultiplier} nextTickAtMs={nextTickMs} />
      <AppShell
        user={ctx.user}
        kpis={kpis}
        airlineName={g.airlineName}
        airlineCode={g.airlineCode}
        currentDay={g.currentDay}
        lastSimulatedAtMs={lastSimulatedAtMs}
        rateMultiplier={g.rateMultiplier}
        rateClass={ctx.catchup?.rateClass ?? "connected"}
        effectiveRate={effectiveRate}
        nextTickAtMs={nextTickMs}
      >
        {children}
      </AppShell>
    </>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

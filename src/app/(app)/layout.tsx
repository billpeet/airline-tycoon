import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  game,
  aircraft,
  route,
  newsEvent,
} from "@/db/schema";
import { getActiveGame } from "@/lib/session";
import { AppShell } from "@/components/shell/app-shell";
import { formatGameDate } from "@/sim/time";
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

  const dateLabel = formatGameDate(g.currentDay);

  const kpis: Kpi[] = [
    {
      code: "CASH",
      label: "Cash",
      value: formatUsdCents(g.cashCents),
      tone: g.cashCents < 0 ? "negative" : "positive",
      flap: ctx.catchup ? ctx.catchup.ranDays > 0 : false,
    },
    { code: "FLEET", label: "Aircraft", value: pad(Number(fleetN)), flap: false },
    { code: "ROUTES", label: "Active routes", value: pad(Number(routeN)), flap: false },
    { code: "PAX/DAY", label: "Daily pax", value: Number(paxN).toLocaleString(), flap: false },
    { code: "OTP", label: "On-time", value: "—", tone: "neutral", flap: false },
    {
      code: "REP",
      label: "Reputation",
      value: g.reputation.toString().padStart(2, "0"),
      tone: g.reputation >= 50 ? "positive" : "neutral",
    },
  ];

  return (
    <AppShell
      user={ctx.user}
      kpis={kpis}
      airlineName={g.airlineName}
      airlineCode={g.airlineCode}
      gameDate={dateLabel.date}
      gameYear={dateLabel.year}
      rateMultiplier={g.rateMultiplier}
      rateClass={ctx.catchup?.rateClass ?? "connected"}
    >
      {children}
    </AppShell>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

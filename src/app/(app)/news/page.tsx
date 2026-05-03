import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { newsEvent, game } from "@/db/schema";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { PageHeader } from "@/components/shell/page-header";
import { BoardingCard, BoardingCardEyebrow } from "@/components/shell/boarding-card";
import { cn } from "@/lib/utils";
import { formatGameDate } from "@/sim/time";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) redirect("/onboarding");

  const items = await db
    .select()
    .from(newsEvent)
    .where(eq(newsEvent.gameId, g.id))
    .orderBy(desc(newsEvent.gameDay), desc(newsEvent.createdAt))
    .limit(120);

  // Group by period: since-last-visit (unseen), last 7 game-days, older.
  const today = g.currentDay;
  const groups: Record<"recent" | "week" | "older", typeof items> = {
    recent: items.filter((i) => !i.seen),
    week: items.filter((i) => i.seen && today - i.gameDay <= 7),
    older: items.filter((i) => i.seen && today - i.gameDay > 7),
  };

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="NWS · 08"
        meta="Newsroom"
        title="The morning paper, written while you slept."
        description={
          groups.recent.length === 0
            ? "All caught up. Step away — the press will run while you're gone."
            : `${groups.recent.length} item${groups.recent.length === 1 ? "" : "s"} since you last looked.`
        }
      />

      {groups.recent.length > 0 && <Section title="Since your last visit" code="NEW" items={groups.recent} />}
      {groups.week.length > 0 && <Section title="Past seven days" code="WK" items={groups.week} />}
      {groups.older.length > 0 && <Section title="Earlier" code="OLD" items={groups.older} />}

      {items.length === 0 && (
        <BoardingCard>
          <div className="px-6 py-10 text-center text-ink-soft">
            Nothing's been printed yet. Open a route, then the world starts writing back.
          </div>
        </BoardingCard>
      )}
    </div>
  );
}

function Section({
  title,
  code,
  items,
}: {
  title: string;
  code: string;
  items: { id: string; gameDay: number; category: string; severity: string; headline: string; body: string | null }[];
}) {
  return (
    <BoardingCard>
      <BoardingCardEyebrow code={code} title={title} meta={`${items.length}`} />
      <ol className="divide-y divide-ink/10">
        {items.map((n) => {
          const { date, year } = formatGameDate(n.gameDay);
          return (
            <li key={n.id} className="grid gap-3 px-5 py-4 md:grid-cols-[120px_60px_1fr]">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-faint">
                {date}, {year}
              </div>
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
              <div className="flex flex-col gap-1">
                <p className="text-[15px] leading-snug text-ink">{n.headline}</p>
                {n.body && <p className="text-[12.5px] text-ink-soft">{n.body}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </BoardingCard>
  );
}

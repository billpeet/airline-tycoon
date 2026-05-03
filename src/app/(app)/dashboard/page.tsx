import { ArrowUpRight, AlertTriangle, Sparkles, Plane } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { airport, airline, aircraftType } from "@/db/schema";
import { PageHeader } from "@/components/shell/page-header";
import {
  BoardingCard,
  BoardingCardEyebrow,
  StatBlock,
} from "@/components/shell/boarding-card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [{ n: airportCount }] = await db.select({ n: sql<number>`count(*)` }).from(airport);
  const [{ n: airlineCount }] = await db.select({ n: sql<number>`count(*)` }).from(airline);
  const [{ n: typeCount }] = await db.select({ n: sql<number>`count(*)` }).from(aircraftType);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="OPS · 01"
        meta="Operations Centre"
        title="Good morning, Captain."
        description="The board is yours. Open routes, watch the cash, and push the network out one city at a time."
        actions={
          <button className="group flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.2em] text-paper transition-all hover:bg-persimmon hover:border-persimmon">
            File a flight plan
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </button>
        }
      />

      {/* Reference data status — the world has been loaded */}
      <section className="border border-ink/15 bg-paper-deep">
        <div className="grid grid-cols-2 divide-x divide-ink/10 md:grid-cols-4">
          <RefStat code="REF" label="Airports loaded" value={airportCount} />
          <RefStat code="OPR" label="Real airlines tracked" value={airlineCount} />
          <RefStat code="EQP" label="Aircraft families" value={typeCount} />
          <div className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="flex flex-col">
              <span className="label-eyebrow">Phase</span>
              <span className="num-tabular text-[16px] leading-tight">
                01 · static world
              </span>
            </div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-hangar">
              <span className="size-1.5 rounded-full bg-hangar pulse-beacon" />
              Live
            </span>
          </div>
        </div>
      </section>

      {/* Today on the board — boarding-pass cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <BoardingCard>
          <BoardingCardEyebrow code="A" title="Today on the board" meta="MON · 12 JAN" />
          <div className="grid grid-cols-2">
            <StatBlock
              label="Cash on hand"
              value="$2.40M"
              hint="Runway · 86 game-days"
              tone="positive"
            />
            <StatBlock
              label="Net 24h"
              value="+$12K"
              hint="vs. yday +$9K"
              tone="positive"
              className="border-l border-ink/10"
            />
            <StatBlock
              label="Fuel index"
              value="$3.18"
              hint="USD / gal · +0.4%"
              className="border-t border-ink/10"
            />
            <StatBlock
              label="Reputation"
              value="32"
              hint="of 100 · regional carrier"
              className="border-t border-l border-ink/10"
            />
          </div>
        </BoardingCard>

        <BoardingCard>
          <BoardingCardEyebrow code="B" title="Fleet status" meta="01 TAIL" />
          <div className="flex flex-col gap-4 px-4 py-5">
            <FleetRow
              tail="N101AT"
              type="Embraer E170"
              base="Boston · BOS"
              utilisation={62}
              status="In service"
              tone="positive"
            />
            <div className="rule-soft" />
            <button className="group flex items-center justify-between border border-dashed border-ink/30 px-4 py-3 text-left text-[13px] text-ink-soft hover:border-ink hover:text-ink">
              <span className="flex items-center gap-3">
                <Plane className="size-4" strokeWidth={1.6} />
                Acquire a second aircraft
              </span>
              <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          </div>
        </BoardingCard>

        <BoardingCard>
          <BoardingCardEyebrow code="C" title="Awaiting your call" meta="02 OPEN" />
          <div className="flex flex-col">
            <DecisionRow
              kind="warn"
              icon={<AlertTriangle className="size-4" strokeWidth={1.7} />}
              title="Fuel hedge expiring"
              detail="Renew at $3.21/gal · 4 quarters"
            />
            <DecisionRow
              kind="info"
              icon={<Sparkles className="size-4" strokeWidth={1.7} />}
              title="Tech: Regional Ops II"
              detail="2 points available · unlocks ATR-72"
            />
          </div>
        </BoardingCard>
      </section>

      {/* Two-up: ledger summary + newsroom strip */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <BoardingCard>
          <BoardingCardEyebrow
            code="D"
            title="Ledger · last 7 game-days"
            meta="USD"
          />
          <div className="grid grid-cols-3 divide-x divide-ink/10">
            {LEDGER_ROWS.map((row) => (
              <div key={row.label} className="flex flex-col gap-1.5 px-4 py-5">
                <span className="label-eyebrow">{row.label}</span>
                <span
                  className={cn(
                    "num-tabular text-[22px] font-medium leading-none",
                    row.delta && row.delta.startsWith("+") && "text-hangar",
                    row.delta && row.delta.startsWith("-") && "text-beacon",
                  )}
                >
                  {row.value}
                </span>
                {row.delta && (
                  <span className="num-tabular text-[11px] text-ink-faint">
                    {row.delta} vs. prior week
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Sparkline-ish bar set */}
          <div className="border-t border-ink/10 px-4 py-5">
            <div className="flex items-end gap-1.5 h-24">
              {BARS.map((v, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-t-sm bg-ink/15",
                    i === BARS.length - 1 && "bg-persimmon",
                  )}
                  style={{ height: `${v}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              <span>D-7</span>
              <span>Today</span>
            </div>
          </div>
        </BoardingCard>

        <BoardingCard>
          <BoardingCardEyebrow code="E" title="Newsroom · while you were away" meta="03" />
          <ol className="divide-y divide-ink/10">
            {NEWS.map((n, i) => (
              <li key={i} className="flex flex-col gap-1.5 px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-persimmon">
                    {n.tag}
                  </span>
                  <span className="label-code text-ink-faint">{n.when}</span>
                </div>
                <p className="text-[14px] leading-snug text-ink">{n.headline}</p>
                <p className="text-[12px] text-ink-soft">{n.detail}</p>
              </li>
            ))}
          </ol>
        </BoardingCard>
      </section>
    </div>
  );
}

const LEDGER_ROWS = [
  { label: "Revenue", value: "$148K", delta: "+8%" },
  { label: "Operating cost", value: "$132K", delta: "+3%" },
  { label: "Net income", value: "$16K", delta: "+62%" },
];

const BARS = [22, 38, 30, 44, 28, 52, 64, 70, 58, 78, 88, 96];

const NEWS = [
  {
    tag: "MARKET",
    when: "08:14 · D-1",
    headline: "Jet-fuel index ticked up 0.4% as Brent crude held above $84",
    detail: "Hedged carriers extended their unit-cost lead.",
  },
  {
    tag: "FLEET",
    when: "06:02 · D-1",
    headline: "Embraer announced 14-month delivery slots on the E175 line",
    detail: "Order books open Friday — small carriers prioritised.",
  },
  {
    tag: "ROUTES",
    when: "21:30 · D-2",
    headline: "JetBlue dropped Boston ↔ Burlington from the winter schedule",
    detail: "Slot pair becomes available at BOS for Q2.",
  },
];

function RefStat({ code, label, value }: { code: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-persimmon">
        {code}
      </span>
      <div className="flex flex-col">
        <span className="label-eyebrow">{label}</span>
        <span className="num-tabular text-[18px] leading-tight">
          {value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function FleetRow({
  tail,
  type,
  base,
  utilisation,
  status,
  tone,
}: {
  tail: string;
  type: string;
  base: string;
  utilisation: number;
  status: string;
  tone: "positive" | "warning" | "negative" | "neutral";
}) {
  const dot = {
    positive: "bg-hangar",
    warning: "bg-runway",
    negative: "bg-beacon",
    neutral: "bg-ink-faint",
  }[tone];
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className={cn("size-2 rounded-full", dot, "pulse-beacon")} />
        <div className="flex flex-col">
          <span className="font-mono text-[12px] tracking-[0.08em]">{tail}</span>
          <span className="text-[11px] text-ink-faint">
            {type} · {base}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="num-tabular text-[14px]">{utilisation}%</span>
        <span className="label-code text-ink-faint">{status}</span>
      </div>
    </div>
  );
}

function DecisionRow({
  kind,
  icon,
  title,
  detail,
}: {
  kind: "warn" | "info";
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button className="group flex items-start gap-3 border-b border-ink/10 px-4 py-3.5 text-left last:border-b-0 hover:bg-paper-deep">
      <span
        className={cn(
          "mt-0.5 inline-flex size-6 items-center justify-center rounded-sm",
          kind === "warn"
            ? "bg-runway/25 text-ink"
            : "bg-persimmon/15 text-persimmon",
        )}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-[13px] font-medium text-ink">{title}</span>
        <span className="block text-[11.5px] text-ink-soft">{detail}</span>
      </span>
      <ArrowUpRight className="mt-1 size-3.5 text-ink-faint transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
    </button>
  );
}

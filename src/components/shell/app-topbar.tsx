"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { KpiStrip, type Kpi } from "./kpi-strip";
import { setRateMultiplier } from "@/app/actions/game";
import { formatGameDate } from "@/sim/time";

export type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function AppTopbar({
  user,
  airlineName = "Cumulus Air",
  airlineCode = "CMA",
  kpis,
  currentDay = 0,
  lastSimulatedAtMs,
  rateMultiplier = 1,
  rateClass = "connected",
  effectiveRate = 1,
  nextTickAtMs,
}: {
  user: SessionUser;
  airlineName?: string;
  airlineCode?: string;
  kpis: Kpi[];
  currentDay?: number;
  lastSimulatedAtMs?: number;
  rateMultiplier?: number;
  rateClass?: "connected" | "offline";
  effectiveRate?: number;
  nextTickAtMs?: number;
}) {
  const router = useRouter();
  const initials = (user.name ?? user.email ?? "?")
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="border-b border-ink/15 bg-paper">
      <div className="flex items-stretch">
        <div className="flex min-w-[260px] items-center gap-3 border-r border-ink/15 px-5 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center bg-persimmon text-paper">
            <span className="font-mono text-[12px] tracking-[0.08em]">
              {airlineCode}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[16px] leading-none">{airlineName}</span>
            <span className="label-code text-ink-faint">Carrier · Operator</span>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto scroll-jet">
          <KpiStrip kpis={kpis} />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "group flex items-center gap-3 border-l border-ink/15 px-4 py-2.5 outline-none",
              "hover:bg-paper-deep focus-visible:bg-paper-deep",
            )}
          >
            <Avatar className="size-8 border border-ink/20">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
              <AvatarFallback className="bg-midnight text-paper text-[10px] font-mono tracking-[0.12em]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="flex flex-col items-start gap-0.5 text-left">
              <span className="text-[12px] font-medium leading-none">
                {user.name ?? "Operator"}
              </span>
              <span className="label-code text-ink-faint">Captain</span>
            </span>
            <ChevronDown className="size-3.5 text-ink-faint transition-transform group-data-[state=open]:rotate-180" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint truncate">
              {user.email}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserRound className="size-4" /> Captain’s log
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings className="size-4" /> Preferences
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await signOut();
                router.push("/");
                router.refresh();
              }}
            >
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2 — in-game clock + next-tick countdown + rate switcher */}
      <div className="flex items-center gap-6 border-t border-ink/10 bg-paper-deep px-5 py-1.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-1.5 rounded-full pulse-beacon",
              rateClass === "offline" ? "bg-runway" : "bg-persimmon",
            )}
          />
          <span className="label-code text-ink-soft">{rateClass === "offline" ? "Catch-up" : "Live"}</span>
        </div>
        <Divider />
        <GameClock
          currentDay={currentDay}
          lastSimulatedAtMs={lastSimulatedAtMs}
          rate={effectiveRate}
        />
        <Divider />
        <NextTick atMs={nextTickAtMs} />
        <Divider />
        <RateSelector current={rateMultiplier} />
      </div>
    </header>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-ink/15" />;
}

function KeyVal({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-code text-ink-faint">{k}</span>
      <span className="num-tabular text-[12px] text-ink">{v}</span>
    </div>
  );
}

/**
 * Live in-game date+time. Computed client-side from
 *   gameTime = lastSimulatedAt's day boundary + (now - lastSimulatedAt) × rate
 * Server renders a placeholder so SSR/CSR markup matches.
 */
function GameClock({
  currentDay,
  lastSimulatedAtMs,
  rate,
}: {
  currentDay: number;
  lastSimulatedAtMs?: number;
  rate: number;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null || lastSimulatedAtMs == null) {
    return (
      <div className="flex items-center gap-2">
        <span className="label-code text-ink-faint">GAME</span>
        <span className="num-tabular text-[12px] text-ink">—</span>
      </div>
    );
  }

  const elapsedRealMs = Math.max(0, now - lastSimulatedAtMs);
  // 1 real-ms at rate× = rate × 24 game-ms.
  const elapsedGameMs = elapsedRealMs * rate * 24;
  const dayOffset = Math.floor(elapsedGameMs / 86_400_000);
  const intoDay = elapsedGameMs % 86_400_000;
  const day = currentDay + dayOffset;

  const h = Math.floor(intoDay / 3_600_000);
  const m = Math.floor((intoDay / 60_000) % 60);
  const s = Math.floor((intoDay / 1_000) % 60);
  const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

  const { date, year } = formatGameDate(day);

  return (
    <div className="flex items-center gap-2">
      <span className="label-code text-ink-faint">GAME</span>
      <span className="num-tabular text-[12px] text-ink">
        {date}, {year} · {time}
      </span>
    </div>
  );
}

function NextTick({ atMs }: { atMs?: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!atMs || now === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="label-code text-ink-faint">NEXT TICK</span>
        <span className="num-tabular text-[12px] text-ink">—</span>
      </div>
    );
  }
  const remaining = Math.max(0, atMs - now);
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const formatted =
    h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-2">
      <span className="label-code text-ink-faint">NEXT TICK</span>
      <span className="num-tabular text-[12px] text-ink">{formatted}</span>
    </div>
  );
}

function RateSelector({ current }: { current: number }) {
  const router = useRouter();
  const options = [1, 2, 4, 8] as const;
  return (
    <div className="ml-auto flex items-center gap-2">
      <span className="label-code text-ink-faint">RATE</span>
      <div className="flex items-stretch border border-ink/20 font-mono text-[10.5px] tracking-[0.08em]">
        {options.map((r) => (
          <button
            key={r}
            onClick={async () => {
              await setRateMultiplier(r);
              router.refresh();
            }}
            className={cn(
              "px-2 py-1 transition-colors",
              r === current
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-paper hover:text-ink",
              r !== options[0] && "border-l border-ink/20",
            )}
          >
            {r}×
          </button>
        ))}
      </div>
    </div>
  );
}

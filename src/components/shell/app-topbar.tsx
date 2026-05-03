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

export type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function AppTopbar({
  user,
  airlineName = "Cumulus Air",
  airlineCode = "CMA",
  gameDate = "Mon 12 Jan",
  gameYear = "1972",
  kpis,
}: {
  user: SessionUser;
  airlineName?: string;
  airlineCode?: string;
  gameDate?: string;
  gameYear?: string;
  kpis: Kpi[];
}) {
  const router = useRouter();
  const initials = (user.name ?? user.email ?? "?")
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [wallclock, setWallclock] = useState<string>("");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      const s = d.getSeconds().toString().padStart(2, "0");
      setWallclock(`${h}:${m}:${s} UTC${-d.getTimezoneOffset() / 60 >= 0 ? "+" : ""}${-d.getTimezoneOffset() / 60}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="border-b border-ink/15 bg-paper">
      {/* Row 1 — airline lockup + KPIs + user */}
      <div className="flex items-stretch">
        {/* Airline / call-sign card */}
        <div className="flex min-w-[260px] items-center gap-3 border-r border-ink/15 px-5 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center bg-persimmon text-paper">
            <span className="font-mono text-[12px] tracking-[0.08em]">
              {airlineCode}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[16px] leading-none">
              {airlineName}
            </span>
            <span className="label-code text-ink-faint">
              Carrier · Operator
            </span>
          </div>
        </div>

        {/* Live KPI strip — split-flap aesthetic */}
        <div className="flex-1 overflow-x-auto scroll-jet">
          <KpiStrip kpis={kpis} />
        </div>

        {/* User chip */}
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

      {/* Row 2 — wallclock + game date marquee */}
      <div className="flex items-center gap-6 border-t border-ink/10 bg-paper-deep px-5 py-1.5">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-persimmon pulse-beacon" />
          <span className="label-code text-ink-soft">Live</span>
        </div>
        <Divider />
        <KeyVal k="GAME" v={`${gameDate} · ${gameYear}`} />
        <Divider />
        <KeyVal k="REAL" v={wallclock || "—"} />
        <Divider />
        <KeyVal k="RATE" v="1.00× · connected" />
        <span className="ml-auto label-code text-ink-faint">
          NXT TICK · 00:42
        </span>
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

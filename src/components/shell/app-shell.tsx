import { type ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar, type SessionUser } from "./app-topbar";
import { type Kpi } from "./kpi-strip";

export function AppShell({
  user,
  kpis,
  airlineName,
  airlineCode,
  gameDate,
  gameYear,
  rateMultiplier,
  rateClass,
  nextTickAtMs,
  children,
}: {
  user: SessionUser;
  kpis: Kpi[];
  airlineName?: string;
  airlineCode?: string;
  gameDate?: string;
  gameYear?: string;
  rateMultiplier?: number;
  rateClass?: "connected" | "offline";
  nextTickAtMs?: number;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh bg-paper text-ink">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar
          user={user}
          kpis={kpis}
          airlineName={airlineName}
          airlineCode={airlineCode}
          gameDate={gameDate}
          gameYear={gameYear}
          rateMultiplier={rateMultiplier}
          rateClass={rateClass}
          nextTickAtMs={nextTickAtMs}
        />
        <main className="relative flex-1 px-8 pb-16 pt-2">
          <CompassWatermark />
          <div className="relative mx-auto max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function CompassWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -right-32 top-12 hidden opacity-[0.06] xl:block"
    >
      <svg viewBox="0 0 320 320" className="size-[480px] text-ink drift-slow">
        <g fill="none" stroke="currentColor" strokeWidth="0.6">
          <circle cx="160" cy="160" r="159" />
          <circle cx="160" cy="160" r="120" />
          <circle cx="160" cy="160" r="80" />
          <circle cx="160" cy="160" r="40" />
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i * Math.PI * 2) / 16;
            const x1 = 160 + Math.cos(a) * 40;
            const y1 = 160 + Math.sin(a) * 40;
            const x2 = 160 + Math.cos(a) * 159;
            const y2 = 160 + Math.sin(a) * 159;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth={i % 4 === 0 ? 1.4 : 0.5}
              />
            );
          })}
        </g>
        <text x="160" y="40" textAnchor="middle" className="font-mono" fontSize="11" letterSpacing="6" fill="currentColor">N</text>
        <text x="280" y="165" textAnchor="middle" className="font-mono" fontSize="11" letterSpacing="6" fill="currentColor">E</text>
        <text x="160" y="290" textAnchor="middle" className="font-mono" fontSize="11" letterSpacing="6" fill="currentColor">S</text>
        <text x="40" y="165" textAnchor="middle" className="font-mono" fontSize="11" letterSpacing="6" fill="currentColor">W</text>
      </svg>
    </div>
  );
}

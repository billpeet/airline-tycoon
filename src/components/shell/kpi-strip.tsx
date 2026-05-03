import { cn } from "@/lib/utils";

export type Kpi = {
  code: string;       // e.g. "CASH"
  label: string;      // e.g. "Cash on hand"
  value: string;      // pre-formatted display value
  delta?: string;     // e.g. "+$12K"
  tone?: "neutral" | "positive" | "negative" | "warning";
  flap?: boolean;     // animate in like a split-flap
};

const toneClass: Record<NonNullable<Kpi["tone"]>, string> = {
  neutral: "text-paper",
  positive: "text-hangar",
  negative: "text-beacon",
  warning: "text-runway",
};

export function KpiStrip({ kpis }: { kpis: Kpi[] }) {
  return (
    <div
      className={cn(
        "relative flex items-stretch divide-x divide-sidebar-border",
        "bg-midnight text-paper",
      )}
    >
      {kpis.map((k, i) => (
        <div
          key={k.code}
          className="flex min-w-[150px] flex-col gap-0.5 px-5 py-2.5"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-paper/55">
              {k.code}
            </span>
            <span className="text-[10px] tracking-[0.04em] text-paper/55">
              {k.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "num-tabular text-[18px] font-medium leading-none",
                k.flap && "flap-in",
                toneClass[k.tone ?? "neutral"],
              )}
            >
              {k.value}
            </span>
            {k.delta && (
              <span
                className={cn(
                  "num-tabular text-[10.5px]",
                  k.tone === "negative"
                    ? "text-beacon"
                    : k.tone === "warning"
                      ? "text-runway"
                      : "text-hangar",
                )}
              >
                {k.delta}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

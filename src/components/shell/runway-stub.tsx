import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

/**
 * RunwayStub — large editorial placeholder for sections we haven't
 * implemented yet. Communicates intent ("this *is* coming") with the
 * same visual care as a finished page, so the shell never feels half-built.
 */
export function RunwayStub({
  code,
  title,
  blurb,
  bullets,
  phase,
}: {
  code: string;
  title: string;
  blurb: string;
  bullets: string[];
  phase: string;
}) {
  return (
    <section className="relative overflow-hidden border border-ink bg-paper">
      <RunwayMarkings />

      <div className="relative grid gap-10 px-10 py-14 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.36em] text-persimmon">
              {code}
            </span>
            <span className="h-px flex-1 bg-ink/30" />
            <span className="label-code text-ink-faint">{phase}</span>
          </div>

          <h2 className="font-display text-[64px] leading-[0.96] tracking-[-0.02em] text-ink">
            {title}
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-ink-soft">
            {blurb}
          </p>

          <ul className="mt-2 grid gap-2.5">
            {bullets.map((b, i) => (
              <li
                key={b}
                className="flex items-baseline gap-3 text-[13px] text-ink-soft"
              >
                <span className="font-mono text-[10px] tracking-[0.18em] text-ink-faint w-6">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <DepartureMonitor code={code} title={title} phase={phase} />
      </div>
    </section>
  );
}

function RunwayMarkings() {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0",
        "[background-image:repeating-linear-gradient(90deg,transparent_0_56px,oklch(0.890_0.028_76)_56px_60px)]",
        "opacity-50",
      )}
    />
  );
}

function DepartureMonitor({
  code,
  title,
  phase,
}: {
  code: string;
  title: string;
  phase: string;
}) {
  const rows = [
    { time: "—:—", from: "TBD", to: "TBD", gate: "—", status: "SCHEDULED" },
    { time: "—:—", from: "TBD", to: "TBD", gate: "—", status: "SCHEDULED" },
    { time: "—:—", from: "TBD", to: "TBD", gate: "—", status: "SCHEDULED" },
  ];
  return (
    <div className="relative bg-midnight text-paper p-5 shadow-[6px_6px_0_0_var(--color-ink)]">
      <div className="flex items-center justify-between border-b border-paper/20 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.32em]">
          Departures
        </span>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper/65">
          <span className="size-1.5 rounded-full bg-runway pulse-beacon" />
          Awaiting data
        </span>
      </div>
      <table className="w-full mt-3 text-[11px] font-mono">
        <thead className="text-paper/50 uppercase tracking-[0.18em]">
          <tr>
            <th className="text-left font-normal pb-1.5">Time</th>
            <th className="text-left font-normal pb-1.5">From</th>
            <th className="text-left font-normal pb-1.5">To</th>
            <th className="text-left font-normal pb-1.5">Gate</th>
            <th className="text-right font-normal pb-1.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-paper/10">
          {rows.map((r, i) => (
            <tr key={i} className="text-paper/85">
              <td className="py-2">{r.time}</td>
              <td className="py-2">{r.from}</td>
              <td className="py-2">{r.to}</td>
              <td className="py-2">{r.gate}</td>
              <td className="py-2 text-right text-runway">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between border-t border-paper/20 pt-3 text-[10px] uppercase tracking-[0.18em] text-paper/55">
        <span>{code}</span>
        <span>{phase} · {title.toUpperCase()}</span>
      </div>
    </div>
  );
}

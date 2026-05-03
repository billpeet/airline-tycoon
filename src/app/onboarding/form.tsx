"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowUpRight } from "lucide-react";
import { createGame } from "@/app/actions/game";
import { cn } from "@/lib/utils";

type AirportRow = {
  id: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string;
};

export function OnboardingForm({ airports }: { airports: AirportRow[] }) {
  const [airlineName, setAirlineName] = useState("");
  const [airlineCode, setAirlineCode] = useState("");
  const [query, setQuery] = useState("");
  const [home, setHome] = useState<AirportRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return airports.slice(0, 12);
    return airports
      .filter(
        (a) =>
          (a.iata ?? "").toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.city ?? "").toLowerCase().includes(q) ||
          a.country.toLowerCase() === q,
      )
      .slice(0, 12);
  }, [airports, query]);

  const ready = airlineName.trim().length >= 3 && /^[A-Z0-9]{2,3}$/.test(airlineCode) && !!home;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || pending) return;
        setError(null);
        startTransition(async () => {
          try {
            await createGame({
              airlineName: airlineName.trim(),
              airlineCode,
              homeAirportId: home!.id,
            });
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        });
      }}
      className="flex flex-col gap-8"
    >
      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <Field label="Airline name" sub="Up to 60 characters.">
          <input
            value={airlineName}
            onChange={(e) => setAirlineName(e.target.value)}
            maxLength={60}
            placeholder="Cumulus Air"
            className="w-full border border-ink/30 bg-paper px-3 py-2.5 font-display text-[20px] outline-none focus:border-ink"
          />
        </Field>
        <Field label="Call-sign" sub="2–3 letters or digits. Becomes your code.">
          <input
            value={airlineCode}
            onChange={(e) => setAirlineCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3))}
            maxLength={3}
            placeholder="CMA"
            className="w-full border border-ink/30 bg-paper px-3 py-2.5 font-mono text-[20px] tracking-[0.2em] uppercase outline-none focus:border-ink"
          />
        </Field>
      </div>

      <Field
        label="Home airport"
        sub={home ? `Selected: ${home.iata} · ${home.city ?? home.name}` : "Search by IATA, city, name or 2-letter country code."}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="LHR · London · GB"
          className="w-full border border-ink/30 bg-paper px-3 py-2.5 outline-none focus:border-ink"
        />
        <div className="mt-2 max-h-[260px] overflow-y-auto scroll-jet border border-ink/15 bg-paper-deep">
          {matches.length === 0 && (
            <div className="px-3 py-3 text-[12.5px] text-ink-faint">No airports match.</div>
          )}
          {matches.map((a) => {
            const selected = home?.id === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setHome(a)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 border-b border-ink/10 px-3 py-2 text-left text-[12.5px] last:border-b-0",
                  selected ? "bg-ink text-paper" : "hover:bg-paper",
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "font-mono text-[11px] tracking-[0.1em]",
                      selected ? "text-persimmon" : "text-persimmon",
                    )}
                  >
                    {a.iata}
                  </span>
                  <span>{a.city ?? a.name}</span>
                  <span className={cn("text-[11px]", selected ? "text-paper/70" : "text-ink-faint")}>
                    {a.name !== a.city ? a.name : ""}
                  </span>
                </span>
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.18em]",
                    selected ? "text-paper/70" : "text-ink-faint",
                  )}
                >
                  {a.country}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      {error && (
        <div className="border border-beacon bg-beacon/10 px-4 py-3 text-[13px] text-beacon">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-ink/15 pt-6">
        <p className="max-w-md text-[12px] text-ink-faint">
          You can change your livery later. The call-sign sticks for life.
        </p>
        <button
          type="submit"
          disabled={!ready || pending}
          className={cn(
            "group flex items-center gap-3 border border-ink bg-ink px-5 py-3 text-[12px] uppercase tracking-[0.22em] text-paper",
            "shadow-[3px_3px_0_0_var(--color-persimmon)]",
            "transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_0_var(--color-persimmon)]",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
          )}
        >
          {pending ? "Filing certificate…" : "Found the airline"}
          <ArrowUpRight aria-hidden className="size-4" />
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label-eyebrow">{label}</span>
      {children}
      {sub && <span className="text-[11.5px] text-ink-faint">{sub}</span>}
    </label>
  );
}

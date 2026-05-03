"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateRoute } from "@/app/actions/game";
import { cn } from "@/lib/utils";

const MAX_DAILY_FLIGHT_HOURS = 14;

type FleetItem = {
  id: string;
  tail: string;
  baseId: string;
  typeId: string;
  rangeKm: number;
  pax: number;
  cruiseSpeedKts: number;
  family: string;
  model: string;
};

export type EditableRoute = {
  id: string;
  fromId: string;
  toId: string;
  fromIata: string | null;
  toIata: string | null;
  fromCity: string | null;
  toCity: string | null;
  aircraftId: string;
  distanceKm: number;
  fareEconomyCents: number;
  frequencyPerWeek: number;
};

export function EditRouteButton({
  route: r,
  fleet,
  reputation,
  usedHoursByAircraft,
}: {
  route: EditableRoute;
  fleet: FleetItem[];
  reputation: number;
  usedHoursByAircraft: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint hover:text-ink"
      >
        <Pencil className="inline size-3" /> Edit
      </button>
      {open && (
        <Dialog
          onClose={() => setOpen(false)}
          route={r}
          fleet={fleet}
          reputation={reputation}
          usedHoursByAircraft={usedHoursByAircraft}
        />
      )}
    </>
  );
}

function Dialog({
  onClose,
  route: initial,
  fleet,
  reputation,
  usedHoursByAircraft,
}: {
  onClose: () => void;
  route: EditableRoute;
  fleet: FleetItem[];
  reputation: number;
  usedHoursByAircraft: Record<string, number>;
}) {
  const [aircraftId, setAircraftId] = useState(initial.aircraftId);
  const [fareEconomy, setFareEconomy] = useState(initial.fareEconomyCents / 100);
  const [frequency, setFrequency] = useState(initial.frequencyPerWeek);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const aircraft = fleet.find((f) => f.id === aircraftId);

  // Filter fleet to those whose base matches one of the route endpoints — the
  // server will reject otherwise, no point letting the player pick.
  const eligible = fleet.filter(
    (f) => f.baseId === initial.fromId || f.baseId === initial.toId,
  );

  const projection = useMemo(() => {
    if (!aircraft) return null;
    const inRange = initial.distanceKm <= aircraft.rangeKm;
    const flightHoursPerLeg = initial.distanceKm / (aircraft.cruiseSpeedKts * 1.852);
    const dailyFreq = frequency / 7;
    const seatsPerDay = aircraft.pax * dailyFreq;
    const newDailyHours = flightHoursPerLeg * 2 * dailyFreq;

    // Used hours on the *target* aircraft, EXCLUDING this route's existing
    // contribution (only relevant when not changing aircraft).
    let otherUsedHours = usedHoursByAircraft[aircraft.id] ?? 0;
    if (aircraft.id === initial.aircraftId) {
      // subtract the current route's existing hours so we don't double-count
      const existingLegHours = initial.distanceKm / (aircraft.cruiseSpeedKts * 1.852);
      const existingDailyHours = existingLegHours * 2 * (initial.frequencyPerWeek / 7);
      otherUsedHours = Math.max(0, otherUsedHours - existingDailyHours);
    }
    const totalAfter = otherUsedHours + newDailyHours;
    const utilOk = totalAfter <= MAX_DAILY_FLIGHT_HOURS;

    // Demand projection
    const sizeWeight = (s: "small" | "medium" | "large") =>
      s === "small" ? 0.25 : s === "medium" ? 0.7 : 1.4;
    // We don't have endpoint sizes here — use a neutral mid value (0.7) for
    // each. Open-route shows the full preview pre-commit; this is a quick
    // sanity for fare/freq tweaks.
    const sizeMix = (sizeWeight("medium") + sizeWeight("medium")) / 2;
    const distFactor = (() => {
      if (initial.distanceKm < 200) return 0.15;
      const lk = Math.log(initial.distanceKm / 1500);
      return Math.max(0.15, Math.exp(-(lk * lk) / 1.6));
    })();
    const market = Math.max(4500, Math.min(120_000, 4000 + Math.round(initial.distanceKm * 12)));
    const yourCents = fareEconomy * 100;
    const elastic = Math.max(0.15, Math.min(1.8, Math.exp(-1.4 * (yourCents / market - 1))));
    const rep = 0.6 + (reputation / 100) * 0.8;
    const expectedPax = Math.round(sizeMix * distFactor * 380 * elastic * rep);
    const realised = Math.min(seatsPerDay, expectedPax);
    const load = seatsPerDay > 0 ? realised / seatsPerDay : 0;

    return {
      inRange,
      utilOk,
      newDailyHours,
      otherUsedHours,
      totalAfter,
      flightHoursPerLeg,
      seatsPerDay,
      realised,
      load,
      marketCents: market,
    };
  }, [aircraft, fareEconomy, frequency, initial, reputation, usedHoursByAircraft]);

  const dirty =
    Math.round(fareEconomy * 100) !== initial.fareEconomyCents ||
    frequency !== initial.frequencyPerWeek ||
    aircraftId !== initial.aircraftId;

  const canSave =
    !!aircraft &&
    !!projection?.inRange &&
    !!projection?.utilOk &&
    fareEconomy >= 10 &&
    frequency >= 1 &&
    dirty;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-3xl flex-col border border-ink bg-paper shadow-[8px_8px_0_0_var(--color-ink)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink/15 bg-paper-deep px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-persimmon">
              EDIT ROUTE
            </span>
            <span className="font-mono text-[12px] tracking-[0.08em] text-ink">
              {initial.fromIata} → {initial.toIata}
            </span>
            <span className="label-code text-ink-faint">
              {initial.fromCity} · {initial.toCity}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-soft hover:text-ink">
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Aircraft" sub={`${eligible.length} eligible (based at endpoints)`}>
              <select
                value={aircraftId}
                onChange={(e) => setAircraftId(e.target.value)}
                className="w-full border border-ink/30 bg-paper px-3 py-2 text-[14px] outline-none focus:border-ink"
              >
                {eligible.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.tail} · {f.family} {f.model} · {f.pax}p
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Economy fare (USD)"
              sub={projection ? `Market estimate: $${(projection.marketCents / 100).toFixed(0)}` : undefined}
            >
              <input
                type="number"
                value={fareEconomy}
                onChange={(e) => setFareEconomy(Math.max(10, Number(e.target.value)))}
                className="w-full border border-ink/30 bg-paper px-3 py-2 text-[14px] num-tabular outline-none focus:border-ink"
              />
            </Field>
            <Field label="Frequency / week" sub="1–21 round-trips">
              <input
                type="number"
                min={1}
                max={21}
                value={frequency}
                onChange={(e) => setFrequency(Math.max(1, Math.min(21, Number(e.target.value))))}
                className="w-full border border-ink/30 bg-paper px-3 py-2 text-[14px] num-tabular outline-none focus:border-ink"
              />
            </Field>
          </div>

          {projection && (
            <div className="grid gap-3 border border-ink/20 bg-paper-deep p-4 md:grid-cols-4">
              <Stat k="Distance" v={`${Math.round(initial.distanceKm).toLocaleString()} km`} />
              <Stat k="Flight time" v={`${projection.flightHoursPerLeg.toFixed(1)} h / leg`} />
              <Stat k="Seats / day" v={Math.round(projection.seatsPerDay).toString()} />
              <Stat k="Expected pax" v={projection.realised.toLocaleString()} />
              <Stat k="Load factor" v={`${(projection.load * 100).toFixed(0)}%`} />
              <Stat k="Range" v={projection.inRange ? "✓ within" : "✗ exceeds"} tone={projection.inRange ? "positive" : "negative"} />
              <Stat
                k="Aircraft utilisation"
                v={`${projection.totalAfter.toFixed(1)}h / ${MAX_DAILY_FLIGHT_HOURS}h`}
                tone={projection.utilOk ? "positive" : "negative"}
              />
              <Stat k="This route" v={`${projection.newDailyHours.toFixed(1)}h / day`} />
            </div>
          )}

          {projection && !projection.utilOk && (
            <p className="border border-runway bg-runway/15 px-3 py-2 text-[12px] text-ink">
              Aircraft would be over its 14h/day cap. Lower frequency, or pick a different tail.
            </p>
          )}
          {error && (
            <p className="border border-beacon bg-beacon/10 px-3 py-2 text-[12px] text-beacon">{error}</p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-ink/15 bg-paper-deep px-5 py-3">
          <button onClick={onClose} className="text-[12px] uppercase tracking-[0.2em] text-ink-soft hover:text-ink">
            Cancel
          </button>
          <button
            disabled={!canSave || pending}
            onClick={() => {
              setError(null);
              start(async () => {
                try {
                  await updateRoute({
                    routeId: initial.id,
                    fareEconomyCents: Math.round(fareEconomy * 100),
                    frequencyPerWeek: frequency,
                    aircraftId,
                  });
                  onClose();
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              });
            }}
            className={cn(
              "border border-ink bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.22em] text-paper transition-colors",
              canSave ? "hover:bg-persimmon hover:border-persimmon" : "cursor-not-allowed opacity-50",
            )}
          >
            {pending ? "Saving…" : dirty ? "Save changes" : "No changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-eyebrow">{label}</span>
      {children}
      {sub && <span className="text-[11px] text-ink-faint">{sub}</span>}
    </label>
  );
}
function Stat({ k, v, tone }: { k: string; v: string; tone?: "positive" | "negative" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label-code text-ink-faint">{k}</span>
      <span className={cn("num-tabular text-[14px]", tone === "positive" ? "text-hangar" : tone === "negative" ? "text-beacon" : "text-ink")}>{v}</span>
    </div>
  );
}

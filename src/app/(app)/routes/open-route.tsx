"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowUpRight, X, Network } from "lucide-react";
import { openRoute } from "@/app/actions/game";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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

type AirportLite = {
  id: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string;
  lat: number;
  lon: number;
  size: "small" | "medium" | "large";
  slotConstrained: boolean;
};

export function OpenRouteButton({
  fleet,
  bases,
  reputation,
  usedHoursByAircraft,
}: {
  fleet: FleetItem[];
  bases: AirportLite[];
  reputation: number;
  usedHoursByAircraft: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const disabled = fleet.length === 0;
  return (
    <>
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "group flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.2em] text-paper transition-all",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "hover:bg-persimmon hover:border-persimmon",
        )}
        title={disabled ? "Acquire an aircraft first" : undefined}
      >
        <Network className="size-3.5" />
        Open route
        <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </button>
      {open && (
        <OpenRouteDialog
          onClose={() => setOpen(false)}
          fleet={fleet}
          bases={bases}
          reputation={reputation}
          usedHoursByAircraft={usedHoursByAircraft}
        />
      )}
    </>
  );
}

const MAX_DAILY_FLIGHT_HOURS = 14;

function OpenRouteDialog({
  onClose,
  fleet,
  bases,
  reputation,
  usedHoursByAircraft,
}: {
  onClose: () => void;
  fleet: FleetItem[];
  bases: AirportLite[];
  reputation: number;
  usedHoursByAircraft: Record<string, number>;
}) {
  const [aircraftId, setAircraftId] = useState<string>(fleet[0]?.id ?? "");
  const [fromId, setFromId] = useState<string>(fleet[0]?.baseId ?? "");
  const [toQuery, setToQuery] = useState("");
  const [toCandidates, setToCandidates] = useState<AirportLite[]>([]);
  const [toAirport, setToAirport] = useState<AirportLite | null>(null);
  const [fareEconomy, setFareEconomy] = useState<number>(180);
  const [frequency, setFrequency] = useState<number>(7);
  const [competitors, setCompetitors] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const aircraft = fleet.find((f) => f.id === aircraftId);
  const fromAirport = bases.find((b) => b.id === fromId);

  // Search candidates as user types
  const searchTo = async (q: string) => {
    setToQuery(q);
    if (q.trim().length < 2) {
      setToCandidates([]);
      return;
    }
    const res = await fetch(`/api/airports/search?q=${encodeURIComponent(q)}`);
    if (res.ok) setToCandidates(await res.json());
  };

  const distance = useMemo(() => {
    if (!fromAirport || !toAirport) return 0;
    return greatCircleKm(fromAirport.lat, fromAirport.lon, toAirport.lat, toAirport.lon);
  }, [fromAirport, toAirport]);

  // Fetch competitor count when both endpoints are set
  useEffect(() => {
    if (!fromAirport || !toAirport) {
      setCompetitors(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/airports/competitors?from=${fromAirport.id}&to=${toAirport.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setCompetitors(typeof j.count === "number" ? j.count : 0);
      })
      .catch(() => !cancelled && setCompetitors(0));
    return () => {
      cancelled = true;
    };
  }, [fromAirport, toAirport]);

  const projection = useMemo(() => {
    if (!aircraft || !fromAirport || !toAirport || distance === 0) return null;
    const inRange = distance <= aircraft.rangeKm;
    const flightHoursPerLeg = distance / (aircraft.cruiseSpeedKts * 1.852);
    const dailyFreq = frequency / 7;
    const seatsPerDay = aircraft.pax * dailyFreq;
    const newDailyHours = flightHoursPerLeg * 2 * dailyFreq;
    const usedHours = usedHoursByAircraft[aircraft.id] ?? 0;
    const totalAfter = usedHours + newDailyHours;
    const utilOk = totalAfter <= MAX_DAILY_FLIGHT_HOURS;
    // Reuse the same demand formula as the sim, in pure JS for preview.
    const sizeWeight = (s: "small" | "medium" | "large") =>
      s === "small" ? 0.25 : s === "medium" ? 0.7 : 1.4;
    const sizeMix = (sizeWeight(fromAirport.size) + sizeWeight(toAirport.size)) / 2;
    const hubBonus = (fromAirport.slotConstrained ? 1.35 : 1) * (toAirport.slotConstrained ? 1.35 : 1);
    const distFactor = (() => {
      if (distance < 200) return 0.15;
      const lk = Math.log(distance / 1500);
      return Math.max(0.15, Math.exp(-(lk * lk) / 1.6));
    })();
    const market = Math.max(4500, Math.min(120_000, 4000 + Math.round(distance * 12)));
    const yourCents = fareEconomy * 100;
    const elastic = Math.max(0.15, Math.min(1.8, Math.exp(-1.4 * (yourCents / market - 1))));
    const rep = 0.6 + (reputation / 100) * 0.8;
    const compMul = 1 / (1 + 0.25 * (competitors ?? 0));
    const expectedPax = Math.round(sizeMix * hubBonus * distFactor * 380 * elastic * rep * compMul);
    const realised = Math.min(seatsPerDay, expectedPax);
    const load = seatsPerDay > 0 ? realised / seatsPerDay : 0;
    return {
      inRange,
      flightHoursPerLeg,
      seatsPerDay,
      expectedPax,
      realised,
      load,
      marketCents: market,
      newDailyHours,
      usedHours,
      totalAfter,
      utilOk,
      compMul,
    };
  }, [aircraft, fromAirport, toAirport, distance, fareEconomy, frequency, reputation, usedHoursByAircraft, competitors]);

  const canSubmit =
    !!aircraft &&
    !!fromAirport &&
    !!toAirport &&
    !!projection?.inRange &&
    !!projection?.utilOk &&
    fareEconomy >= 10 &&
    frequency >= 1;

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
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-persimmon">
            FLT · NEW ROUTE
          </span>
          <button onClick={onClose} aria-label="Close" className="text-ink-soft hover:text-ink">
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto p-6">
          {/* 1: Aircraft + base */}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Aircraft">
              <select
                value={aircraftId}
                onChange={(e) => {
                  setAircraftId(e.target.value);
                  const a = fleet.find((f) => f.id === e.target.value);
                  if (a) setFromId(a.baseId);
                }}
                className="w-full border border-ink/30 bg-paper px-3 py-2 text-[14px] outline-none focus:border-ink"
              >
                {fleet.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.tail} · {f.family} {f.model} · {f.pax}p · {f.rangeKm.toLocaleString()} km
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From (base)">
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full border border-ink/30 bg-paper px-3 py-2 text-[14px] outline-none focus:border-ink"
              >
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.iata} · {b.city ?? b.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* 2: To */}
          <Field label="To" sub={toAirport ? `${toAirport.iata} · ${toAirport.city ?? toAirport.name} · ${toAirport.country}` : "Search by IATA, city or name"}>
            <input
              value={toQuery}
              onChange={(e) => searchTo(e.target.value)}
              placeholder="JFK · New York"
              className="w-full border border-ink/30 bg-paper px-3 py-2 text-[14px] outline-none focus:border-ink"
            />
            {toCandidates.length > 0 && (
              <div className="mt-1 max-h-[200px] overflow-y-auto border border-ink/15 bg-paper-deep">
                {toCandidates.map((a) => {
                  const inRange = aircraft ? greatCircleKm(fromAirport?.lat ?? 0, fromAirport?.lon ?? 0, a.lat, a.lon) <= aircraft.rangeKm : false;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setToAirport(a);
                        setToQuery(`${a.iata} · ${a.city ?? a.name}`);
                        setToCandidates([]);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 border-b border-ink/10 px-3 py-2 text-left text-[12.5px] last:border-b-0",
                        inRange ? "hover:bg-paper" : "opacity-40",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-persimmon">{a.iata}</span>
                        <span>{a.city ?? a.name}</span>
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                        {a.country} {!inRange && "· OUT OF RANGE"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          {/* 3: Fare + frequency */}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Economy fare (USD)" sub={projection ? `Market estimate: $${(projection.marketCents / 100).toFixed(0)}` : undefined}>
              <input
                type="number"
                value={fareEconomy}
                onChange={(e) => setFareEconomy(Math.max(10, Number(e.target.value)))}
                className="w-full border border-ink/30 bg-paper px-3 py-2 text-[14px] num-tabular outline-none focus:border-ink"
              />
            </Field>
            <Field label="Frequency / week" sub="1–21 round-trips per week">
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

          {/* Projection */}
          {projection && (
            <div className="grid gap-3 border border-ink/20 bg-paper-deep p-4 md:grid-cols-4">
              <Stat k="Distance" v={`${Math.round(distance).toLocaleString()} km`} />
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
              <Stat
                k="This route adds"
                v={`${projection.newDailyHours.toFixed(1)}h / day`}
              />
              <Stat
                k="Competitors"
                v={
                  competitors === null
                    ? "—"
                    : competitors === 0
                      ? "0 · clear"
                      : `${competitors} · ×${projection.compMul.toFixed(2)}`
                }
                tone={competitors === null ? undefined : competitors === 0 ? "positive" : competitors >= 4 ? "negative" : undefined}
              />
            </div>
          )}
          {projection && !projection.utilOk && (
            <p className="border border-runway bg-runway/15 px-3 py-2 text-[12px] text-ink">
              Aircraft is over its 14h/day cap. Lower frequency, shorten the route, or assign another tail.
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
            disabled={!canSubmit || pending}
            onClick={() => {
              if (!canSubmit || !aircraft || !fromAirport || !toAirport) return;
              setError(null);
              start(async () => {
                try {
                  await openRoute({
                    fromAirportId: fromAirport.id,
                    toAirportId: toAirport.id,
                    aircraftId: aircraft.id,
                    fareEconomyCents: Math.round(fareEconomy * 100),
                    frequencyPerWeek: frequency,
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
              canSubmit ? "hover:bg-persimmon hover:border-persimmon" : "cursor-not-allowed opacity-50",
            )}
          >
            {pending ? "Filing…" : "Open route"}
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

// Inline copy of the great-circle helper so this client component doesn't pull
// in the server-only sim modules.
function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

"use client";

import { useState, useTransition } from "react";
import { ArrowUpRight, Plane, X } from "lucide-react";
import type { AircraftType } from "@/db/schema";
import { buyAircraft, type AcquireMode } from "@/app/actions/game";
import { cn } from "@/lib/utils";
import { formatUsdCents } from "@/lib/money";
import { useRouter } from "next/navigation";
import {
  monthlyPaymentCents,
  DEFAULT_LOAN_RATE_BPS,
  FINANCE_DOWNPAYMENT_PCT,
  LEASE_DEPOSIT_MONTHS,
} from "@/sim/finance";

export function FleetActions({
  cashCents,
  homeAirportId,
  catalogue,
}: {
  cashCents: number;
  homeAirportId: string;
  catalogue: AircraftType[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.2em] text-paper transition-all hover:bg-persimmon hover:border-persimmon"
      >
        <Plane className="size-3.5" />
        Acquire aircraft
        <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </button>
      {open && (
        <AcquireDialog
          onClose={() => setOpen(false)}
          cashCents={cashCents}
          homeAirportId={homeAirportId}
          catalogue={catalogue}
        />
      )}
    </>
  );
}

function AcquireDialog({
  onClose,
  cashCents,
  homeAirportId,
  catalogue,
}: {
  onClose: () => void;
  cashCents: number;
  homeAirportId: string;
  catalogue: AircraftType[];
}) {
  const [filterClass, setFilterClass] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"cash" | "finance" | "lease">("cash");
  const [loanTerm, setLoanTerm] = useState<24 | 60 | 120>(60);
  const [leaseTerm, setLeaseTerm] = useState<24 | 36 | 60>(36);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const filtered = catalogue.filter((c) => filterClass === "all" || c.typeClass === filterClass);
  const selected = catalogue.find((c) => c.id === selectedId);
  const priceCents = selected ? Math.round(selected.listPriceMusd * 1_000_000 * 100) : 0;
  const leaseMonthlyCents = selected ? Math.round(selected.leaseRateKusdMonth * 1000 * 100) : 0;

  // Per-mode: upfront cash, monthly outflow
  const downCents = Math.round(priceCents * FINANCE_DOWNPAYMENT_PCT);
  const principalCents = priceCents - downCents;
  const loanMonthly = selected ? monthlyPaymentCents(principalCents, DEFAULT_LOAN_RATE_BPS, loanTerm) : 0;
  const leaseDeposit = leaseMonthlyCents * LEASE_DEPOSIT_MONTHS;

  const upfront =
    tab === "cash" ? priceCents : tab === "finance" ? downCents : leaseDeposit;
  const monthly =
    tab === "cash" ? 0 : tab === "finance" ? loanMonthly : leaseMonthlyCents;
  const canAfford = selected ? cashCents >= upfront : false;

  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-5xl flex-col border border-ink bg-paper shadow-[8px_8px_0_0_var(--color-ink)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink/15 bg-paper-deep px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-persimmon">
              ACQ · ORDER BOOK
            </span>
            <span className="label-code text-ink-soft">{filtered.length} options</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-soft hover:text-ink">
            <X className="size-4" />
          </button>
        </header>

        <div className="grid flex-1 grid-cols-[1fr_320px] divide-x divide-ink/15 overflow-hidden">
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-ink/10 bg-paper px-4 py-2 text-[11px]">
              <span className="label-code text-ink-faint">CLASS</span>
              {(["all", "turboprop", "regional_jet", "narrowbody", "widebody"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterClass(c)}
                  className={cn(
                    "px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em]",
                    filterClass === c
                      ? "bg-ink text-paper"
                      : "text-ink-soft hover:bg-paper-deep",
                  )}
                >
                  {c.replace("_", " ")}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto scroll-jet">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-paper-deep text-ink-soft">
                  <tr className="border-b border-ink/15">
                    <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em]">Model</th>
                    <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em]">Class</th>
                    <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.22em]">Pax</th>
                    <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.22em]">Range</th>
                    <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.22em]">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const cents = Math.round(c.listPriceMusd * 1_000_000 * 100);
                    const sel = c.id === selectedId;
                    const afford = cashCents >= cents;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          "cursor-pointer border-b border-ink/10 last:border-b-0",
                          sel ? "bg-ink text-paper" : "hover:bg-paper-deep",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <div className={sel ? "text-paper" : "text-ink"}>
                            {c.manufacturer} {c.model}
                          </div>
                          <div className={cn("text-[11px]", sel ? "text-paper/70" : "text-ink-faint")}>
                            {c.family}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn("label-code", sel ? "text-paper/80" : "text-ink-soft")}>
                            {c.typeClass.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right num-tabular">{c.typicalPax}</td>
                        <td className="px-3 py-2.5 text-right num-tabular">{c.rangeKm.toLocaleString()}</td>
                        <td
                          className={cn(
                            "px-3 py-2.5 text-right num-tabular",
                            !afford && !sel && "text-ink-faint line-through",
                          )}
                        >
                          ${c.listPriceMusd.toFixed(0)}M
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side: details + commit */}
          <aside className="flex flex-col overflow-y-auto p-5">
            {selected ? (
              <>
                <span className="label-eyebrow">Selected</span>
                <h3 className="font-display text-[28px] leading-tight">{selected.manufacturer} {selected.model}</h3>
                <p className="mt-1 text-[12px] text-ink-faint">
                  {selected.family} · {selected.typeClass.replace("_", " ")}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-[12px]">
                  <Spec k="Pax (typical)" v={selected.typicalPax.toString()} />
                  <Spec k="Pax (max)" v={selected.maxPax.toString()} />
                  <Spec k="Range" v={`${selected.rangeKm.toLocaleString()} km`} />
                  <Spec k="Cruise" v={`${selected.cruiseSpeedKts} kts`} />
                  <Spec k="Cargo" v={`${selected.cargoKg.toLocaleString()} kg`} />
                  <Spec k="MTOW" v={`${(selected.mtowKg / 1000).toFixed(0)} t`} />
                  <Spec k="Fuel burn" v={`${selected.fuelBurnLph} L/h`} />
                  <Spec k="Crew" v={`${selected.crewCockpit + selected.crewCabin}`} />
                </dl>
                <div className="mt-6 border-t border-ink/15 pt-4">
                  {/* Mode tabs */}
                  <div className="flex items-stretch border border-ink/20">
                    {(["cash", "finance", "lease"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setTab(m)}
                        className={cn(
                          "flex-1 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em]",
                          tab === m ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep",
                          m !== "cash" && "border-l border-ink/20",
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {/* Term selector for finance / lease */}
                  {tab === "finance" && (
                    <div className="mt-3 flex items-stretch border border-ink/15">
                      {([24, 60, 120] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setLoanTerm(t)}
                          className={cn(
                            "flex-1 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em]",
                            loanTerm === t ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep",
                            t !== 24 && "border-l border-ink/15",
                          )}
                        >
                          {t} mo
                        </button>
                      ))}
                    </div>
                  )}
                  {tab === "lease" && (
                    <div className="mt-3 flex items-stretch border border-ink/15">
                      {([24, 36, 60] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setLeaseTerm(t)}
                          className={cn(
                            "flex-1 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em]",
                            leaseTerm === t ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep",
                            t !== 24 && "border-l border-ink/15",
                          )}
                        >
                          {t} mo
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Per-mode terms */}
                  <div className="mt-4 space-y-1.5 text-[12px]">
                    {tab === "cash" && (
                      <>
                        <Row k="Sticker price" v={`$${selected.listPriceMusd.toFixed(0)}M`} />
                        <Row k="Cash now" v={formatUsdCents(cashCents)} />
                        <Row k="Cash after" v={formatUsdCents(cashCents - priceCents)} tone={canAfford ? "neutral" : "negative"} />
                      </>
                    )}
                    {tab === "finance" && (
                      <>
                        <Row k="Sticker" v={`$${selected.listPriceMusd.toFixed(0)}M`} />
                        <Row k={`${(FINANCE_DOWNPAYMENT_PCT * 100).toFixed(0)}% down`} v={formatUsdCents(downCents)} />
                        <Row k="Loan principal" v={formatUsdCents(principalCents)} />
                        <Row k={`Monthly P&I (${loanTerm}mo @ ${(DEFAULT_LOAN_RATE_BPS / 100).toFixed(2)}%)`} v={formatUsdCents(loanMonthly)} tone="warning" />
                        <Row k="Cash after" v={formatUsdCents(cashCents - downCents)} tone={canAfford ? "neutral" : "negative"} />
                      </>
                    )}
                    {tab === "lease" && (
                      <>
                        <Row k="Monthly rent" v={formatUsdCents(leaseMonthlyCents)} tone="warning" />
                        <Row k={`Deposit (${LEASE_DEPOSIT_MONTHS}mo upfront)`} v={formatUsdCents(leaseDeposit)} />
                        <Row k="Term" v={`${leaseTerm} months`} />
                        <Row k="Cash after" v={formatUsdCents(cashCents - leaseDeposit)} tone={canAfford ? "neutral" : "negative"} />
                      </>
                    )}
                  </div>
                </div>
                {error && (
                  <p className="mt-4 border border-beacon bg-beacon/10 px-3 py-2 text-[12px] text-beacon">
                    {error}
                  </p>
                )}
                <button
                  disabled={!canAfford || pending}
                  onClick={() => {
                    setError(null);
                    const mode: AcquireMode =
                      tab === "cash"
                        ? { kind: "cash" }
                        : tab === "finance"
                          ? { kind: "finance", termMonths: loanTerm }
                          : { kind: "lease", termMonths: leaseTerm };
                    startTransition(async () => {
                      try {
                        await buyAircraft({
                          typeId: selected.id,
                          baseAirportId: homeAirportId,
                          mode,
                        });
                        onClose();
                        router.refresh();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : String(e));
                      }
                    });
                  }}
                  className={cn(
                    "mt-5 flex w-full items-center justify-center gap-2 border border-ink bg-ink px-4 py-3 text-[12px] uppercase tracking-[0.22em] text-paper",
                    "transition-all",
                    canAfford
                      ? "hover:bg-persimmon hover:border-persimmon"
                      : "cursor-not-allowed opacity-50",
                  )}
                >
                  {pending
                    ? "Wiring funds…"
                    : canAfford
                      ? tab === "cash"
                        ? "Buy outright"
                        : tab === "finance"
                          ? "Sign the loan"
                          : "Sign the lease"
                      : `Need ${formatUsdCents(upfront - cashCents)} more`}
                </button>
                <p className="mt-3 text-[11px] text-ink-faint">
                  {tab === "lease"
                    ? `Operating lease — no resale, monthly $${(monthly / 100).toLocaleString()} for ${leaseTerm} months.`
                    : tab === "finance"
                      ? `Loan collateralised against this tail.`
                      : `Aircraft will be based at your home airport.`}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-ink-soft">Select an aircraft from the catalogue.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label-code text-ink-faint">{k}</span>
      <span className="num-tabular text-[14px]">{v}</span>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "neutral" | "warning" | "negative" | "positive" }) {
  const cls =
    tone === "negative" ? "text-beacon" : tone === "warning" ? "text-runway" : tone === "positive" ? "text-hangar" : "text-ink";
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-soft">{k}</span>
      <span className={cn("num-tabular", cls)}>{v}</span>
    </div>
  );
}

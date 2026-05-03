"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, X, Wallet, CreditCard } from "lucide-react";
import { applyForLoan, openRevolver } from "@/app/actions/game";
import { cn } from "@/lib/utils";
import { formatUsdCents } from "@/lib/money";
import { monthlyPaymentCents, DEFAULT_LOAN_RATE_BPS, DEFAULT_REVOLVER_RATE_BPS } from "@/sim/finance";

export function FinanceActions({
  cashCents,
  hasRevolver,
}: {
  cashCents: number;
  hasRevolver: boolean;
}) {
  const [openLoan, setOpenLoan] = useState(false);
  const [openRev, setOpenRev] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setOpenLoan(true)}
        className="group flex items-center gap-2 border border-ink bg-paper px-4 py-2.5 text-[12px] uppercase tracking-[0.2em] text-ink transition-all hover:bg-ink hover:text-paper"
      >
        <Wallet className="size-3.5" />
        Apply for loan
      </button>
      <button
        onClick={() => setOpenRev(true)}
        disabled={hasRevolver}
        className={cn(
          "group flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.2em] text-paper transition-all",
          hasRevolver ? "cursor-not-allowed opacity-50" : "hover:bg-persimmon hover:border-persimmon",
        )}
      >
        <CreditCard className="size-3.5" />
        {hasRevolver ? "Revolver active" : "Open revolver"}
        <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </button>
      {openLoan && <LoanDialog cashCents={cashCents} onClose={() => setOpenLoan(false)} />}
      {openRev && <RevolverDialog onClose={() => setOpenRev(false)} />}
    </div>
  );
}

function LoanDialog({ cashCents, onClose }: { cashCents: number; onClose: () => void }) {
  const [principal, setPrincipal] = useState(2_000_000);
  const [term, setTerm] = useState<24 | 60 | 120>(60);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const principalCents = Math.round(principal * 100);
  const monthly = monthlyPaymentCents(principalCents, DEFAULT_LOAN_RATE_BPS, term);
  const totalRepayment = monthly * term;
  const totalInterest = totalRepayment - principalCents;

  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="relative w-full max-w-xl border border-ink bg-paper shadow-[8px_8px_0_0_var(--color-ink)]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-ink/15 bg-paper-deep px-5 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-persimmon">FIN · BANK LOAN</span>
          <button onClick={onClose} aria-label="Close" className="text-ink-soft hover:text-ink"><X className="size-4" /></button>
        </header>
        <div className="flex flex-col gap-5 p-6">
          <Field label="Principal (USD)" sub="$100K – $200M">
            <input
              type="number"
              value={principal}
              onChange={(e) => setPrincipal(Math.max(100_000, Number(e.target.value)))}
              className="w-full border border-ink/30 bg-paper px-3 py-2 text-[14px] num-tabular outline-none focus:border-ink"
            />
          </Field>
          <Field label="Term">
            <div className="flex items-stretch border border-ink/20">
              {([24, 60, 120] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTerm(t)}
                  className={cn(
                    "flex-1 py-2 font-mono text-[11px] uppercase tracking-[0.18em]",
                    term === t ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-deep",
                    t !== 24 && "border-l border-ink/20",
                  )}
                >
                  {t} months
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4 border border-ink/20 bg-paper-deep p-4 text-[12px]">
            <KV k="Rate (APR)" v={`${(DEFAULT_LOAN_RATE_BPS / 100).toFixed(2)}%`} />
            <KV k="Monthly P&I" v={formatUsdCents(monthly)} />
            <KV k="Total interest" v={formatUsdCents(totalInterest)} tone="warning" />
            <KV k="Total repayment" v={formatUsdCents(totalRepayment)} />
            <KV k="Cash now" v={formatUsdCents(cashCents)} />
            <KV k="Cash after" v={formatUsdCents(cashCents + principalCents)} tone="positive" />
          </div>
          {error && <p className="border border-beacon bg-beacon/10 px-3 py-2 text-[12px] text-beacon">{error}</p>}
        </div>
        <footer className="flex items-center justify-end gap-3 border-t border-ink/15 bg-paper-deep px-5 py-3">
          <button onClick={onClose} className="text-[12px] uppercase tracking-[0.2em] text-ink-soft hover:text-ink">Cancel</button>
          <button
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                try {
                  await applyForLoan({ principalCents, termMonths: term });
                  onClose();
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              });
            }}
            className="border border-ink bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.22em] text-paper transition-colors hover:bg-persimmon hover:border-persimmon disabled:opacity-50"
          >
            {pending ? "Drawing down…" : "Draw down"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function RevolverDialog({ onClose }: { onClose: () => void }) {
  const [limit, setLimit] = useState(1_000_000);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const limitCents = Math.round(limit * 100);

  return (
    <div role="dialog" aria-modal className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="relative w-full max-w-md border border-ink bg-paper shadow-[8px_8px_0_0_var(--color-ink)]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-ink/15 bg-paper-deep px-5 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-persimmon">FIN · REVOLVER</span>
          <button onClick={onClose} aria-label="Close" className="text-ink-soft hover:text-ink"><X className="size-4" /></button>
        </header>
        <div className="flex flex-col gap-5 p-6">
          <p className="text-[13px] text-ink-soft">
            A revolving credit facility lets you go cash-negative up to your limit. You're charged interest only on the overdrawn balance, plus a small monthly facility fee.
          </p>
          <Field label="Credit limit (USD)" sub="$100K – $50M">
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Math.max(100_000, Number(e.target.value)))}
              className="w-full border border-ink/30 bg-paper px-3 py-2 text-[14px] num-tabular outline-none focus:border-ink"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4 border border-ink/20 bg-paper-deep p-4 text-[12px]">
            <KV k="Rate" v={`${(DEFAULT_REVOLVER_RATE_BPS / 100).toFixed(2)}% APR`} tone="warning" />
            <KV k="Facility fee" v="$250 / month" />
          </div>
          {error && <p className="border border-beacon bg-beacon/10 px-3 py-2 text-[12px] text-beacon">{error}</p>}
        </div>
        <footer className="flex items-center justify-end gap-3 border-t border-ink/15 bg-paper-deep px-5 py-3">
          <button onClick={onClose} className="text-[12px] uppercase tracking-[0.2em] text-ink-soft hover:text-ink">Cancel</button>
          <button
            disabled={pending}
            onClick={() => {
              setError(null);
              start(async () => {
                try {
                  await openRevolver({ limitCents });
                  onClose();
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              });
            }}
            className="border border-ink bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.22em] text-paper transition-colors hover:bg-persimmon hover:border-persimmon disabled:opacity-50"
          >
            {pending ? "Opening…" : "Open facility"}
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
function KV({ k, v, tone }: { k: string; v: string; tone?: "positive" | "warning" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label-code text-ink-faint">{k}</span>
      <span className={cn("num-tabular text-[14px]", tone === "positive" ? "text-hangar" : tone === "warning" ? "text-runway" : "text-ink")}>{v}</span>
    </div>
  );
}

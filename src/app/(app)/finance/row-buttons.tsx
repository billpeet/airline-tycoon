"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { repayLoan, closeRevolver } from "@/app/actions/game";
import { formatUsdCents } from "@/lib/money";

export function RepayButton({
  instrumentId,
  outstandingCents,
  cashCents,
}: {
  instrumentId: string;
  outstandingCents: number;
  cashCents: number;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const canFullRepay = cashCents >= outstandingCents;
  return (
    <button
      disabled={pending || !canFullRepay}
      title={canFullRepay ? `Pay off ${formatUsdCents(outstandingCents)}` : "Not enough cash to fully repay"}
      onClick={() => {
        if (!confirm(`Pay off this loan in full (${formatUsdCents(outstandingCents)})?`)) return;
        start(async () => {
          try {
            await repayLoan({ instrumentId, amountCents: outstandingCents });
            router.refresh();
          } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
          }
        });
      }}
      className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint hover:text-ink disabled:opacity-40"
    >
      {pending ? "…" : "Repay"}
    </button>
  );
}

export function CloseRevolverButton({ instrumentId, cashCents }: { instrumentId: string; cashCents: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const ok = cashCents >= 0;
  return (
    <button
      disabled={pending || !ok}
      title={ok ? "Close the facility" : "Cash must be ≥ 0 before closing"}
      onClick={() => {
        if (!confirm("Close the revolver?")) return;
        start(async () => {
          try {
            await closeRevolver(instrumentId);
            router.refresh();
          } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
          }
        });
      }}
      className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint hover:text-ink disabled:opacity-40"
    >
      {pending ? "…" : "Close"}
    </button>
  );
}

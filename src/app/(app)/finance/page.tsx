import { eq, and, sql, gte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  game,
  txn,
  financeInstrument,
  aircraft,
  aircraftType,
} from "@/db/schema";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { PageHeader } from "@/components/shell/page-header";
import { BoardingCard, BoardingCardEyebrow, StatBlock } from "@/components/shell/boarding-card";
import { formatUsdCents } from "@/lib/money";
import { FinanceActions } from "./actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const session = await getSessionUser();
  if (!session) redirect("/");
  const g = await db.query.game.findFirst({ where: eq(game.userId, session.user.id) });
  if (!g) redirect("/onboarding");

  const today = g.currentDay;
  const window7 = 7;
  const window30 = 30;

  // Active instruments
  const instruments = await db
    .select()
    .from(financeInstrument)
    .where(and(eq(financeInstrument.gameId, g.id)));
  const active = instruments.filter((i) => i.status === "active");
  const loans = active.filter((i) => i.kind === "loan");
  const leases = active.filter((i) => i.kind === "lease");
  const revolver = active.find((i) => i.kind === "revolver");

  const totalDebt = loans.reduce((s, l) => s + l.outstandingCents, 0);
  const monthlyServicing =
    loans.reduce((s, l) => s + l.monthlyPaymentCents, 0) +
    leases.reduce((s, l) => s + l.monthlyPaymentCents, 0);

  // P&L window (last 30 days)
  const pnl = await db
    .select({
      kind: txn.kind,
      total: sql<number>`coalesce(sum(${txn.amountCents}), 0)`,
    })
    .from(txn)
    .where(and(eq(txn.gameId, g.id), gte(txn.gameDay, today - window30 + 1)))
    .groupBy(txn.kind);
  const sumK = (kinds: string[]) =>
    pnl.filter((l) => kinds.includes(l.kind)).reduce((s, l) => s + Number(l.total), 0);

  const revenue = sumK(["route_revenue"]);
  const opCosts = -sumK(["route_fuel", "route_crew", "route_landing", "aircraft_idle"]);
  const interest = -sumK(["loan_interest", "revolver_interest", "revolver_fee"]);
  const grossProfit = revenue - opCosts;
  const netIncome = grossProfit - interest;

  // Cashflow window 30d
  const inflow = sumK(["route_revenue", "loan_drawdown"]);
  const outflow = -sumK([
    "route_fuel", "route_crew", "route_landing", "aircraft_idle",
    "aircraft_purchase",
    "loan_payment", "loan_interest",
    "lease_deposit", "lease_payment",
    "revolver_interest", "revolver_fee",
  ]);
  const netCash = inflow - outflow;

  // Asset value: sum aircraft list price for cash + finance owned tails
  const ownedAircraft = await db
    .select({
      acquisitionMode: aircraft.acquisitionMode,
      listPriceMusd: aircraftType.listPriceMusd,
    })
    .from(aircraft)
    .innerJoin(aircraftType, eq(aircraft.typeId, aircraftType.id))
    .where(eq(aircraft.gameId, g.id));
  const fleetAssetCents = ownedAircraft
    .filter((a) => a.acquisitionMode !== "lease")
    .reduce((s, a) => s + Math.round(a.listPriceMusd * 1_000_000 * 100), 0);

  const totalAssets = g.cashCents + fleetAssetCents;
  const equity = totalAssets - totalDebt;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="FIN · 05"
        meta="Finance"
        title="Cashflow is the only score that matters today."
        description={`Cash ${formatUsdCents(g.cashCents)} · debt ${formatUsdCents(totalDebt)} · monthly servicing ${formatUsdCents(monthlyServicing)}.`}
        actions={<FinanceActions cashCents={g.cashCents} hasRevolver={!!revolver} />}
      />

      {/* Balance sheet snapshot */}
      <section className="grid gap-4 md:grid-cols-3">
        <BoardingCard>
          <BoardingCardEyebrow code="A" title="Balance sheet" meta="SNAPSHOT" />
          <div className="grid grid-cols-2">
            <StatBlock label="Cash" value={formatUsdCents(g.cashCents)} tone={g.cashCents < 0 ? "negative" : "positive"} />
            <StatBlock label="Fleet (book)" value={formatUsdCents(fleetAssetCents)} className="border-l border-ink/10" />
            <StatBlock label="Total debt" value={formatUsdCents(totalDebt)} tone={totalDebt > 0 ? "warning" : "neutral"} className="border-t border-ink/10" />
            <StatBlock label="Equity" value={formatUsdCents(equity, { sign: "always" })} tone={equity >= 0 ? "positive" : "negative"} className="border-t border-l border-ink/10" />
          </div>
        </BoardingCard>

        <BoardingCard>
          <BoardingCardEyebrow code="B" title={`P&L · last ${window30}d`} meta="USD" />
          <div className="grid grid-cols-2">
            <StatBlock label="Revenue" value={formatUsdCents(revenue)} tone="positive" />
            <StatBlock label="Operating cost" value={formatUsdCents(opCosts)} tone="warning" className="border-l border-ink/10" />
            <StatBlock label="Interest" value={formatUsdCents(interest)} tone={interest > 0 ? "warning" : "neutral"} className="border-t border-ink/10" />
            <StatBlock label="Net income" value={formatUsdCents(netIncome, { sign: "always" })} tone={netIncome >= 0 ? "positive" : "negative"} className="border-t border-l border-ink/10" />
          </div>
        </BoardingCard>

        <BoardingCard>
          <BoardingCardEyebrow code="C" title={`Cashflow · last ${window30}d`} meta="USD" />
          <div className="grid grid-cols-2">
            <StatBlock label="Inflow" value={formatUsdCents(inflow)} tone="positive" />
            <StatBlock label="Outflow" value={formatUsdCents(outflow)} tone="warning" className="border-l border-ink/10" />
            <StatBlock label="Net" value={formatUsdCents(netCash, { sign: "always" })} tone={netCash >= 0 ? "positive" : "negative"} className="border-t border-ink/10" />
            <StatBlock label="Monthly servicing" value={formatUsdCents(monthlyServicing)} className="border-t border-l border-ink/10" />
          </div>
        </BoardingCard>
      </section>

      {/* Debt schedule */}
      <BoardingCard>
        <BoardingCardEyebrow code="D" title="Debt schedule" meta={`${active.length} active`} />
        {active.length === 0 ? (
          <div className="px-6 py-10 text-center text-ink-soft">
            No active loans, leases or facilities. The boardroom is dry.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="bg-paper-deep text-ink-soft">
              <tr className="border-b border-ink/15">
                <Th>Kind</Th>
                <Th>Notes</Th>
                <Th>Outstanding / limit</Th>
                <Th>Monthly</Th>
                <Th>Rate</Th>
                <Th>Term</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {active.map((i) => {
                const remaining = Math.max(0, i.termMonths - i.monthsPaid);
                return (
                  <tr key={i.id} className="border-b border-ink/10 last:border-b-0">
                    <Td>
                      <span className={cn(
                        "label-code",
                        i.kind === "loan" ? "text-persimmon" : i.kind === "lease" ? "text-runway" : "text-hangar",
                      )}>
                        {i.kind}
                      </span>
                    </Td>
                    <Td className="text-[12px] text-ink-soft">{i.notes ?? ""}</Td>
                    <Td className="num-tabular">
                      {i.kind === "revolver"
                        ? `— / ${formatUsdCents(i.principalCents)}`
                        : formatUsdCents(i.outstandingCents)}
                    </Td>
                    <Td className="num-tabular">
                      {i.monthlyPaymentCents > 0 ? formatUsdCents(i.monthlyPaymentCents) : "—"}
                    </Td>
                    <Td className="num-tabular">
                      {i.rateBps > 0 ? `${(i.rateBps / 100).toFixed(2)}%` : "—"}
                    </Td>
                    <Td className="num-tabular">
                      {i.kind === "revolver" ? "rolling" : `${i.monthsPaid} / ${i.termMonths} mo`}
                    </Td>
                    <Td>
                      {i.kind === "loan" && (
                        <RepayButton instrumentId={i.id} outstandingCents={i.outstandingCents} cashCents={g.cashCents} />
                      )}
                      {i.kind === "revolver" && (
                        <CloseRevolverButton instrumentId={i.id} cashCents={g.cashCents} />
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </BoardingCard>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.22em]">{children}</th>
  );
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ""}`}>{children}</td>;
}

import { RepayButton, CloseRevolverButton } from "./row-buttons";

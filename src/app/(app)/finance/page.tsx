import { PageHeader } from "@/components/shell/page-header";
import { RunwayStub } from "@/components/shell/runway-stub";

export default function FinancePage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="FIN · 05"
        meta="Finance"
        title="Cashflow is the only score that matters today."
        description="Loans, leases, bonds, IPO equity, fuel hedges. Tier them on as the tech tree opens them. Don't go cash-negative without a credit line."
      />
      <RunwayStub
        code="FIN · 05"
        title="Finance dashboard arrives in Phase 3."
        blurb="Balance sheet, P&L and cashflow are surfaced as separate views; financing actions are first-class buttons, not buried menus."
        bullets={[
          "Tier 1 — bank loans, collateralised against airframes",
          "Tier 2 — operating leases, revolving credit",
          "Tier 3 — corporate bonds at fixed rate",
          "Tier 4 — IPO with persistent ownership-% stat",
          "Tier 5 — fuel hedging contracts (lock for N quarters)",
        ]}
        phase="Phase 3"
      />
    </div>
  );
}

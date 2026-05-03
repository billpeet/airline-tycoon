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
        title="Treasury is dark for now."
        blurb="Once you start moving real money, this is the desk you'll live on. Balance sheet, P&amp;L and cashflow side by side, with financing actions as first-class buttons rather than buried menus."
        bullets={[
          "Bank loans collateralised against your airframes",
          "Operating leases and revolving credit facilities",
          "Corporate bonds at fixed rate, longer tenor",
          "Take the airline public — issue equity, dilute your stake",
          "Lock fuel costs ahead with hedging contracts",
        ]}
      />
    </div>
  );
}

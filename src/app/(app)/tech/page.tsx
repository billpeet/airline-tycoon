import { PageHeader } from "@/components/shell/page-header";
import { RunwayStub } from "@/components/shell/runway-stub";

export default function TechPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="TEC · 06"
        meta="Tech Tree"
        title="Specialise. Don't sprawl."
        description="A branching capability tree: Operations · Fleet · Network · Finance · Specialisation. The specialisation branches are mutually exclusive — pick a doctrine and lean in."
      />
      <RunwayStub
        code="TEC · 06"
        title="The tree blossoms in Phase 4."
        blurb="Branches and prerequisites live in the DB so we can rebalance without a code deploy. Each prestige run alters the weights."
        bullets={[
          "Operations · time acceleration, maintenance efficiency",
          "Fleet · unlock aircraft families, regional → next-gen",
          "Network · regions: domestic → continental → transatlantic → APAC → polar",
          "Finance · loans → leases → bonds → IPO → hedging",
          "Specialisation · Low-cost · Premium · Cargo · Charter (one only)",
        ]}
        phase="Phase 4"
      />
    </div>
  );
}

import { PageHeader } from "@/components/shell/page-header";
import { RunwayStub } from "@/components/shell/runway-stub";

export default function FleetPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="FLT · 03"
        meta="Fleet"
        title="Tails, types and tin."
        description="Buy outright, finance, lease, or scour the used market. Watch utilisation, maintenance cycles, and crew lead time."
      />
      <RunwayStub
        code="FLT · 03"
        title="Fleet management arrives in Phase 2."
        blurb="Aircraft families seeded from real-world reference data: A220, A320, A330, A350, 737, 777, 787, ATR-72, and the Embraer E-Jets to start."
        bullets={[
          "Acquisition modes: buy · finance · operating lease · used",
          "Utilisation, C/D-check schedule, retirement curve",
          "Per-aircraft P&L drilldown",
          "Crew & maintenance lead-time pipeline",
        ]}
        phase="Phase 2"
      />
    </div>
  );
}

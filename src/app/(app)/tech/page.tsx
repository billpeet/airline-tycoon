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
        title="The tree hasn't grown in yet."
        blurb="Capability points come from milestones — passengers carried, routes opened, profit thresholds, prestige resets. Spend them on the branch you want to be known for."
        bullets={[
          "Operations — faster game time, more efficient maintenance, quicker training",
          "Fleet — unlock aircraft families, regional first then narrowbody, widebody, next-gen",
          "Network — open new regions: domestic, continental, transatlantic, Asia-Pacific, polar",
          "Finance — unlock instruments: loans, leases, bonds, IPO, hedging",
          "Specialisation — Low-cost · Premium · Cargo · Charter (one only — your defining doctrine)",
        ]}
      />
    </div>
  );
}

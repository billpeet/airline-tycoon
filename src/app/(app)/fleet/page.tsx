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
        title="Hangar doors are still closed."
        blurb="The order book opens once you've signed your operating certificate. Modern Boeing, Airbus, Embraer, ATR and De Havilland frames are all on offer — from regional turboprops up to the long-haul widebodies."
        bullets={[
          "Pick your acquisition: buy outright, finance, lease, or pick up a used hull",
          "Track utilisation, C/D-check schedules and the retirement curve per tail",
          "Per-aircraft profit and loss — find the dogs and ground them",
          "Crew and maintenance pipelines so you can't just hire a hundred captains overnight",
        ]}
      />
    </div>
  );
}

import { PageHeader } from "@/components/shell/page-header";
import { RunwayStub } from "@/components/shell/runway-stub";

export default function EventsPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="EVT · 07"
        meta="Events"
        title="The desk that's waiting on you."
        description="Two flavours: pure-consequence (fuel up 12%, ATC strike at LHR) and interactive (Boeing offers a launch-customer slot — commit $200M deposit?)."
      />
      <RunwayStub
        code="EVT · 07"
        title="Event engine arrives in Phase 4."
        blurb="Events are templates in the DB with conditions, weights and effect scripts. Categories: macro · geopolitical · technological · operational · opportunity."
        bullets={[
          "Macroeconomic · fuel, FX, interest rates, recessions",
          "Geopolitical · airspace, sanctions, bilateral agreements",
          "Technological · new airframes, biofuel mandates",
          "Operational · strikes, weather seasons, incidents",
          "Opportunity · codeshares, slot auctions, government tenders",
        ]}
        phase="Phase 4"
      />
    </div>
  );
}

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
        title="The wire is quiet."
        blurb="The world doesn't sit still. Once you're flying, this is where the world finds you — economic shocks, opportunities, decisions that need your call before the desk closes."
        bullets={[
          "Macroeconomic — fuel, FX, interest rates, recessions",
          "Geopolitical — airspace closures, sanctions, new bilateral agreements",
          "Technological — new airframes, biofuel mandates",
          "Operational — strikes, weather seasons, incidents",
          "Opportunity — codeshare offers, slot auctions, government tenders",
        ]}
      />
    </div>
  );
}

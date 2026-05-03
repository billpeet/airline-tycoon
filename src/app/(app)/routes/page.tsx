import { PageHeader } from "@/components/shell/page-header";
import { RunwayStub } from "@/components/shell/runway-stub";

export default function RoutesPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="NET · 04"
        meta="Routes"
        title="Open a city pair. Watch the demand."
        description="Set fares, frequency and aircraft per route. The configurator surfaces demand, competition, and projected load factor before you commit."
      />
      <RunwayStub
        code="NET · 04"
        title="Route configurator lands in Phase 2."
        blurb="Hub-and-spoke bonuses reward connecting passengers; slot constraints at premium airports gate the busiest hubs."
        bullets={[
          "Real airports (top ~1500 by traffic) seeded into reference DB",
          "Visible demand model: city size · competitor presence · seasonality",
          "Slot acquisition at major airports",
          "Competitor AI response when you open against them",
        ]}
        phase="Phase 2"
      />
    </div>
  );
}

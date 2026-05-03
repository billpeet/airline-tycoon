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
        title="No routes filed yet."
        blurb="Plan a city pair and the planner shows you the catchment, the competition, and what kind of fare it'll bear — before you sink capital into the first weekly frequency."
        bullets={[
          "Visible demand model: city size, business / leisure mix, seasonality",
          "Hub-and-spoke bonuses for passengers connecting through your hubs",
          "Slot acquisition at the busiest airports — they don't grow back",
          "See competitor responses before you commit to opening against an entrenched carrier",
        ]}
      />
    </div>
  );
}

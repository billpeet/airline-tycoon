import { PageHeader } from "@/components/shell/page-header";
import { RunwayStub } from "@/components/shell/runway-stub";

export default function GlobePage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="GLB · 02"
        meta="World Map"
        title="The whole world, on one table."
        description="A rotating Earth with great-circle arcs for every active route, competitor heatmaps, and demand intensity by city."
      />
      <RunwayStub
        code="GLB · 02"
        title="Three.js globe lands in Phase 1."
        blurb="We seed airports, aircraft and real-airline reference data first. Then the globe goes live with toggleable layers for player routes, competitor density, and demand."
        bullets={[
          "Seed airports (top ~1500 by traffic) and real-airline networks",
          "Render great-circle arcs as instanced line geometry",
          "Layer toggles: player routes · competitor heat · demand",
          "Decorative aircraft markers (sampled — not a sim source-of-truth)",
        ]}
        phase="Phase 1"
      />
    </div>
  );
}

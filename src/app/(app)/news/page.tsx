import { PageHeader } from "@/components/shell/page-header";
import { RunwayStub } from "@/components/shell/runway-stub";

export default function NewsPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        code="NWS · 08"
        meta="Newsroom"
        title="The morning paper, written while you slept."
        description="Every offline catch-up produces a structured feed of cards: routes earned X, fuel did Y, a strike cost you Z. The whole point of an idle game lives here."
      />
      <RunwayStub
        code="NWS · 08"
        title="Newsroom comes online in Phase 2."
        blurb="The catch-up sim writes structured NewsEvents on every visit; this page is just a beautiful render of that feed."
        bullets={[
          "Per-route, per-fleet and per-event summaries",
          "Period rollups: last visit · last 7 game-days · last quarter",
          "Filter by category · severity · region",
          "Pinned items survive subsequent catch-ups",
        ]}
        phase="Phase 2"
      />
    </div>
  );
}

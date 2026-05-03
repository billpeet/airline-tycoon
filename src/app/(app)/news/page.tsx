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
        title="No editions printed yet."
        blurb="Step away for an evening or a week — the press will be running when you get back. Per-route, per-fleet and per-event summaries, written for the time you weren't here."
        bullets={[
          "Per-route, per-fleet and per-event summaries",
          "Period rollups: last visit · last seven days · last quarter",
          "Filter by category, severity, region",
          "Pin the items you want to keep on the front page",
        ]}
      />
    </div>
  );
}

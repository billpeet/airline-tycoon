"use client";

import { useState, useTransition } from "react";
import { reopenRoute } from "@/app/actions/game";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function ReopenRouteButton({ routeId }: { routeId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            try {
              await reopenRoute(routeId);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          });
        }}
        className={cn(
          "border border-ink bg-paper px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink hover:bg-ink hover:text-paper",
          pending && "opacity-50",
        )}
      >
        {pending ? "Reopening…" : "Reopen"}
      </button>
      {error && (
        <span className="text-[10.5px] text-beacon" title={error}>
          {error.length > 60 ? error.slice(0, 60) + "…" : error}
        </span>
      )}
    </span>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Heartbeat for the (app) shell. While the page is open, refresh on a
 * regular cadence so the catch-up sim stays current and the player sees
 * KPIs / countdown tick over without manual reload.
 *
 * Rate-aware: at 8× a game-day passes in 7.5 real-min, so we want to
 * refresh more often. At 1× a game-day takes a full real hour, so we
 * keep refreshes infrequent enough to avoid useless server work.
 */
export function SimPoller({
  rateMultiplier,
  nextTickAtMs,
}: {
  rateMultiplier: number;
  nextTickAtMs: number;
}) {
  const router = useRouter();

  useEffect(() => {
    // Pick a polling interval such that we never miss the tick boundary
    // by more than a few seconds, but never poll more often than every
    // 10 seconds.
    const intervalMs = Math.max(10_000, Math.min(60_000, 30_000 / rateMultiplier));

    const id = setInterval(() => {
      // Don't waste cycles when the tab isn't visible — the next visit will
      // pick everything up via the offline catch-up path.
      if (typeof document !== "undefined" && document.hidden) return;
      router.refresh();
    }, intervalMs);

    // Schedule a refresh shortly after the predicted next tick so the user
    // sees the change land, even if the regular poll is mid-cycle.
    const tilTick = Math.max(2_000, nextTickAtMs - Date.now() + 1500);
    const tickRefresh = setTimeout(() => {
      if (!(typeof document !== "undefined" && document.hidden)) {
        router.refresh();
      }
    }, tilTick);

    return () => {
      clearInterval(id);
      clearTimeout(tickRefresh);
    };
  }, [router, rateMultiplier, nextTickAtMs]);

  return null;
}

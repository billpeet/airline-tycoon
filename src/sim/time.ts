/**
 * Time model — converts real wallclock to game-days at the rate matrix
 * defined in SPEC §3:
 *   - 1 real hour = 1 game day baseline (rate × 1)
 *   - Connected acceleration up to 8× (player choice; tech-tree-gated later)
 *   - Offline ticks at 0.5×, capped at 7 real days of accumulation
 *
 * "Connected" vs "offline" is decided by gap size: if elapsed real-ms since
 * lastSimulatedAt is below `OFFLINE_THRESHOLD_MS`, treat as connected and
 * use the player's chosen rate; above that, treat the entire gap as offline.
 */

const REAL_SECONDS_PER_GAME_DAY = 3600; // 1 real hour = 1 game day at base
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // > 5 min real → offline
const OFFLINE_RATE = 0.5;
const OFFLINE_CAP_REAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 real days

export type RateClass = "connected" | "offline";

export interface ElapsedDecision {
  /** Whole game-days to advance the sim by. */
  gameDays: number;
  /** "Real ms" the sim is consuming (≤ now-lastSimulatedAt; capped if offline). */
  consumedRealMs: number;
  /** Whether this gap is an active session or a long absence. */
  rateClass: RateClass;
  /** Effective rate multiplier (× baseline). 1 = baseline, 0.5 = offline, etc. */
  effectiveRate: number;
  /** True if we capped the offline accumulation. */
  cappedOffline: boolean;
}

export function decideElapsed(
  lastSimulatedAt: Date | number,
  now: Date | number,
  rateMultiplier: number,
): ElapsedDecision {
  const lastMs = typeof lastSimulatedAt === "number" ? lastSimulatedAt : lastSimulatedAt.getTime();
  const nowMs = typeof now === "number" ? now : now.getTime();
  const rawElapsedMs = Math.max(0, nowMs - lastMs);

  let cappedOffline = false;
  let consumedRealMs = rawElapsedMs;
  let rateClass: RateClass;
  let effectiveRate: number;

  if (rawElapsedMs <= OFFLINE_THRESHOLD_MS) {
    rateClass = "connected";
    effectiveRate = clamp(rateMultiplier, 1, 8);
  } else {
    rateClass = "offline";
    effectiveRate = OFFLINE_RATE;
    if (consumedRealMs > OFFLINE_CAP_REAL_MS) {
      consumedRealMs = OFFLINE_CAP_REAL_MS;
      cappedOffline = true;
    }
  }

  const gameDayFraction =
    (consumedRealMs / 1000 / REAL_SECONDS_PER_GAME_DAY) * effectiveRate;
  const gameDays = Math.floor(gameDayFraction);

  // We only advance the sim by whole days. Roll back the consumed real-ms
  // so the leftover fraction carries forward to next visit. This keeps
  // lastSimulatedAt aligned to whole game-day boundaries.
  const consumedForWholeDays =
    (gameDays * REAL_SECONDS_PER_GAME_DAY * 1000) / effectiveRate;

  return {
    gameDays,
    consumedRealMs: Math.round(consumedForWholeDays),
    rateClass,
    effectiveRate,
    cappedOffline,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Game day → in-fiction date string. Game starts on a fixed date. */
export const GAME_EPOCH = new Date(Date.UTC(2026, 0, 1)); // 2026-01-01

export function gameDayToDate(day: number): Date {
  return new Date(GAME_EPOCH.getTime() + day * 24 * 60 * 60 * 1000);
}

export function formatGameDate(day: number): { weekday: string; date: string; year: string } {
  const d = gameDayToDate(day);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }).toUpperCase();
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  const year = d.getUTCFullYear().toString();
  return { weekday, date: `${weekday} ${date}`, year };
}

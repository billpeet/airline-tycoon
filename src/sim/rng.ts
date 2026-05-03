/**
 * Seedable PRNG. Mulberry32 — fast, well-distributed enough for our sim,
 * and gives perfect determinism for replay/debug.
 */

export type RNG = () => number;

export function makeRng(seed: number): RNG {
  let s = (seed | 0) || 1;
  return function rng() {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap non-crypto seed derivation from a string. */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mix the per-game seed with the game-day for a per-day stream. */
export function dailyRng(gameSeed: number, gameDay: number): RNG {
  return makeRng(((gameSeed * 2654435761) ^ (gameDay * 0x9E3779B1)) >>> 0);
}

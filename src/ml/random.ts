/**
 * Seeded Random
 * Small reproducible pseudo-random generator (mulberry32) for deterministic results
 */

/** Returns a function producing numbers in [0, 1); the same seed gives the same sequence */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a key with probability proportional to its weight */
export function weightedPick<T extends string>(weights: Record<T, number>, random: () => number): T {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let point = random() * total;
  for (const [key, weight] of entries) {
    point -= weight;
    if (point < 0) return key;
  }
  return entries[entries.length - 1][0];
}

/** mulberry32. Advances `state.rng` and returns a float in [0, 1). */
export function next(state: { rng: number }): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(state.rng ^ (state.rng >>> 15), 1 | state.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const range = (s: { rng: number }, a: number, b: number) => a + next(s) * (b - a);

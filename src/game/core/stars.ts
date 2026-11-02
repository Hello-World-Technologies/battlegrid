import { REPLAY_FACTOR } from './rewards.ts';
import type { Difficulty } from './types.ts';

/** Every win earns at least one star; winning faster earns more. */
export const MAX_STARS = 3;

/** Seconds to win for 3 stars, 2 stars and the fast one-star, on the first levels. */
export const BASE_TIMES = { three: 60, two: 90, one: 120 } as const;

/**
 * Later levels are harder and take longer to win, so the times stretch a little with the level: 1.5% per level up to
 * level 41 (60%), then they stay put. Level 1 is exactly 2:00 / 1:30 / 1:00.
 */
export const TIME_STRETCH_PER_LEVEL = 0.015;
export const TIME_STRETCH_MAX_LEVELS = 40;

/** Coins for a win by stars, and for a slow win (over the one-star time) or an assisted one. */
export const COINS_BY_STARS: Readonly<Record<1 | 2 | 3, number>> = { 1: 140, 2: 200, 3: 250 };
export const SLOW_COINS = 100;

/** The times for a level, in seconds, rounded to 5. */
export function starTimes(level: number): { three: number; two: number; one: number } {
  const k = 1 + TIME_STRETCH_PER_LEVEL * Math.min(TIME_STRETCH_MAX_LEVELS, Math.max(0, level - 1));
  const r = (s: number) => Math.round((s * k) / 5) * 5;
  return { three: r(BASE_TIMES.three), two: r(BASE_TIMES.two), one: r(BASE_TIMES.one) };
}

export interface StarResult {
  win: boolean;
  /** 0 for a loss; 1 for any win; 2 under the two-star time; 3 under the three-star time. */
  stars: number;
  /** Simulation seconds the battle took (paused time does not count). */
  seconds: number;
  /** The level's times: win under `three` for 3 stars, under `two` for 2, under `one` for the fast one-star pay. */
  three: number;
  two: number;
  one: number;
  /** Won within the one-star time (140 coins rather than the slow 100). */
  fast: boolean;
  /** Won on an easier setting: it counts as a win but only earns one star and the slow pay. */
  assisted: boolean;
}

export function scoreBattle(level: number, won: boolean, seconds: number, difficulty: Difficulty = 'normal'): StarResult {
  const t = starTimes(level);
  const assisted = difficulty === 'easy';
  const stars = !won ? 0 : assisted ? 1 : seconds <= t.three ? 3 : seconds <= t.two ? 2 : 1;
  return { win: won, stars, seconds, ...t, fast: won && !assisted && seconds <= t.one, assisted };
}

/** Coins a result is worth the first time (see `winPayout` for replays). */
export function coinsFor(r: StarResult): number {
  if (!r.win) return 0;
  if (r.stars >= 2) return COINS_BY_STARS[r.stars as 2 | 3];
  return r.fast ? COINS_BY_STARS[1] : SLOW_COINS;
}

/**
 * Coins a win pays given the best stars the level had before. The first win pays in full. A replay that earns more
 * stars pays the difference, so improving a level is always worth something; any other replay pays a quarter, so a
 * level cannot be farmed.
 */
export function winPayout(previousBest: number, r: StarResult): number {
  const full = coinsFor(r);
  if (!r.win || previousBest <= 0) return full;
  if (r.stars > previousBest) return Math.max(0, full - COINS_BY_STARS[Math.min(3, previousBest) as 1 | 2 | 3]);
  return Math.round(full * REPLAY_FACTOR);
}

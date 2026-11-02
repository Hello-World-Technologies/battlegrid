import type { AiParams, Difficulty, DifficultyProfile, Personality } from './types.ts';

/*
 * Fair play. You and every enemy play by the same rules: the same troop production, the same starting troops, the same
 * send rule (all the troops in a tower go). What makes a level harder is how well the enemy plays, and that rises
 * smoothly with the level number: it reacts faster, wastes less, makes fewer mistakes and slowly learns to team up,
 * guard, reinforce the front, strike together and stay careful (see `think` in world.ts).
 */

/** Troops a tower makes, as a multiplier of the tier's base rate. The same for every side on every level. */
export const FAIR_PROD = 1;
/** Troops each side starts with in total (generated levels: one tower each; authored levels: split as designed). */
export const START_TROOPS = 40;

/** The level at which the enemy has half of the skill it will ever have. Skill never reaches 1, it only approaches it. */
export const SKILL_HALF_LEVEL = 30;

/** How skilled the enemy is on a level, 0 (a novice) rising smoothly toward 1 (an expert). Level 1 is 0. */
export const skillAt = (level: number) => 1 - Math.pow(0.5, Math.max(0, level - 1) / SKILL_HALF_LEVEL);

/** Neutral garrisons grow with the level (for everyone alike) up to this level, so later maps are slower to expand on. */
export const NEUTRAL_GROWTH_PER_LEVEL = 0.02;
export const NEUTRAL_GROWTH_CAP_LEVEL = 45;

/**
 * What a fully skilled enemy looks like. Speed and carefulness are what make an enemy hard (measured against the balance
 * bot), so these are the main numbers of the climb: how often it decides, how many troops it sends in on top of what a
 * target needs, and how many troops a tower needs before it will attack.
 */
export const NOVICE_INTERVAL = 9;
export const NOVICE_MARGIN = 28;
export const NOVICE_MIN_UNITS = 36;
export const EXPERT_INTERVAL = 2.5;
export const EXPERT_MARGIN = 7;
export const EXPERT_MIN_UNITS = 14;

/** Seconds before an enemy makes its first move. */
export const ENEMY_FIRST_MOVE = 4;

/** How hard the AIs pile on the leader at full skill: troops of extra attraction. */
export const LEADER_MAX = 6;

/** The share of its decisions a novice gets wrong (a random target instead of the best); it shrinks to nothing as skill grows. */
export const MISTAKE_CHANCE = 0.4;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** 0 below `lo`, 1 above `hi`, a straight line between. */
export const ramp = (v: number, lo: number, hi: number) => clamp01((v - lo) / (hi - lo));

/**
 * The enemy skill after the assist setting: an assisted retry (`easy`) plays a weaker enemy, never a poorer one. `hard`
 * is a stronger enemy, with the same economy.
 */
const SKILL_FACTOR: Record<Difficulty, number> = { easy: 0.6, normal: 1, hard: 1.2 };

/**
 * All balance numbers in one place. Tuned with `npm run balance` and the curve sampler. `skillOverride` is how an authored
 * level sets how good its enemy is (never how rich it is).
 */
export function profileFor(level: number, difficulty: Difficulty = 'normal', skillOverride?: number): DifficultyProfile {
  const skill = clamp01((skillOverride ?? skillAt(level)) * SKILL_FACTOR[difficulty]);
  return {
    // Same economy for everyone.
    scale: 1,
    playerStart: START_TROOPS,
    playerProd: FAIR_PROD,
    enemyStart: START_TROOPS,
    enemyProd: FAIR_PROD,
    neutralScale: 1 + Math.min(level, NEUTRAL_GROWTH_CAP_LEVEL) * NEUTRAL_GROWTH_PER_LEVEL,
    // Every enemy waits the same human-like time before its first move, on every level (measured: opening all-in sooner is
    // worse, so a shrinking delay would make better enemies weaker).
    grace: [0, 0, ENEMY_FIRST_MOVE, ENEMY_FIRST_MOVE, ENEMY_FIRST_MOVE],
    ai: {
      skill,
      interval: lerp(NOVICE_INTERVAL, EXPERT_INTERVAL, skill),
      intervalMin: lerp(NOVICE_INTERVAL, EXPERT_INTERVAL, skill),
      minUnits: lerp(NOVICE_MIN_UNITS, EXPERT_MIN_UNITS, skill),
      // Every side sends all the troops of a tower, you included.
      fraction: 1,
      margin: lerp(NOVICE_MARGIN, EXPERT_MARGIN, skill),
      coordinate: skill >= 0.1,
      playerBias: 0,
      leader: LEADER_MAX * ramp(skill, 0.1, 0.8),
      reinforce: skill >= 0.45,
      strike: skill >= 0.6,
      caution: skill >= 0.25,
    },
  };
}

/**
 * Each enemy has a style, never an economic edge: the aggressor starts attacking sooner and takes tighter risks, the
 * turtle waits to build up and wants a safer margin. All of them produce and start exactly the same.
 */
export function aiFor(base: AiParams, personality: Personality): AiParams {
  if (personality === 'aggressor') {
    return { ...base, interval: base.interval * 0.85, intervalMin: base.intervalMin * 0.85, minUnits: base.minUnits * 0.6, margin: base.margin * 0.6 };
  }
  if (personality === 'turtle') {
    return { ...base, interval: base.interval * 1.2, intervalMin: base.intervalMin * 1.2, minUnits: base.minUnits * 1.5, margin: base.margin * 1.4 };
  }
  return base;
}

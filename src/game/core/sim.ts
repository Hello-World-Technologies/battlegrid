import { generateLevel } from './levels.ts';
import { advance, think } from './world.ts';
import { STEP, type AiParams, type Difficulty, type World } from './types.ts';

/** A reasonable, not perfect, human: thinks every ~1.5 s and, like every side, sends all the troops of a tower. */
export const BOT: AiParams = { interval: 1.5, intervalMin: 1.5, minUnits: 14, fraction: 1, margin: 4, coordinate: true, playerBias: 0 };

export interface MatchResult {
  won: boolean;
  seconds: number;
}

const TIMEOUT = 600;

/** Plays a prebuilt world to the end: the bot is player 1, the built-in AI plays the enemies. */
export function playWorld(w: World, bot: AiParams = BOT): MatchResult {
  // A person does not make a first move at the same instant every game: the bot's first move is somewhere between 2 and 4
  // seconds (the same for the same world), so nothing depends on who happens to act first by a single tick.
  let clock = 2 + ((w.seed >>> 0) % 21) / 10;
  while (w.status === 'play' && w.t < TIMEOUT) {
    advance(w, STEP);
    clock -= STEP;
    if (clock <= 0) {
      think(w, 1, bot);
      clock = bot.interval;
    }
  }
  return { won: w.status === 'won', seconds: w.t };
}

/** Plays one full campaign match. */
export function playMatch(level: number, seed: number, difficulty: Difficulty = 'normal', bot: AiParams = BOT): MatchResult {
  return playWorld(generateLevel(level, seed, difficulty), bot);
}

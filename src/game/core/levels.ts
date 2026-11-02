import { AUTHORED, levelName, type LevelDef } from './campaign.ts';
import { aiFor, profileFor } from './difficulty.ts';
import { buildLand } from './land.ts';
import { snapToGeography } from './geofit.ts';
import { next, range } from './rng.ts';
import { NEUTRAL_UNITS } from './world.ts';
import { ENEMIES, WORLD_H, type Difficulty, type Kind, type Owner, type Personality, type Storm, type Tier, type World } from './types.ts';

/** Levels are endless; the level list groups them in chapters of this many. */
export const LEVELS_PER_CHAPTER = 10;
export const MAX_LEVEL_TERRITORIES = 18;
const TOP = 16;
const BOTTOM = WORLD_H - 18;
const PERSONALITIES: readonly Personality[] = ['balanced', 'aggressor', 'turtle'];

/** Generated levels (11+): how many territories. Levels 1-10 are authored and set their own. */
export const territoryCount = (level: number) => Math.min(MAX_LEVEL_TERRITORIES, 5 + level * 2);
/** Enemy sides: one at first, two from level 7, three from level 20. */
export const factionCount = (level: number) => (level >= THIRD_ENEMY_LEVEL ? 3 : level >= 7 ? 2 : 1);
export const THIRD_ENEMY_LEVEL = 20;

/** How many maps are tried for a fair start, and how uneven the starts may be (best room to expand / worst). */
export const START_TRIES = 100;
export const FAIR_START_RATIO = 1.35;

/**
 * How much room to expand a side's starting tower has: the neutral towers within reach, nearer and weaker ones counting
 * more. Two sides with the same number are equally well placed.
 */
export function startRoom(w: World, start: { x: number; y: number }): number {
  let room = 0;
  for (const t of w.territories) {
    if (t.owner !== 0) continue;
    const d = Math.hypot(t.x - start.x, t.y - start.y);
    if (d >= 40) continue;
    room += (1 / (1 + t.units / 30)) * (1 - d / 40);
  }
  return room;
}

/** How uneven the starting positions of a level are: the best side's room divided by the worst side's (1 = perfectly fair). */
export function startRatio(w: World): number {
  const rooms = w.territories.filter((t) => t.owner !== 0).map((t) => startRoom(w, t));
  if (rooms.length < 2) return 1;
  return Math.max(...rooms) / Math.max(1e-6, Math.min(...rooms));
}

export function blank(level: number, seed: number, difficulty: Difficulty, name: string, lesson: string, skill?: number): World {
  const profile = profileFor(level, difficulty, skill);
  return {
    level,
    seed,
    rng: seed | 0,
    t: 0,
    acc: 0,
    status: 'play',
    territories: [],
    dots: [],
    queues: [],
    profile,
    name,
    lesson,
    storms: [],
    factionAi: [profile.ai, profile.ai, profile.ai, profile.ai, profile.ai],
    // Everyone produces at the same rate.
    factionProd: [0, profile.playerProd, profile.enemyProd, profile.enemyProd, profile.enemyProd],
    personality: ['balanced', 'balanced', 'balanced', 'balanced', 'balanced'],
    aiClock: [0, 0, profile.grace[2], profile.grace[3], profile.grace[4]],
    trackEvents: false,
    events: [],
    collide: true,
    buffs: { surge: 0, rally: 0 },
  };
}

export function setPersonality(w: World, owner: 2 | 3 | 4, p: Personality) {
  w.personality[owner] = p;
  w.factionAi[owner] = aiFor(w.profile.ai, p);
}

function fromDef(level: number, seed: number, difficulty: Difficulty, def: LevelDef): World {
  const w = blank(level, seed, difficulty, def.name, def.lesson, def.skill);
  // Fair start: every enemy begins with the same total troops as you, split over its towers as the level is drawn.
  const total = (o: Owner) => def.nodes.reduce((sum, n) => sum + (n[3] === o ? n[4] : 0), 0);
  const mine = total(1);
  for (const [x, y, tier, owner, units, kind] of def.nodes) {
    const scaled = owner >= 2 ? Math.round((units * mine) / total(owner)) : units;
    w.territories.push({ id: w.territories.length, x, y, tier, kind: kind ?? 'normal', owner, units: scaled, flash: 0 });
  }
  w.storms = (def.storms ?? []).map(([x, y, r]): Storm => ({ x, y, r }));
  for (const f of ENEMIES) {
    setPersonality(w, f, def.personalities?.[f] ?? 'balanced');
  }
  return w;
}

/**
 * Builds a level. The same (level, seed, difficulty) always gives the same map.
 * Levels 1-10 are the authored tutorial arc (the seed only affects the enemy's choices).
 * Later levels are generated and add factories, fortresses, storms and enemy personalities.
 * Either way the finished layout is cut into one state per territory (see land.ts).
 */
export function generateLevel(level: number, seed: number, difficulty: Difficulty = 'normal'): World {
  const def = AUTHORED[level];
  if (def) {
    const authored = fromDef(level, seed, difficulty, def);
    // The earliest levels stay low-stakes: filled neutrals never bring in a big (tier 2) garrison there.
    snapToGeography(authored, true, level <= 3 ? 1 : 2);
    buildLand(authored);
    return authored;
  }

  // Generated levels: look for a map where every side has about the same room to expand, then keep the best found.
  // Each candidate is laid over real geography first (towers move onto countries), so fairness is judged on the final map.
  const candidate = (s: number) => {
    const c = generateOnce(level, s, difficulty);
    snapToGeography(c);
    return c;
  };
  let best = candidate(seed);
  let bestRatio = startRatio(best);
  for (let k = 1; k < START_TRIES && bestRatio > FAIR_START_RATIO; k++) {
    const w = candidate(seed + k * 104729);
    const ratio = startRatio(w);
    if (ratio < bestRatio) {
      best = w;
      bestRatio = ratio;
    }
  }
  best.seed = seed;
  buildLand(best);
  return best;
}

/** Builds one candidate map for a generated level (without its land); `generateLevel` picks a fair one. */
function generateOnce(level: number, seed: number, difficulty: Difficulty): World {
  const w = blank(level, seed, difficulty, levelName(level), '');
  const profile = w.profile;
  const total = territoryCount(level);
  const minD = Math.min(20, 90 / Math.sqrt(total * 1.6));

  const place = (x0: number, x1: number, y0: number, y1: number) => {
    for (let i = 0; i < 300; i++) {
      const x = range(w, x0, x1);
      const y = range(w, y0, y1);
      const gap = i > 200 ? minD * 0.7 : minD;
      if (w.territories.every((t) => Math.hypot(t.x - x, t.y - y) > gap)) return { x, y };
    }
    return { x: range(w, x0, x1), y: range(w, y0, y1) };
  };
  const add = (owner: Owner, tier: Tier, units: number, area: [number, number, number, number], kind: Kind = 'normal') => {
    w.territories.push({ id: w.territories.length, ...place(...area), tier, kind, owner, units, flash: 0 });
  };

  const three = factionCount(level) >= 3;
  const foeStart = Math.round(profile.enemyStart);
  add(1, 1, profile.playerStart, [12, 40, BOTTOM - 34, BOTTOM]);
  add(2, 1, foeStart, [60, 88, TOP, TOP + 34]);
  if (factionCount(level) >= 2) add(3, 1, foeStart, [12, 40, TOP, TOP + 34]);
  // The third enemy starts in the south-east, opposite you.
  if (three) add(4, 1, foeStart, [60, 88, BOTTOM - 34, BOTTOM]);

  while (w.territories.length < total) {
    const r = next(w);
    const tier: Tier = r < 0.25 ? 2 : r < 0.5 ? 1 : 0;
    const [lo, hi] = NEUTRAL_UNITS[tier];
    add(0, tier, Math.round(range(w, lo, hi) * profile.neutralScale), [10, 90, TOP + 8, BOTTOM - 8]);
  }

  // Specials are neutral prizes: pick medium and large neutrals and upgrade them.
  const prizes = w.territories.filter((t) => t.owner === 0 && t.tier >= 1);
  const factories = level >= 12 ? (level >= 20 ? 2 : 1) : 0;
  const fortresses = level >= 14 ? (level >= 22 ? 2 : 1) : 0;
  for (let i = 0; i < factories + fortresses && prizes.length; i++) {
    const t = prizes.splice(Math.floor(next(w) * prizes.length), 1)[0];
    t.kind = i < factories ? 'factory' : 'fortress';
  }

  const storms = level >= 11 ? Math.min(3, 1 + Math.floor((level - 11) / 6)) : 0;
  for (let i = 0; i < storms; i++) w.storms.push({ x: range(w, 25, 75), y: range(w, 60, 112), r: range(w, 9, 14) });

  for (const f of ENEMIES) {
    if (w.territories.some((t) => t.owner === f)) {
      setPersonality(w, f, PERSONALITIES[Math.floor(next(w) * 3)]);
    }
  }
  return w;
}

/**
 * The seed a level number is always played with, so every level is one fixed map (as in State.io) and its preview
 * on the home screen is the map you will fight on. Retries keep it; the enemy's choices replay from it too.
 */
export const levelSeed = (level: number) => (Math.imul(level + 1, 2654435761) >>> 1) || 1;

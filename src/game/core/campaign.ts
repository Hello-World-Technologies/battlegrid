import type { Kind, Owner, Personality, Tier } from './types.ts';

/** [x, y, tier, owner, troops, kind?] in world units (100 wide, 170 tall). */
export type NodeDef = [x: number, y: number, tier: Tier, owner: Owner, units: number, kind?: Kind];

export interface LevelDef {
  name: string;
  /** One line that teaches the new idea. Shown as the first tip. */
  lesson: string;
  nodes: NodeDef[];
  storms?: [x: number, y: number, r: number][];
  personalities?: Partial<Record<2 | 3 | 4, Personality>>;
  /** How skilled this level's enemy is, 0 to 1 (see `skillAt`). Left out, the level number decides. The only per-level difficulty knob: economy is never touched. */
  skill?: number;
}

export const CAMPAIGN_LEVELS = 30;

/**
 * Levels 1-10 are hand-made. Each one adds a single idea:
 * send, grow, factory, fortress, defend, storm, second enemy, combine, crossfire, boss.
 */
export const AUTHORED: Record<number, LevelDef> = {
  1: {
    name: 'First Contact',
    lesson: 'Drag from your territory to another to send troops.',
    nodes: [[22, 138, 1, 1, 40], [62, 118, 0, 0, 10], [30, 88, 0, 0, 12], [70, 72, 0, 0, 16], [72, 32, 1, 2, 16]],
  },
  2: {
    name: 'Snowball',
    lesson: 'Every territory you hold raises production on all of them.',
    nodes: [
      [20, 140, 1, 1, 40], [55, 132, 0, 0, 8], [82, 112, 0, 0, 10], [35, 105, 0, 0, 12],
      [62, 88, 1, 0, 22], [25, 68, 0, 0, 14], [72, 30, 1, 2, 20],
    ],
  },
  3: {
    name: 'Power Plant',
    lesson: 'Factories produce double troops. Take them early.',
    skill: 0.35,
    nodes: [
      [20, 140, 1, 1, 40], [50, 136, 0, 0, 10], [82, 125, 0, 0, 12], [25, 100, 0, 0, 14],
      [58, 96, 1, 0, 30, 'factory'], [80, 70, 1, 0, 24], [70, 30, 1, 2, 24], [28, 45, 0, 0, 15],
    ],
  },
  4: {
    name: 'The Wall',
    lesson: 'Fortresses hold twice as strong. Bring extra troops.',
    skill: 0.38,
    nodes: [
      [20, 140, 1, 1, 42], [52, 138, 0, 0, 12], [82, 118, 0, 0, 14], [28, 100, 0, 0, 16],
      [55, 84, 1, 0, 26, 'fortress'], [82, 72, 0, 0, 18], [72, 30, 1, 2, 30], [28, 50, 1, 0, 26],
    ],
  },
  5: {
    name: 'Hold the Line',
    lesson: 'This enemy attacks early. Keep troops home to defend.',
    skill: 0,
    nodes: [
      [22, 138, 1, 1, 45], [58, 134, 0, 0, 12], [84, 108, 0, 0, 16], [26, 100, 0, 0, 14],
      [50, 70, 1, 0, 26], [70, 60, 1, 2, 30], [30, 40, 0, 0, 18],
    ],
    personalities: { 2: 'aggressor' },
  },
  6: {
    name: 'Ion Storm',
    lesson: 'Storms slow troops. Go around them, or plan for the delay.',
    skill: 0.45,
    nodes: [
      [20, 140, 1, 1, 42], [62, 138, 0, 0, 12], [82, 100, 1, 0, 24], [22, 98, 0, 0, 14],
      [50, 92, 1, 0, 28, 'factory'], [30, 56, 0, 0, 18], [74, 32, 1, 2, 28],
    ],
    storms: [[46, 112, 15], [62, 62, 13]],
  },
  7: {
    name: 'Second Empire',
    lesson: 'A second enemy. They fight each other as well as you.',
    skill: 0.12,
    nodes: [
      [22, 140, 1, 1, 44], [58, 132, 0, 0, 12], [84, 112, 0, 0, 16], [28, 100, 0, 0, 16],
      [55, 84, 1, 0, 28, 'factory'], [78, 34, 1, 2, 26], [24, 34, 1, 3, 26], [50, 52, 0, 0, 20],
    ],
    personalities: { 2: 'balanced', 3: 'turtle' },
  },
  8: {
    name: 'Pincer',
    lesson: 'Drag through several territories to attack together.',
    skill: 0.85,
    nodes: [
      [20, 140, 1, 1, 34], [76, 140, 1, 1, 34], [48, 118, 0, 0, 16], [82, 96, 0, 0, 18],
      [22, 96, 0, 0, 18], [50, 78, 1, 0, 40, 'fortress'], [50, 34, 2, 2, 62, 'fortress'], [24, 56, 0, 0, 20],
    ],
  },
  9: {
    name: 'Crossfire',
    lesson: 'Let them fight each other, then strike the weakened one.',
    skill: 0,
    nodes: [
      [50, 142, 1, 1, 50], [22, 112, 0, 0, 16], [80, 112, 0, 0, 16], [50, 90, 1, 0, 30, 'factory'],
      [22, 62, 1, 3, 32], [78, 62, 1, 2, 32], [50, 40, 0, 0, 24], [50, 66, 0, 0, 20],
    ],
    personalities: { 2: 'aggressor', 3: 'aggressor' },
  },
  10: {
    name: 'The Citadel',
    lesson: 'Boss level. Crack the Citadel, one wall at a time.',
    skill: 0.82,
    nodes: [
      [20, 142, 1, 1, 44], [78, 142, 1, 1, 44], [50, 122, 0, 0, 20], [24, 96, 0, 0, 22],
      [80, 96, 1, 0, 30, 'factory'], [50, 30, 2, 2, 60, 'fortress'], [24, 52, 1, 2, 30], [78, 52, 1, 2, 30, 'fortress'],
    ],
    storms: [[50, 88, 14]],
    personalities: { 2: 'turtle' },
  },
};

const ADJECTIVES = [
  'Misty', 'Golden', 'Frozen', 'Hidden', 'Lost', 'Silver', 'Crimson', 'Quiet', 'Stormy', 'Ancient', 'Sunny', 'Wild',
  'Emerald', 'Dusty', 'Royal', 'Lonely', 'Windy', 'Amber', 'Velvet', 'Iron', 'Coral', 'Distant', 'Mossy', 'Twilight',
];
const PLACES = [
  'Valley', 'Harbor', 'Ridge', 'Meadow', 'Canyon', 'Island', 'Bay', 'Forest', 'Summit', 'Oasis', 'Fields', 'Falls',
  'Coast', 'Plateau', 'Grove', 'Lagoon', 'Peaks', 'Steppe', 'Delta', 'Hollow', 'Marsh', 'Cliffs', 'Dunes', 'Gardens',
];

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const roman = (n: number) => {
  if (n >= 4000) return String(n);
  let out = '';
  for (const [v, r] of ROMAN) while (n >= v) { out += r; n -= v; }
  return out;
};

/**
 * A level's name, for as many levels as you like. Levels 1-10 are authored. Every later level is an "Adjective Place"
 * ("Misty Harbor") from a 24 x 24 table, walked so that neighbouring levels differ in both words and no pair repeats
 * for 576 levels; after that the walk starts again with a numeral ("Misty Harbor II", "... III", ...), so every level
 * has its own name, and always the same one.
 */
export const levelName = (level: number) => {
  const authored = AUTHORED[level]?.name;
  if (authored) return authored;
  const k = Math.max(0, level - 11);
  const i = k % 576;
  const cycle = Math.floor(k / 576);
  const adj = i % 24;
  const place = (Math.floor(i / 24) + 5 * adj) % 24;
  return `${ADJECTIVES[adj]} ${PLACES[place]}${cycle ? ` ${roman(cycle + 1)}` : ''}`;
};

/** Owner ids: 0 neutral, 1 the player, 2, 3 and 4 enemy factions. */
export type Owner = 0 | 1 | 2 | 3 | 4;
/** The enemy factions. Levels have one, two or three of them. */
export const ENEMIES = [2, 3, 4] as const;
export type Tier = 0 | 1 | 2;
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Status = 'play' | 'won' | 'lost';
/** factory: produces double. fortress: troops fighting it count for half (it holds twice as strong). */
export type Kind = 'normal' | 'factory' | 'fortress';

export type Personality = 'balanced' | 'aggressor' | 'turtle';

/** The world is a fixed 100 x 170 space. Renderers scale it to the screen. */
export const WORLD_W = 100;
export const WORLD_H = 170;
export const STEP = 1 / 60;

/** The share of a tower's troops every send uses, for every side: all of them. */
export const SEND_FRACTION = 1;

/** Battle items you buy with coins and use in a level. */
export const ITEM_IDS = ['bomb', 'megabomb', 'freeze', 'airdrop', 'shield', 'surge', 'rally', 'provoke', 'flak', 'recall'] as const;
export type ItemId = (typeof ITEM_IDS)[number];

/** What an item needs you to tap: a tower that is not yours, an enemy's tower, one of your own, or nothing at all. */
export type ItemTarget = 'foe' | 'enemy' | 'mine' | 'none';
export const ITEM_TARGET: Readonly<Record<ItemId, ItemTarget>> = {
  bomb: 'foe',
  megabomb: 'foe',
  freeze: 'enemy',
  airdrop: 'mine',
  shield: 'mine',
  surge: 'none',
  rally: 'none',
  provoke: 'none',
  flak: 'mine',
  recall: 'mine',
};

/** The numbers items run on. */
export const BOMB_DAMAGE = 5;
export const MEGABOMB_DAMAGE = 25;
export const FREEZE_SECONDS = 10;
export const AIRDROP_TROOPS = 10;
export const SHIELD_SECONDS = 15;
/** Flak: troops it shoots out of the sky, heading for the tower you used it on. */
export const FLAK_DAMAGE = 12;
/** Damage a shielded tower takes, as a share (it holds twice as strong). */
export const SHIELD_FACTOR = 0.5;
export const SURGE_SECONDS = 10;
export const SURGE_FACTOR = 2;
export const RALLY_SECONDS = 10;
export const RALLY_FACTOR = 2;
/** The share of its troops the enemy's strongest tower sends when you provoke it. */
export const PROVOKE_FRACTION = 0.5;

/**
 * The ground under a level, in world units and territory order. Either one convex polygon per territory that together
 * fill the board (Voronoi cells, built from the territory positions: see land.ts), or real geography (see geofit.ts):
 * each territory is a country, and the countries around it are drawn as scenery.
 */
export interface Land {
  /** Flat [x0, y0, x1, y1, ...] per territory: its state (for a country, its largest part). */
  cells: number[][];
  /** Real geography only: every part of every territory's country (mainland and islands), as flat rings. */
  parts?: number[][][];
  /** Real geography only: countries on the board that hold no tower. They are drawn like the neutral states. */
  filler?: number[][];
  /** Real geography only: the countries around the board, outside the play area, drawn pale. */
  scenery?: number[][];
  /** Real geography only: the region of the world the level is laid over. */
  theater?: string;
}

export interface Territory {
  id: number;
  x: number;
  y: number;
  tier: Tier;
  kind: Kind;
  owner: Owner;
  units: number;
  /** Seconds left of the "just hit / just captured" flash. Visual only. */
  flash: number;
  /** Seconds left of a freeze: the tower makes no troops. */
  freeze?: number;
  /** Seconds left of a shield: the tower takes half damage. */
  shield?: number;
}

/** One visible dot travelling between two territories, worth `v` troops on arrival. */
export interface Dot {
  from: number;
  to: number;
  owner: Owner;
  v: number;
  /** Distance travelled along the line from the source centre. */
  p: number;
  /** Sideways offset: this dot's lane in its marching column, so a stream reads as parallel lanes, not scatter. */
  off: number;
  ang: number;
}

/** Troops waiting to leave a territory, released one dot at a time. */
export interface Queue {
  from: number;
  to: number;
  owner: Owner;
  vals: number[];
  wait: number;
  /** Seconds between each dot's release, set once when the send is queued (see `intervalFor`). */
  interval: number;
  /** Lanes in this stream's marching column (3-5 wide: "Parallel Column Formation"), fixed when queued. */
  width: number;
  /** Next lane to use (cycles 0..width-1), so dots stream down fixed parallel lanes instead of scattering. */
  lane: number;
}

/** Every number that shapes how hard a level is. */
/** A storm slows every troop flying through it. */
export interface Storm {
  x: number;
  y: number;
  r: number;
}

export interface DifficultyProfile {
  /** 0.85 easy, 1 normal, 1.2 hard. Scales authored enemy garrisons. */
  scale: number;
  playerStart: number;
  playerProd: number;
  enemyStart: number;
  enemyProd: number;
  neutralScale: number;
  /** Seconds of grace before each faction's first attack (index = owner). */
  grace: [number, number, number, number, number];
  ai: AiParams;
}

export interface AiParams {
  interval: number;
  intervalMin: number;
  minUnits: number;
  fraction: number;
  margin: number;
  /** Pool several territories against one target when none can win alone. */
  coordinate: boolean;
  /** How much more attractive the player's territories are as targets. */
  playerBias: number;
  /**
   * How good this enemy is, 0 (novice) to 1 (expert), rising smoothly with the level (see `skillAt`). When set, each smart
   * skill below is used with a chance that rises with it (and a novice sometimes picks a random target); when it is
   * left out (hand-built test settings, the balance bot) the flags below decide on their own.
   */
  skill?: number;
  /**
   * Smarter play, switched on as the enemy's skill grows (all absent or 0 on the early levels, so they play as they always did):
   * `leader` is how much more attractive the strongest side's towers are as targets, so the AIs gang up on whoever is
   * winning (you, or each other); `reinforce` sends spare troops from safe towers to the front when there is nothing to attack; `strike` hits a
   * target from every tower in range at once instead of the minimum.
   */
  leader?: number;
  reinforce?: boolean;
  strike?: boolean;
  /**
   * Caution: a tower with an enemy tower close by is not emptied for an attack that is not clearly overwhelming, because
   * every send takes all the troops and would leave it open. Without it the AI empties its front line for any attack it can win.
   */
  caution?: boolean;
}

/** Things that just happened, for sound, haptics and effects. Only recorded when `trackEvents` is on. */
export type GameEvent =
  | { type: 'send'; from: number; to: number; owner: Owner; troops: number }
  | { type: 'land'; id: number; owner: Owner }
  | { type: 'capture'; id: number; owner: Owner; previous: Owner }
  /** Two opposing streams met in the open (collide rule): where, and who. */
  | { type: 'clash'; x: number; y: number; a: Owner; b: Owner }
  /** An item was used: on tower `id` (or -1 when it needs none), worth `amount` (troops destroyed or added, or seconds). */
  | { type: 'item'; item: ItemId; id: number; owner: Owner; amount: number }
  | { type: 'end'; status: 'won' | 'lost' };

export interface World {
  level: number;
  seed: number;
  /** Mutable random state (mulberry32). Kept in the world so runs replay exactly. */
  rng: number;
  t: number;
  acc: number;
  status: Status;
  /** The states the board is cut into, one per territory. Unset for hand-built test worlds. */
  land?: Land;
  /** Set when the level has been laid over real geography (see geofit.ts): the region, and each territory's country. */
  geo?: { theater: number; countries: number[] };
  territories: Territory[];
  dots: Dot[];
  queues: Queue[];
  profile: DifficultyProfile;
  name: string;
  /** One-line lesson shown as the first tip. Empty for generated levels. */
  lesson: string;
  storms: Storm[];
  /** Per-owner AI settings and production multipliers (index = owner). */
  factionAi: AiParams[];
  factionProd: number[];
  personality: Personality[];
  /** Seconds until each faction next thinks (index = owner). */
  aiClock: [number, number, number, number, number];
  trackEvents: boolean;
  events: GameEvent[];
  /**
   * State.io rules: troops of opposing owners that meet in flight destroy each other one for one, and the enemy AI
   * guards threatened territories. On for every generated level; hand-built test worlds may leave it off.
   */
  collide?: boolean;
  /** Seconds left of your Surge (double production) and Rally (double speed) items. */
  buffs?: { surge: number; rally: number };
}

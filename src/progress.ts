// src/progress.ts
//
// The player's meta-progression: the level reached, stars per level, coins earned, battle record
// the daily bonus streak and what was bought in the shop. Everything here only grows (coins spent, skins owned, items
// bought and items used), which is what makes mergeProgress safe. The items you hold are the difference of the last two.
//
// Every reducer is pure and takes the day key explicitly so it can be tested
// without a clock. Persistence lives in src/save.ts; this module has no
// storage dependency.

import { dayKeyOf } from './dayKeys';

export type Progress = {
  coins: number;
  /** Highest level reachable (the next one to beat). Levels are endless. */
  unlocked: number;
  /** Levels won, counting replays. */
  wins: number;
  losses: number;

  /** Consecutive days the bonus was claimed. */
  streak: number;
  bestStreak: number;
  /** UTC day of the last claim, or null before the first. */
  lastClaimDay: string | null;

  /** Best stars (1-3) ever earned per level. Only levels with at least one star appear. */
  stars: Record<number, number>;

  /** Coins spent in the shop, lifetime. What you can spend now is `coins - spent` (see coinsLeft). */
  spent: number;
  /** Ids of the skins you own (see src/shop.ts). `classic` is always owned. */
  skins: string[];
  /** The skin you play with. Always one you own. */
  skin: string;
  /** The same for the shape your troops fly as, and for the board theme. */
  shapes: string[];
  shape: string;
  boards: string[];
  board: string;
  /** Ids of the leaderboard titles you own (see src/shop.ts). `none` is always owned. */
  titles: string[];
  /** The title shown beside your name on the leaderboard. Always one you own. */
  title: string;
  /** Battle items by id: how many you have ever got (a couple of bombs are free) and how many you have used. You hold the difference. */
  items: Record<string, number>;
  itemsUsed: Record<string, number>;
  /** Permanent upgrades bought, by id: the level of each (see src/shop.ts). Levels only go up. */
  upgrades: Record<string, number>;
};

/** Bombs every player starts with, so the first battle can try one. */
export const FREE_BOMBS = 2;

export const DEFAULT_SKIN = 'classic';
export const DEFAULT_SHAPE = 'round';
export const DEFAULT_BOARD = 'classic';
export const DEFAULT_TITLE = 'none';

export const emptyProgress = (): Progress => ({
  coins: 0,
  unlocked: 1,
  wins: 0,
  losses: 0,
  streak: 0,
  bestStreak: 0,
  lastClaimDay: null,
  stars: {},
  spent: 0,
  skins: [DEFAULT_SKIN],
  skin: DEFAULT_SKIN,
  shapes: [DEFAULT_SHAPE],
  shape: DEFAULT_SHAPE,
  boards: [DEFAULT_BOARD],
  board: DEFAULT_BOARD,
  titles: [DEFAULT_TITLE],
  title: DEFAULT_TITLE,
  items: { bomb: FREE_BOMBS },
  itemsUsed: {},
  upgrades: {},
});

/* ── Stars ──────────────────────────────────────────────────────────────── */

/** Cleans stars read from a save: only whole 1-3 star counts on real levels survive. */
export const sanitizeStars = (raw: unknown): Record<number, number> => {
  const out: Record<number, number> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [key, value] of Object.entries(raw)) {
    const level = Number(key);
    if (!Number.isInteger(level) || level < 1 || typeof value !== 'number') continue;
    const n = Math.min(3, Math.floor(value));
    if (n >= 1) out[level] = n;
  }
  return out;
};

/** Cleans an owned list read from a save: unique ids, always including the default one. */
export const sanitizeOwned = (raw: unknown, def: string): string[] => {
  const out = [def];
  if (!Array.isArray(raw)) return out;
  for (const id of raw) if (typeof id === 'string' && id.length > 0 && id.length <= 32 && !out.includes(id) && out.length < 64) out.push(id);
  return out;
};

export const sanitizeSkins = (raw: unknown): string[] => sanitizeOwned(raw, DEFAULT_SKIN);

export const sanitizeTitles = (raw: unknown): string[] => sanitizeOwned(raw, DEFAULT_TITLE);

/** Cleans item counts read from a save: whole numbers from 0 up, a bounded number of ids. Unknown ids are kept (newer data). */
export const sanitizeCounts = (raw: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (Object.keys(out).length >= 64) break;
    if (id.length === 0 || id.length > 32 || typeof v !== 'number' || !Number.isFinite(v)) continue;
    const n = Math.min(1_000_000, Math.floor(v));
    if (n > 0) out[id] = n;
  }
  return out;
};

/** Per-id maximum of two count maps. Returns `a` itself when it already covers `b`. */
const mergeCounts = (a: Record<string, number>, b: Record<string, number>): Record<string, number> => {
  let out: Record<string, number> | null = null;
  for (const id of Object.keys(b)) if (b[id] > (a[id] ?? 0)) (out ??= { ...a })[id] = b[id];
  return out ?? a;
};

/** How many of an item you hold right now. */
export const heldOf = (p: Progress, id: string): number => Math.max(0, (p.items[id] ?? 0) - (p.itemsUsed[id] ?? 0));

/** Everything you hold, by id (only the ones you have any of). */
export const stockOf = (p: Progress): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const id of Object.keys(p.items)) if (heldOf(p, id) > 0) out[id] = heldOf(p, id);
  return out;
};

/** Coins you can spend right now. */
export const coinsLeft = (p: Progress): number => Math.max(0, p.coins - p.spent);

export const starsOf = (p: Progress, level: number): number => p.stars[level] ?? 0;

export const totalStars = (p: Progress): number => Object.values(p.stars).reduce((n, v) => n + v, 0);

/** Per-level best of two star maps. Returns `a` itself when it already covers `b`. */
const mergeStars = (a: Record<number, number>, b: Record<number, number>): Record<number, number> => {
  let out: Record<number, number> | null = null;
  for (const key of Object.keys(b)) {
    const level = Number(key);
    if (b[level] > (a[level] ?? 0)) (out ??= { ...a })[level] = b[level];
  }
  return out ?? a;
};

/** Union of two skin lists. Returns `a` itself when it already has everything in `b`. */
const mergeSkins = (a: string[], b: string[]): string[] => {
  const missing = b.filter((id) => !a.includes(id));
  return missing.length ? [...a, ...missing] : a;
};

/**
 * Combines two copies of the same player's progress (the cloud one and the
 * device one). Every counter only ever grows — nothing spends coins — so the
 * larger value is always the more complete one. The streak belongs with
 * whichever copy claimed most recently. Returns `a` itself when it already
 * covers `b`, so callers can detect "nothing to write back" by identity.
 */
export const mergeProgress = (a: Progress, b: Progress): Progress => {
  const bNewer =
    (b.lastClaimDay ?? '') > (a.lastClaimDay ?? '') ||
    (b.lastClaimDay === a.lastClaimDay && b.streak > a.streak);
  const streakFrom = bNewer ? b : a;
  const merged: Progress = {
    coins: Math.max(a.coins, b.coins),
    unlocked: Math.max(a.unlocked, b.unlocked),
    wins: Math.max(a.wins, b.wins),
    losses: Math.max(a.losses, b.losses),
    bestStreak: Math.max(a.bestStreak, b.bestStreak, streakFrom.streak),
    streak: streakFrom.streak,
    lastClaimDay: streakFrom.lastClaimDay,
    stars: mergeStars(a.stars, b.stars),
    spent: Math.max(a.spent, b.spent),
    skins: mergeSkins(a.skins, b.skins),
    // The copy that has spent more is the later one, so its choice of skin wins.
    skin: b.spent > a.spent ? b.skin : a.skin,
    shapes: mergeSkins(a.shapes, b.shapes),
    shape: b.spent > a.spent ? b.shape : a.shape,
    boards: mergeSkins(a.boards, b.boards),
    board: b.spent > a.spent ? b.board : a.board,
    titles: mergeSkins(a.titles, b.titles),
    title: b.spent > a.spent ? b.title : a.title,
    items: mergeCounts(a.items, b.items),
    itemsUsed: mergeCounts(a.itemsUsed, b.itemsUsed),
    upgrades: mergeCounts(a.upgrades, b.upgrades),
  };
  if (!merged.skins.includes(merged.skin)) merged.skin = DEFAULT_SKIN;
  if (!merged.shapes.includes(merged.shape)) merged.shape = DEFAULT_SHAPE;
  if (!merged.boards.includes(merged.board)) merged.board = DEFAULT_BOARD;
  if (!merged.titles.includes(merged.title)) merged.title = DEFAULT_TITLE;
  const same = (Object.keys(merged) as (keyof Progress)[]).every((k) => merged[k] === a[k]);
  return same ? a : merged;
};

/* ── Battles ────────────────────────────────────────────────────────────── */

/**
 * Banks a win: pays `payout` coins, unlocks the next level if this was the frontier and keeps
 * the level's best star count (a worse replay never lowers it).
 */
export const recordWin = (p: Progress, level: number, payout: number, stars = 0): Progress => ({
  ...p,
  coins: p.coins + Math.max(0, Math.floor(payout)),
  unlocked: Math.max(p.unlocked, level + 1),
  wins: p.wins + 1,
  stars: mergeStars(p.stars, sanitizeStars({ [level]: stars })),
});

export const recordLoss = (p: Progress): Progress => ({ ...p, losses: p.losses + 1 });

/* ── Shop ───────────────────────────────────────────────────────────────── */

/** Buys a skin and equips it. Does nothing if you own it already or cannot afford it. */
export const buySkin = (p: Progress, id: string, price: number): Progress => {
  if (p.skins.includes(id) || price < 0 || coinsLeft(p) < price) return p;
  return { ...p, spent: p.spent + Math.floor(price), skins: [...p.skins, id], skin: id };
};

/** Buys `count` of an item for `price` coins. Does nothing if you cannot afford it. */
export const buyItem = (p: Progress, id: string, count: number, price: number): Progress =>
  count < 1 || price < 0 || coinsLeft(p) < price
    ? p
    : { ...p, spent: p.spent + Math.floor(price), items: { ...p.items, [id]: (p.items[id] ?? 0) + Math.floor(count) } };

/** Uses one of an item. Does nothing if you hold none. */
export const spendItem = (p: Progress, id: string): Progress =>
  heldOf(p, id) < 1 ? p : { ...p, itemsUsed: { ...p.itemsUsed, [id]: (p.itemsUsed[id] ?? 0) + 1 } };

/** The level you have of an upgrade (0 = not bought). */
export const upgradeLevel = (p: Progress, id: string): number => p.upgrades[id] ?? 0;

/** Buys the next level of an upgrade for `price` coins. Does nothing at the top level or if you cannot afford it. */
export const buyUpgrade = (p: Progress, id: string, price: number, maxLevel: number): Progress =>
  upgradeLevel(p, id) >= maxLevel || price < 0 || coinsLeft(p) < price
    ? p
    : { ...p, spent: p.spent + Math.floor(price), upgrades: { ...p.upgrades, [id]: upgradeLevel(p, id) + 1 } };

/** The four kinds of cosmetic: your colour, the shape your troops fly as, the board theme, and your leaderboard title. */
export type CosmeticKind = 'skin' | 'shape' | 'board' | 'title';
const WARDROBE = {
  skin: { owned: 'skins', current: 'skin' },
  shape: { owned: 'shapes', current: 'shape' },
  board: { owned: 'boards', current: 'board' },
  title: { owned: 'titles', current: 'title' },
} as const;

/** Buys a cosmetic and equips it. Does nothing if you own it already or cannot afford it. */
export const buyCosmetic = (p: Progress, kind: CosmeticKind, id: string, price: number): Progress => {
  const w = WARDROBE[kind];
  if (p[w.owned].includes(id) || price < 0 || coinsLeft(p) < price) return p;
  return { ...p, spent: p.spent + Math.floor(price), [w.owned]: [...p[w.owned], id], [w.current]: id };
};

/** Equips a cosmetic you own. */
export const selectCosmetic = (p: Progress, kind: CosmeticKind, id: string): Progress => {
  const w = WARDROBE[kind];
  return p[w.owned].includes(id) && p[w.current] !== id ? { ...p, [w.current]: id } : p;
};

/** Equips a skin you own. */
export const selectSkin = (p: Progress, id: string): Progress => (p.skins.includes(id) && p.skin !== id ? { ...p, skin: id } : p);

/** Extra coins on top of a banked win (the rewarded-ad multiplier). */
export const addCoins = (p: Progress, amount: number): Progress => ({
  ...p,
  coins: p.coins + Math.max(0, Math.floor(amount)),
});

/* ── Daily bonus ────────────────────────────────────────────────────────── */

export type RewardKind = 'coins' | 'chest';

export type Reward = { kind: RewardKind; amount: number };

/** A seven-day cycle, ending on a chest. Scaled to level payouts (140-250 coins a win): a day is about one or two wins. */
export const DAILY_REWARDS: Reward[] = [
  { kind: 'coins', amount: 100 },
  { kind: 'coins', amount: 150 },
  { kind: 'coins', amount: 200 },
  { kind: 'coins', amount: 250 },
  { kind: 'coins', amount: 300 },
  { kind: 'coins', amount: 400 },
  { kind: 'chest', amount: 800 },
];

export const DAILY_CYCLE = DAILY_REWARDS.length;

const yesterdayOf = (dayKey: string): string => {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return dayKeyOf(d);
};

export const canClaimDaily = (p: Progress, dayKey: string): boolean => p.lastClaimDay !== dayKey;

/**
 * The streak as of `dayKey`. A streak survives only if the last claim was
 * today or yesterday; once a whole day has been missed it is already broken,
 * even though the stored counter keeps its old value until the next claim.
 */
export const liveStreak = (p: Progress, dayKey: string): number =>
  p.lastClaimDay === dayKey || p.lastClaimDay === yesterdayOf(dayKey) ? p.streak : 0;

/** Which day of the cycle is up for grabs (0-based): today's if it can still
 *  be claimed, tomorrow's once it has been. */
export const dailyIndex = (p: Progress, dayKey: string): number => liveStreak(p, dayKey) % DAILY_CYCLE;

/**
 * Claims today's bonus. A missed day restarts the streak at one; claiming on
 * consecutive days advances it. Claiming twice in a day is a no-op.
 */
export const claimDaily = (p: Progress, dayKey: string): Progress => {
  if (!canClaimDaily(p, dayKey)) return p;
  const reward = DAILY_REWARDS[dailyIndex(p, dayKey)];
  const streak = liveStreak(p, dayKey) + 1;
  return {
    ...p,
    coins: p.coins + reward.amount,
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    lastClaimDay: dayKey,
  };
};

/** Time until the next UTC midnight, as "12h 30m". */
export const untilReset = (now: Date): string => {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const ms = Math.max(0, next - now.getTime());
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
};

export const todayKey = (): string => dayKeyOf(new Date());

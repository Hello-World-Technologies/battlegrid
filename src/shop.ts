// src/shop.ts
//
// What the shop sells: colours for your side of the battlefield. A skin changes your states, towers and troops
// (never the rivals', which stay red, green and purple, and neutral stays grey, so the board always reads at a glance).
// Prices are in coins; ownership and the equipped skin live in Progress (see src/progress.ts).

import type { ImageSourcePropType } from 'react-native';
import { AIRDROP_TROOPS, BOMB_DAMAGE, FLAK_DAMAGE, FREEZE_SECONDS, MEGABOMB_DAMAGE, RALLY_SECONDS, SHIELD_SECONDS, SURGE_SECONDS, type ItemId } from './game/core';
import type { Perks } from './game/session';
import { COL, LIGHT } from './game/theme';
import { THEME } from './theme';
import { look } from './ui/look';

export type Skin = {
  id: string;
  name: string;
  price: number;
  /** The fill of your states and the lighter highlights. */
  light: string;
  /** The deep shade of your towers and troops. */
  deep: string;
  /** The shade used for your regions on the small level maps. */
  region: string;
};

export const SKINS: readonly Skin[] = [
  { id: 'classic', name: 'Classic Blue', price: 0, light: '#70bceb', deep: '#2c6a99', region: '#7cc8ff' },
  { id: 'ocean', name: 'Deep Ocean', price: 1500, light: '#5b7fe0', deep: '#1b2a7a', region: '#6f8ee8' },
  { id: 'gold', name: 'Sunny Gold', price: 2500, light: '#f2cf4a', deep: '#a37b00', region: '#f5d764' },
  { id: 'cyan', name: 'Ice Cyan', price: 3000, light: '#4fd8e0', deep: '#0c7f87', region: '#6fe3ea' },
  { id: 'pink', name: 'Hot Pink', price: 4000, light: '#f58cc4', deep: '#a8286f', region: '#f7a3d1' },
];

/** A battle item you can buy: what it is called, how it looks and what it does. Prices are about one win's coins. */
export type ItemShop = { id: ItemId; name: string; emoji: string; blurb: string; price: number };

export const ITEM_SHOP: readonly ItemShop[] = [
  { id: 'bomb', name: 'Bomb', emoji: '💣', blurb: `Destroys ${BOMB_DAMAGE} troops in one tower.`, price: 200 },
  { id: 'megabomb', name: 'Mega bomb', emoji: '☄️', blurb: `Destroys ${MEGABOMB_DAMAGE} troops in one tower.`, price: 600 },
  { id: 'freeze', name: 'Freeze', emoji: '❄️', blurb: `An enemy tower makes no troops for ${FREEZE_SECONDS} seconds.`, price: 250 },
  { id: 'airdrop', name: 'Airdrop', emoji: '📦', blurb: `Adds ${AIRDROP_TROOPS} troops to one of your towers.`, price: 150 },
  { id: 'shield', name: 'Shield', emoji: '🛡️', blurb: `One of your towers takes half damage for ${SHIELD_SECONDS} seconds.`, price: 150 },
  { id: 'surge', name: 'Surge', emoji: '⚡', blurb: `Your towers make double troops for ${SURGE_SECONDS} seconds.`, price: 250 },
  { id: 'rally', name: 'Rally', emoji: '🏃', blurb: `Your troops fly twice as fast for ${RALLY_SECONDS} seconds.`, price: 200 },
  { id: 'provoke', name: 'Provoke', emoji: '😡', blurb: 'The strongest enemy sends half its fullest tower at the other enemy.', price: 300 },
  { id: 'flak', name: 'Flak', emoji: '🎯', blurb: `Shoots down up to ${FLAK_DAMAGE} troops already heading for one of your towers.`, price: 220 },
  { id: 'recall', name: 'Recall', emoji: '↩️', blurb: 'Every troop you sent from one of your towers turns around and comes home.', price: 200 },
];

export const itemShopById = (id: string): ItemShop | undefined => ITEM_SHOP.find((i) => i.id === id);

/** Packs of an item: one at the price, five for 20% off. */
export const ITEM_PACKS = [1, 5] as const;
export const packPrice = (item: ItemShop, count: number): number => (count === 1 ? item.price : Math.round(item.price * count * 0.8));

/**
 * Permanent upgrades, bought one level at a time and kept forever. Each is small and capped, so coins make you a little
 * stronger without ever deciding a battle. `prices[i]` buys level i + 1; `per` is what each level adds.
 */
export type UpgradeId = 'reserves' | 'heavy' | 'coldsnap' | 'fortify' | 'supplydrop';
export type UpgradeShop = { id: UpgradeId; name: string; emoji: string; per: number; prices: readonly number[]; describe: (level: number) => string };

export const UPGRADES: readonly UpgradeShop[] = [
  { id: 'reserves', name: 'Reserves', emoji: '🎖️', per: 2, prices: [600, 1000, 1500, 2200], describe: (l) => `+${2 * l} troops on each tower you start with` },
  { id: 'heavy', name: 'Heavy bombs', emoji: '💥', per: 1, prices: [800, 1500, 2500], describe: (l) => `Bombs destroy ${BOMB_DAMAGE + l} troops` },
  { id: 'coldsnap', name: 'Cold Snap', emoji: '🥶', per: 2, prices: [700, 1300, 2000], describe: (l) => `Freeze lasts ${FREEZE_SECONDS + 2 * l} seconds` },
  { id: 'fortify', name: 'Fortify', emoji: '🔰', per: 3, prices: [650, 1200, 1900], describe: (l) => `Shield lasts ${SHIELD_SECONDS + 3 * l} seconds` },
  { id: 'supplydrop', name: 'Supply Drop', emoji: '🪂', per: 2, prices: [600, 1100, 1800], describe: (l) => `Airdrop adds ${AIRDROP_TROOPS + 2 * l} troops` },
];

export const upgradeShopById = (id: string): UpgradeShop | undefined => UPGRADES.find((u) => u.id === id);

/** The perks a save's upgrade levels add up to, handed to every battle. */
export function perksOf(levels: Record<string, number>): Perks {
  const lv = (id: UpgradeId) => Math.max(0, Math.min(UPGRADES.find((u) => u.id === id)!.prices.length, Math.floor(levels[id] ?? 0)));
  return {
    startTroops: 2 * lv('reserves'),
    bombBonus: lv('heavy'),
    freezeBonus: 2 * lv('coldsnap'),
    shieldBonus: 3 * lv('fortify'),
    airdropBonus: 2 * lv('supplydrop'),
  };
}

export { BOMB_DAMAGE };

export const skinById = (id: string): Skin => SKINS.find((s) => s.id === id) ?? SKINS[0];

/**
 * Paints the battlefield and level maps in a skin. The palettes are shared module-level arrays (the renderer reads
 * them every frame), so this changes them in place; call it whenever the equipped skin changes.
 */
export function applySkin(id: string) {
  const s = skinById(id);
  LIGHT[1] = s.light;
  COL[1] = s.deep;
  THEME.region[1] = s.region;
  THEME.regionDeep[1] = s.deep;
}

/** The shape your troops fly as (a visual choice only). */
export type Shape = { id: string; name: string; glyph: string; price: number };
export const SHAPES: readonly Shape[] = [
  { id: 'round', name: 'Round', glyph: '●', price: 0 },
  { id: 'square', name: 'Square', glyph: '■', price: 900 },
  { id: 'diamond', name: 'Diamond', glyph: '◆', price: 900 },
  { id: 'star', name: 'Star', glyph: '★', price: 1500 },
  // Pictures rather than shapes: the art is in src/ui/sprites.ts and the renderer draws it in src/ui/draw.ts.
  { id: 'plane', name: 'Warplane', glyph: '✈', price: 2500 },
  { id: 'sprite', name: 'Water sprite', glyph: '✦', price: 2500 },
];
export const shapeById = (id: string): Shape => SHAPES.find((s) => s.id === id) ?? SHAPES[0];

/** A theme for the board: the water around it, the grey of neutral states, and the seams (a visual choice only). */
export type Board = { id: string; name: string; water: string; neutral: string; seam: string; price: number };
export const BOARDS: readonly Board[] = [
  { id: 'classic', name: 'Classic', water: '#dfe6ee', neutral: '#a6a6a6', seam: '#ffffff', price: 0 },
  { id: 'sand', name: 'Desert sand', water: '#f1e3c4', neutral: '#c9b48a', seam: '#fff8e6', price: 1000 },
  { id: 'mint', name: 'Mint', water: '#d9efe6', neutral: '#9bbcab', seam: '#ffffff', price: 1000 },
  { id: 'night', name: 'Night', water: '#232c4d', neutral: '#8f9ac4', seam: '#e6ebff', price: 1500 },
];
export const boardById = (id: string): Board => BOARDS.find((b) => b.id === id) ?? BOARDS[0];

/** A badge shown beside your name on the leaderboard (see src/screens/Leaderboard.tsx). Purely cosmetic: it
 *  changes nothing about how you play. `none` has no icon and is always owned. */
export type Title = { id: string; name: string; icon: ImageSourcePropType | null; tint: string; price: number };
export const TITLES: readonly Title[] = [
  { id: 'none', name: 'No title', icon: null, tint: '', price: 0 },
  { id: 'veteran', name: 'Veteran', icon: require('../assets/ui/title_shield.png'), tint: '#3f78b8', price: 800 },
  { id: 'conqueror', name: 'Conqueror', icon: require('../assets/ui/title_laurel.png'), tint: '#9ab53e', price: 2000 },
  { id: 'champion', name: 'Champion', icon: require('../assets/ui/title_crown.png'), tint: '#e6bd72', price: 4000 },
  { id: 'legend', name: 'Legend', icon: require('../assets/ui/title_flame.png'), tint: '#e8892a', price: 8000 },
];
export const titleById = (id: string): Title => TITLES.find((t) => t.id === id) ?? TITLES[0];

/** Equips a troop shape: the renderer draws every troop as it from now on. */
export function applyShape(id: string) {
  look.shape = shapeById(id).id;
}

/** Equips a board theme for the battlefield and the small level maps. */
export function applyBoard(id: string) {
  const b = boardById(id);
  look.board = b.id;
  look.water = b.water;
  look.neutral = b.neutral;
  look.seam = b.seam;
  THEME.mapWater = b.water;
  THEME.mapLand = b.neutral;
}

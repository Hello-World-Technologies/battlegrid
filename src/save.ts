// src/save.ts
//
// The on-device copy of the player's save (progress, settings, onboarding).
// It is the only store when Firebase is not configured, and the fallback when
// the cloud read fails; when the cloud is reachable it is a mirror, so the
// app opens instantly and still works offline.
//
// Keyed by uid so two accounts on one device never see each other's data.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_BOARD, DEFAULT_SHAPE, DEFAULT_SKIN, DEFAULT_TITLE, Progress, emptyProgress, sanitizeCounts, sanitizeOwned, sanitizeSkins, sanitizeStars, sanitizeTitles } from './progress';
import { DEFAULT_SETTINGS, SettingsValue } from './settings';

export type SaveData = {
  progress: Progress;
  settings: SettingsValue;
  onboarded: boolean;
};

export const freshSave = (): SaveData => ({
  progress: emptyProgress(),
  settings: DEFAULT_SETTINGS,
  onboarded: false,
});

const keyFor = (uid: string) => `bg.save.${uid}`;

/** Keys written by the first version of the app, before accounts existed. */
const LEGACY = { level: 'bg.level', coins: 'bg.coins', haptics: 'bg.haptics' } as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Rebuilds a SaveData from parsed JSON, defaulting anything missing. */
const normalise = (raw: unknown): SaveData => {
  const base = freshSave();
  if (!isRecord(raw)) return base;
  const p = isRecord(raw.progress) ? raw.progress : {};
  const s = isRecord(raw.settings) ? raw.settings : {};
  return {
    progress: {
      coins: num(p.coins, base.progress.coins),
      unlocked: Math.max(1, num(p.unlocked, base.progress.unlocked)),
      wins: num(p.wins, base.progress.wins),
      losses: num(p.losses, base.progress.losses),
      streak: num(p.streak, base.progress.streak),
      bestStreak: num(p.bestStreak, base.progress.bestStreak),
      lastClaimDay: typeof p.lastClaimDay === 'string' ? p.lastClaimDay : null,
      stars: sanitizeStars(p.stars),
      spent: Math.max(0, num(p.spent, base.progress.spent)),
      skins: sanitizeSkins(p.skins),
      shapes: sanitizeOwned(p.shapes, DEFAULT_SHAPE),
      shape: typeof p.shape === 'string' && sanitizeOwned(p.shapes, DEFAULT_SHAPE).includes(p.shape) ? p.shape : DEFAULT_SHAPE,
      boards: sanitizeOwned(p.boards, DEFAULT_BOARD),
      board: typeof p.board === 'string' && sanitizeOwned(p.boards, DEFAULT_BOARD).includes(p.board) ? p.board : DEFAULT_BOARD,
      titles: sanitizeTitles(p.titles),
      title: typeof p.title === 'string' && sanitizeTitles(p.titles).includes(p.title) ? p.title : DEFAULT_TITLE,
      items: isRecord(p.items) ? sanitizeCounts(p.items) : base.progress.items,
      itemsUsed: sanitizeCounts(p.itemsUsed),
      upgrades: sanitizeCounts(p.upgrades),
      skin: typeof p.skin === 'string' && sanitizeSkins(p.skins).includes(p.skin) ? p.skin : DEFAULT_SKIN,
    },
    settings: {
      sound: typeof s.sound === 'boolean' ? s.sound : base.settings.sound,
      music: typeof s.music === 'boolean' ? s.music : base.settings.music,
      vibration: typeof s.vibration === 'boolean' ? s.vibration : base.settings.vibration,
    },
    onboarded: raw.onboarded === true,
  };
};

/** Pre-accounts progress, adopted once by whichever uid loads first. */
async function readLegacy(): Promise<SaveData | null> {
  const [level, coins, haptics] = await Promise.all([
    AsyncStorage.getItem(LEGACY.level),
    AsyncStorage.getItem(LEGACY.coins),
    AsyncStorage.getItem(LEGACY.haptics),
  ]);
  if (level === null && coins === null && haptics === null) return null;
  const save = freshSave();
  save.progress.unlocked = Math.max(1, Number(level) || 1);
  save.progress.coins = Number(coins) || 0;
  save.settings = { ...save.settings, vibration: haptics !== '0' };
  return save;
}

export async function loadLocalSave(uid: string): Promise<SaveData> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid));
    if (raw) return normalise(JSON.parse(raw));
    const legacy = await readLegacy();
    if (legacy) {
      await writeLocalSave(uid, legacy);
      await Promise.all(Object.values(LEGACY).map((key) => AsyncStorage.removeItem(key)));
      return legacy;
    }
  } catch {
    // A corrupt or unreadable save falls through to a fresh one.
  }
  return freshSave();
}

export async function writeLocalSave(uid: string, data: SaveData): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(uid), JSON.stringify(data));
  } catch {
    // Losing a save is better than crashing the game.
  }
}

// src/firebase/firestore.ts
//
// Cloud save for BattleGrid: one document per player.
//
//   players/{uid} — { playerId, displayName, avatarUrl, ranked, onboarded,
//                     firstSeenAt, lastSeenAt, progress: {...}, settings: {...} }
//
// Every player has a Firebase uid (anonymous or Play Games) from first
// launch, so a guest's progress is saved from the first battle. `onboarded`
// is naturally per-uid: a brand-new guest always gets a fresh uid and
// therefore a fresh, unonboarded document.
//
// @react-native-firebase/firestore keeps its own on-disk cache and queues
// writes while offline, so play still works without a connection.
//
// Loading returns null when the document could not be read. The caller must
// then NOT write to the cloud until a later load succeeds: writing a fresh
// default over a document we merely failed to read would erase real progress.

import { doc, getDoc, serverTimestamp, setDoc, DocumentData } from '@react-native-firebase/firestore';
import { db } from './config';
import { DEFAULT_BOARD, DEFAULT_SHAPE, DEFAULT_SKIN, DEFAULT_TITLE, Progress, emptyProgress, sanitizeCounts, sanitizeOwned, sanitizeSkins, sanitizeStars, sanitizeTitles } from '../progress';
import { DEFAULT_SETTINGS, SettingsValue } from '../settings';

const PLAYERS = 'players';

export type PlayerProfileFields = {
  displayName: string;
  avatarUrl: string | null;
  /** True once the player has a linked Play Games account, i.e. !isGuest. */
  ranked: boolean;
};

export type PlayerDoc = {
  progress: Progress;
  settings: SettingsValue;
  onboarded: boolean;
};

const numberOr = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const progressToDoc = (p: Progress) => ({
  coins: p.coins,
  unlocked: p.unlocked,
  wins: p.wins,
  losses: p.losses,
  streak: p.streak,
  bestStreak: p.bestStreak,
  lastClaimDay: p.lastClaimDay,
  // Firestore map keys are strings; sanitizeStars turns them back into level numbers on load.
  stars: p.stars,
  spent: p.spent,
  skins: p.skins,
  skin: p.skin,
  shapes: p.shapes,
  shape: p.shape,
  boards: p.boards,
  board: p.board,
  titles: p.titles,
  title: p.title,
  items: p.items,
  itemsUsed: p.itemsUsed,
  upgrades: p.upgrades,
});

const settingsToDoc = (s: SettingsValue) => ({
  sound: s.sound,
  music: s.music,
  vibration: s.vibration,
});

/** Maps a players/{uid} document back to a Progress, defaulting any missing
 *  or malformed field rather than rejecting the whole record. */
const docToProgress = (data: DocumentData): Progress => {
  const fresh = emptyProgress();
  const raw = (data.progress ?? {}) as Record<string, unknown>;
  return {
    coins: numberOr(raw.coins, fresh.coins),
    unlocked: Math.max(1, numberOr(raw.unlocked, fresh.unlocked)),
    wins: numberOr(raw.wins, fresh.wins),
    losses: numberOr(raw.losses, fresh.losses),
    streak: numberOr(raw.streak, fresh.streak),
    bestStreak: numberOr(raw.bestStreak, fresh.bestStreak),
    lastClaimDay: typeof raw.lastClaimDay === 'string' ? raw.lastClaimDay : null,
    stars: sanitizeStars(raw.stars),
    spent: Math.max(0, numberOr(raw.spent, fresh.spent)),
    skins: sanitizeSkins(raw.skins),
    shapes: sanitizeOwned(raw.shapes, DEFAULT_SHAPE),
    shape: typeof raw.shape === 'string' && sanitizeOwned(raw.shapes, DEFAULT_SHAPE).includes(raw.shape) ? raw.shape : DEFAULT_SHAPE,
    boards: sanitizeOwned(raw.boards, DEFAULT_BOARD),
    board: typeof raw.board === 'string' && sanitizeOwned(raw.boards, DEFAULT_BOARD).includes(raw.board) ? raw.board : DEFAULT_BOARD,
    titles: sanitizeTitles(raw.titles),
    title: typeof raw.title === 'string' && sanitizeTitles(raw.titles).includes(raw.title) ? raw.title : DEFAULT_TITLE,
    items: typeof raw.items === 'object' && raw.items !== null ? sanitizeCounts(raw.items) : fresh.items,
    itemsUsed: sanitizeCounts(raw.itemsUsed),
    upgrades: sanitizeCounts(raw.upgrades),
    skin: typeof raw.skin === 'string' && sanitizeSkins(raw.skins).includes(raw.skin) ? raw.skin : DEFAULT_SKIN,
  };
};

const docToSettings = (data: DocumentData): SettingsValue => {
  const raw = (data.settings ?? {}) as Record<string, unknown>;
  return {
    sound: typeof raw.sound === 'boolean' ? raw.sound : DEFAULT_SETTINGS.sound,
    music: typeof raw.music === 'boolean' ? raw.music : DEFAULT_SETTINGS.music,
    vibration: typeof raw.vibration === 'boolean' ? raw.vibration : DEFAULT_SETTINGS.vibration,
  };
};

/**
 * Loads this player's cloud save, creating players/{uid} the first time the
 * uid is ever seen. `seed` (the device's local save) becomes that first
 * document, so progress made offline or before Firebase was configured is
 * not lost. Returns null when Firebase is off or the read failed.
 */
export async function loadOrCreatePlayer(
  uid: string,
  profile: PlayerProfileFields,
  seed: PlayerDoc,
): Promise<PlayerDoc | null> {
  if (!db || !uid) return null;
  try {
    const ref = doc(db, PLAYERS, uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        playerId: uid,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        ranked: profile.ranked,
        onboarded: seed.onboarded,
        firstSeenAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        progress: progressToDoc(seed.progress),
        settings: settingsToDoc(seed.settings),
      });
      return seed;
    }
    const data = snap.data() ?? {};
    return {
      progress: docToProgress(data),
      settings: docToSettings(data),
      onboarded: data.onboarded === true,
    };
  } catch (err) {
    console.warn('[Firebase] loadOrCreatePlayer failed:', err);
    return null;
  }
}

/** A players/{uid} document counts as untouched if nothing has been played or
 *  claimed on it — what loadOrCreatePlayer's fresh-defaults path produces. */
const hasRealProgress = (data: DocumentData | undefined): boolean => {
  if (!data) return false;
  const p = docToProgress(data);
  return p.wins > 0 || p.losses > 0 || p.unlocked > 1 || p.streak > 0 || Object.keys(p.stars).length > 0 || p.spent > 0 || Object.keys(p.itemsUsed).length > 0;
};

/**
 * Called right after a guest's identity swaps to a different uid (a Play
 * Games sign-in that resolved to an existing account instead of linking). If
 * the destination account is untouched the guest's progress is adopted onto
 * it wholesale so nothing earned as a guest is lost. A destination that has
 * its own real progress is a genuine returning player: their history is what
 * they expect to see, so it is left alone and null is returned.
 */
export async function migrateGuestProgressIfFresh(
  newUid: string,
  guestProgress: Progress,
): Promise<PlayerDoc | null> {
  if (!db || !newUid) return null;
  try {
    const ref = doc(db, PLAYERS, newUid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : undefined;
    if (hasRealProgress(data)) return null;
    await setDoc(
      ref,
      {
        playerId: newUid,
        lastSeenAt: serverTimestamp(),
        onboarded: true,
        progress: progressToDoc(guestProgress),
      },
      { merge: true },
    );
    return {
      progress: guestProgress,
      settings: data ? docToSettings(data) : DEFAULT_SETTINGS,
      onboarded: true,
    };
  } catch (err) {
    console.warn('[Firebase] migrateGuestProgressIfFresh failed:', err);
    return null;
  }
}

async function merge(uid: string, fields: Record<string, unknown>, label: string): Promise<void> {
  if (!db || !uid) return;
  try {
    await setDoc(doc(db, PLAYERS, uid), { playerId: uid, lastSeenAt: serverTimestamp(), ...fields }, { merge: true });
  } catch (err) {
    console.warn(`[Firebase] ${label} failed:`, err);
  }
}

/** Persists a reducer's output. Called after every Progress change. */
export const savePlayerProgress = (uid: string, p: Progress) =>
  merge(uid, { progress: progressToDoc(p) }, 'savePlayerProgress');

/** Persists sound/music/vibration. Called after Settings' SAVE. */
export const savePlayerSettings = (uid: string, s: SettingsValue) =>
  merge(uid, { settings: settingsToDoc(s) }, 'savePlayerSettings');

/** Marks onboarding complete for this uid. */
export const markPlayerOnboarded = (uid: string) => merge(uid, { onboarded: true }, 'markPlayerOnboarded');

/** Keeps the profile fields (name, avatar, ranked status) current. */
export const savePlayerProfile = (uid: string, profile: PlayerProfileFields) =>
  merge(
    uid,
    { displayName: profile.displayName, avatarUrl: profile.avatarUrl, ranked: profile.ranked },
    'savePlayerProfile',
  );

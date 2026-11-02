// src/leaderboard.ts
//
// The global leaderboard: no Cloud Functions, just client-side writes + Firestore Security Rules
// as the anti-cheat layer (see firestore.rules's `leaderboard` match block).
//
// Collection `leaderboard`, one document per player per UTC day, id `${uid}_${dayKey}`:
//   { uid, name, score, dayKey, createdAt, photoURL?, country?, city?, countryCode? }
//
// `score` is BattleGrid's lifetime coins earned (progress.coins — already tracked as an
// only-grows total, so it is a natural fit for a field the rules require can never decrease).
// `dayKey` buckets by UTC day (src/dayKeys.ts) rather than storing one all-time document per
// player: Firestore requires an inequality/equality filter's field to be the one it sorts by
// first, so a single growing document updated in place would force every query to choose between
// filtering and ordering by score. Bucketing by day sidesteps that — each fetch below collapses
// a player's day-rows down to their best with `bestPerPlayer`.
//
// Reads are one-shot queries (getDocs), not real-time listeners, scoped by orderBy('score','desc')
// plus an optional where() for the Country/City tabs — those need a composite index the first
// time they run; Firestore's error message links straight to creating it in the console.

import {
  collection,
  doc,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  Query,
  runTransaction,
  serverTimestamp,
  where,
} from '@react-native-firebase/firestore';
import { db } from './firebase/config';
import { dayKeyOf } from './dayKeys';
import type { Geo } from './geo';

const LEADERBOARD = 'leaderboard';
const TOP_N = 50;
// A player can have several day-rows; overfetch so collapsing to one row per player still leaves TOP_N.
const OVERFETCH = TOP_N * 4;

export type LeaderboardEntry = {
  id: string;
  uid: string;
  name: string;
  score: number;
  dayKey: string;
  photoURL: string | null;
  country: string | null;
  city: string | null;
  countryCode: string | null;
  /** The id of an equipped src/shop.ts Title, or null for none. */
  title: string | null;
};

export type LeaderboardResult = {
  entries: LeaderboardEntry[];
  /** False when the server could not be reached at all, so the UI can tell that apart from "nobody's played yet". */
  online: boolean;
};

const numberOr = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const stringOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/**
 * Writes this player's score for today, never lowering what is already stored. Also used to keep
 * the stored name/photo/geo current even on a day the score does not improve (the transaction
 * still only writes when something actually changed). Every failure — offline, rules rejection,
 * Firebase unconfigured — is swallowed: a flaky network must never block or crash a battle result.
 */
export async function submitLeaderboardScore(
  score: number,
  name: string,
  uid: string | null,
  photoURL: string | null = null,
  geo: Geo | null = null,
  title: string | null = null,
): Promise<void> {
  if (!db || !uid || score <= 0) return;
  const dayKey = dayKeyOf(new Date());
  const ref = doc(db, LEADERBOARD, `${uid}_${dayKey}`);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const stored = snap.exists() ? (snap.data() as DocumentData) : null;
      const storedScore = numberOr(stored?.score, 0);
      const identityChanged =
        stored?.name !== name ||
        (photoURL !== null && stored?.photoURL !== photoURL) ||
        (geo !== null && stored?.country !== geo.country) ||
        (title !== null && (stored?.title ?? null) !== title);
      if (stored && score <= storedScore && !identityChanged) return; // nothing to do

      tx.set(ref, {
        uid,
        name,
        score: Math.max(score, storedScore),
        dayKey,
        createdAt: serverTimestamp(),
        ...(photoURL ? { photoURL } : {}),
        ...(geo ? { country: geo.country, city: geo.city, countryCode: geo.countryCode } : {}),
        ...(title ? { title } : {}),
      });
    });
  } catch (err) {
    console.warn('[Firebase] submitLeaderboardScore failed:', err);
  }
}

const mapDocs = (docs: DocumentData[]): LeaderboardEntry[] =>
  docs.map((d) => {
    const data = d.data() as DocumentData;
    return {
      id: d.id as string,
      uid: typeof data.uid === 'string' ? data.uid : '',
      name: typeof data.name === 'string' && data.name ? data.name : 'Player',
      score: numberOr(data.score, 0),
      dayKey: typeof data.dayKey === 'string' ? data.dayKey : '',
      photoURL: stringOrNull(data.photoURL),
      country: stringOrNull(data.country),
      city: stringOrNull(data.city),
      countryCode: stringOrNull(data.countryCode),
      title: stringOrNull(data.title),
    };
  });

/** Collapses multiple day-rows per player down to each player's best, highest score first, capped at TOP_N. */
export const bestPerPlayer = (entries: LeaderboardEntry[]): LeaderboardEntry[] => {
  const best = new Map<string, LeaderboardEntry>();
  for (const e of entries) {
    const key = e.uid || e.id;
    const seen = best.get(key);
    if (!seen || e.score > seen.score) best.set(key, e);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, TOP_N);
};

async function fetchScoped(scope?: (q: Query) => Query): Promise<LeaderboardResult> {
  if (!db) return { entries: [], online: false };
  try {
    let q: Query = query(collection(db, LEADERBOARD), orderBy('score', 'desc'), limit(OVERFETCH));
    if (scope) q = scope(q);
    const snap = await getDocs(q);
    return { entries: bestPerPlayer(mapDocs(snap.docs)), online: true };
  } catch (err) {
    console.warn('[Firebase] leaderboard fetch failed:', err);
    return { entries: [], online: false };
  }
}

export const fetchAllTimeLeaderboard = (): Promise<LeaderboardResult> => fetchScoped();

export const fetchCountryLeaderboard = (country: string): Promise<LeaderboardResult> =>
  fetchScoped((q) => query(q, where('country', '==', country)));

export const fetchCityLeaderboard = (city: string): Promise<LeaderboardResult> =>
  fetchScoped((q) => query(q, where('city', '==', city)));

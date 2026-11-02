// src/firebase/analytics.ts
//
// Google Analytics events: `login` when Play Games sign-in completes (per
// https://firebase.google.com/docs/android/integrate-play-games) and the
// standard `level_end` when a battle finishes.
//
// Same null-safe degrade pattern as config.ts: analytics is unavailable
// offline, on iOS without GoogleService-Info.plist, or when Firebase isn't
// configured at all, and every logger below is then a silent no-op instead
// of a throw.

import { getAnalytics, logEvent, logLogin, Analytics } from '@react-native-firebase/analytics';
import app, { isFirebaseConfigured } from './config';

let analytics: Analytics | null = null;
if (isFirebaseConfigured && app) {
  try {
    analytics = getAnalytics(app);
  } catch (err) {
    console.warn('[Firebase] Analytics initialisation failed:', err);
  }
}

export const logPlayGamesLogin = (): void => {
  if (!analytics) return;
  logLogin(analytics, { method: 'play_games' }).catch(() => {});
};

/** `stars` and `assisted` let us tune the star goals and the easier retry from real play. */
export const logLevelEnd = (level: number, won: boolean, stars = 0, assisted = false): void => {
  if (!analytics) return;
  logEvent(analytics, 'level_end', {
    level_name: `level_${level}`,
    success: won ? 1 : 0,
    stars,
    assisted: assisted ? 1 : 0,
  });
};

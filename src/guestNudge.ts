// src/guestNudge.ts
//
// Whether the one-time "sign in with Play Games to keep your progress" nudge (src/ui/BackupNudge.tsx) has
// already been shown on this device. Deliberately device-local, not part of Progress: it is UI chrome, not
// game state, and must never be synced or merged across devices (a player who dismissed it on one device
// should not be nagged again there, but a fresh install is exactly when the nudge should be free to show).

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@battlegrid/guestNudgeShown';

/** Wins before the nudge is offered: enough to show the game is worth keeping, before much could be lost. */
export const GUEST_NUDGE_AFTER_WINS = 3;

/** Fails closed (reports "already shown") so a broken store nags, at worst, never rather than every launch. */
export const wasGuestNudgeShown = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return true;
  }
};

export const markGuestNudgeShown = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Losing this marker just means the nudge might show once more — never worth crashing over.
  }
};

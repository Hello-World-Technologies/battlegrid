// src/settings.ts
//
// Sound / music / vibration. Persisted with the rest of the player's save
// (see src/save.ts), so they follow a signed-in player across devices.

export type SettingsValue = {
  /** Sound effects (captures, results, rewards). */
  sound: boolean;
  /** Menu and battle music loops. */
  music: boolean;
  /** Haptic feedback during battles. */
  vibration: boolean;
};

export const DEFAULT_SETTINGS: SettingsValue = {
  sound: true,
  music: true,
  vibration: true,
};

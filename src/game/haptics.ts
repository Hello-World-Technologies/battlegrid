import { Platform, Vibration } from 'react-native';

let enabled = true;

/** Android takes a pattern that starts with a delay; iOS only has one fixed-length buzz, so it skips light taps. */
function buzz(pattern: number | number[], strongOnIos: boolean) {
  if (!enabled) return;
  try {
    if (Platform.OS === 'ios') {
      if (strongOnIos) Vibration.vibrate();
    } else {
      Vibration.vibrate(Array.isArray(pattern) ? [0, ...pattern] : pattern);
    }
  } catch {
    // Vibration is optional.
  }
}

export const Haptics = {
  get on() {
    return enabled;
  },
  set(value: boolean) {
    enabled = value;
  },
  send: () => buzz(8, false),
  capture: () => buzz([18, 30, 18], true),
  lostTerritory: () => buzz(60, true),
  warning: () => buzz([25, 50, 25], false),
  win: () => buzz([30, 40, 30, 40, 80], true),
  lose: () => buzz(120, true),
  confirm: () => buzz(15, false),
};

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Progress {
  /** Highest level reachable (the next one to beat). */
  unlocked: number;
  coins: number;
  haptics: boolean;
}

const KEYS = { unlocked: 'bg.level', coins: 'bg.coins', haptics: 'bg.haptics' } as const;

export async function loadProgress(): Promise<Progress> {
  try {
    const [level, coins, haptics] = await Promise.all([
      AsyncStorage.getItem(KEYS.unlocked),
      AsyncStorage.getItem(KEYS.coins),
      AsyncStorage.getItem(KEYS.haptics),
    ]);
    return { unlocked: Number(level) || 1, coins: Number(coins) || 0, haptics: haptics !== '0' };
  } catch {
    return { unlocked: 1, coins: 0, haptics: true };
  }
}

export async function saveProgress(p: Partial<Progress>): Promise<void> {
  try {
    if (p.unlocked !== undefined) await AsyncStorage.setItem(KEYS.unlocked, String(p.unlocked));
    if (p.coins !== undefined) await AsyncStorage.setItem(KEYS.coins, String(p.coins));
    if (p.haptics !== undefined) await AsyncStorage.setItem(KEYS.haptics, p.haptics ? '1' : '0');
  } catch {
    // Losing a save is better than crashing the game.
  }
}

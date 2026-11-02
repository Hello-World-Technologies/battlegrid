// src/ui/TabBar.tsx
//
// The bottom navigation: a wooden plank floating above the bottom edge, with an icon and a label per tab. The
// active tab sits on a cream square with a brown edge; the rest are cream on the wood. A red dot marks a tab that
// has something waiting (the daily bonus).

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from '../audio';
import { useTheme } from '../theme';
import { FONT_BODY_BOLD } from './fonts';
import { NAV_GAP, NAV_HEIGHT, NAV_MARGIN, lift } from './tokens';

export type TabKey = 'battle' | 'levels' | 'shop' | 'daily' | 'profile' | 'settings';

const ICON = {
  battle: require('../../assets/ui/home.png'),
  shop: require('../../assets/ui/crown_a.png'),
  daily: require('../../assets/ui/medal1.png'),
  profile: require('../../assets/ui/multiplayer.png'),
  settings: require('../../assets/ui/gear.png'),
  levels: require('../../assets/ui/leaderboardsComplex.png'),
};

const LABEL: Record<TabKey, string> = {
  battle: 'Home',
  daily: 'Daily',
  profile: 'Profile',
  settings: 'Settings',
  levels: 'Levels',
  shop: 'Shop',
};

const ORDER: TabKey[] = ['battle', 'levels', 'shop', 'daily', 'profile', 'settings'];

type Props = {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
  /** Tabs showing a red dot. */
  badges?: TabKey[];
};

/** Total height including the gap and the safe-area inset, so screens can pad their content. */
export const useTabBarHeight = () => NAV_HEIGHT + NAV_GAP + useSafeAreaInsets().bottom + 8;

export default function TabBar({ active, onSelect, badges = [] }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { bottom: insets.bottom + NAV_GAP, backgroundColor: '#c98f4e', borderColor: theme.heroDeep }, lift(1.3)]}>
      {ORDER.map((key) => {
        const on = key === active;
        const color = on ? theme.ink : '#fff0cf';
        return (
          <Pressable
            key={key}
            onPress={() => {
              Audio.sfx('tap');
              onSelect(key);
            }}
            accessibilityRole="tab"
            accessibilityLabel={LABEL[key]}
            accessibilityState={{ selected: on }}
            style={[styles.tab, on && { backgroundColor: '#fff3d9', borderColor: theme.cardEdge, borderWidth: 2 }]}
          >
            <Image source={ICON[key]} style={[styles.icon, { tintColor: color }]} resizeMode="contain" />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {LABEL[key]}
            </Text>
            {badges.includes(key) ? <View style={[styles.dot, { backgroundColor: theme.red, borderColor: '#fff3d9' }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: NAV_MARGIN,
    right: NAV_MARGIN,
    height: NAV_HEIGHT,
    borderRadius: 18,
    borderWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    gap: 2,
  },
  tab: { flex: 1, height: NAV_HEIGHT - 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icon: { width: 21, height: 21 },
  label: { fontFamily: FONT_BODY_BOLD, fontSize: 9.5 },
  dot: { position: 'absolute', top: 6, right: '26%', width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
});

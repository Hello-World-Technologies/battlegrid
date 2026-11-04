// src/screens/Home.tsx
//
// The front door: a full-screen scene (a sky, with a big faded battle map of the level you are on behind it), the
// BattleGrid masthead, three wooden-plank buttons (PLAY, LEVELS, SHOP) and a row of square buttons for the Daily
// Bonus, your Profile and Settings. There is no tab bar here; every other screen has one to come back.
//
// The screen owns no game state: it renders what App gives it and reports taps back up.

import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBannerHeight } from '../ui/AdBanner';

import { ICONS } from '../icons';
import { PlayerProfile } from '../firebase/auth';
import { Progress, coinsLeft } from '../progress';
import { useTheme } from '../theme';
import CurrencyPill from '../ui/CurrencyPill';
import { Gradient } from '../ui/Gradient';
import { Pulse } from '../ui/HomeFx';
import HomeLevelMap from '../ui/HomeLevelMap';
import Logo from '../ui/Logo';
import { FONT_BODY_BOLD, FONT_DISPLAY } from '../ui/fonts';
import { SPACE, lift } from '../ui/tokens';

type Props = {
  player: PlayerProfile | null;
  progress: Progress;
  /** True when today's daily bonus is waiting to be claimed. */
  dailyReady: boolean;
  onPlay: () => void;
  onLevels: () => void;
  onShop: () => void;
  onDaily: () => void;
  onProfile: () => void;
  onSettings: () => void;
  onLeaderboard: () => void;
};

/** The three plank colours: fill, edge and the grain lines on it. */
const PLANKS = {
  play: { fill: '#e6bd72', edge: '#8a5a2b', grain: '#c99a50' },
  levels: { fill: '#a33a26', edge: '#5a1c10', grain: '#86301f' },
  shop: { fill: '#9ab53e', edge: '#52651a', grain: '#82a02e' },
} as const;

function Plank({
  kind,
  label,
  sublabel,
  width,
  onPress,
}: {
  kind: keyof typeof PLANKS;
  label: string;
  sublabel?: string;
  width: number;
  onPress: () => void;
}) {
  const c = PLANKS[kind];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}, ${sublabel}` : label}
      style={({ pressed }) => [
        styles.plank,
        { width, backgroundColor: c.fill, borderColor: c.edge, transform: [{ scale: pressed ? 0.97 : 1 }] },
        lift(1.2),
      ]}
    >
      <View style={[styles.grain, { top: 9, backgroundColor: c.grain }]} />
      <View style={[styles.grain, { bottom: 9, backgroundColor: c.grain }]} />
      <Text style={styles.plankText}>{label}</Text>
      {sublabel ? <Text style={styles.plankSub}>{sublabel}</Text> : null}
    </Pressable>
  );
}

function Square({
  icon,
  label,
  fill,
  badge,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  fill: string;
  badge?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ready` : label}
      style={({ pressed }) => [styles.square, { backgroundColor: fill, transform: [{ scale: pressed ? 0.94 : 1 }] }, lift(1)]}
    >
      {icon}
      {badge ? <View style={[styles.dot, { backgroundColor: theme.red }]} /> : null}
    </Pressable>
  );
}

export default function Home({ progress, dailyReady, onPlay, onLevels, onShop, onDaily, onProfile, onSettings, onLeaderboard }: Props) {
  const insets = useSafeAreaInsets();
  // Everything at the bottom sits above the ad banner while one is showing.
  const bottom = insets.bottom + useBannerHeight();
  const { width, height } = useWindowDimensions();
  const level = progress.unlocked;
  const plankW = Math.round(Math.min(width * 0.66, 300));

  return (
    <View style={styles.root}>
      <Gradient colors={['#8fc3e8', '#f3d3c0']} />
      {/* The battle map of the level you are on, large and faded behind everything. */}
      <View style={[StyleSheet.absoluteFill, styles.art]} pointerEvents="none">
        <HomeLevelMap level={level} width={width} height={height} dotScale={1.6} fill />
      </View>
      <View style={styles.veil} pointerEvents="none" />

      <View style={[styles.top, { paddingTop: insets.top + SPACE.md }]}>
        <CurrencyPill kind="coins" value={coinsLeft(progress)} size="sm" />
      </View>

      <View style={[styles.logo, { top: insets.top + height * 0.1 }]} pointerEvents="none">
        <Logo width={Math.min(width * 0.8, 300)} />
        <Text style={styles.tag}>PLAN · CONQUER · WIN</Text>
      </View>

      <View style={[styles.menu, { bottom: bottom + 92 + height * 0.06 }]}>
        <Pulse>
          <Plank kind="play" label="PLAY" sublabel={`LEVEL ${level}`} width={plankW} onPress={onPlay} />
        </Pulse>
        <Plank kind="levels" label="LEVELS" width={plankW} onPress={onLevels} />
        <Plank kind="shop" label="SHOP" width={plankW} onPress={onShop} />
      </View>

      <View style={[styles.row, { bottom: bottom + 20 }]}>
        <Square label="Daily bonus" fill="#e2a321" badge={dailyReady} onPress={onDaily} icon={<ICONS.gift size={24} color="#ffffff" />} />
        <Square label="Leaderboard" fill="#8a62b0" onPress={onLeaderboard} icon={<ICONS.trophy size={24} color="#ffffff" />} />
        <Square label="Profile" fill="#3f9d8f" onPress={onProfile} icon={<ICONS.person size={24} color="#ffffff" />} />
        <Square label="Settings" fill="#4a5d7a" onPress={onSettings} icon={<ICONS.settings size={24} color="#ffffff" />} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#8fc3e8' },
  art: { opacity: 0.5 },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.12)' },
  top: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: SPACE.lg },
  logo: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  tag: { marginTop: 4, fontSize: 15, letterSpacing: 2, fontFamily: FONT_BODY_BOLD, color: '#ffffff', textShadowColor: 'rgba(40,60,110,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  menu: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: SPACE.md + 2 },
  plank: { height: 58, borderRadius: 12, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  grain: { position: 'absolute', left: 14, right: 14, height: 2, borderRadius: 1 },
  plankText: { fontSize: 28, lineHeight: 32, fontFamily: FONT_DISPLAY, color: '#ffffff', textShadowColor: 'rgba(40,20,5,0.75)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 2 } },
  plankSub: { marginTop: -4, fontSize: 11, lineHeight: 13, fontFamily: FONT_BODY_BOLD, color: '#ffffff', opacity: 0.9, textShadowColor: 'rgba(40,20,5,0.7)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  row: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: SPACE.lg },
  square: { width: 58, height: 58, borderRadius: 12, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#ffffff' },
});

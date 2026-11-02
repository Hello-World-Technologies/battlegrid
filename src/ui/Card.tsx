// src/ui/Card.tsx
//
// Parchment panels with a chunky wood edge and a warm shadow (Caveboy-Escape style). `tone` picks the material:
//   panel — parchment (default); use `theme.ink` text on it
//   bonus — a pale yellow highlight
//   inset — a recessed tile for nested rows on a card
//   stage — the dark-wood hero panel; use `theme.heroText` on it

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { FONT_BODY_BOLD, FONT_DISPLAY } from './fonts';
import { FS, RADIUS, SPACE, lift } from './tokens';

export type CardTone = 'panel' | 'bonus' | 'inset' | 'stage';

type Props = {
  children: React.ReactNode;
  tone?: CardTone;
  padded?: boolean;
  radius?: number;
  /** Ease in on mount (a small rise and fade). On by default. */
  enter?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Card({ children, tone = 'panel', padded = true, radius = RADIUS.xl, enter = true, style }: Props) {
  const { theme } = useTheme();
  const pop = useRef(new Animated.Value(enter ? 0 : 1)).current;
  useEffect(() => {
    if (enter) Animated.timing(pop, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter, pop]);
  const face = tone === 'bonus' ? theme.softYellow : tone === 'inset' ? theme.cardAlt : tone === 'stage' ? theme.hero : theme.card;
  return (
    <Animated.View
      style={[
        { borderRadius: radius, backgroundColor: face, opacity: pop, transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
        tone === 'panel' || tone === 'bonus' ? [{ borderWidth: 3, borderColor: theme.cardEdge }, lift()] : null,
        tone === 'stage' ? { borderWidth: 3, borderColor: theme.heroDeep } : null,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Small spaced all-caps heading above a group of cards ("ACHIEVEMENTS"). */
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { theme } = useTheme();
  return <Text style={[styles.sectionLabel, { color: theme.dim }, style]}>{children}</Text>;
}

/** A labelled number tile: a big figure over a small caps caption. */
export function StatTile({
  label,
  value,
  color,
  icon,
  style,
}: {
  label: string;
  value: string | number;
  color?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.card, borderWidth: 3, borderColor: theme.cardEdge }, lift(0.8), style]}>
      {icon ? <View style={styles.statIcon}>{icon}</View> : null}
      <Text style={[styles.statValue, { color: color ?? theme.ink }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.inkSoft }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A small rounded pill of text: "CAMPAIGN", "+20 XP", "ONLINE". */
export function Chip({ label, tone = 'blue', style }: { label: string; tone?: 'blue' | 'yellow' | 'green' | 'red' | 'grey'; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  const p = {
    blue: [theme.softBlue, theme.blue],
    yellow: [theme.softYellow, '#8a5a00'],
    green: [theme.softGreen, theme.greenDeep],
    red: ['#f6d6cc', theme.redDeep],
    grey: [theme.cardAlt, theme.inkSoft],
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: p[0] }, style]}>
      <Text style={[styles.chipText, { color: p[1] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  padded: { padding: SPACE.lg },
  sectionLabel: { fontFamily: FONT_BODY_BOLD, fontSize: FS.cap, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: SPACE.sm, marginLeft: SPACE.xs },
  stat: { flex: 1, minWidth: 80, alignItems: 'center', paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm, borderRadius: RADIUS.lg },
  statIcon: { marginBottom: 2 },
  statValue: { fontSize: 22, fontFamily: FONT_DISPLAY },
  statLabel: { fontSize: FS.cap, fontFamily: FONT_BODY_BOLD, letterSpacing: 1.2, textTransform: 'uppercase' },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: FONT_BODY_BOLD, fontSize: FS.cap, letterSpacing: 0.6, textTransform: 'uppercase' },
});

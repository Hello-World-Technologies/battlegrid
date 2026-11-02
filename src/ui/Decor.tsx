// src/ui/Decor.tsx
//
// Small drawn pieces: the coin, the star, the chest, the trophy, the leaderboard medal
// and a slow bob for hero art. Coins and chests are built from views; stars are a
// rounded icon-font glyph (flat gold or pale grey-blue, as in png4); the trophy and the
// tutorial hand are CC0 icons from Kenney (assets/ui). Each piece takes a `size`.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleProp, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '../icons';
import { alpha, darken } from './color';
import { FONT_DISPLAY } from './fonts';
import { glow } from './tokens';

const GOLD = '#ffc21a';
const GOLD_LIGHT = '#ffe27a';
const GOLD_DEEP = '#c98a00';

/** Flat star colours from the png4 mockups. */
export const STAR_ON = '#f2a900';
export const STAR_OFF = '#d9dcee';

const IMG = {
  trophy: require('../../assets/ui/trophy.png'),
  hand: require('../../assets/ui/hand.png'),
};

/* ── Coin ───────────────────────────────────────────────────────────────── */

export function Coin({ size = 22, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const edge = Math.max(2, size * 0.09);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: GOLD,
          borderWidth: edge,
          borderColor: '#e08a00',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      pointerEvents="none"
    >
      <View
        style={{
          width: size * 0.56,
          height: size * 0.56,
          borderRadius: size * 0.28,
          backgroundColor: GOLD_LIGHT,
          borderWidth: Math.max(1.5, size * 0.07),
          borderColor: '#f0a000',
        }}
      />
    </View>
  );
}

/* ── Star ───────────────────────────────────────────────────────────────── */

export function Star({ size = 24, on = true, style }: { size?: number; on?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]} pointerEvents="none">
      <Ionicons name="star" size={size} color={on ? STAR_ON : STAR_OFF} />
    </View>
  );
}

/* ── Tutorial hand ──────────────────────────────────────────────────────── */

/** Pointing hand (Kenney cursor pack). Its fingertip is at the top-left of the box. */
export function Hand({ size = 56, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Image source={IMG.hand} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

/* ── Chest ──────────────────────────────────────────────────────────────── */

export function Chest({
  size = 56,
  open = false,
  style,
}: {
  size?: number;
  open?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const w = size;
  const h = size * 0.8;
  const lidH = h * 0.42;
  const line = Math.max(2, size * 0.05);
  const wood = '#b8641f';
  const woodDark = '#7a3e10';
  return (
    <View style={[{ width: w, height: h }, style]} pointerEvents="none">
      {open ? (
        <View
          style={{
            position: 'absolute',
            top: -size * 0.12,
            left: w * 0.12,
            right: w * 0.12,
            height: size * 0.4,
            borderRadius: size * 0.2,
            backgroundColor: alpha(GOLD, 0.9),
            ...glow(GOLD, 0.9, size * 0.4),
          }}
        />
      ) : null}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          width: w,
          height: h - lidH + line,
          borderRadius: size * 0.1,
          backgroundColor: wood,
          borderWidth: line,
          borderColor: woodDark,
        }}
      >
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: w * 0.22, width: line * 1.4, backgroundColor: GOLD_DEEP }} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, right: w * 0.22, width: line * 1.4, backgroundColor: GOLD_DEEP }} />
      </View>
      <View
        style={{
          position: 'absolute',
          top: open ? -lidH * 0.45 : 0,
          left: -size * 0.02,
          width: w + size * 0.04,
          height: lidH,
          borderTopLeftRadius: size * 0.3,
          borderTopRightRadius: size * 0.3,
          borderBottomLeftRadius: size * 0.06,
          borderBottomRightRadius: size * 0.06,
          backgroundColor: '#d47a2a',
          borderWidth: line,
          borderColor: woodDark,
          transform: open ? [{ rotate: '-12deg' }] : undefined,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: lidH - size * 0.07,
          left: w / 2 - size * 0.1,
          width: size * 0.2,
          height: size * 0.22,
          borderRadius: size * 0.05,
          backgroundColor: GOLD,
          borderWidth: line * 0.7,
          borderColor: GOLD_DEEP,
        }}
      />
    </View>
  );
}

/* ── Trophy ─────────────────────────────────────────────────────────────── */

export function Trophy({ size = 48, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Image source={IMG.trophy} style={{ width: size, height: size, tintColor: GOLD }} resizeMode="contain" />
    </View>
  );
}

/* ── Medal ──────────────────────────────────────────────────────────────── */

const MEDAL_COLORS: Record<number, string> = {
  1: '#ffc21a',
  2: '#d5dbe6',
  3: '#e0985a',
};

export function Medal({ place, size = 34 }: { place: number; size?: number }) {
  const color = MEDAL_COLORS[place] ?? MEDAL_COLORS[3];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: darken(color, 0.25),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.5, fontFamily: FONT_DISPLAY, color: darken(color, 0.55) }}>{place}</Text>
    </View>
  );
}

/* ── Motion ─────────────────────────────────────────────────────────────── */

/** Gentle vertical bob for hero art. Native-driven, so it costs nothing on the JS thread. */
export function Float({
  children,
  distance = 8,
  duration = 2600,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  distance?: number;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const easing = Easing.inOut(Easing.quad);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: duration / 2, delay, easing, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: duration / 2, easing, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] });

  return (
    <Animated.View style={[style, { transform: [{ translateY }] }]} pointerEvents="box-none">
      {children}
    </Animated.View>
  );
}

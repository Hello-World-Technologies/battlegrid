// src/ui/ResultBadge.tsx
//
// The picture at the top of the result screens (png4): a rounded map-thumbnail tile with a round
// medal on its corner, a gold crown for a win and a red cross for a loss. The thumbnail is an
// abstract little battlefield (grey land, white territories, one blue and one red), not a real
// map, so it never claims anything about the level just played.

import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import { ICONS } from '../icons';
import { useTheme } from '../theme';
import { lift } from './tokens';

const CROWN = require('../../assets/ui/crown_a.png');

// Land blobs and territories in a 100x100 box: [x, y, w, h, rotation].
const LAND: [number, number, number, number, number][] = [
  [-8, 10, 46, 34, -12],
  [30, -6, 40, 28, 14],
  [58, 18, 50, 36, -8],
  [4, 52, 52, 40, 10],
  [50, 58, 52, 46, -14],
  [24, 30, 36, 26, 6],
];
const NODES: [number, number][] = [
  [20, 22],
  [48, 12],
  [70, 34],
  [36, 44],
  [16, 66],
  [60, 70],
  [84, 62],
  [44, 82],
];

type Props = {
  tone: 'win' | 'loss';
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export default function ResultBadge({ tone, size = 128, style }: Props) {
  const { theme } = useTheme();
  const win = tone === 'win';
  const border = Math.round(size * 0.04);
  const inner = size - border * 2;
  const u = inner / 100;
  const land = win ? theme.mapLand : '#bdbdc4';
  const water = win ? theme.mapBg : '#d9d9de';
  const medal = Math.round(size * 0.43);

  return (
    <View style={[{ width: size + medal * 0.2, height: size + medal * 0.2 }, style]} pointerEvents="none">
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size * 0.3,
            borderWidth: border,
            borderColor: '#FFFFFF',
            backgroundColor: water,
            overflow: 'hidden',
          },
          lift(1.4),
        ]}
      >
        {LAND.map(([x, y, w, h, r], i) => (
          <View
            key={i}
            style={{ position: 'absolute', left: x * u, top: y * u, width: w * u, height: h * u, borderRadius: 12 * u, backgroundColor: land, transform: [{ rotate: `${r}deg` }] }}
          />
        ))}
        {NODES.map(([x, y], i) => {
          // One territory is yours (blue), one is the enemy's: on a win you hold the field, on a loss they do.
          const own = i === 5;
          const foe = i === 2;
          const face = own ? (win ? theme.region[1] : '#6f7480') : foe ? (win ? theme.region[2] : '#3d3f48') : '#FFFFFF';
          const r = (own || foe ? 8 : 6) * u;
          return (
            <View
              key={i}
              style={{ position: 'absolute', left: x * u - r, top: y * u - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: face }}
            />
          );
        })}
      </View>
      <View
        style={[
          {
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: medal,
            height: medal,
            borderRadius: medal / 2,
            borderWidth: Math.round(medal * 0.09),
            borderColor: '#FFFFFF',
            backgroundColor: win ? theme.gold : theme.red,
            alignItems: 'center',
            justifyContent: 'center',
          },
          lift(0.8),
        ]}
      >
        {win ? (
          <Image source={CROWN} style={{ width: medal * 0.62, height: medal * 0.62, tintColor: '#FFFFFF' }} resizeMode="contain" />
        ) : (
          <ICONS.close size={medal * 0.7} color="#FFFFFF" />
        )}
      </View>
    </View>
  );
}

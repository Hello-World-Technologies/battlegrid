// src/ui/Gradient.tsx
//
// Vertical gradients without a native gradient library: a stack of thin bands whose colours are interpolated.
// `HeroPanel` is the deep-blue rounded panel of png4 (the streak card, the profile header): a gradient with an
// optional soft glow, clipped to its radius, with its children on top.

import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { alpha, mix } from './color';

type GradientProps = {
  /** Top and bottom colours. */
  colors: [string, string];
  /** How many bands to draw (more = smoother). */
  steps?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/** A gradient filling its parent. Put it first inside a view with `overflow: 'hidden'`. */
export function Gradient({ colors, steps = 24, style, children }: GradientProps) {
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {Array.from({ length: steps }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: mix(colors[0], colors[1], steps === 1 ? 0 : i / (steps - 1)) }} />
      ))}
      {children}
    </View>
  );
}

type HeroProps = {
  colors: [string, string];
  radius?: number;
  /** A soft light blob in the corner (`glow` colour), as behind the streak flame. */
  glow?: string;
  /** Only round the bottom corners (the profile header runs off the top of the screen). */
  bottomOnly?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function HeroPanel({ colors, radius = 28, glow, bottomOnly = false, style, children }: HeroProps) {
  const corners: ViewStyle = bottomOnly
    ? { borderBottomLeftRadius: radius, borderBottomRightRadius: radius }
    : { borderRadius: radius };
  return (
    <View style={[{ overflow: 'hidden' }, corners, style]}>
      <Gradient colors={colors} />
      {glow
        ? [1, 0.7, 0.4].map((k, i) => (
            <View
              key={k}
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: -60 + i * 40,
                top: -40 + i * 30,
                width: 260 * k,
                height: 260 * k,
                borderRadius: 130 * k,
                backgroundColor: alpha(glow, 0.1 + i * 0.07),
              }}
            />
          ))
        : null}
      {children}
    </View>
  );
}

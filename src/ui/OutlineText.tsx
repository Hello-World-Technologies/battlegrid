// src/ui/OutlineText.tsx
//
// Display type for titles: the chunky Lilita One face in cream with a thick dark-brown outline, like the Caveboy-Escape
// logo. The outline is drawn as copies of the text pushed out in eight directions under the letters, so it works
// without any native module. Pass `color` for another fill, `outline` for another edge and `thickness` for its width.

import React from 'react';
import { StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { FONT_DISPLAY } from './fonts';

type Props = {
  children: React.ReactNode;
  size?: number;
  color?: string;
  outline?: string;
  thickness?: number;
  style?: StyleProp<TextStyle>;
  wrapStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;
};

const OFFSETS: [number, number][] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7],
];

export default function OutlineText({ children, size = 24, color, outline, thickness, style, wrapStyle, numberOfLines = 1 }: Props) {
  const { theme } = useTheme();
  const t = thickness ?? Math.max(2, Math.round(size / 10));
  const base: TextStyle = { fontFamily: FONT_DISPLAY, fontSize: size, textAlign: 'center', includeFontPadding: false };
  return (
    <View style={wrapStyle}>
      {/* The outline: the same text in the edge colour, pushed out in every direction. */}
      {OFFSETS.map(([dx, dy], i) => (
        <Text
          key={i}
          numberOfLines={numberOfLines}
          accessible={false}
          importantForAccessibility="no"
          style={[base, style, { position: 'absolute', left: dx * t, top: dy * t, right: -dx * t, color: outline ?? theme.outline }]}
        >
          {children}
        </Text>
      ))}
      <Text numberOfLines={numberOfLines} style={[base, style, { color: color ?? '#fff6df' }]}>
        {children}
      </Text>
    </View>
  );
}

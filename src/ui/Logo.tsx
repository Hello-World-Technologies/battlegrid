// src/ui/Logo.tsx
//
// The BattleGrid game logo (assets/ui/logo.png: transparent, cropped to the artwork, 1027x821).
// Replaces the old text-only Wordmark; size it by `width`, the height follows the artwork's ratio.

import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const SOURCE = require('../../assets/ui/logo.png');
const RATIO = 1027 / 821;

type Props = {
  /** Rendered width in dp. */
  width: number;
  style?: StyleProp<ImageStyle>;
};

export default function Logo({ width, style }: Props) {
  return (
    <Image
      source={SOURCE}
      accessibilityRole="image"
      accessibilityLabel="BattleGrid"
      resizeMode="contain"
      style={[{ width, height: width / RATIO }, style]}
    />
  );
}

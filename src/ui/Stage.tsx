// src/ui/Stage.tsx
//
// The screen background behind menu screens: a cartoon sky (blue fading to peach) with soft hills at the bottom.
// `hero` adds a pale sun glow near the top, behind hero art; `plain` is just the sky, for list screens.

import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../theme';
import { alpha } from './color';
import { Gradient } from './Gradient';

type Props = {
  variant?: 'hero' | 'plain';
  children?: React.ReactNode;
};

export default function Stage({ variant = 'hero', children }: Props) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const size = width * 1.5;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]} pointerEvents="none">
      <Gradient colors={['#9fcdf0', '#f7dcc4']} />
      <View style={{ position: 'absolute', bottom: -width * 0.55, left: -width * 0.3, width: width * 1.1, height: width * 1.1, borderRadius: width * 0.55, backgroundColor: alpha('#9ab53e', 0.28) }} />
      <View style={{ position: 'absolute', bottom: -width * 0.7, right: -width * 0.4, width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, backgroundColor: alpha('#7a9a32', 0.3) }} />
      {variant === 'hero' ? (
        <View
          style={{
            position: 'absolute',
            top: -size * 0.62,
            left: (width - size) / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: alpha('#fff4cc', 0.35),
          }}
        />
      ) : null}
      {children}
    </View>
  );
}

// src/ui/ProgressBar.tsx
//
// A soft rounded bar: a pale track with a coloured fill that animates to its new value. Used for level
// progress, the streak and the splash loader. On a deep-blue panel pass `track` for a translucent one.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { alpha } from './color';
import { FONT_BODY } from './fonts';

type Props = {
  /** 0–1. Values outside the range are clamped. */
  value: number;
  color?: string;
  /** Track colour; defaults to a pale blue-grey. */
  track?: string;
  height?: number;
  /** Shows `current/target` inside the bar. */
  caption?: string;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function ProgressBar({ value, color, track, height = 8, caption, animated = true, style }: Props) {
  const { theme } = useTheme();
  const fill = color ?? theme.green;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const anim = useRef(new Animated.Value(animated ? 0 : clamped)).current;
  const radius = height / 2;

  useEffect(() => {
    if (!animated) {
      anim.setValue(clamped);
      return;
    }
    Animated.timing(anim, { toValue: clamped, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [clamped, anim, animated]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[styles.track, { height, borderRadius: radius, backgroundColor: track ?? theme.cardDeep }, style]}>
      <Animated.View style={[styles.fillWrap, { width }]}>
        <View style={[styles.fill, { backgroundColor: fill, borderRadius: radius }]} />
        <View style={[styles.sheen, { backgroundColor: alpha('#FFFFFF', 0.28) }]} />
      </Animated.View>

      {caption ? (
        <View style={styles.captionWrap} pointerEvents="none">
          <Text style={[styles.caption, { color: theme.ink }]}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden', justifyContent: 'center' },
  fillWrap: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  fill: { flex: 1, minWidth: 6 },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%' },
  captionWrap: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  caption: { fontSize: 10, fontFamily: FONT_BODY, letterSpacing: 0.6 },
});

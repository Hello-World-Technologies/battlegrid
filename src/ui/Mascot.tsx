// src/ui/Mascot.tsx
//
// The water sprite, our mascot (a still rendered from the 3D model: assets/ui/shape_sprite.png). It springs in, then
// idles: a happy one bobs on the spot, a sad one leans over and sways slowly. Transform and opacity only, on the
// native driver, and it is decoration: it takes no touches and is hidden from screen readers.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

const SOURCE = require('../../assets/ui/shape_sprite.png');

type Props = {
  /** Width and height in dp (the picture is square). */
  size?: number;
  mood?: 'happy' | 'sad';
  /** Delay before it springs in, in ms. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Mascot({ size = 96, mood = 'happy', delay = 200, style }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const happy = mood === 'happy';

  useEffect(() => {
    const easing = Easing.inOut(Easing.quad);
    const half = happy ? 520 : 1400;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration: half, easing, useNativeDriver: true }),
        Animated.timing(idle, { toValue: 0, duration: half, easing, useNativeDriver: true }),
      ]),
    );
    const run = Animated.sequence([Animated.delay(delay), Animated.spring(enter, { toValue: 1, friction: 5, tension: 110, useNativeDriver: true }), loop]);
    run.start();
    return () => run.stop();
  }, [enter, idle, delay, happy]);

  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const opacity = enter.interpolate({ inputRange: [0, 0.3], outputRange: [0, happy ? 1 : 0.92], extrapolate: 'clamp' });
  // Happy: hop up a few dp. Sad: lean to one side and sway a little.
  const hop = idle.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.07] });
  const sway = idle.interpolate({ inputRange: [0, 1], outputRange: happy ? ['-2deg', '3deg'] : ['-14deg', '-8deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size, opacity, transform: [{ translateY: happy ? hop : 0 }, { rotate: sway }, { scale }] }, style]}
    >
      <Animated.Image source={SOURCE} resizeMode="contain" style={{ width: size, height: size }} />
    </Animated.View>
  );
}

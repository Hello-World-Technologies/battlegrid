// src/screens/DailyPulse.tsx
//
// Two small, native-driver loops for the Daily screen: a gentle pulse for the one primary action (only while it
// can be pressed) and a slow flicker for the streak flame.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

/** Scales its child 1 -> 1.03 -> 1 about every 1.6 s while `active`. */
export function Pulse({
  active,
  children,
  style,
}: {
  active: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.setValue(0);
      return;
    }
    const easing = Easing.inOut(Easing.quad);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, easing, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 800, easing, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** A flame that breathes: a slow scale and a tiny sway. */
export function Flicker({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const easing = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 700, easing, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });
  return <Animated.View style={[style, { transform: [{ scale }, { rotate }] }]}>{children}</Animated.View>;
}

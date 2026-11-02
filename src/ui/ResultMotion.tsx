// src/ui/ResultMotion.tsx
//
// Small one-shot / slow-loop motion helpers for the result, pause, onboarding and splash screens.
// Everything runs on the native driver (transform + opacity only), so it costs nothing on the JS thread:
//   PopIn    — spring scale-in (stars, badges)
//   SlideUp  — rise and fade in (stat tiles)
//   Pulse    — the one primary call-to-action breathes, scale 1 to 1.03 and back

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

type BaseProps = { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> };

/** Springs from `from` to full size (with a little overshoot) and fades in. */
export function PopIn({ children, delay = 0, from = 0.4, style }: BaseProps & { from?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, friction: 4.5, tension: 120, useNativeDriver: true })]);
    a.start();
    return () => a.stop();
  }, [v, delay]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [from, 1] });
  const opacity = v.interpolate({ inputRange: [0, 0.25], outputRange: [0, 1], extrapolate: 'clamp' });
  return <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>;
}

/** Rises `distance` dp into place while fading in. */
export function SlideUp({ children, delay = 0, distance = 22, style }: BaseProps & { distance?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 340, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true })]);
    a.start();
    return () => a.stop();
  }, [v, delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] });
  const opacity = v.interpolate({ inputRange: [0, 0.5], outputRange: [0, 1], extrapolate: 'clamp' });
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** A gentle 1.6 s breathing loop for the screen's primary button. */
export function Pulse({ children, delay = 0, enabled = true, style }: BaseProps & { enabled?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) {
      v.setValue(0);
      return undefined;
    }
    const easing = Easing.inOut(Easing.quad);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, easing, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 800, easing, useNativeDriver: true }),
      ]),
    );
    const start = Animated.sequence([Animated.delay(delay), loop]);
    start.start();
    return () => start.stop();
  }, [v, delay, enabled]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}

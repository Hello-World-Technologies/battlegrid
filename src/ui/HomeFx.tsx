// src/ui/HomeFx.tsx
//
// Small game-feel pieces for Home and Levels. Everything is Animated with the native driver, runs
// once or very slowly, and costs nothing on the JS thread.
//   Pulse    - the one call-to-action of a screen breathes (scale 1 to 1.03 and back)
//   Flicker  - a flame that flickers
//   PopStar  - a star that springs in (scale 0.4 to 1); empty stars stay still

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { Star } from './Decor';

export function Pulse({
  children,
  active = true,
  style,
}: {
  children: React.ReactNode;
  active?: boolean;
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

export function Flicker({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const easing = Easing.inOut(Easing.sin);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 520, easing, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.3, duration: 340, easing, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.8, duration: 420, easing, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 520, easing, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  const scaleY = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const scaleX = v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  return <Animated.View style={{ transform: [{ scaleX }, { scaleY }] }}>{children}</Animated.View>;
}

export function PopStar({ size, on, delay = 0 }: { size: number; on: boolean; delay?: number }) {
  const v = useRef(new Animated.Value(on ? 0 : 1)).current;
  useEffect(() => {
    if (!on) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    Animated.spring(v, { toValue: 1, delay, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, [on, delay, v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ scale }] }}>
      <Star size={size} on={on} />
    </Animated.View>
  );
}

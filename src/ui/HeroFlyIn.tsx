// src/ui/HeroFlyIn.tsx
//
// The wordmark art (assets/art/splash_hero_title.png) sweeping onto the splash screen: it swoops in from
// off-screen top right, banking level as it settles, then idles with a small hover bob — the same
// spring-in-then-idle shape as Mascot, just with a directional entrance. Transform and opacity only, on the native
// driver; decoration only, so it takes no touches and is hidden from screen readers.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleProp, ViewStyle } from 'react-native';

const SOURCE = require('../../assets/art/splash_hero_title.png');
/** Natural aspect ratio of splash_hero_title.png (1027 x 821). */
const ASPECT = 1027 / 821;

type Props = {
  /** Width in dp; height follows the art's own aspect ratio. */
  width: number;
  /** Delay before the swoop starts, in ms. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

export default function HeroFlyIn({ width, delay = 300, style }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const height = width / ASPECT;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(idle, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const run = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(enter, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
      loop,
    ]);
    run.start();
    return () => run.stop();
  }, [enter, idle, delay]);

  const translateX = enter.interpolate({ inputRange: [0, 1], outputRange: [width * 0.9, 0] });
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [-height * 0.6, 0] });
  const rotate = enter.interpolate({ inputRange: [0, 1], outputRange: ['22deg', '0deg'] });
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const opacity = enter.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const hop = idle.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.025] });

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, opacity, transform: [{ translateX }, { translateY: Animated.add(translateY, hop) }, { rotate }, { scale }] },
        style,
      ]}
    >
      <Image source={SOURCE} resizeMode="contain" style={{ width, height }} />
    </Animated.View>
  );
}

// src/screens/Splash.tsx
//
// The opening scene: the bright battle key art (SplashScene — the wordmark flying in over the siege
// scene) with a wooden loading bar over it, anchored near the bottom of the art.
//
// Timing contract: the bar fills for SPLASH_MS, then the screen fades out and calls onDone() exactly once.
//
// Driver split:
//   root  Animated.View → fade-out opacity          (useNativeDriver: true)
//   fill  Animated.View → bar width                 (useNativeDriver: false)

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SplashScene, { CTA_TOP } from '../ui/SplashScene';
import { FONT_DISPLAY } from '../ui/fonts';
import { SPACE } from '../ui/tokens';

/** How long the loading bar takes to fill, which is how long the splash shows. */
const SPLASH_MS = 6000;

type Props = { onDone: () => void };

export default function Splash({ onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const barWidth = Math.min(width * 0.6, 280);

  // native-driver value
  const fade = useRef(new Animated.Value(1)).current;

  // JS-driver value (width cannot be driven natively)
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: SPLASH_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onDone());
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const barW = progress.interpolate({ inputRange: [0, 1], outputRange: [0, barWidth - 6] });

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <SplashScene />

      <View style={[styles.loadingWrap, { top: height * CTA_TOP, paddingBottom: insets.bottom }]}>
        <View style={[styles.track, { width: barWidth }]}>
          <Animated.View style={[styles.fill, { width: barW }]} />
        </View>
        <Text style={styles.loadingLabel}>Plan · Conquer · Win</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#4fa8e8' },
  loadingWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: SPACE.md },
  track: { height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#0d3c7a', backgroundColor: '#123a6b', padding: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 8, backgroundColor: '#3fb6f6' },
  loadingLabel: {
    fontSize: 16,
    fontFamily: FONT_DISPLAY,
    letterSpacing: 0.5,
    color: '#ffffff',
    textShadowColor: 'rgba(20,50,90,0.7)',
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 2 },
  },
});

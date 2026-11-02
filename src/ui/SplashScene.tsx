// src/ui/SplashScene.tsx
//
// The splash screen's artwork: the wordmark lockup flying in over a painted battle-scene backdrop
// (assets/art/splash_action_background.jpg; see assets/CREDITS.md) that supplies its own sky, castle,
// armies and mountains — none of that is drawn separately in code. It fills the screen behind Splash's
// tagline and loading bar.
//
// Layout is fractions of the window size, computed once per size change, so it holds up across phone
// aspect ratios. `CTA_TOP` is exported so Splash can anchor its loading bar near the bottom of the art.

import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import HeroFlyIn from './HeroFlyIn';

const BACKGROUND = require('../../assets/art/splash_action_background.jpg');

/** width / height of the full-scene background art (assets/art/splash_action_background.jpg). */
const BACKGROUND_ASPECT = 899 / 1600;

/** Where Splash should anchor its loading bar, as a fraction of screen height. */
export const CTA_TOP = 0.86;

export default function SplashScene() {
  const { width: W, height: H } = useWindowDimensions();

  // Fill the screen edge-to-edge top-to-bottom (no letterbox bars); the art's own aspect ratio is
  // close to a phone screen's, so this crops a little off the left/right edges, centered.
  const bgWidth = H * BACKGROUND_ASPECT;
  const bgLeft = (W - bgWidth) / 2;

  const heroWidth = W * 0.72;
  const heroTop = H * 0.11;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={BACKGROUND} resizeMode="cover" style={{ position: 'absolute', left: bgLeft, top: 0, width: bgWidth, height: H }} />

      {/* Wordmark, flying in over the battle scene */}
      <HeroFlyIn width={heroWidth} style={{ position: 'absolute', left: (W - heroWidth) / 2, top: heroTop }} />
    </View>
  );
}

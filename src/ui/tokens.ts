// src/ui/tokens.ts
//
// Layout constants shared by every screen. Colours live in the theme; sizes,
// radii, type scale and glow recipes live here so spacing stays consistent
// and no screen invents its own scale.

import { Platform, TextStyle, ViewStyle } from 'react-native';

export const SPACE = {
  xs: 3,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  xxxl: 32,
} as const;

/**
 * The type scale (dp). Every screen uses ONLY these sizes, so text stays small, clean and consistent.
 * Display = Lilita One (titles, big numbers, button labels); everything else Poppins.
 */
export const FS = {
  /** Big hero numbers (a streak, the people you rule). */
  hero: 38,
  /** Screen titles. */
  title: 26,
  /** Card and row titles. */
  h2: 17,
  /** Stat numbers and button labels. */
  h3: 15,
  body: 13,
  small: 11.5,
  /** Caps captions and chips. */
  cap: 10,
} as const;

/** Large, soft corners (png4): cards read as friendly sheets, buttons as pills. */
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
  pill: 999,
} as const;

/** Display type is chunky (Lilita One, single weight); body type is Poppins. */
export const TYPE = {
  display: { fontSize: 40, letterSpacing: 1 } as TextStyle,
  title: { fontSize: 28, letterSpacing: 0.8 } as TextStyle,
  heading: { fontSize: 20, letterSpacing: 0.6 } as TextStyle,
  label: { fontSize: 13, fontWeight: '700', letterSpacing: 1 } as TextStyle,
  body: { fontSize: 14, fontWeight: '600' } as TextStyle,
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8 } as TextStyle,
} as const;

/**
 * A soft glow in the element's own colour. Shadows tint only on iOS; Android
 * draws elevation in grey, so callers there get no glow rather than a grey slab.
 */
export const shadow = (
  color: string,
  opacity = 0.5,
  radius = 14,
  offsetY = 0,
  elevation = 0,
): ViewStyle => ({
  shadowColor: color,
  shadowOpacity: opacity,
  shadowRadius: radius,
  shadowOffset: { width: 0, height: offsetY },
  elevation,
});

export const glow = (color: string, opacity = 0.45, radius = 16): ViewStyle =>
  shadow(color, opacity, radius, 0, 0);

/** Android draws elevation shadows in grey; tinted glows are iOS-only. */
export const canTintShadow = Platform.OS === 'ios';

/** Height reserved for the bottom tab bar, excluding the safe-area inset. */
/** The tab bar is a floating pill: its height, the gap under it, and the side margin. */
export const NAV_HEIGHT = 62;
export const NAV_GAP = 10;
export const NAV_MARGIN = 12;

/** The warm brown drop shadow under panels and planks. Android draws it as elevation. */
export const lift = (strength = 1): ViewStyle => ({
  shadowColor: '#3b1f0d',
  shadowOpacity: 0.16 * strength,
  shadowRadius: 14 * strength,
  shadowOffset: { width: 0, height: 4 * strength },
  elevation: Math.round(3 * strength),
});

export const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

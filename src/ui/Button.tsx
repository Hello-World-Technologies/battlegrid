// src/ui/Button.tsx
//
// Wooden-plank buttons in the Caveboy-Escape style: a chunky face with a dark edge, two faint grain lines and a
// darker slab under it (the thickness). Pressing sinks the face into the slab. Labels are display type with a dark
// shadow, white on the coloured planks and dark brown on the tan and cream ones.

import React, { useRef } from 'react';
import {
  AccessibilityRole,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Audio } from '../audio';
import { useTheme, type Theme } from '../theme';
import { alpha, darken } from './color';
import { FONT_DISPLAY } from './fonts';
import { SPACE, lift } from './tokens';

export type ButtonTone = 'green' | 'blue' | 'orange' | 'purple' | 'red' | 'gold' | 'light' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

const SIZES: Record<ButtonSize, { height: number; font: number; pad: number; gap: number; slab: number }> = {
  sm: { height: 34, font: 14, pad: SPACE.md, gap: 5, slab: 3 },
  md: { height: 44, font: 17, pad: SPACE.lg, gap: 6, slab: 4 },
  lg: { height: 54, font: 22, pad: SPACE.xl, gap: 8, slab: 5 },
};

type Props = {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  size?: ButtonSize;
  /** Rendered before the label — an icon element, usually. */
  icon?: React.ReactNode;
  /** Rendered after the label. */
  trailing?: React.ReactNode;
  /** Small second line under the label, e.g. "LEVEL 5". */
  sublabel?: string;
  disabled?: boolean;
  busy?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

export default function Button({
  label,
  onPress,
  tone = 'green',
  size = 'md',
  icon,
  trailing,
  sublabel,
  disabled = false,
  busy = false,
  fullWidth = false,
  style,
  labelStyle,
  accessibilityLabel,
}: Props) {
  const { theme } = useTheme();
  const dims = SIZES[size];
  const press = useRef(new Animated.Value(0)).current;
  const palette = tonePalette(tone, theme);
  const inactive = disabled || busy;
  const height = sublabel ? dims.height + dims.font * 0.55 : dims.height;
  const radius = Math.min(height / 2, 14);

  const animate = (to: number) =>
    Animated.timing(press, {
      toValue: to,
      duration: to === 1 ? 70 : 130,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, dims.slab - 1] });
  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] });

  const handlePress = () => {
    Audio.sfx('tap');
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy }}
      style={[fullWidth && styles.fullWidth, { opacity: disabled ? 0.5 : 1 }, style]}
    >
      <View style={{ height: height + dims.slab, borderRadius: radius, backgroundColor: palette.deep }}>
        <Animated.View
          style={[
            styles.face,
            { height, borderRadius: radius, paddingHorizontal: dims.pad, backgroundColor: palette.face, borderColor: palette.deep, transform: [{ translateY }, { scale }] },
          ]}
        >
          <View style={[styles.grain, { top: 5, backgroundColor: palette.grain }]} />
          <View style={[styles.grain, { bottom: 5, backgroundColor: palette.grain }]} />
          <View style={[styles.content, { gap: dims.gap }]}>
            {busy ? (
              <ActivityIndicator color={palette.labelColor} size="small" />
            ) : (
              <>
                {icon}
                <View style={styles.labels}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                    style={[{ fontFamily: FONT_DISPLAY, fontSize: dims.font, color: palette.labelColor }, palette.shadow ? styles.labelShadow : null, labelStyle]}
                  >
                    {label}
                  </Text>
                  {sublabel ? (
                    <Text style={[styles.sub, { color: alpha(palette.labelColor, 0.85) }]} numberOfLines={1}>
                      {sublabel}
                    </Text>
                  ) : null}
                </View>
                {trailing}
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** A square wooden icon button: the back arrow in headers, the pause button. */
export function IconButton({
  children,
  onPress,
  label,
  size = 38,
  tone = 'light',
  disabled,
  style,
  accessibilityRole = 'button',
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  size?: number;
  tone?: 'light' | 'blue';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityRole?: AccessibilityRole;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Audio.sfx('tap');
        onPress();
      }}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      hitSlop={10}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size * 0.28,
            borderWidth: 3,
            borderColor: tone === 'blue' ? theme.blueDeep : theme.goldDeep,
            backgroundColor: tone === 'blue' ? theme.blue : theme.gold,
            alignItems: 'center',
            justifyContent: 'center',
          },
          lift(0.8),
        ]}
      >
        {children}
      </View>
    </Pressable>
  );
}

function tonePalette(tone: ButtonTone, theme: Theme) {
  const plank = (face: string, deep: string, labelColor = '#FFFFFF') => ({
    face,
    deep,
    labelColor,
    grain: darken(face, 0.12),
    shadow: labelColor === '#FFFFFF',
  });
  switch (tone) {
    case 'blue':
      return plank(theme.blue, theme.blueDeep);
    case 'orange':
      return plank(theme.orange, theme.orangeDeep);
    case 'purple':
      return plank(theme.purple, theme.purpleDeep);
    case 'red':
      return plank(theme.red, theme.redDeep);
    case 'gold':
      return plank(theme.gold, theme.goldDeep, theme.ink);
    case 'light':
      return plank('#f6dfa6', theme.goldDeep, theme.ink);
    case 'soft':
      return plank('#fbeccb', '#c9a566', theme.ink);
    case 'green':
    default:
      return plank(theme.green, theme.greenDeep);
  }
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  face: { justifyContent: 'center', overflow: 'hidden', borderWidth: 3 },
  grain: { position: 'absolute', left: 12, right: 12, height: 2, borderRadius: 1 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  labels: { alignItems: 'center' },
  sub: { fontFamily: FONT_DISPLAY, fontSize: 10.5, letterSpacing: 0.8, marginTop: -1 },
  labelShadow: { textShadowColor: 'rgba(40,20,5,0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
});

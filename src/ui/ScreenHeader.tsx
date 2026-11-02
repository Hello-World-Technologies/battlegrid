// src/ui/ScreenHeader.tsx
//
// Back button · outlined title · optional right slot. Every secondary screen uses
// this, so headers cannot drift apart.

import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICONS } from '../icons';
import { useTheme } from '../theme';
import { IconButton } from './Button';
import { FONT_DISPLAY } from './fonts';
import OutlineText from './OutlineText';
import { SPACE } from './tokens';

type Props = {
  title: string;
  onBack?: () => void;
  /** Rendered on the right; a spacer keeps the title centred when absent. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function ScreenHeader({ title, onBack, right, style }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + SPACE.md }, style]}>
      {onBack ? (
        <IconButton onPress={onBack} label="Back" style={styles.back}>
          <ICONS.back size={22} color={theme.ink} />
        </IconButton>
      ) : null}

      <View style={styles.titleWrap}>
        <OutlineText size={26} wrapStyle={styles.titleBox} style={styles.titleText}>
          {title}
        </OutlineText>
      </View>

      {right ? <View style={styles.rightSide}>{right}</View> : null}
    </View>
  );
}

/** Plain display type for headings on panels. */
export function Title({
  children,
  size = 22,
  color,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { theme } = useTheme();
  return (
    <Text style={[{ fontFamily: FONT_DISPLAY, fontSize: size, color: color ?? theme.ink }, style]} numberOfLines={1}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.sm,
  },
  back: { marginRight: SPACE.md },
  rightSide: { alignItems: 'flex-end', marginLeft: SPACE.md },
  titleWrap: { flex: 1 },
  titleBox: { alignItems: 'flex-start' },
  titleText: { textAlign: 'left' },
});

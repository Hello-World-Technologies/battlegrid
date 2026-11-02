// src/ui/Dialog.tsx
//
// The dialog shell: a dim scrim and a wood-edged parchment card that scales in, with an outlined title at
// the top. Pause and notices use it, so every dialog enters the same way.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import Card from './Card';
import OutlineText from './OutlineText';
import { type RibbonTone } from './Ribbon';
import { SPACE } from './tokens';

type Props = {
  title?: string;
  children: React.ReactNode;
  /** Tapping the backdrop calls this; omit to make the dialog modal. */
  onDismiss?: () => void;
  /** Tints the title: red for trouble, green for good news. */
  tone?: RibbonTone;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Dialog({ title, children, onDismiss, tone = 'blue', maxWidth = 380, style }: Props) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [enter]);

  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  const cardWidth = Math.min(width - SPACE.xxl * 2, maxWidth);
  // Titles are cream with a brown outline; the tone tints the letters for good or bad news.
  const titleColor = tone === 'red' ? '#ffb4a3' : tone === 'green' ? '#d6f08a' : tone === 'orange' ? '#ffd08a' : '#fff6df';

  return (
    <Animated.View style={[styles.backdrop, { backgroundColor: theme.scrim, opacity: enter }]}>
      {onDismiss ? <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" /> : null}

      <Animated.View style={[{ width: cardWidth, transform: [{ scale }] }, style]}>
        <Card style={styles.card}>
          {title ? (
            <View accessibilityRole="header" accessibilityLabel={title} style={styles.titleBox}>
              <OutlineText size={28} color={titleColor}>
                {title}
              </OutlineText>
            </View>
          ) : null}
          {children}
        </Card>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: SPACE.xl },
  card: { alignItems: 'center', paddingTop: SPACE.lg, paddingBottom: SPACE.lg, gap: SPACE.sm },
  titleBox: { alignSelf: 'stretch', alignItems: 'center', marginBottom: 4 },
});

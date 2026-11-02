// src/ui/CurrencyPill.tsx
//
// The coin readout: a white chip with a tinted icon block on the left and a bold
// number on the right. Values count up when they change, so earning something is
// visible rather than instantaneous.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Coin } from './Decor';
import { FONT_BODY_BOLD } from './fonts';
import { lift } from './tokens';

export type Currency = 'coins';

type Props = {
  kind: Currency;
  value: number;
  onPress?: () => void;
  size?: 'sm' | 'md';
  /** Overrides the icon. */
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function CurrencyPill({ kind, value, onPress, size = 'md', icon, style }: Props) {
  const { theme } = useTheme();
  const shown = useCountUp(value);
  const h = size === 'sm' ? 28 : 34;

  const body = (
    <View
      style={[
        styles.chip,
        { height: h, borderRadius: h / 2, backgroundColor: theme.card, borderWidth: 2.5, borderColor: theme.cardEdge },
        lift(0.8),
        style,
      ]}
    >
      <View style={styles.iconBlock}>{icon ?? <Coin size={size === 'sm' ? 18 : 22} />}</View>
      <Text style={[styles.value, { color: theme.ink, fontSize: size === 'sm' ? 13 : 15 }]} numberOfLines={1}>
        {shown.toLocaleString()}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${kind}: ${value}`} hitSlop={6}>
      {body}
    </Pressable>
  );
}

/** Eases a displayed number toward its target so rewards read as earned. */
export function useCountUp(target: number, duration = 700): number {
  const anim = useRef(new Animated.Value(target)).current;
  const [shown, setShown] = useState(target);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      anim.setValue(target);
      setShown(target);
      return;
    }
    const id = anim.addListener(({ value }) => setShown(Math.round(value)));
    Animated.timing(anim, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      // An interrupted run must not snap to its stale target; only a completed one
      // sets the final value, the newer effect's own listener keeps driving `shown`.
      if (finished) setShown(target);
    });
    return () => anim.removeListener(id);
  }, [target, anim, duration]);

  return shown;
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', paddingLeft: 7 },
  iconBlock: { alignItems: 'center', justifyContent: 'center' },
  value: { textAlign: 'center', fontFamily: FONT_BODY_BOLD, paddingHorizontal: 10 },
});

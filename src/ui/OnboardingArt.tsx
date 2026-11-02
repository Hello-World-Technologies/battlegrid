// src/ui/OnboardingArt.tsx
//
// The picture on the welcome screen (png4): a miniature battlefield card with grey land, white
// neutral territories, one blue territory of yours and one red enemy, and a hand dragging troops
// from yours to a neutral one. It illustrates the rule; the numbers are only an example.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Hand } from './Decor';
import { FONT_DISPLAY } from './fonts';
import { FS, lift } from './tokens';

type Props = { width: number; height: number };

// Land and territory layout as fractions of the card: [x, y, w, h, rotation].
const LAND: [number, number, number, number, number][] = [
  [0.02, 0.1, 0.34, 0.3, -8],
  [0.28, 0.02, 0.3, 0.26, 10],
  [0.55, 0.12, 0.42, 0.34, -6],
  [0.06, 0.44, 0.36, 0.34, 8],
  [0.4, 0.5, 0.34, 0.3, -10],
  [0.7, 0.54, 0.3, 0.3, 6],
];
// [x, y, count, kind]
const NODES: [number, number, number, 'neutral' | 'own' | 'foe'][] = [
  [0.2, 0.26, 10, 'neutral'],
  [0.44, 0.16, 10, 'neutral'],
  [0.76, 0.26, 16, 'foe'],
  [0.54, 0.46, 10, 'neutral'],
  [0.28, 0.62, 40, 'own'],
  [0.7, 0.68, 10, 'neutral'],
];

export default function OnboardingArt({ width, height }: Props) {
  const { theme } = useTheme();
  const u = Math.min(1, width / 324);
  const own = NODES.find((n) => n[3] === 'own')!;
  const target = NODES[3];
  const ox = own[0] * width;
  const oy = own[1] * height;
  const tx = target[0] * width;
  const ty = target[1] * height;
  const len = Math.hypot(tx - ox, ty - oy);
  const angle = (Math.atan2(ty - oy, tx - ox) * 180) / Math.PI;
  const dashes = Math.max(3, Math.floor(len / (16 * u)));
  const handSize = 52 * u;

  // The hand drags from your territory to the neutral one, rests a moment, and starts again.
  const drag = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(drag, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(drag, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drag]);
  const handX = drag.interpolate({ inputRange: [0, 1], outputRange: [ox - tx, 0] });
  const handY = drag.interpolate({ inputRange: [0, 1], outputRange: [oy - ty, 0] });

  return (
    <View style={[{ width, height, borderRadius: 26, backgroundColor: theme.mapWater, overflow: 'hidden' }, lift(1)]} pointerEvents="none">
      {LAND.map(([x, y, w, h, r], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: x * width,
            top: y * height,
            width: w * width,
            height: h * height,
            borderRadius: 22 * u,
            backgroundColor: theme.mapLand,
            borderWidth: 2,
            borderColor: theme.mapLandEdge,
            transform: [{ rotate: `${r}deg` }],
          }}
        />
      ))}
      {NODES.map(([x, y, count, kind], i) => {
        const r = (kind === 'own' ? 15 : 11) * u;
        const region = kind === 'own' ? 1 : kind === 'foe' ? 2 : -1;
        return (
          <React.Fragment key={i}>
            {region > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  left: x * width - 40 * u,
                  top: y * height - 34 * u,
                  width: 80 * u,
                  height: 68 * u,
                  borderRadius: 30 * u,
                  backgroundColor: theme.region[region],
                }}
              />
            ) : null}
            <View
              style={{
                position: 'absolute',
                left: x * width - r,
                top: y * height - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: region > 0 ? theme.regionDeep[region] : '#FFFFFF',
              }}
            />
            <Text style={[styles.count, { left: x * width - 20, top: y * height + r + 1, color: theme.ink }]}>{count}</Text>
          </React.Fragment>
        );
      })}
      <View
        style={{
          position: 'absolute',
          left: (ox + tx) / 2 - len / 2,
          top: (oy + ty) / 2 - 2.5,
          width: len,
          height: 5,
          flexDirection: 'row',
          justifyContent: 'space-between',
          transform: [{ rotate: `${angle}deg` }],
        }}
      >
        {Array.from({ length: dashes }, (_, i) => (
          <View key={i} style={{ width: (len / (dashes * 2 - 1)), height: 5, borderRadius: 2.5, backgroundColor: '#FFFFFF' }} />
        ))}
      </View>
      <Animated.View style={{ position: 'absolute', left: tx - 6, top: ty + 2, transform: [{ translateX: handX }, { translateY: handY }] }}>
        <Hand size={handSize} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  count: { position: 'absolute', width: 40, textAlign: 'center', fontSize: FS.body, fontFamily: FONT_DISPLAY },
});

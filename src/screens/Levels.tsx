// src/screens/Levels.tsx
//
// The level path: an endless treasure map. Level 1 is at the bottom and the path climbs upward, each level a
// polaroid-style card (a scenery picture, different for every level, with its number and name underneath) that
// alternates left and right, joined by a dashed brown trail on parchment. Cleared levels show their stars, the current
// one glows and says PLAY, and the next few are faded and locked so you can see what is ahead. Only your open
// levels and those few are listed; each win opens the next one and the list grows with you. It opens scrolled to
// your level. Replaying a cleared level pays a quarter of the reward (see REPLAY_FACTOR).

import React, { useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import { Canvas, DashPathEffect, Group, Path } from '@shopify/react-native-skia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { levelName } from '../game/core';
import { ICONS } from '../icons';
import { useTheme } from '../theme';
import { PopStar, Pulse } from '../ui/HomeFx';
import LevelScene from '../ui/LevelScene';
import { FONT_BODY_BOLD, FONT_DISPLAY } from '../ui/fonts';
import { lift } from '../ui/tokens';

type Props = {
  /** Highest level reachable (the next one to beat). */
  unlocked: number;
  /** Best stars per level; levels without an entry have none. */
  stars?: Record<number, number>;
  onPick: (level: number) => void;
  onBack?: () => void;
  /** Test builds: every level up to this number can be played, whatever you have cleared. */
  openUpTo?: number;
};

const NO_STARS: Record<number, number> = {};

// The treasure-map palette. The screen is its own scene, so its colours live here, not in the theme.
const PARCHMENT = '#f3d29b';
const GRID = '#e5bd82';
const BLOB = '#ecc88c';
const TRAIL = '#8a5a3c';
const INK = '#7a3b22';
const GOLD = '#ffb400';

/** How many locked levels are shown past the furthest open one, so you can see what is coming. */
const LOCKED_AHEAD = 3;

/** Parchment with a faint grid and a few land blobs, drawn once behind the scrolling list. */
function Parchment({ width, height }: { width: number; height: number }) {
  const k = width / 360;
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: PARCHMENT }]} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ scale: k }]}>
          <Path path="M-20,40 C40,10 120,60 150,20 C190,-10 230,40 200,90 C170,140 80,130 40,170 C0,200 -30,120 -20,40 Z" color={BLOB} />
          <Path path="M230,230 C290,200 380,240 390,300 C400,370 320,400 270,380 C220,360 190,270 230,230 Z" color={BLOB} />
          <Path path="M-20,420 C30,380 110,410 120,470 C130,540 60,580 10,560 C-30,540 -40,460 -20,420 Z" color={BLOB} />
          <Path path="M210,560 C270,530 340,560 350,620 C360,690 290,720 240,700 C190,680 170,600 210,560 Z" color={BLOB} />
        </Group>
        {Array.from({ length: Math.ceil(width / 70) + 1 }, (_, i) => (
          <Path key={`v${i}`} path={`M${i * 70},0 L${i * 70},${height}`} color={GRID} style="stroke" strokeWidth={1} />
        ))}
        {Array.from({ length: Math.ceil(height / 70) + 1 }, (_, i) => (
          <Path key={`h${i}`} path={`M0,${i * 70} L${width},${i * 70}`} color={GRID} style="stroke" strokeWidth={1} />
        ))}
      </Canvas>
    </View>
  );
}

type Geometry = {
  w: number;
  rowH: number;
  cardW: number;
  cardH: number;
  photoW: number;
  photoH: number;
};

/** Which side of the path a level's card sits on: odd levels left, even levels right. */
const onLeft = (n: number) => n % 2 === 1;

const centreX = (n: number, g: Geometry) => (onLeft(n) ? g.w * 0.3 : g.w * 0.7);

type StopProps = {
  n: number;
  g: Geometry;
  unlocked: number;
  openUpTo: number;
  starCount: number;
  onPick: (level: number) => void;
};

/** One level: its card, and the dashed trail that leads down from it to the level before it. */
const Stop = React.memo(function Stop({ n, g, unlocked, openUpTo, starCount, onPick }: StopProps) {
  const { theme } = useTheme();
  const done = n < unlocked;
  const current = n === unlocked;
  const locked = n > Math.max(unlocked, openUpTo);
  const name = levelName(n);
  const left = onLeft(n);
  const tilt = left ? -2 : 2;

  // The trail runs from the bottom of this card, straight down, then bends into the near edge of the card below.
  const trail = useMemo(() => {
    if (n <= 1) return null;
    const x0 = centreX(n, g);
    const x1 = centreX(n - 1, g) + (onLeft(n - 1) ? g.cardW / 2 : -g.cardW / 2);
    const h = g.rowH - g.cardH / 2;
    return { d: `M${x0},0 C${x0},${h} ${x0 + (x1 - x0) * 0.35},${h} ${x1},${h}`, h };
  }, [n, g]);

  return (
    <View style={{ height: g.rowH, width: g.w }}>
      {trail ? (
        <Canvas
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: g.rowH / 2 + g.cardH / 2, width: g.w, height: trail.h }}
        >
          <Path path={trail.d} color={TRAIL} style="stroke" strokeWidth={5} strokeCap="round">
            <DashPathEffect intervals={[16, 12]} />
          </Path>
        </Canvas>
      ) : null}

      <Pressable
        disabled={locked}
        onPress={() => onPick(n)}
        accessibilityRole="button"
        accessibilityLabel={`Level ${n}, ${name}${done ? ', cleared' : locked ? ', locked' : ''}`}
        style={[
          styles.card,
          {
            width: g.cardW,
            height: g.cardH,
            left: centreX(n, g) - g.cardW / 2,
            top: (g.rowH - g.cardH) / 2,
            transform: [{ rotate: `${tilt}deg` }],
            opacity: locked ? 0.7 : 1,
          },
          current ? { borderWidth: 3, borderColor: GOLD } : null,
          lift(1),
        ]}
      >
        <View style={[styles.photo, { width: g.photoW, height: g.photoH }]}>
          <LevelScene level={n} width={g.photoW} height={g.photoH} />
          {locked ? (
            <View style={styles.lockVeil}>
              <ICONS.lock size={30} color="#ffffff" />
            </View>
          ) : null}
          {done ? (
            <View style={styles.stars} accessibilityLabel={`${starCount} of 3 stars`}>
              {[1, 2, 3].map(i => (
                <PopStar key={i} size={16} on={starCount >= i} delay={i * 90} />
              ))}
            </View>
          ) : null}
          {current ? (
            <Pulse style={styles.playWrap}>
              <View style={[styles.play, { backgroundColor: theme.green, borderBottomColor: theme.greenDeep }]}>
                <Text style={styles.playText}>PLAY</Text>
              </View>
            </Pulse>
          ) : null}
        </View>
        <Text style={styles.caption} numberOfLines={1}>
          {n}.{name}
        </Text>
        <View style={[styles.tape, left ? { left: -14 } : { right: -14 }, { transform: [{ rotate: left ? '-38deg' : '38deg' }] }]} />
      </Pressable>
    </View>
  );
});

export default function Levels({
  unlocked,
  stars = NO_STARS,
  onPick,
  onBack,
  openUpTo = 0,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const g = useMemo<Geometry>(() => {
    const cardW = Math.round(width * 0.46);
    const photoW = cardW - 14;
    const photoH = Math.round(photoW * 0.68);
    const cardH = photoH + 14 + 32;
    return { w: width, rowH: cardH + Math.round(width * 0.12), cardW, cardH, photoW, photoH };
  }, [width]);

  const furthest = Math.max(unlocked, openUpTo);
  // Only the open levels and a few locked ones ahead are listed; winning opens the next one and the list grows.
  const total = furthest + LOCKED_AHEAD;
  const data = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);

  const list = useRef<FlatList<number>>(null);
  // Level 1 is at the bottom (the list is inverted): open with the level you are on near the bottom of the screen,
  // the level you just cleared under it and the locked ones above.
  const startIndex = Math.max(0, unlocked - 2);
  const toCurrent = useCallback(() => {
    list.current?.scrollToIndex({ index: Math.max(0, unlocked - 2), animated: true });
  }, [unlocked]);
  // Test builds open many levels past yours: a second button jumps straight to the furthest one.
  const toFurthest = useCallback(() => {
    list.current?.scrollToIndex({ index: Math.max(0, furthest - 2), animated: false });
  }, [furthest]);

  const bottomPad = insets.bottom + 16;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<number>) => (
      <Stop n={item} g={g} unlocked={unlocked} openUpTo={openUpTo} starCount={stars[item] ?? 0} onPick={onPick} />
    ),
    [g, unlocked, openUpTo, stars, onPick],
  );

  return (
    <View style={styles.root}>
      <Parchment width={width} height={height} />
      <FlatList
        ref={list}
        style={styles.list}
        data={data}
        inverted
        keyExtractor={n => String(n)}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({ length: g.rowH, offset: g.rowH * index, index })}
        initialScrollIndex={startIndex}
        initialNumToRender={8}
        windowSize={7}
        maxToRenderPerBatch={6}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: bottomPad + 40, paddingBottom: insets.top + 24 }}
      />

      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={[styles.round, { left: 16, bottom: insets.bottom + 16, backgroundColor: theme.blue }, lift(1)]}
        >
          <ICONS.back size={26} color="#ffffff" />
        </Pressable>
      ) : null}

      {furthest > unlocked ? (
        <Pressable
          onPress={toFurthest}
          accessibilityRole="button"
          accessibilityLabel={`Go to level ${furthest}`}
          style={[styles.locate, { right: 16, bottom: bottomPad + 46, backgroundColor: theme.card }, lift(1)]}
        >
          <ICONS.trophy size={18} color={theme.orange} />
          <Text style={[styles.locateText, { color: theme.ink }]}>Level {furthest}</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={toCurrent}
        accessibilityRole="button"
        accessibilityLabel={`Go to level ${unlocked}`}
        style={[styles.locate, { right: 16, bottom: bottomPad, backgroundColor: theme.card }, lift(1)]}
      >
        <ICONS.trophy size={18} color={theme.blue} />
        <Text style={[styles.locateText, { color: theme.ink }]}>Level {unlocked}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PARCHMENT },
  list: { flex: 1, backgroundColor: 'transparent' },
  card: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 7,
    alignItems: 'center',
  },
  photo: { borderRadius: 3, overflow: 'hidden' },
  lockVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,25,40,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stars: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  playWrap: { position: 'absolute', bottom: 8, alignSelf: 'center' },
  play: { height: 30, paddingHorizontal: 20, borderRadius: 15, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
  playText: { color: '#ffffff', fontSize: 16, lineHeight: 20, fontFamily: FONT_DISPLAY },
  caption: { marginTop: 3, fontSize: 16, lineHeight: 20, fontFamily: FONT_DISPLAY, color: INK },
  tape: {
    position: 'absolute',
    top: 2,
    width: 54,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(160,140,120,0.25)',
  },
  round: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locate: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  locateText: { fontSize: 14, fontFamily: FONT_BODY_BOLD },
});

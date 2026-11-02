// src/ui/ShareCard.tsx
//
// The off-screen card captured as an image when a player shares their result (Win/Lose screens): a fixed-size,
// unanimated snapshot of the logo, the mascot, the result badge and the level/stars/time. Fixed size and no
// entrance animation, unlike the on-screen result card, because this is captured on demand — a capture taken
// mid-animation would show a half-faded-in card — and the image is what rides along in the native share sheet,
// not what the player actually sees on screen.

import React, { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { levelName } from '../game/core';
import { useTheme } from '../theme';
import { Star } from './Decor';
import { FONT_BODY_BOLD, FONT_DISPLAY } from './fonts';
import Logo from './Logo';
import ResultBadge from './ResultBadge';
import { FS, RADIUS, SPACE } from './tokens';

const MASCOT = require('../../assets/ui/shape_sprite.png');

export const SHARE_CARD_W = 320;
export const SHARE_CARD_H = 420;

type Props = {
  kind: 'win' | 'lose';
  level: number;
  /** Stars earned; shown only for a win. */
  stars?: number;
  /** Battle time in seconds. */
  seconds?: number;
};

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const ShareCard = forwardRef<ViewShotRef, Props>(function ShareCardImpl({ kind, level, stars, seconds }, ref) {
  const { theme } = useTheme();
  const win = kind === 'win';
  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 0.95, result: 'tmpfile' }}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardEdge }]}>
        <Logo width={120} />
        <View style={styles.badgeRow}>
          <ResultBadge tone={win ? 'win' : 'loss'} size={76} />
          <Image source={MASCOT} style={styles.mascot} resizeMode="contain" />
        </View>
        <Text style={[styles.title, { color: theme.ink }]}>{win ? 'Victory!' : 'Defeated'}</Text>
        <Text style={[styles.level, { color: theme.inkSoft }]}>
          Level {level} · {levelName(level)}
        </Text>
        {win && stars !== undefined ? (
          <View style={styles.stars}>
            {[0, 1, 2].map((i) => (
              <Star key={i} size={28} on={i < stars} />
            ))}
          </View>
        ) : null}
        {seconds !== undefined ? (
          <Text style={[styles.time, { color: theme.inkSoft }]}>{win ? `Won in ${fmtTime(seconds)}` : `Survived ${fmtTime(seconds)}`}</Text>
        ) : null}
        <Text style={[styles.tagline, { color: theme.inkSoft }]}>PLAN · CONQUER · WIN</Text>
      </View>
    </ViewShot>
  );
});

export default ShareCard;

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_W,
    height: SHARE_CARD_H,
    borderWidth: 4,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    padding: SPACE.lg,
  },
  badgeRow: { alignItems: 'center', justifyContent: 'center', marginTop: SPACE.md },
  mascot: { position: 'absolute', width: 60, height: 60, right: -22, bottom: -6 },
  title: { fontSize: FS.hero, fontFamily: FONT_DISPLAY, marginTop: SPACE.sm },
  level: { fontSize: FS.h3, fontFamily: FONT_BODY_BOLD },
  stars: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  time: { fontSize: FS.h2, fontFamily: FONT_BODY_BOLD, marginTop: SPACE.xs },
  tagline: { position: 'absolute', bottom: SPACE.lg, fontSize: FS.cap, letterSpacing: 1.6, fontFamily: FONT_BODY_BOLD },
});

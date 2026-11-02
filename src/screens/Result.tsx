// src/screens/Result.tsx
//
// The two ends of a battle. Win banks its reward up front (App records it the
// moment the level is won), so nothing is lost if the app is closed here. Lose
// offers the same map again — a retry keeps the seed, so the player learns the
// same board.
//
// Both follow png4 at phone scale: a map-thumbnail badge, a title with a level chip, a white card, stat tiles,
// then the buttons at the bottom. Win is the game-feel moment: the stars pop in one by one, the stat tiles
// slide up in sequence and NEXT LEVEL breathes. There is no ad card: coins are only earned by playing.

import React, { useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RNShare from 'react-native-share';
import type { ViewShotRef } from 'react-native-view-shot';
import { COINS_BY_STARS, REPLAY_FACTOR, SLOW_COINS, levelName, type StarResult } from '../game/core';
import { ICONS, Ionicons } from '../icons';
import { PLAY_STORE_URL } from '../links';
import { useTheme } from '../theme';
import Button, { IconButton } from '../ui/Button';
import Card, { Chip, StatTile } from '../ui/Card';
import ConfettiLayer from '../ui/ConfettiLayer';
import { Coin, Star } from '../ui/Decor';
import { FONT_BODY, FONT_BODY_BOLD, FONT_DISPLAY } from '../ui/fonts';
import Mascot from '../ui/Mascot';
import { PopIn, Pulse, SlideUp } from '../ui/ResultMotion';
import ResultBadge from '../ui/ResultBadge';
import ShareCard from '../ui/ShareCard';
import Stage from '../ui/Stage';
import { FS, SPACE } from '../ui/tokens';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Captures `cardRef`'s ShareCard to a PNG and opens the native share sheet with it attached. Falls back to a
 * plain-text share (RN's built-in `Share`, image-less) if the capture or the image share fails for any reason —
 * cancelling the share sheet counts as a failure too (`failOnCancel: false`), so a cancel quietly tries the
 * fallback rather than surfacing an error.
 */
async function shareCard(cardRef: React.RefObject<ViewShotRef | null>, message: string, setSharing: (v: boolean) => void) {
  setSharing(true);
  try {
    const uri = await cardRef.current?.capture();
    await RNShare.open({ url: uri, message, failOnCancel: false });
  } catch {
    try {
      await Share.share({ message });
    } catch {
      // No share sheet available either — nothing more to do.
    }
  } finally {
    setSharing(false);
  }
}

// Timeline of the win celebration (ms): badge, stars one by one, tiles in sequence, then the button breathes.
const STAR_AT = 380;
const STAR_STEP = 240;
const TILE_AT = STAR_AT + 3 * STAR_STEP + 120;
const TILE_STEP = 120;

/* ── Win ────────────────────────────────────────────────────────────────── */

type WinProps = {
  level: number;
  /** Replaces "NEXT LEVEL". */
  nextLabel?: string;
  /** Coins already banked for this win. */
  payout: number;
  /** True when the level had been cleared before, so it paid the replay rate. */
  replay: boolean;
  /** How fast the battle was, against the level's star times. */
  result?: StarResult;
  /** Battle time in seconds: shown as a stat and beside the star times. */
  seconds?: number;
  onNext: () => void;
  onLevels: () => void;
  onHome: () => void;
};

export function WinScreen({ level, nextLabel = 'NEXT LEVEL', payout, replay, result, seconds, onNext, onLevels, onHome }: WinProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const shareCardRef = useRef<ViewShotRef>(null);
  const [sharing, setSharing] = useState(false);
  const shareResult = () => {
    if (sharing) return;
    const stars = result ? `${result.stars}★ ` : '';
    const message = `I just beat Level ${level} · ${levelName(level)} in BattleGrid ${stars}🏆 Think you can beat it?\n\n🎮 ${PLAY_STORE_URL}`;
    shareCard(shareCardRef, message, setSharing);
  };
  // The three star rows are the win times: any win is a star, then under the two- and three-star times.
  const goals: { label: string; met: boolean; note?: string }[] = result
    ? [
        { label: 'Win the battle', met: result.win, note: `${result.fast ? COINS_BY_STARS[1] : SLOW_COINS} coins` },
        { label: `Win in under ${fmtTime(result.two)}`, met: result.stars >= 2, note: `${COINS_BY_STARS[2]} coins` },
        { label: `Win in under ${fmtTime(result.three)}`, met: result.stars >= 3, note: `${COINS_BY_STARS[3]} coins` },
      ]
    : [];

  const tiles: React.ReactNode[] = [<StatTile key="coins" label="Coins" value={`+${payout.toLocaleString()}`} icon={<Coin size={16} />} />];
  if (result) tiles.push(<StatTile key="stars" label="Stars" value={`${result.stars}/3`} icon={<Star size={16} />} />);
  if (seconds !== undefined) {
    tiles.push(<StatTile key="time" label="Time" value={fmtTime(seconds)} icon={<Ionicons name="time" size={16} color={theme.blue} />} />);
  }

  return (
    <View style={styles.root}>
      <Stage variant="hero" />
      <ConfettiLayer />
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={shareCardRef} kind="win" level={level} stars={result?.stars} seconds={seconds} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + SPACE.lg, paddingBottom: insets.bottom + SPACE.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <PopIn from={0.5} delay={60}>
            <ResultBadge tone="win" size={96} />
          </PopIn>
          <Mascot mood="happy" size={88} delay={500} style={styles.mascot} />
          <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>
            Victory!
          </Text>
          <Chip label={`Level ${level} · ${levelName(level)}`} tone="blue" style={styles.chip} />

          {result ? (
            <Card style={styles.card}>
              <View style={styles.stars} accessibilityLabel={`${result.stars} of 3 stars`}>
                {goals.map((g, i) => (
                  <PopIn key={i} delay={STAR_AT + i * STAR_STEP} from={g.met ? 0.4 : 0.8} style={i === 1 ? undefined : styles.sideStar}>
                    <Star size={i === 1 ? 42 : 34} on={g.met} />
                  </PopIn>
                ))}
              </View>
              {goals.map((g) => (
                <View key={g.label} style={styles.goal}>
                  {g.met ? <ICONS.checkmark size={20} color={theme.green} /> : <View style={[styles.goalOff, { backgroundColor: theme.cardDeep }]} />}
                  <Text style={[styles.goalText, { color: g.met ? theme.ink : theme.muted }]}>{g.label}</Text>
                  {g.note ? <Text style={[styles.goalNote, { color: theme.muted }]}>{g.note}</Text> : null}
                </View>
              ))}
              {result.assisted ? (
                <Text style={[styles.note, { color: theme.inkSoft }]}>Assisted battle: one star and the slow reward.</Text>
              ) : null}
            </Card>
          ) : null}

          <View style={styles.tiles}>
            {tiles.map((t, i) => (
              <SlideUp key={i} delay={TILE_AT + i * TILE_STEP} style={styles.tileSlot}>
                {t}
              </SlideUp>
            ))}
          </View>

          {replay ? (
            <View style={styles.notes}>
              <Text style={[styles.note, { color: theme.inkSoft }]}>
                {payout > 0 && result && result.stars > 0 ? 'Replay: you are paid for the stars you added, or a quarter of the reward.' : `Replay reward · ${Math.round(REPLAY_FACTOR * 100)}%`}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pulse delay={TILE_AT + tiles.length * TILE_STEP + 300} style={styles.pulse}>
            <Button label={nextLabel} size="lg" tone="green" fullWidth onPress={onNext} />
          </Pulse>
          <View style={styles.row}>
            <Button label="LEVELS" tone="light" size="md" onPress={onLevels} style={styles.rowItem} />
            <Button label="HOME" tone="light" size="md" onPress={onHome} style={styles.rowItem} />
          </View>
        </View>
      </ScrollView>
      <IconButton
        onPress={shareResult}
        label="Share result"
        disabled={sharing}
        style={[styles.shareButton, { top: insets.top + SPACE.md }]}
      >
        <ICONS.share size={18} color={theme.ink} />
      </IconButton>
    </View>
  );
}

/* ── Lose ───────────────────────────────────────────────────────────────── */

type LoseProps = {
  level: number;
  /** Replaces "Level N · name". */
  title?: string;
  /** The battle just lost was already the assisted one. */
  assisted?: boolean;
  /** Losses in a row on this level, shown as a stat when given. */
  attempts?: number;
  /** How long the battle lasted, in seconds, shown as a stat when given. */
  seconds?: number;
  onRetry: () => void;
  onLevels: () => void;
  onHome: () => void;
};

export function LoseScreen({ level, assisted = false, attempts, seconds, onRetry, onLevels, onHome }: LoseProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const shareCardRef = useRef<ViewShotRef>(null);
  const [sharing, setSharing] = useState(false);
  const shareResult = () => {
    if (sharing) return;
    const message = `I just got defeated on Level ${level} · ${levelName(level)} in BattleGrid 😅 Bet you can do better!\n\n🎮 ${PLAY_STORE_URL}`;
    shareCard(shareCardRef, message, setSharing);
  };
  const tiles: React.ReactNode[] = [];
  if (attempts !== undefined) tiles.push(<StatTile key="attempts" label="Attempts" value={attempts} icon={<ICONS.restart size={16} color={theme.red} />} />);
  if (seconds !== undefined) {
    tiles.push(<StatTile key="time" label="Time survived" value={fmtTime(seconds)} icon={<Ionicons name="time" size={16} color={theme.blue} />} />);
  }

  return (
    <View style={styles.root}>
      <Stage variant="hero" />
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={shareCardRef} kind="lose" level={level} seconds={seconds} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + SPACE.lg, paddingBottom: insets.bottom + SPACE.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          <PopIn from={0.6} delay={60}>
            <ResultBadge tone="loss" size={96} />
          </PopIn>
          <Mascot mood="sad" size={84} delay={500} style={styles.mascot} />
          <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>
            Defeated
          </Text>
          <Chip label={`Level ${level} · ${levelName(level)}`} tone="red" style={styles.chip} />

          <Card style={styles.card}>
            <Text style={[styles.loseText, { color: theme.inkSoft }]}>
              <Text style={{ color: theme.ink, fontFamily: FONT_BODY_BOLD }}>The enemy took every territory. </Text>
              Retry plays the same map, so you know where they strike.
            </Text>
          </Card>

          {tiles.length > 0 ? (
            <View style={styles.tiles}>
              {tiles.map((t, i) => (
                <SlideUp key={i} delay={320 + i * TILE_STEP} style={styles.tileSlot}>
                  {t}
                </SlideUp>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pulse delay={900} style={styles.pulse}>
            <Button label={assisted ? 'TRY AGAIN (ASSISTED)' : 'TRY AGAIN'} size="lg" tone="green" fullWidth onPress={onRetry} />
          </Pulse>
          <View style={styles.row}>
            <Button label="LEVELS" tone="light" size="md" onPress={onLevels} style={styles.rowItem} />
            <Button label="HOME" tone="light" size="md" onPress={onHome} style={styles.rowItem} />
          </View>
        </View>
      </ScrollView>
      <IconButton
        onPress={shareResult}
        label="Share result"
        disabled={sharing}
        style={[styles.shareButton, { top: insets.top + SPACE.md }]}
      >
        <ICONS.share size={18} color={theme.ink} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACE.lg, gap: SPACE.xxl },
  top: { alignItems: 'center', gap: SPACE.sm },
  // Beside the badge, in the top right corner of the content.
  mascot: { position: 'absolute', top: 0, right: -6 },
  // The ShareCard is only ever captured, never seen — parked well off the visible area.
  offscreen: { position: 'absolute', left: -9999, top: 0 },
  shareButton: { position: 'absolute', right: SPACE.lg },

  title: { fontSize: FS.hero, lineHeight: 46, fontFamily: FONT_DISPLAY, textAlign: 'center', marginTop: SPACE.sm },
  chip: { alignSelf: 'center', paddingHorizontal: SPACE.lg, marginBottom: SPACE.sm },

  card: { alignSelf: 'stretch', gap: SPACE.sm },
  stars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: SPACE.sm, marginBottom: SPACE.xs },
  sideStar: { marginBottom: -2 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  goalOff: { width: 16, height: 16, borderRadius: 8, margin: 2 },
  goalText: { flex: 1, fontSize: FS.body, fontFamily: FONT_BODY_BOLD },
  goalNote: { fontSize: FS.small, fontFamily: FONT_BODY_BOLD },

  loseText: { fontSize: FS.body, lineHeight: 20, fontFamily: FONT_BODY },

  tiles: { flexDirection: 'row', alignSelf: 'stretch', gap: SPACE.md },
  tileSlot: { flex: 1 },
  notes: { gap: 2 },
  note: { fontSize: FS.small, fontFamily: FONT_BODY, textAlign: 'center' },

  actions: { alignSelf: 'stretch', gap: SPACE.md },
  pulse: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: SPACE.md },
  rowItem: { flex: 1 },
});

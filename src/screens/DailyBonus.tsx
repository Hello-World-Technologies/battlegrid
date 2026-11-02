// src/screens/DailyBonus.tsx
//
// A seven-day reward cycle. One claim per UTC day; claiming on consecutive
// days advances the streak, a missed day starts it again at one. The cycle
// ends on a treasure chest, then repeats.
//
// The rules live in src/progress.ts — this screen only renders them and asks
// the parent to apply a claim.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '../icons';
import {
  DAILY_CYCLE,
  DAILY_REWARDS,
  Progress,
  Reward,
  canClaimDaily,
  coinsLeft,
  dailyIndex,
  liveStreak,
  todayKey,
} from '../progress';
import { useTheme } from '../theme';
import Button from '../ui/Button';
import Card, { SectionLabel } from '../ui/Card';
import CurrencyPill from '../ui/CurrencyPill';
import { Chest, Coin, Float } from '../ui/Decor';
import Dialog from '../ui/Dialog';
import { HeroPanel } from '../ui/Gradient';
import ProgressBar from '../ui/ProgressBar';
import ScreenHeader from '../ui/ScreenHeader';
import Stage from '../ui/Stage';
import { alpha } from '../ui/color';
import { FONT_BODY, FONT_BODY_BOLD, FONT_DISPLAY } from '../ui/fonts';
import { FS, RADIUS, SPACE, lift } from '../ui/tokens';
import { Flicker, Pulse } from './DailyPulse';

type Props = {
  progress: Progress;
  onClaim: () => void;
  onBack?: () => void;
};

/** Time to the next UTC midnight as "HH:MM:SS". */
const countdown = (now: Date): string => {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const s = Math.max(0, Math.floor((next - now.getTime()) / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

export default function DailyBonus({ progress, onClaim, onBack }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => new Date());
  const [claimed, setClaimed] = useState<Reward | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const day = todayKey();
  const claimable = canClaimDaily(progress, day);
  // After a claim the streak has already advanced, so `activeIndex` points at
  // tomorrow's reward: it is the next one up, not a claimed one.
  const activeIndex = dailyIndex(progress, day);
  const streak = liveStreak(progress, day);
  // Days of this cycle already collected (a finished cycle wraps to index 0).
  const done = claimable ? activeIndex : activeIndex === 0 ? DAILY_CYCLE : activeIndex;
  const reward = DAILY_REWARDS[activeIndex];
  const last = DAILY_REWARDS[DAILY_CYCLE - 1];

  const handleClaim = () => {
    if (!claimable) return;
    setClaimed(reward);
    onClaim();
  };

  return (
    <View style={styles.root}>
      <Stage variant="plain" />
      <ScreenHeader title="Daily Bonus" onBack={onBack} right={<CurrencyPill kind="coins" value={coinsLeft(progress)} />} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Streak hero ── */}
        <HeroPanel colors={[theme.hero, theme.heroDeep]} radius={RADIUS.xl} style={lift(1)}>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroText}>
                <View style={styles.streakRow}>
                  <Text style={styles.streakNum}>{streak}</Text>
                  <Text style={styles.streakUnit}>day streak</Text>
                </View>
                <Text style={[styles.heroCopy, { color: theme.heroText }]}>
                  {streak > 0
                    ? 'Come back every day: rewards grow, and day 7 is a big one.'
                    : 'Claim today to start your streak. Rewards grow every day.'}
                </Text>
              </View>
              <Flicker style={styles.flame}>
                <View style={[styles.halo, { backgroundColor: alpha('#ff9a2e', 0.16) }]} />
                <Ionicons name="flame" size={52} color="#ff8a1c" />
                <View style={styles.flameInner}>
                  <Ionicons name="flame" size={26} color="#ffd35c" />
                </View>
              </Flicker>
            </View>
            <View style={styles.barLabels}>
              <Text style={[styles.barLabel, { color: theme.heroText }]}>
                {claimable ? `DAY ${activeIndex + 1}` : `DAY ${done} CLAIMED`}
              </Text>
              <Text style={[styles.barLabel, { color: theme.heroText }]}>
                {`DAY ${DAILY_CYCLE} · ${last.amount.toLocaleString()} COINS`}
              </Text>
            </View>
            <ProgressBar
              value={done / DAILY_CYCLE}
              height={8}
              color={theme.gold}
              track={alpha('#FFFFFF', 0.2)}
              style={styles.bar}
            />
          </View>
        </HeroPanel>

        {/* ── Seven-day strip ── */}
        <View style={styles.strip}>
          {DAILY_REWARDS.map((r, i) => {
            const state = i < done ? 'claimed' : i === activeIndex ? (claimable ? 'today' : 'next') : 'upcoming';
            return (
              <DayPill
                key={i}
                index={i}
                reward={r}
                state={state}
                onPress={state === 'today' ? handleClaim : undefined}
              />
            );
          })}
        </View>

        {/* ── Reward ── */}
        <Card style={styles.reward}>
          <SectionLabel style={styles.rewardLabel}>{claimable ? "Today's reward" : "Tomorrow's reward"}</SectionLabel>
          <View style={styles.rewardRow}>
            {reward.kind === 'chest' ? <Chest size={44} /> : <Coin size={36} />}
            <Text style={[styles.rewardAmount, { color: theme.ink }]}>{reward.amount.toLocaleString()}</Text>
          </View>
          <Text style={[styles.rewardCopy, { color: theme.inkSoft }]}>
            {claimable
              ? streak > 0
                ? 'Claim before UTC midnight to keep your streak'
                : 'Claim to start your streak'
              : 'Come back after UTC midnight to keep your streak'}
          </Text>
        </Card>

        <Pulse active={claimable} style={styles.claimWrap}>
          <Button
            label={claimable ? `CLAIM +${reward.amount.toLocaleString()}` : 'COME BACK TOMORROW'}
            accessibilityLabel={claimable ? 'CLAIM TODAY' : 'COME BACK TOMORROW'}
            size={claimable ? 'lg' : 'md'}
            fullWidth
            tone={claimable ? 'gold' : 'light'}
            disabled={!claimable}
            onPress={handleClaim}
          />
        </Pulse>
        <Text style={[styles.next, { color: theme.muted }]}>Next bonus in {countdown(now)}</Text>
      </ScrollView>

      {claimed ? (
        <Dialog title="CLAIMED!" tone="green" onDismiss={() => setClaimed(null)}>
          <Float distance={6}>{claimed.kind === 'chest' ? <Chest size={64} open /> : <Coin size={48} />}</Float>
          <Text style={[styles.claimedAmount, { color: theme.ink }]}>+{claimed.amount.toLocaleString()} coins</Text>
          <Text style={[styles.claimedSub, { color: theme.inkSoft }]}>See you tomorrow for day {activeIndex + 1}.</Text>
          <Button label="CONTINUE" size="md" tone="green" fullWidth onPress={() => setClaimed(null)} />
        </Dialog>
      ) : null}
    </View>
  );
}

/* ── Day pill ───────────────────────────────────────────────────────────── */

function DayPill({
  index,
  reward,
  state,
  onPress,
}: {
  index: number;
  reward: Reward;
  state: 'claimed' | 'today' | 'next' | 'upcoming';
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const today = state === 'today';
  const next = state === 'next';
  const label = today ? 'TODAY' : `D${index + 1}`;

  const pill = (
    <View
      style={[
        styles.day,
        lift(today ? 1 : 0.7),
        { backgroundColor: today ? theme.softYellow : theme.card },
        (today || next) && { borderWidth: 2, borderColor: theme.gold },
      ]}
    >
      <Text style={[styles.dayLabel, { color: today ? '#a56a00' : theme.muted }]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
      <View
        style={[
          styles.dayDisc,
          { backgroundColor: state === 'claimed' ? theme.softGreen : today ? theme.gold : theme.chip },
        ]}
      >
        {state === 'claimed' ? (
          <Ionicons name="checkmark" size={16} color={theme.green} />
        ) : reward.kind === 'chest' ? (
          <Chest size={20} />
        ) : (
          <Coin size={today ? 22 : 18} />
        )}
      </View>
      <Text style={[styles.dayAmount, { color: theme.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {reward.amount.toLocaleString()}
      </Text>
    </View>
  );

  if (!onPress) return <View style={styles.slot}>{pill}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Claim day ${index + 1}`} style={styles.slot}>
      {pill}
    </Pressable>
  );
}

/* ── Styles (layout only — colours come from the theme) ─────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, gap: SPACE.md },

  hero: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  heroText: { flex: 1 },
  streakRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm },
  streakNum: { fontFamily: FONT_DISPLAY, fontSize: FS.hero, lineHeight: FS.hero + 8, color: '#FFFFFF' },
  streakUnit: { fontFamily: FONT_BODY_BOLD, fontSize: FS.h2, color: '#FFFFFF' },
  heroCopy: { fontFamily: FONT_BODY_BOLD, fontSize: FS.small, lineHeight: 16 },
  flame: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 64, height: 64, borderRadius: 32 },
  flameInner: { position: 'absolute', bottom: 8 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.md },
  barLabel: { fontFamily: FONT_BODY_BOLD, fontSize: FS.cap, letterSpacing: 1 },
  bar: { marginTop: SPACE.sm },

  strip: { flexDirection: 'row', gap: SPACE.xs + 1 },
  slot: { flex: 1 },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.lg,
    gap: SPACE.xs,
    minHeight: 76,
  },
  dayLabel: { fontFamily: FONT_BODY_BOLD, fontSize: FS.cap, letterSpacing: 0.3 },
  dayDisc: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dayAmount: { fontFamily: FONT_DISPLAY, fontSize: FS.small, paddingHorizontal: 2 },

  reward: { alignItems: 'center', gap: SPACE.xs },
  rewardLabel: { marginBottom: 0, marginLeft: 0 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  rewardAmount: { fontFamily: FONT_DISPLAY, fontSize: FS.hero, lineHeight: FS.hero + 8 },
  rewardCopy: { fontFamily: FONT_BODY_BOLD, fontSize: FS.small, textAlign: 'center' },

  claimWrap: { alignSelf: 'stretch', marginTop: SPACE.xs },
  next: { fontFamily: FONT_BODY_BOLD, fontSize: FS.small, textAlign: 'center' },

  claimedAmount: { fontSize: FS.hero, fontFamily: FONT_DISPLAY, marginTop: SPACE.md },
  claimedSub: { fontSize: FS.body, fontFamily: FONT_BODY, marginBottom: SPACE.lg, textAlign: 'center' },
});

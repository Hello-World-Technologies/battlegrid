// src/screens/Profile.tsx
//
// Who the player is and how the levels are going: avatar, name,
// the numbers that matter, milestones worked out from real progress, and the
// account (Play Games sign-in / sign-out).
//
// Stats come from src/progress.ts (cloud-saved per uid);
// name, photo and account state come from Firebase auth. There is no XP or
// player-level system, so none is shown.
//
// A guest's display name is auto-assigned at first launch (see
// src/anonymousNames.ts) with no name prompt during onboarding, so the
// pencil beside the name here is the only way to rename — guest-only, since
// a Play Games name is set by that account instead.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PlayerProfile } from '../firebase/auth';
import { ICONS, Ionicons } from '../icons';
import { Progress, totalStars } from '../progress';
import { useTheme } from '../theme';
import Button from '../ui/Button';
import Card, { Chip, SectionLabel } from '../ui/Card';
import { STAR_ON } from '../ui/Decor';
import Dialog from '../ui/Dialog';
import { HeroPanel } from '../ui/Gradient';
import ProgressBar from '../ui/ProgressBar';
import { alpha } from '../ui/color';
import { FONT_BODY, FONT_BODY_BOLD, FONT_DISPLAY } from '../ui/fonts';
import { FS, RADIUS, SPACE, lift } from '../ui/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  player: PlayerProfile | null;
  progress: Progress;
  playGamesAvailable: boolean;
  onBack?: () => void;
  onPlayGames: () => Promise<void>;
  onSignOut: () => Promise<void>;
  /** Renames the guest account, in Firebase auth and everywhere the name is
   *  mirrored. Resolves false (rather than throwing) if the write failed, so
   *  the caller can keep the rename modal open and show an error instead of
   *  closing as if it succeeded. */
  onRenameGuest: (name: string) => Promise<boolean>;
};

type Milestone = { key: string; label: string; icon: string; have: number; need: number };

export default function Profile({
  player,
  progress,
  playGamesAvailable,
  onBack,
  onPlayGames,
  onSignOut,
  onRenameGuest,
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const isSignedIn = !!player && !player.isGuest;
  const displayName = player?.name ?? 'Guest';
  const cleared = progress.unlocked - 1;
  const battles = progress.wins + progress.losses;
  const winRate = battles > 0 ? Math.round((progress.wins / battles) * 100) : 0;
  const stars = totalStars(progress);
  const nextTen = (Math.floor(cleared / 10) + 1) * 10;

  // Milestones are thresholds checked against what the save really holds.
  const milestones: Milestone[] = [
    { key: 'win', label: 'First win', icon: 'trophy', have: progress.wins, need: 1 },
    { key: 'three', label: 'Three stars', icon: 'star', have: Object.values(progress.stars).filter((v) => v >= 3).length, need: 1 },
    { key: 'streak', label: '7-day streak', icon: 'flame', have: progress.bestStreak, need: 7 },
    { key: 'wins', label: 'Ten wins', icon: 'ribbon', have: progress.wins, need: 10 },
    { key: 'levels', label: '10 levels', icon: 'flag', have: cleared, need: 10 },
    { key: 'stars', label: '25 stars', icon: 'sparkles', have: stars, need: 25 },
    { key: 'levels25', label: '25 levels', icon: 'earth', have: cleared, need: 25 },
    { key: 'levels50', label: '50 levels', icon: 'globe', have: cleared, need: 50 },
  ];

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const openRename = () => {
    setName(displayName);
    setRenameError(null);
    setShowRename(true);
  };

  const saveRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || renaming) return;
    setRenaming(true);
    setRenameError(null);
    try {
      const ok = await onRenameGuest(trimmed);
      if (ok) setShowRename(false);
      else setRenameError("Couldn't save that — check your connection and try again.");
    } finally {
      setRenaming(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero header ── */}
        <HeroPanel colors={[theme.hero, theme.heroDeep]} bottomOnly radius={RADIUS.xxl}>
          <View style={[styles.hero, { paddingTop: insets.top + SPACE.lg }]}>
            <View style={styles.identityRow}>
              {onBack ? (
                <Pressable
                  onPress={onBack}
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                  hitSlop={10}
                  style={[styles.back, { backgroundColor: alpha('#FFFFFF', 0.18) }]}
                >
                  <ICONS.back size={20} color="#FFFFFF" />
                </Pressable>
              ) : null}
              <View style={[styles.ring, { borderColor: theme.gold }]}>
                {player?.photoURL ? (
                  <Image source={{ uri: player.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.blue }]}>
                    <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.identityInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {player?.isGuest ? (
                    <Pressable onPress={openRename} accessibilityRole="button" accessibilityLabel="Change username" hitSlop={10}>
                      <ICONS.edit size={16} color={theme.heroDim} />
                    </Pressable>
                  ) : null}
                </View>
                <Text style={[styles.sub, { color: theme.heroText }]} numberOfLines={1}>
                  Commander · Campaign level {progress.unlocked}
                </Text>
              </View>
            </View>

            <View style={styles.barLabels}>
              <Text style={[styles.barLabel, { color: theme.heroText }]}>{cleared === 1 ? '1 LEVEL CLEARED' : `${cleared} LEVELS CLEARED`}</Text>
              <Text style={[styles.barLabel, { color: theme.heroText }]}>NEXT GOAL · {nextTen}</Text>
            </View>
            <ProgressBar
              value={(cleared % 10) / 10}
              height={8}
              color={theme.gold}
              track={alpha('#FFFFFF', 0.2)}
              style={styles.bar}
            />
          </View>
        </HeroPanel>

        {/* ── Stat tiles overlapping the header ── */}
        <View style={styles.tiles}>
          <Tile value={cleared} label="Levels" icon={<Ionicons name="flag" size={14} color={theme.blue} />} />
          <Tile value={stars} label="Stars" color={theme.goldDeep} icon={<ICONS.star size={14} color={STAR_ON} />} />
          <Tile value={progress.wins} label="Wins" icon={<Ionicons name="trophy" size={14} color={theme.green} />} />
        </View>

        <View style={styles.body}>
          {/* ── Battle record ── */}
          <View>
            <SectionLabel>Record</SectionLabel>
            <Card style={styles.records}>
              <View style={styles.recordRow}>
                <Fact value={`${winRate}%`} label="Win rate" />
                <Fact value={progress.losses} label="Lost" />
                <Fact value={progress.bestStreak} label="Best streak" />
                <Fact value={progress.coins.toLocaleString()} label="Coins earned" />
              </View>
            </Card>
          </View>

          {/* ── Milestones, from real progress ── */}
          <View>
            <SectionLabel>Milestones</SectionLabel>
            <Card style={styles.badges}>
              {milestones.map((m, i) => (
                <Badge key={m.key} m={m} index={i} />
              ))}
            </Card>
          </View>

          {/* ── Account ── */}
          <Card style={styles.account}>
            <View style={styles.accountRow}>
              <View style={[styles.accountIcon, { backgroundColor: isSignedIn ? theme.softGreen : theme.cardAlt }]}>
                <ICONS.playGames size={22} color={isSignedIn ? theme.green : theme.muted} />
              </View>
              <View style={styles.accountText}>
                <Text style={[styles.accountTitle, { color: theme.ink }]}>Google Play Games</Text>
                <Text style={[styles.accountSub, { color: theme.inkSoft }]} numberOfLines={2}>
                  {isSignedIn
                    ? 'Signed in'
                    : playGamesAvailable
                    ? 'Playing as guest'
                    : 'Sign-in is not available in this build.'}
                </Text>
              </View>
              <Chip label={isSignedIn ? 'Online' : 'Guest'} tone={isSignedIn ? 'green' : 'grey'} />
            </View>

            {isSignedIn ? (
              <Button label="SIGN OUT" tone="soft" size="md" fullWidth busy={busy} onPress={() => run(onSignOut)} />
            ) : playGamesAvailable ? (
              <Button
                label="SIGN IN WITH PLAY GAMES"
                tone="blue"
                size="md"
                fullWidth
                busy={busy}
                onPress={() => run(onPlayGames)}
              />
            ) : (
              <Text style={[styles.note, { color: theme.dim }]}>Play Games sign-in is not available in this build.</Text>
            )}
            {error ? <Text style={[styles.error, { color: theme.red }]}>{error}</Text> : null}
          </Card>
        </View>
      </ScrollView>

      {showRename ? (
        <Dialog title="CHANGE USERNAME" onDismiss={() => setShowRename(false)}>
          <Text style={[styles.modalBody, { color: theme.inkSoft }]}>This is the name shown on your profile.</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter a name"
            placeholderTextColor={theme.inkSoft}
            maxLength={20}
            autoFocus
            autoCapitalize="words"
            style={[styles.input, { backgroundColor: theme.chip, borderColor: theme.chipEdge, color: theme.ink }]}
          />
          {renameError ? <Text style={[styles.error, { color: theme.red }]}>{renameError}</Text> : null}
          <Button
            label="SAVE"
            size="md"
            tone="green"
            fullWidth
            busy={renaming}
            disabled={!name.trim()}
            style={styles.modalOk}
            onPress={saveRename}
          />
        </Dialog>
      ) : null}
    </View>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function Tile({ value, label, color, icon }: { value: number; label: string; color?: string; icon?: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.card }, lift(0.9)]}>
      <View style={styles.tileTop}>
        {icon}
        <Text style={[styles.tileValue, { color: color ?? theme.ink }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Text style={[styles.tileLabel, { color: theme.inkSoft }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

function Fact({ value, label }: { value: string | number; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.fact}>
      <Text style={[styles.factValue, { color: theme.ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.factLabel, { color: theme.inkSoft }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A round badge: gold with a ring when earned (it pops in), a faded grey disc with a lock and its progress when not. */
function Badge({ m, index }: { m: Milestone; index: number }) {
  const { theme } = useTheme();
  const done = m.have >= m.need;
  const pop = useRef(new Animated.Value(done ? 0.4 : 1)).current;
  useEffect(() => {
    if (!done) return;
    const anim = Animated.spring(pop, { toValue: 1, delay: 120 + index * 70, friction: 5, tension: 120, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [done, index, pop]);
  return (
    <View style={styles.badge} accessibilityLabel={`${m.label}, ${done ? 'done' : `${Math.min(m.have, m.need)} of ${m.need}`}`}>
      <Animated.View
        style={[
          styles.badgeDisc,
          done
            ? [{ backgroundColor: theme.gold, borderColor: '#ffd35c' }, lift(0.5)]
            : { backgroundColor: theme.cardDeep, borderColor: theme.cardAlt, opacity: 0.8 },
          { transform: [{ scale: pop }] },
        ]}
      >
        <Ionicons name={m.icon as any} size={20} color={done ? '#FFFFFF' : theme.muted} />
        {!done ? (
          <View style={[styles.badgeLock, { backgroundColor: theme.card }]}>
            <ICONS.lock size={9} color={theme.muted} />
          </View>
        ) : null}
      </Animated.View>
      <Text style={[styles.badgeLabel, { color: done ? theme.ink : theme.inkSoft }]} numberOfLines={1}>
        {m.label}
      </Text>
      <Text style={[styles.badgeCount, { color: done ? theme.greenDeep : theme.muted }]}>
        {done ? 'DONE' : `${Math.min(m.have, m.need)}/${m.need}`}
      </Text>
    </View>
  );
}

/* ── Styles (layout only — colours come from the theme) ─────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { paddingHorizontal: SPACE.lg, paddingBottom: 38 },
  back: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  ring: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, padding: 2 },
  avatar: { flex: 1, borderRadius: 26 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: FS.title, fontFamily: FONT_DISPLAY },
  identityInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  name: { fontSize: FS.title, lineHeight: 32, fontFamily: FONT_DISPLAY, color: '#FFFFFF', flexShrink: 1 },
  sub: { fontSize: FS.small, fontFamily: FONT_BODY_BOLD },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.lg },
  barLabel: { fontFamily: FONT_BODY_BOLD, fontSize: FS.cap, letterSpacing: 1 },
  bar: { marginTop: SPACE.sm },

  tiles: { flexDirection: 'row', gap: SPACE.md, paddingHorizontal: SPACE.lg, marginTop: -26 },
  tile: { flex: 1, alignItems: 'center', paddingVertical: SPACE.md, borderRadius: RADIUS.lg },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 1 },
  tileValue: { fontSize: FS.h2, lineHeight: 22, fontFamily: FONT_DISPLAY },
  tileLabel: { fontSize: FS.cap, fontFamily: FONT_BODY_BOLD, letterSpacing: 1.2 },

  body: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, gap: SPACE.md },

  records: { paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm, gap: SPACE.md },
  recordRow: { flexDirection: 'row' },
  fact: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  factValue: { fontSize: FS.h2, lineHeight: 22, fontFamily: FONT_DISPLAY },
  factLabel: { fontSize: FS.small, fontFamily: FONT_BODY_BOLD },

  badges: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.md, paddingHorizontal: SPACE.sm },
  badge: { width: '25%', alignItems: 'center', gap: 1 },
  badgeDisc: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  badgeLock: { position: 'absolute', right: -4, bottom: -4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeLabel: { fontSize: FS.cap, fontFamily: FONT_BODY_BOLD },
  badgeCount: { fontSize: FS.cap, fontFamily: FONT_BODY_BOLD, letterSpacing: 0.4 },

  account: { gap: SPACE.md },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  accountIcon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  accountText: { flex: 1 },
  accountTitle: { fontSize: FS.h2, fontFamily: FONT_DISPLAY },
  accountSub: { fontSize: FS.small, fontFamily: FONT_BODY_BOLD },

  note: { fontSize: FS.small, fontFamily: FONT_BODY, textAlign: 'center' },
  error: { fontSize: FS.small, fontFamily: FONT_BODY_BOLD, textAlign: 'center', marginTop: SPACE.sm },

  modalBody: { fontSize: FS.body, fontFamily: FONT_BODY, textAlign: 'center', marginBottom: SPACE.lg },
  input: {
    alignSelf: 'stretch',
    borderWidth: 2,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    fontSize: FS.h3,
    fontFamily: FONT_BODY_BOLD,
  },
  modalOk: { marginTop: SPACE.lg },
});

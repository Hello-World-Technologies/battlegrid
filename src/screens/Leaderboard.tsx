// src/screens/Leaderboard.tsx
//
// The global leaderboard: Worldwide, Country and City tabs over src/leaderboard.ts's one-shot
// Firestore queries. Country/City lazily request location permission the first time either tab
// is opened (src/geo.ts) — Worldwide always works with no permission at all. Ranked by lifetime
// coins earned, since that is the one Progress field that only ever grows (see src/progress.ts),
// matching the "a score can never decrease" rule Firestore enforces server-side.
//
// The signed-in player's own row is tinted blue wherever it appears in the fetched top 50; if it
// is not there at all (outside the top 50, or the board could not be reached), a separate "YOU"
// row is pinned under the list showing their local best instead of leaving them wondering where
// they rank.

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlayerProfile } from '../firebase/auth';
import { ensureGeo } from '../geo';
import {
  fetchAllTimeLeaderboard,
  fetchCityLeaderboard,
  fetchCountryLeaderboard,
  type LeaderboardEntry,
} from '../leaderboard';
import { titleById } from '../shop';
import { useTheme } from '../theme';
import { useBannerHeight } from '../ui/AdBanner';
import Button from '../ui/Button';
import { Coin, Medal } from '../ui/Decor';
import ScreenHeader from '../ui/ScreenHeader';
import Stage from '../ui/Stage';
import { FONT_BODY, FONT_BODY_BOLD, FONT_DISPLAY } from '../ui/fonts';
import { FS, RADIUS, SPACE } from '../ui/tokens';

type Scope = 'world' | 'country' | 'city';
type Status = 'loading' | 'ready' | 'error' | 'geoUnavailable';

type Props = {
  player: PlayerProfile | null;
  /** This player's own lifetime coins — the leaderboard score — for the pinned "you" row. */
  myScore: number;
  /** This player's equipped leaderboard title id (see src/shop.ts), for the pinned "you" row. */
  myTitle: string;
  onBack?: () => void;
};

/** A two-letter ISO country code as its flag emoji (regional-indicator pair); null if malformed. */
const flagOf = (code: string | null): string | null => {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  const base = 0x1f1e6 - 'A'.charCodeAt(0);
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => base + c.charCodeAt(0)));
};

export default function Leaderboard({ player, myScore, myTitle, onBack }: Props) {
  const adHeight = useBannerHeight();
  const { theme } = useTheme();
  const [scope, setScope] = useState<Scope>('world');
  const [status, setStatus] = useState<Status>('loading');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [place, setPlace] = useState<string | null>(null); // country/city name shown under the active tab

  const load = useCallback(async (next: Scope) => {
    setStatus('loading');
    if (next === 'world') {
      setPlace(null);
      const r = await fetchAllTimeLeaderboard();
      setEntries(r.entries);
      setStatus(r.online ? 'ready' : 'error');
      return;
    }
    const geo = await ensureGeo();
    if (!geo || (next === 'country' ? !geo.country : !geo.city)) {
      setPlace(null);
      setStatus('geoUnavailable');
      return;
    }
    setPlace(next === 'country' ? geo.country : geo.city);
    const r = next === 'country' ? await fetchCountryLeaderboard(geo.country) : await fetchCityLeaderboard(geo.city);
    setEntries(r.entries);
    setStatus(r.online ? 'ready' : 'error');
  }, []);

  useEffect(() => {
    load('world');
  }, [load]);

  const selectScope = (next: Scope) => {
    if (next === scope) return;
    setScope(next);
    load(next);
  };

  const youAreRanked = !!player && entries.some((e) => e.uid === player.uid);
  const emptyCopy =
    scope === 'world' ? 'Nobody has set a score yet — be the first!' : `Nobody from ${place ?? 'here'} has set a score yet — be the first!`;

  return (
    <View style={styles.root}>
      <Stage variant="plain" />
      <ScreenHeader title="Leaderboard" onBack={onBack} />

      <View style={styles.tabs}>
        <ScopeTab label="Worldwide" active={scope === 'world'} onPress={() => selectScope('world')} />
        <ScopeTab label="Country" active={scope === 'country'} onPress={() => selectScope('country')} />
        <ScopeTab label="City" active={scope === 'city'} onPress={() => selectScope('city')} />
      </View>
      {place ? <Text style={[styles.place, { color: theme.inkSoft }]}>{place}</Text> : null}

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: SPACE.xxl + adHeight }]} showsVerticalScrollIndicator={false}>
        {status === 'loading' ? (
          <ActivityIndicator style={styles.spinner} color={theme.blue} size="large" />
        ) : status === 'error' ? (
          <StateMessage text="Leaderboard unavailable — check your connection." onRetry={() => load(scope)} />
        ) : status === 'geoUnavailable' ? (
          <StateMessage
            text={`Location unavailable for the ${scope === 'country' ? 'Country' : 'City'} board. Try Worldwide instead, or allow location and retry.`}
            onRetry={() => load(scope)}
          />
        ) : entries.length === 0 ? (
          <Text style={[styles.empty, { color: theme.inkSoft }]}>{emptyCopy}</Text>
        ) : (
          entries.map((e, i) => <Row key={e.id} rank={i + 1} entry={e} isYou={!!player && e.uid === player.uid} />)
        )}

        {status === 'ready' && !youAreRanked && player ? (
          <View style={styles.pinnedWrap}>
            <Text style={[styles.pinnedLabel, { color: theme.dim }]}>YOUR BEST</Text>
            <Row
              rank={0}
              entry={{
                id: 'you',
                uid: player.uid,
                name: player.name,
                score: myScore,
                dayKey: '',
                photoURL: player.photoURL,
                country: null,
                city: null,
                countryCode: null,
                title: myTitle,
              }}
              isYou
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function ScopeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={[
        styles.tab,
        { backgroundColor: active ? theme.blue : theme.card, borderColor: active ? theme.blueDeep : theme.cardEdge },
      ]}
    >
      <Text style={[styles.tabText, { color: active ? '#FFFFFF' : theme.inkSoft }]}>{label}</Text>
    </Pressable>
  );
}

/** One ranked row: a medal for the top 3, a plain number after that, or a "YOU" chip when `rank` is 0 (the
 *  pinned row, whose true rank beyond the fetched top 50 is unknown). */
function Row({ rank, entry, isYou }: { rank: number; entry: LeaderboardEntry; isYou: boolean }) {
  const { theme } = useTheme();
  const flag = flagOf(entry.countryCode);
  const locationLine = [flag, entry.city].filter(Boolean).join(' ');
  const title = titleById(entry.title ?? 'none');
  return (
    <View style={[styles.row, isYou ? { backgroundColor: theme.softBlue, borderRadius: RADIUS.lg } : null]}>
      <View style={styles.rankSlot}>
        {rank === 0 ? (
          <View style={[styles.youBadge, { backgroundColor: theme.blue }]}>
            <Text style={styles.youBadgeText}>YOU</Text>
          </View>
        ) : rank <= 3 ? (
          <Medal place={rank} size={30} />
        ) : (
          <Text style={[styles.rankText, { color: theme.inkSoft }]}>{rank}</Text>
        )}
      </View>
      {entry.photoURL ? (
        <Image source={{ uri: entry.photoURL }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.blue }]}>
          <Text style={styles.avatarText}>{entry.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          {title.icon ? <Image source={title.icon} resizeMode="contain" style={[styles.titleBadge, { tintColor: title.tint }]} /> : null}
          <Text style={[styles.name, { color: theme.ink }]} numberOfLines={1}>
            {entry.name}
          </Text>
        </View>
        {locationLine ? (
          <Text style={[styles.location, { color: theme.inkSoft }]} numberOfLines={1}>
            {locationLine}
          </Text>
        ) : null}
      </View>
      <View style={styles.scorePill}>
        <Coin size={14} />
        <Text style={[styles.scoreText, { color: theme.ink }]} numberOfLines={1}>
          {entry.score.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

function StateMessage({ text, onRetry }: { text: string; onRetry: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={styles.state}>
      <Text style={[styles.stateText, { color: theme.inkSoft }]}>{text}</Text>
      <Button label="RETRY" tone="light" size="sm" onPress={onRetry} />
    </View>
  );
}

/* ── Styles (layout only — colours come from the theme) ─────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1 },

  tabs: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: SPACE.lg, marginTop: SPACE.sm },
  tab: { flex: 1, borderWidth: 2, borderRadius: RADIUS.pill, paddingVertical: SPACE.sm, alignItems: 'center' },
  tabText: { fontSize: FS.small, fontFamily: FONT_BODY_BOLD, letterSpacing: 0.4 },
  place: { textAlign: 'center', marginTop: SPACE.sm, fontSize: FS.small, fontFamily: FONT_BODY_BOLD },

  body: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: SPACE.xxl, gap: SPACE.xs },

  spinner: { marginTop: SPACE.xxxl },
  empty: { textAlign: 'center', marginTop: SPACE.xxxl, fontSize: FS.body, fontFamily: FONT_BODY, paddingHorizontal: SPACE.lg },
  state: { alignItems: 'center', gap: SPACE.md, marginTop: SPACE.xxxl, paddingHorizontal: SPACE.lg },
  stateText: { textAlign: 'center', fontSize: FS.body, fontFamily: FONT_BODY },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.sm },
  rankSlot: { width: 32, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: FS.h3, fontFamily: FONT_DISPLAY },
  youBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: RADIUS.sm },
  youBadgeText: { fontSize: 9, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF', letterSpacing: 0.4 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: FS.h3, fontFamily: FONT_DISPLAY },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleBadge: { width: 16, height: 16 },
  name: { fontSize: FS.h3, fontFamily: FONT_BODY_BOLD },
  location: { fontSize: FS.cap, fontFamily: FONT_BODY },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  scoreText: { fontSize: FS.small, fontFamily: FONT_BODY_BOLD },

  pinnedWrap: { marginTop: SPACE.lg, gap: SPACE.xs },
  pinnedLabel: { fontSize: FS.cap, fontFamily: FONT_BODY_BOLD, letterSpacing: 1.2, marginLeft: SPACE.sm },
});

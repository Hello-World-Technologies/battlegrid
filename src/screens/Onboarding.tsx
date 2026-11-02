// src/screens/Onboarding.tsx
//
// Shown exactly once, right after the first splash, before the player has
// ever reached Home: choose Play Games or Guest up front instead of
// discovering the option later. A guest account already exists silently by
// the time this screen renders (App signs one in on mount) with an
// auto-assigned pseudonym (see src/anonymousNames.ts), so "Play as guest"
// just proceeds straight to Home. The player can rename themselves later
// from Profile.
//
// Play Games sign-in here links onto that same guest account (see
// src/firebase/auth.ts), so choosing it first still starts from the same
// anonymous uid. Android only — playGamesAvailable is false elsewhere.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICONS } from '../icons';
import { useTheme } from '../theme';
import Button from '../ui/Button';
import { FONT_BODY, FONT_BODY_BOLD, FONT_DISPLAY } from '../ui/fonts';
import OnboardingArt from '../ui/OnboardingArt';
import { PopIn, Pulse, SlideUp } from '../ui/ResultMotion';
import Stage from '../ui/Stage';
import { FS, SPACE } from '../ui/tokens';
import Logo from '../ui/Logo';
import Mascot from '../ui/Mascot';

type Props = {
  playGamesAvailable: boolean;
  /** Resolves once linked and lands on Home; rejects with a message to show inline. */
  onPlayGames: () => Promise<void>;
  /** The guest account already exists with its pseudonym, so this just proceeds to Home. */
  onGuest: () => void;
};

export default function Onboarding({ playGamesAvailable, onPlayGames, onGuest }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const artW = width - SPACE.lg * 2;

  const handlePlayGames = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onPlayGames();
    } catch (e: any) {
      setError(e?.message ?? 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stage variant="hero" />

      <View style={[styles.body, { paddingTop: insets.top + SPACE.md, paddingBottom: insets.bottom + SPACE.xl }]}>
        <View style={styles.brand}>
          <Logo width={130} />
        </View>

        <View style={styles.hero}>
          <PopIn from={0.9} delay={80}>
            <OnboardingArt width={artW} height={Math.min(artW * 0.9, 320)} />
          </PopIn>

          <SlideUp delay={300} distance={14} style={styles.copy}>
            <View style={styles.copyText}>
              <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>
                Welcome, Commander
              </Text>
              <Text style={[styles.text, { color: theme.inkSoft }]}>
                Drag from one of your territories to another to send troops. Take every territory on the map to win.
              </Text>
            </View>
            <Mascot size={92} delay={600} />
          </SlideUp>
        </View>

        <View style={styles.choiceArea}>
          {playGamesAvailable ? (
            <Pulse delay={900} enabled={!busy} style={styles.pulse}>
            <Button
              label="Sign in with Play Games"
              size="lg"
              tone="blue"
              fullWidth
              busy={busy}
              onPress={handlePlayGames}
              icon={<ICONS.playGames size={22} color="#FFFFFF" />}
            />
            </Pulse>
          ) : (
            <Pulse delay={900} style={styles.pulse}>
              <Button label="Play as guest" size="lg" tone="blue" fullWidth onPress={onGuest} />
            </Pulse>
          )}

          {playGamesAvailable ? (
            <Pressable
              onPress={onGuest}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Play as guest"
              hitSlop={10}
              style={styles.guestLink}
            >
              <Text style={[styles.guestLinkText, { color: theme.inkSoft }]}>Play as guest</Text>
            </Pressable>
          ) : null}

          {error ? <Text style={[styles.error, { color: theme.red }]}>{error}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingHorizontal: SPACE.lg, justifyContent: 'space-between' },

  brand: { alignItems: 'center' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACE.lg },
  copy: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.md },
  copyText: { flex: 1, gap: SPACE.sm },
  title: { fontSize: FS.title, lineHeight: 32, fontFamily: FONT_DISPLAY },
  text: { fontSize: FS.body, lineHeight: 20, fontFamily: FONT_BODY },

  choiceArea: { alignItems: 'center', alignSelf: 'stretch', gap: SPACE.md },

  pulse: { alignSelf: 'stretch' },
  guestLink: { paddingVertical: SPACE.sm },
  guestLinkText: { fontSize: FS.body, fontFamily: FONT_BODY_BOLD },

  error: { fontSize: FS.body, fontFamily: FONT_BODY, textAlign: 'center' },
});

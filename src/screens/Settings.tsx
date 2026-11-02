// src/screens/Settings.tsx
//
// Sound · Music · Vibration toggles, SAVE. Toggles are staged locally and
// only committed on SAVE (which also returns to the previous screen). Account
// (sign in / sign out / rename) lives on the Profile screen — not here.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICONS } from '../icons';
import { PLAY_STORE_URL } from '../links';
import { SettingsValue } from '../settings';
import { useTheme } from '../theme';
import Button, { IconButton } from '../ui/Button';
import Card, { SectionLabel } from '../ui/Card';
import { alpha } from '../ui/color';
import ScreenHeader from '../ui/ScreenHeader';
import Stage from '../ui/Stage';
import { FONT_BODY_BOLD } from '../ui/fonts';
import { FS, RADIUS, SPACE } from '../ui/tokens';

type Props = {
  initial: SettingsValue;
  onSave: (next: SettingsValue) => void;
  onBack?: () => void;
};

export default function Settings({ initial, onSave, onBack }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [sound, setSound] = useState(initial.sound);
  const [music, setMusic] = useState(initial.music);
  const [vibration, setVibration] = useState(initial.vibration);

  const shareApp = () => {
    Share.share({
      message: `Check out BattleGrid — a fast real-time territory conquest game!\n\n${PLAY_STORE_URL}`,
    }).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <Stage variant="plain" />

      <ScreenHeader
        title="Settings"
        onBack={onBack}
        right={
          <IconButton onPress={shareApp} label="Share app">
            <ICONS.share size={18} color={theme.ink} />
          </IconButton>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + SPACE.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <SectionLabel>Audio</SectionLabel>
          <Card padded={false}>
            <ToggleRow
              icon={<ICONS.volume size={17} color="#FFFFFF" />}
              iconColor={theme.blue}
              label="Sound effects"
              value={sound}
              onChange={setSound}
            />
            <Divider />
            <ToggleRow
              icon={<ICONS.music size={17} color="#FFFFFF" />}
              iconColor={theme.purple}
              label="Music"
              value={music}
              onChange={setMusic}
            />
          </Card>
        </View>

        <View>
          <SectionLabel>Gameplay</SectionLabel>
          <Card padded={false}>
            <ToggleRow
              icon={<ICONS.vibrate size={17} color="#FFFFFF" />}
              iconColor={theme.orange}
              label="Vibration"
              value={vibration}
              onChange={setVibration}
            />
          </Card>
        </View>

        <Button
          label="SAVE"
          size="lg"
          fullWidth
          tone="green"
          style={styles.save}
          onPress={() => onSave({ sound, music, vibration })}
        />
      </ScrollView>
    </View>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function ToggleRow({
  icon,
  iconColor,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  // The icon tile gives a small bounce each time its switch is flipped; a switched-off row fades its tile.
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.setValue(0.7);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }).start();
  }, [value, pop]);
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Animated.View
          style={[styles.icon, { backgroundColor: iconColor, opacity: value ? 1 : 0.45, transform: [{ scale: pop }] }]}
        >
          {icon}
        </Animated.View>
        <Text style={[styles.label, { color: theme.ink }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: alpha(theme.ink, 0.2), true: theme.green }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={alpha(theme.ink, 0.2)}
      />
    </View>
  );
}

function Divider() {
  const { theme } = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.cardDeep }]} />;
}

/* ── Styles (layout only — colours come from the theme) ─────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, gap: SPACE.md },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.lg,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  icon: { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: FS.h3, fontFamily: FONT_BODY_BOLD },
  divider: { height: 1, marginHorizontal: SPACE.lg },

  save: { marginTop: SPACE.sm },
});

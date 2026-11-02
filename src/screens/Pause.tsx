// src/screens/Pause.tsx
//
// Dialog over the live battlefield (png4): RESUME (primary), RESTART, a "Quit to menu" link and round
// sound / music / vibration toggles. The battlefield keeps its state underneath — this is an overlay,
// not a screen change.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { levelName } from '../game/core';
import { Ionicons } from '../icons';
import { SettingsValue } from '../settings';
import { useTheme } from '../theme';
import Button from '../ui/Button';
import { Chip } from '../ui/Card';
import Dialog from '../ui/Dialog';
import { FONT_BODY, FONT_BODY_BOLD } from '../ui/fonts';
import { PopIn, Pulse } from '../ui/ResultMotion';
import { FS, RADIUS, SPACE, lift } from '../ui/tokens';

type Props = {
  level: number;
  settings: SettingsValue;
  onSettingsChange: (next: SettingsValue) => void;
  onResume: () => void;
  onRestart: () => void;
  onLevels: () => void;
  onHome: () => void;
};

type ToggleDef = { key: keyof SettingsValue; label: string; on: string; off: string };

const TOGGLES: ToggleDef[] = [
  { key: 'sound', label: 'Sound effects', on: 'volume-high', off: 'volume-mute' },
  { key: 'music', label: 'Music', on: 'musical-notes', off: 'musical-notes-outline' },
  { key: 'vibration', label: 'Vibration', on: 'phone-portrait', off: 'phone-portrait-outline' },
];

export default function Pause({ level, settings, onSettingsChange, onResume, onRestart, onLevels, onHome }: Props) {
  const { theme } = useTheme();

  return (
    <Dialog title="Paused" onDismiss={onResume} maxWidth={340}>
      <Chip label={`Level ${level} · ${levelName(level)}`} tone="blue" style={styles.chip} />

      <View style={[styles.tip, { backgroundColor: theme.softBlue }]}>
        <Ionicons name="bulb" size={20} color={theme.gold} />
        <Text style={[styles.tipText, { color: theme.inkSoft }]}>
          <Text style={[styles.tipBold, { color: theme.blue }]}>Goal. </Text>
          Take every territory on the map to win. The battle is on hold.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pulse delay={500} style={styles.pulse}>
          <Button label="RESUME" size="lg" tone="green" fullWidth onPress={onResume} />
        </Pulse>
        <Button label="RESTART" tone="light" size="md" fullWidth onPress={onRestart} />
        <View style={styles.links}>
          <Pressable onPress={onLevels} accessibilityRole="button" accessibilityLabel="LEVELS" hitSlop={10}>
            <Text style={[styles.link, { color: theme.inkSoft }]}>Levels</Text>
          </Pressable>
          <Text style={[styles.link, { color: theme.muted }]}>·</Text>
          <Pressable onPress={onHome} accessibilityRole="button" accessibilityLabel="HOME" hitSlop={10}>
            <Text style={[styles.link, { color: theme.inkSoft }]}>Quit to menu</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.toggles}>
        {TOGGLES.map(({ key, label, on: onIcon, off: offIcon }, i) => {
          const on = settings[key];
          return (
            <PopIn key={key} delay={150 + i * 90} from={0.6}>
              <Pressable
                onPress={() => onSettingsChange({ ...settings, [key]: !on })}
                accessibilityRole="switch"
                accessibilityLabel={label}
                accessibilityState={{ checked: on }}
                style={[styles.toggle, { backgroundColor: on ? theme.softBlue : theme.cardAlt }, on ? lift(0.3) : null]}
              >
                <Ionicons name={(on ? onIcon : offIcon) as any} size={20} color={on ? theme.blue : theme.muted} />
              </Pressable>
            </PopIn>
          );
        })}
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'center', paddingHorizontal: SPACE.lg, marginBottom: SPACE.xs },
  tip: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: SPACE.md, borderRadius: RADIUS.lg, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg, marginBottom: SPACE.sm },
  tipText: { flex: 1, fontSize: FS.body, lineHeight: 19, fontFamily: FONT_BODY },
  tipBold: { fontFamily: FONT_BODY_BOLD },
  actions: { alignSelf: 'stretch', gap: SPACE.md },
  pulse: { alignSelf: 'stretch' },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.md, paddingTop: SPACE.xs },
  link: { fontSize: FS.body, fontFamily: FONT_BODY_BOLD },
  toggles: { flexDirection: 'row', gap: SPACE.lg, marginTop: SPACE.md },
  toggle: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
});

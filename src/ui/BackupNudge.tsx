// src/ui/BackupNudge.tsx
//
// A one-time nudge for guests: progress already saves to Firebase, but a guest's identity is an anonymous
// Firebase account stored only on-device — uninstalling the app loses it for good, since Firebase Anonymous
// Auth has no recovery path. Signing in with Play Games moves progress onto an account tied to Google, which
// does survive a reinstall. Shown once, after a few wins (see src/guestNudge.ts), from App.tsx.

import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import Button from './Button';
import Dialog from './Dialog';
import { FONT_BODY } from './fonts';
import { FS, SPACE } from './tokens';

type Props = {
  /** Opens the Play Games sheet; rejects (including SignInCancelled) if it does not complete. */
  onSignIn: () => Promise<void>;
  onDismiss: () => void;
};

export default function BackupNudge({ onSignIn, onDismiss }: Props) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSignIn();
      onDismiss();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Dialog title="Keep your progress" onDismiss={busy ? undefined : onDismiss}>
      <Text style={[styles.body, { color: theme.inkSoft }]}>
        You're playing as a guest — your progress lives only on this device. Sign in with Play Games so it's
        never lost, even if you uninstall.
      </Text>
      {error ? <Text style={[styles.error, { color: theme.red }]}>{error}</Text> : null}
      <Button label="SIGN IN WITH PLAY GAMES" tone="blue" size="md" fullWidth busy={busy} onPress={signIn} style={styles.cta} />
      <Button label="MAYBE LATER" tone="light" size="sm" fullWidth disabled={busy} onPress={onDismiss} />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: FS.body, fontFamily: FONT_BODY, textAlign: 'center', lineHeight: 20, paddingHorizontal: SPACE.md },
  error: { fontSize: FS.small, fontFamily: FONT_BODY, textAlign: 'center' },
  cta: { marginTop: SPACE.sm },
});

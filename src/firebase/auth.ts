// src/firebase/auth.ts
//
// Identity model:
//   • Every player is signed in, always. First launch creates an anonymous
//     Firebase account and derives a pseudonym from its uid, so guests can
//     play and post scores with zero friction.
//   • Play Games is an optional upgrade, Android-only. There is no
//     PlayGamesAuthProvider on the JS side of any Firebase SDK — it is a
//     native-only class — so the whole exchange (Play Games sign-in ->
//     server auth code -> Firebase credential -> link/sign-in) happens in
//     the native module registered as `PlayGamesAuth`
//     (android/app/src/main/java/com/battlegrid/playgames/). It signs
//     straight into FirebaseAuth.getInstance(), the same native singleton
//     @react-native-firebase/auth reads from, so `firebaseAuth.currentUser`
//     and observePlayer's listener below pick up the result with no extra
//     plumbing.
//   • The native module links the credential onto the existing anonymous
//     account rather than creating a new one, so the uid — and therefore
//     every leaderboard row keyed on it — carries over. If that Play Games
//     account already owns a different uid (a returning player on a fresh
//     install), it signs into that account instead: its own history is what
//     they expect to see.
//
// Every function degrades instead of throwing: if Firebase is unconfigured the
// game must still be playable offline, just without a global leaderboard.

import { NativeModules, Platform } from 'react-native';
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut as fbSignOut,
  updateProfile,
  User,
} from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseAuth } from './config';
import { logPlayGamesLogin } from './analytics';
import { anonymousNameFor } from '../anonymousNames';

export type PlayerProfile = {
  uid: string;
  /** Name shown on the leaderboard: Play Games display name, or a pseudonym. */
  name: string;
  isGuest: boolean;
  /** Play Games profile photo; null for guests. */
  photoURL: string | null;
  /** Play Games account email; usually null — Play Games sign-in does not
   *  grant an email scope. Never shown on the board. */
  email: string | null;
};

/** True only on Android, with Firebase configured — Play Games Services has
 *  no iOS or web equivalent. */
export const isPlayGamesSignInAvailable = Platform.OS === 'android' && !!firebaseAuth;

const PROFILE_KEY = '@battlegrid/profile';
const LOCAL_GUEST_KEY = '@battlegrid/localGuestId';
/** Set on a Play Games sign-in, cleared on sign-out: tells launch to restore
 *  the Play Games session rather than settle for a guest. */
const PLAY_GAMES_UID_KEY = '@battlegrid/playGamesUid';

/** The provider id Firebase's native Android SDK assigns to a Play Games
 *  credential (com.google.firebase.auth.PlayGamesAuthProvider.PROVIDER_ID). */
const PLAY_GAMES_PROVIDER_ID = 'playgames.google.com';

/** Raised when the user backs out of the Play Games sheet — not an error to
 *  report. */
export class SignInCancelled extends Error {
  constructor() {
    super('Sign-in cancelled');
    this.name = 'SignInCancelled';
  }
}

/** A sign-in failure the player should see, carrying the underlying code. */
export class SignInFailed extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'SignInFailed';
    this.code = code;
  }
}

/**
 * Turn a Play Games native-module error into something actionable. The
 * native module (see PlayGamesAuthModule.kt) already resolves Google Play
 * Services status codes to a human string, so this mostly just adds context
 * for the codes it defines itself.
 */
const describeSignInError = (err: any): SignInFailed => {
  const code = String(err?.code ?? 'unknown');
  const message = String(err?.message ?? '');

  if (code === 'NO_PLAY_GAMES_APP_ID') {
    return new SignInFailed(
      'Play Games is not set up yet: put the numeric Application ID from Play Console ' +
        '(Play Games Services > Configuration) into android/app/src/main/res/values/strings.xml (app_id), then rebuild.',
      code,
    );
  }
  if (code === 'NO_WEB_CLIENT_ID') {
    return new SignInFailed(
      "This build has no default_web_client_id — download the real " +
        'android/app/google-services.json from the Firebase console.',
      code,
    );
  }
  if (code === 'NO_ACTIVITY' || code === 'IN_PROGRESS') {
    return new SignInFailed('Try again in a moment.', code);
  }
  if (code === 'NO_AUTH_CODE') {
    return new SignInFailed(
      'Google Play services did not return a sign-in code. Try again.',
      code,
    );
  }
  if (message.includes('DEVELOPER_ERROR')) {
    return new SignInFailed(
      "Google rejected this build's configuration (DEVELOPER_ERROR). Check that " +
        "Play Games Services is configured for com.battlegrid.game in the Play " +
        'Console, with this build’s SHA-1 registered.',
      code,
    );
  }
  return new SignInFailed(
    `Play Games sign-in failed${message ? `: ${message}` : ''}.`,
    code,
  );
};

/**
 * The native module signs straight into FirebaseAuth's native singleton, so
 * the JS SDK's `currentUser` reference only catches up once its own
 * auth-state listener fires. Linking (first-time sign-in) mutates that
 * reference in place, so a same-tick `reload()` used to happen to see it —
 * but the collision path (a returning player, or any repeat sign-in after
 * sign-out) swaps in a *different* existing account, and reload() raced
 * that swap, throwing "did not sync" on a plain timing loss. Wait for the
 * listener to actually report the uid instead of racing a stale reference.
 */
const waitForUid = (uid: string, timeoutMs = 8000): Promise<User> =>
  new Promise((resolve, reject) => {
    if (!firebaseAuth) {
      reject(new Error('Firebase not configured'));
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('Sign-in succeeded but the signed-in user did not sync'));
    }, timeoutMs);
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user?.uid === uid) {
        clearTimeout(timer);
        unsubscribe();
        resolve(user);
      }
    });
  });

const playGamesProvider = (user: User) =>
  user.providerData.find((p) => p.providerId === PLAY_GAMES_PROVIDER_ID) ?? null;

/** Map a Firebase user to the profile the leaderboard displays. */
export const profileFromUser = (user: User): PlayerProfile => {
  const playGames = playGamesProvider(user);
  // isAnonymous alone can report a linked Play Games account as anonymous
  // after a cold start; the linked provider is the authoritative signal.
  const isGuest = user.isAnonymous && !playGames;
  const name = isGuest
    ? (user.displayName ?? '').trim() || anonymousNameFor(user.uid)
    : (playGames?.displayName ?? user.displayName ?? '').trim() || 'Player';
  return {
    uid: user.uid,
    name,
    isGuest,
    photoURL: isGuest ? null : playGames?.photoURL ?? user.photoURL ?? null,
    email: isGuest ? null : playGames?.email ?? user.email ?? null,
  };
};

// ─── Local persistence ─────────────────────────────────────────────────────

/** Mirror the profile to device storage so the Play Games identity survives
 *  offline launches and is available to any screen without a round-trip. */
export const saveProfile = async (p: PlayerProfile | null): Promise<void> => {
  try {
    if (p) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(p));
    else await AsyncStorage.removeItem(PROFILE_KEY);
  } catch {}
};

export const loadSavedProfile = async (): Promise<PlayerProfile | null> => {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as PlayerProfile) : null;
  } catch {
    return null;
  }
};

/** Offline fallback when Firebase is unconfigured: a device-local guest whose
 *  id is minted once and reused, so the nickname is stable across launches.
 *  Prefers a name the player set via setGuestName over the generated one. */
export const localGuestProfile = async (): Promise<PlayerProfile> => {
  let id: string | null = null;
  try {
    id = await AsyncStorage.getItem(LOCAL_GUEST_KEY);
  } catch {}
  if (!id) {
    id = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      await AsyncStorage.setItem(LOCAL_GUEST_KEY, id);
    } catch {}
  }
  const saved = await loadSavedProfile();
  if (saved && saved.uid === id && saved.isGuest) return saved;
  return { uid: id, name: anonymousNameFor(id), isGuest: true, photoURL: null, email: null };
};

/** Set synchronously the instant sign-out starts, so the very next guest
 *  session can never be silently pulled back into the Play Games account —
 *  even if the AsyncStorage marker clear below is slow or fails. In-memory
 *  only: a real app relaunch always starts this false again, which is
 *  correct — the persisted marker (cleared, reliably, on sign-out) is what
 *  keeps a player on their chosen guest across relaunches. */
let suppressAutoRestore = false;

// ─── Session ───────────────────────────────────────────────────────────────

/**
 * Subscribe to auth state. Returns an unsubscribe function. Emits null when
 * signed out; the caller is expected to respond by creating a fresh guest.
 * Without Firebase it emits a device-local guest once.
 */
export const observePlayer = (
  onChange: (profile: PlayerProfile | null) => void,
): (() => void) => {
  if (!firebaseAuth) {
    localGuestProfile().then(onChange);
    return () => {};
  }
  let restoreTried = false;
  return onAuthStateChanged(firebaseAuth, async (user) => {
    let profile = user ? profileFromUser(user) : null;
    if (profile && !profile.isGuest) {
      rememberPlayGamesUid(profile.uid);
    } else if (!restoreTried && !suppressAutoRestore && (await wasPlayGamesPlayer())) {
      // A Play Games player came back as a guest (or with no session):
      // restore their account before the app settles for a guest.
      restoreTried = true;
      profile = (await restorePlayGamesSession()) ?? profile;
    }
    // A concrete session (the null pass is just a stop on the way to one)
    // means sign-out has fully resolved into whatever comes next — lift the
    // guard so a later, real Play Games sign-in isn't blocked by it.
    if (profile) suppressAutoRestore = false;
    saveProfile(profile);
    onChange(profile);
  });
};

const rememberPlayGamesUid = (uid: string) =>
  AsyncStorage.setItem(PLAY_GAMES_UID_KEY, uid).catch(() => {});

const wasPlayGamesPlayer = async (): Promise<boolean> => {
  try {
    if (await AsyncStorage.getItem(PLAY_GAMES_UID_KEY)) return true;
  } catch {}
  const saved = await loadSavedProfile();
  return !!saved && !saved.isGuest;
};

/** Silently re-establishes the Play Games session on launch. Never shows UI;
 *  null means there was nothing to restore. */
async function restorePlayGamesSession(): Promise<PlayerProfile | null> {
  const nativeModule = NativeModules.PlayGamesAuth;
  if (!firebaseAuth || !isPlayGamesSignInAvailable || !nativeModule?.restoreSession) return null;
  try {
    const result = await nativeModule.restoreSession();
    if (!result?.uid) return null;
    const profile = profileFromUser(await waitForUid(result.uid));
    if (profile.isGuest) return null;
    return profile;
  } catch (err) {
    console.warn('[Auth] Play Games session restore failed:', err);
    return null;
  }
}

// ─── Guest ─────────────────────────────────────────────────────────────────

export async function signInAsGuest(): Promise<PlayerProfile | null> {
  if (!firebaseAuth) return localGuestProfile();
  // Never replace a live session (e.g. a just-restored Play Games account).
  if (firebaseAuth.currentUser) return profileFromUser(firebaseAuth.currentUser);
  // This mints a deliberate new guest for this session — the auth-state event
  // it produces must not be silently swapped for a stale Play Games session
  // by observePlayer's auto-restore. Cleared automatically
  // once any concrete profile resolves, same as the sign-out path below.
  suppressAutoRestore = true;
  try {
    const { user } = await signInAnonymously(firebaseAuth);
    return profileFromUser(user);
  } catch (err) {
    console.warn('[Auth] guest sign-in failed:', err);
    return null;
  }
}

/** Names the current guest (Onboarding's "Play as guest" popup, or choosing
 *  it again after a sign-out). Overrides the generated pseudonym; the
 *  identity itself — uid, and everything tied to it — is unchanged. */
export async function setGuestName(name: string): Promise<PlayerProfile | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  if (!firebaseAuth) {
    const guest = await localGuestProfile();
    const profile = { ...guest, name: trimmed };
    await saveProfile(profile);
    return profile;
  }

  const user = firebaseAuth.currentUser;
  if (!user) return null;
  try {
    await updateProfile(user, { displayName: trimmed });
    // Not profileFromUser(user).name: the native SDK just wrote displayName
    // on its own singleton, and this `user` reference can still read back the
    // pre-update value for a beat — the same lag documented for Play Games
    // sign-in above. `trimmed` is already known-good, so use it directly
    // rather than re-deriving a name that may still resolve to the old
    // pseudonym.
    const profile = { ...profileFromUser(user), name: trimmed };
    await saveProfile(profile);
    return profile;
  } catch (err) {
    console.warn('[Auth] setGuestName failed:', err);
    return null;
  }
}

// ─── Play Games ────────────────────────────────────────────────────────────

export async function signInWithPlayGames(): Promise<PlayerProfile | null> {
  if (!firebaseAuth || !isPlayGamesSignInAvailable) {
    throw new SignInFailed(
      'Play Games sign-in is not available in this build (Android only, and ' +
        'Firebase must be configured).',
      'not-configured',
    );
  }
  const nativeModule = NativeModules.PlayGamesAuth;
  if (!nativeModule) {
    throw new SignInFailed(
      'The Play Games native module is missing — rebuild the native app.',
      'not-configured',
    );
  }
  try {
    const { uid } = await nativeModule.signIn();
    // The native module linked/signed in and set the name+photo behind JS's
    // back — wait for the JS auth-state listener to actually report that
    // uid rather than trusting the (possibly stale, possibly swapped-out)
    // cached currentUser reference.
    const user = await waitForUid(uid);
    logPlayGamesLogin();
    const profile = profileFromUser(user);
    await saveProfile(profile);
    await rememberPlayGamesUid(profile.uid);
    return profile;
  } catch (err: any) {
    if (err?.code === 'SIGN_IN_CANCELLED') throw new SignInCancelled();
    const described = describeSignInError(err);
    console.warn(`[Auth] Play Games sign-in failed (${described.code}):`, err);
    throw described;
  }
}

// ─── Sign out ──────────────────────────────────────────────────────────────

/** Ends the Play Games session. observePlayer then emits null and the app
 *  mints a fresh guest, so the player is never left signed out. */
export async function signOutPlayer(): Promise<void> {
  suppressAutoRestore = true;
  try {
    if (NativeModules.PlayGamesAuth) {
      await NativeModules.PlayGamesAuth.signOut().catch(() => {});
    }
    // Cleared before signing out so the resulting null emission mints a
    // guest instead of restoring the account the player just left.
    await AsyncStorage.removeItem(PLAY_GAMES_UID_KEY).catch(() => {});
    await saveProfile(null);
    if (firebaseAuth) await fbSignOut(firebaseAuth);
  } catch (err) {
    console.warn('[Auth] sign-out failed:', err);
  }
}

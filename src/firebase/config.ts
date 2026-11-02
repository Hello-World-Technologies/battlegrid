// src/firebase/config.ts
//
// Firebase bootstrap.
//
// @react-native-firebase wraps the native Android/iOS Firebase SDKs, which
// initialise themselves from android/app/google-services.json and
// ios/GoogleService-Info.plist — there is no JS-side config object to fill
// in and no .env dependency here (unlike the old web-SDK setup this
// replaced). google-services.json is committed to this (private) repo;
// GoogleService-Info.plist isn't yet checked in and must be added per iOS
// dev machine from the Firebase console. Missing native config is non-fatal
// on purpose: this module is imported at the top of App.tsx, so throwing
// here would take the whole bundle down and every screen with it. Instead
// `db`/`firebaseAuth` are null and the app degrades to an offline,
// guest-only state.

import { getApp, getApps, FirebaseApp } from '@react-native-firebase/app';
import { getFirestore, Firestore } from '@react-native-firebase/firestore';
import { getAuth, Auth } from '@react-native-firebase/auth';

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;

export const isFirebaseConfigured = getApps().length > 0;

if (!isFirebaseConfigured) {
  console.warn(
    '[Firebase] Disabled — no native Firebase app found. Add ' +
      'android/app/google-services.json (and ios/GoogleService-Info.plist for ' +
      'iOS) from the Firebase console, then rebuild the native app — this is ' +
      'not something a JS/Metro reload can pick up.',
  );
} else {
  try {
    app = getApp();
    firestore = getFirestore(app);
    auth = getAuth(app);
  } catch (err) {
    console.warn('[Firebase] Initialisation failed:', err);
    app = null;
    firestore = null;
    auth = null;
  }
}

export const db: Firestore | null = firestore;
export const firebaseAuth: Auth | null = auth;

export default app;

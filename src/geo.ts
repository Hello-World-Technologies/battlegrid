// src/geo.ts
//
// Coarse location for the Leaderboard screen's Country/City tabs. Requested lazily — only when
// one of those tabs is opened for the first time — so the OS permission prompt never appears
// unprompted, and cached in memory for the rest of the session once resolved (or once denied, so
// a "not now" is not re-prompted every tab switch). No backend: a position is reverse-geocoded to
// a country/city with BigDataCloud's free, key-less client-side endpoint
// (https://www.bigdatacloud.com/geocoding-apis), matching the "no Cloud Functions" shape of the
// rest of the leaderboard. Android only — iOS is not set up for this build (see AGENTS.md).

import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export type Geo = {
  country: string;
  city: string;
  countryCode: string | null;
};

// undefined = not tried this session yet; null = tried and failed or was denied.
let cached: Geo | null | undefined;

async function requestPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION, {
      title: 'Location for the leaderboard',
      message: 'BattleGrid uses your rough location to show Country and City leaderboards. Worldwide always works without it.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function getPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

async function reverseGeocode(latitude: number, longitude: number): Promise<Geo | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const country = typeof data.countryName === 'string' ? data.countryName : '';
    const city =
      typeof data.city === 'string' && data.city ? data.city : typeof data.locality === 'string' ? data.locality : '';
    if (!country) return null;
    return { country, city, countryCode: typeof data.countryCode === 'string' ? data.countryCode : null };
  } catch {
    return null;
  }
}

/**
 * Resolves to the device's country/city once per app session: permission, then a position fix,
 * then a reverse-geocode call. Every failure (denied, no fix, offline, bad response) resolves to
 * null rather than throwing — callers fall back to the Worldwide board.
 */
export async function ensureGeo(): Promise<Geo | null> {
  if (cached !== undefined) return cached;
  const allowed = await requestPermission();
  if (!allowed) {
    cached = null;
    return null;
  }
  try {
    const { latitude, longitude } = await getPosition();
    cached = await reverseGeocode(latitude, longitude);
  } catch {
    cached = null;
  }
  return cached;
}

/** Test-only: clears the in-memory cache so each test starts fresh. */
export const resetGeoCache = (): void => {
  cached = undefined;
};

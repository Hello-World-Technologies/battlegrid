# Ads Integration Guide (Unity LevelPlay + Meta Audience Network)

Everything needed to add ads to a React Native (CLI, no Expo) Android game, taken from
Cube Fall. Mediation is **Unity LevelPlay**; the only ad network is **Meta Audience
Network (bidding)**. Formats: **banner**, **interstitial**, **rewarded**.

Contents: 1 Overview · 2 Dashboard setup · 3 Install · 4 Code (full source) · 5 Wiring ·
6 Consent · 7 Dev vs production · 8 Release checklist · 9 Troubleshooting · 10 Gotchas

---

## 1. Overview

```
Game UI ── AdBanner (component)           ┐
        ── AdService.showInterstitial()   ├── unity-levelplay-mediation (RN wrapper)
        ── AdService.showRewarded()       ┘        │
        ── AdConsentPrompt (dialog)                 ▼
                                       LevelPlay native SDK ── Meta adapter ── Meta SDK
```

- `src/config/ads.ts` – app key, ad unit ids, `ADS_CONFIGURED`.
- `src/services/AdService.ts` – init, privacy flags, interstitial + rewarded lifecycle.
- `src/components/AdBanner.tsx` – banner view + dev-only test-suite button.
- `src/components/AdConsentPrompt.tsx` – first-launch consent dialog.
- `android/.../MainApplication.kt` – **debug only** Meta test mode.
- `android/app/build.gradle` – Meta adapter dependency.

Design rules that made it safe:
- Every public `AdService` call swallows its own errors. Ads must never crash or block the game.
- Ad objects (interstitial/rewarded) are created **only after** `onInitSuccess`.
- After a close or load failure, the ad is reloaded (failures retry with backoff 5s → 60s).
- If an ad isn't ready, the game just continues (`proceed()` runs immediately).
- The "Watch ad" button is shown **only** when a rewarded ad is actually loaded.

---

## 2. Dashboard setup (do this first, ads depend on it)

### Meta Monetization Manager (business.facebook.com → Monetization Manager)
1. Create a **Property** for the Android package (e.g. `com.cubefall.game`).
2. Create **3 placements** in it, one per format, with the right type:
   Banner, Interstitial, **Rewarded video**. Each gets an id like
   `<metaAppId>_<placementNumber>`. Status must be **Receiving ads**.
3. Integration → **Bidding setup**: connect Meta with LevelPlay as the mediation partner.
4. Integration → **Testing**: add your phone as a test device (Google Advertising ID).
5. Check **Issues** tab for warnings. Payout/business verification must be complete.
6. Add `app-ads.txt` to your developer website and link it in Play Console.

### Unity LevelPlay (platform.ironsrc.com)
1. Add the Android app → you get the **App Key** (e.g. `2901ec11d`).
2. **Setup → Ad units**: create 3 ad units (Banner, Interstitial, Rewarded) → 3 ids.
3. **Setup → Networks → Meta (Bidding)**: enter the **Meta App ID** and add **3 instances**.
   Each instance = one ad format, and its **Placement ID must be the matching Meta
   placement** (rewarded instance ↔ rewarded placement, etc. — mixing them gives errors).
4. Make sure every instance is **active** and set to "All Countries".

> Meta ids live only in the dashboards. The app uses only the LevelPlay App Key and
> LevelPlay ad unit ids.

---

## 3. Install

```bash
npm i unity-levelplay-mediation        # used: ^9.4.0 (pulls native LevelPlay SDK 9.7.0)
```

`android/app/build.gradle` → `dependencies { ... }`:
```gradle
// Meta adapter; bundles Meta's audience-network-sdk, so don't declare it separately.
implementation "com.unity3d.ads-mediation:facebook-adapter:5.6.0"
implementation "com.google.android.gms:play-services-appset:16.0.2"
implementation "com.google.android.gms:play-services-ads-identifier:18.0.1"
```
`android/build.gradle` needs `google()` and `mavenCentral()` in repositories (default RN has them).

`AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
<uses-permission android:name="com.google.android.gms.permission.AD_ID"/>
```

`MainApplication.kt` (debug-only Meta test mode — see section 7):
```kotlin
import com.facebook.ads.AdSettings
...
override fun onCreate() {
  super.onCreate()
  if (BuildConfig.DEBUG) {
    AdSettings.setTestMode(true)
    AdSettings.addTestDevice("<your-device-hash>") // from logcat, see section 7
  }
  loadReactNative(this)
}
```

Minify is off in release (`android.enableMinifyInReleaseBuilds` defaults to false). If you ever
turn it on, add keep rules for `com.ironsource.**`, `com.unity3d.mediation.**` and
`com.facebook.ads.**`.

Rebuild native after changing gradle (`npx react-native run-android` or `gradlew`).

---

## 4. Code (full source)

### `src/config/ads.ts`

```ts
/**
 * Unity LevelPlay (Meta Audience Network demand) identifiers.
 *
 * Debug builds (`__DEV__`) use the TEST set, release builds the PRODUCTION
 * set. Keep both here so a separate test app can be swapped in later.
 *
 * The App Key and ad unit ids are LevelPlay's, not Meta's. The Meta App ID
 * (1003804126069487) and Meta placement ids live in the LevelPlay dashboard
 * mapping, not in the app.
 */
const PRODUCTION = {
  appKey: '2901ec11d',
  interstitial: '4n7ve7p6t87kqrp1',
  rewarded: 'ta6aq7p1c17rqu8b',
  banner: '99nxomrxmi8pssrx',
};

// LevelPlay has no separate test ids: debug builds reuse the production ids and
// get test ads because the device is registered as a Meta test device
// (Monetization Manager > Integration > Testing) and the LevelPlay test suite.
const TEST = PRODUCTION;

const ids = __DEV__ ? TEST : PRODUCTION;

export const LEVELPLAY_APP_KEY = ids.appKey;
export const INTERSTITIAL_AD_UNIT_ID = ids.interstitial;
export const REWARDED_AD_UNIT_ID = ids.rewarded;
export const BANNER_AD_UNIT_ID = ids.banner;

export const ADS_CONFIGURED = !LEVELPLAY_APP_KEY.startsWith('INSERT_');

export const AD_FREQUENCY = {
  /** How long to wait for a late `onAdRewarded` after the ad closes. */
  rewardGraceMs: 1500,
} as const;

```

### `src/services/AdService.ts`

```ts
import {
  LevelPlay,
  LevelPlayInitRequest,
  LevelPlayInterstitialAd,
  LevelPlayPrivacySettings,
  LevelPlayRewardedAd,
} from 'unity-levelplay-mediation';

import {
  AD_FREQUENCY,
  ADS_CONFIGURED,
  INTERSTITIAL_AD_UNIT_ID,
  LEVELPLAY_APP_KEY,
  REWARDED_AD_UNIT_ID,
} from '@/config/ads';
import { appStorage } from '@/services/StorageService';

/**
 * Unity LevelPlay mediation (Meta Audience Network demand only).
 *
 * Every public call swallows its own failure, like the other services: ads
 * must never be able to break or block the game. Ad objects are created only
 * after `init` reports success, and are reloaded after each close/failure.
 */

const CONSENT_KEY = 'cubefall.adConsent';
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 60_000;

type Consent = 'granted' | 'denied';

const log = (...args: unknown[]): void => {
  if (__DEV__) console.log('[Ads]', ...args);
};

let initStarted = false;
let ready = false;
let interstitial: LevelPlayInterstitialAd | null = null;
let rewarded: LevelPlayRewardedAd | null = null;
let interstitialShowing = false;
let rewardedShowing = false;
let interstitialRetries = 0;
let rewardedRetries = 0;
const readyListeners = new Set<() => void>();

const retryDelay = (attempt: number): number =>
  Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt);

function loadInterstitial(): void {
  interstitial?.loadAd().catch((e) => log('interstitial load threw', e));
}

function loadRewarded(): void {
  rewarded?.loadAd().catch((e) => log('rewarded load threw', e));
}

/** Resolver for the show in flight, so close/fail callbacks settle it once. */
let finishInterstitial: (() => void) | null = null;
/** The rewarded show in flight; `settle` is idempotent. */
let rewardSession: {
  earned: boolean;
  closed: boolean;
  settle: (earned: boolean) => void;
} | null = null;

function createAds(): void {
  interstitial = new LevelPlayInterstitialAd(INTERSTITIAL_AD_UNIT_ID);
  interstitial.setListener({
    onAdLoaded: () => {
      interstitialRetries = 0;
      log('interstitial loaded');
    },
    onAdLoadFailed: (error) => {
      log('interstitial load failed', error);
      setTimeout(loadInterstitial, retryDelay(interstitialRetries++));
    },
    onAdDisplayed: () => log('interstitial displayed'),
    onAdDisplayFailed: (error) => {
      log('interstitial display failed', error);
      interstitialShowing = false;
      finishInterstitial?.();
      loadInterstitial();
    },
    onAdClosed: () => {
      interstitialShowing = false;
      finishInterstitial?.();
      loadInterstitial();
    },
  });

  rewarded = new LevelPlayRewardedAd(REWARDED_AD_UNIT_ID);
  rewarded.setListener({
    onAdLoaded: () => {
      rewardedRetries = 0;
      log('rewarded loaded');
    },
    onAdLoadFailed: (error) => {
      log('rewarded load failed', error);
      setTimeout(loadRewarded, retryDelay(rewardedRetries++));
    },
    onAdDisplayed: () => log('rewarded displayed'),
    onAdDisplayFailed: (error) => {
      log('rewarded display failed', error);
      rewardSession?.settle(false);
      loadRewarded();
    },
    // The reward and the close can arrive in either order: `earned` is
    // recorded on whichever comes first, and the show settles on close (or
    // right away if the reward lands after the close).
    onAdRewarded: () => {
      const session = rewardSession;
      if (!session) return;
      session.earned = true;
      if (session.closed) session.settle(true);
    },
    onAdClosed: () => {
      const session = rewardSession;
      loadRewarded();
      if (!session) return;
      session.closed = true;
      if (session.earned) {
        session.settle(true);
      } else {
        setTimeout(() => session.settle(session.earned), AD_FREQUENCY.rewardGraceMs);
      }
    },
  });

  loadInterstitial();
  loadRewarded();
}

/**
 * Regions with a consent rule for personalised ads: EEA, UK, Switzerland (GDPR),
 * US (CCPA/state laws), Canada, Brazil (LGPD).
 */
const CONSENT_REGIONS = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH', 'US', 'CA', 'BR',
]);

/** Region from the device locale (e.g. "en-PK" -> "PK"); null when it has none. */
function deviceRegion(): string | null {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return /[-_]([A-Za-z]{2})(?:$|[-_])/.exec(locale)?.[1].toUpperCase() ?? null;
  } catch {
    return null;
  }
}

/** Consent is applied by the device region; an unknown region is asked. */
async function applyPrivacy(): Promise<void> {
  const consented = !AdService.consentRequired() || AdService.getConsent() === 'granted';
  await LevelPlayPrivacySettings.setGDPRConsent(consented);
  // CCPA: "do not sell" stays on until the player has opted in.
  await LevelPlayPrivacySettings.setCCPA(!consented);
}

export const AdService = {
  /** Whether this player's region needs a consent choice before personalised ads. */
  consentRequired(): boolean {
    const region = deviceRegion();
    return region === null || CONSENT_REGIONS.has(region);
  },

  /** The stored consent choice, or null if the player hasn't been asked. */
  getConsent(): Consent | null {
    const v = appStorage.getString(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  },

  /** Record the player's choice and, if the SDK is already up, apply it now. */
  setConsent(consent: Consent): void {
    appStorage.set(CONSENT_KEY, consent);
    if (initStarted) void applyPrivacy().catch((e) => log('privacy update threw', e));
  },

  /**
   * Initialise LevelPlay once per app lifecycle. Privacy flags are applied
   * first; consent is never assumed — no stored choice means "denied".
   */
  async init(): Promise<void> {
    if (!ADS_CONFIGURED) {
      log('LevelPlay app key not set; ads disabled');
      return;
    }
    if (initStarted) return;
    initStarted = true;
    try {
      await applyPrivacy();
      // COPPA is only accepted before init, so it is not part of applyPrivacy().
      await LevelPlayPrivacySettings.setCOPPA(false);
      if (__DEV__) {
        await LevelPlay.setAdaptersDebug(true);
        // Required before init for LevelPlay.launchTestSuite().
        await LevelPlay.setMetaData('is_test_suite', ['enable']);
      }
      await LevelPlay.init(LevelPlayInitRequest.builder(LEVELPLAY_APP_KEY).build(), {
        onInitSuccess: () => {
          log('LevelPlay initialised');
          ready = true;
          createAds();
          readyListeners.forEach((fn) => fn());
          if (__DEV__) void LevelPlay.validateIntegration().catch(() => {});
        },
        onInitFailed: (error) => {
          log('LevelPlay init failed', error);
          initStarted = false;
        },
      });
    } catch (e) {
      log('LevelPlay init threw', e);
      initStarted = false;
    }
  },

  /** True once the SDK is up; banners are only worth mounting then. */
  isReady(): boolean {
    return ready;
  },

  /** Subscribe to SDK init success; returns the unsubscribe. */
  onReady(listener: () => void): () => void {
    readyListeners.add(listener);
    return () => readyListeners.delete(listener);
  },

  async isRewardedReady(): Promise<boolean> {
    try {
      return !!rewarded && !rewardedShowing && (await rewarded.isAdReady());
    } catch {
      return false;
    }
  },

  /**
   * Shows an interstitial if one is loaded, then runs `proceed` once it is
   * gone. If none is ready (or anything fails) `proceed` runs immediately,
   * so the player is never blocked. No reward is attached.
   */
  async showInterstitial(proceed: () => void): Promise<void> {
    try {
      if (!ready || !interstitial || interstitialShowing || rewardedShowing) {
        return proceed();
      }
      if (!(await interstitial.isAdReady())) return proceed();
      interstitialShowing = true;
      let done = false;
      finishInterstitial = () => {
        if (done) return;
        done = true;
        finishInterstitial = null;
        proceed();
      };
      await interstitial.showAd('Leaderboard');
    } catch (e) {
      log('interstitial show threw', e);
      interstitialShowing = false;
      if (finishInterstitial) finishInterstitial();
      else proceed();
    }
  },

  /**
   * Player-initiated rewarded ad. Resolves true only if `onAdRewarded` fired
   * for this show, exactly once per show; false on any failure or dismissal.
   */
  async showRewarded(): Promise<boolean> {
    if (rewardSession || !(await AdService.isRewardedReady()) || !rewarded) return false;
    return new Promise<boolean>((resolve) => {
      rewardedShowing = true;
      let settled = false;
      const session = {
        earned: false,
        closed: false,
        settle: (earned: boolean) => {
          if (settled) return;
          settled = true;
          rewardSession = null;
          rewardedShowing = false;
          resolve(earned);
        },
      };
      rewardSession = session;
      rewarded!.showAd('Revive').catch((e) => {
        log('rewarded show threw', e);
        session.settle(false);
      });
    });
  },
};

```

### `src/components/AdBanner.tsx`

```ts
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LevelPlay,
  LevelPlayAdSize,
  LevelPlayBannerAdView,
  type LevelPlayBannerAdViewMethods,
} from 'unity-levelplay-mediation';

import { ADS_CONFIGURED, BANNER_AD_UNIT_ID } from '@/config/ads';
import { AdService } from '@/services/AdService';

/**
 * Adaptive LevelPlay banner pinned to the bottom safe edge. Renders nothing
 * until the SDK has initialised and the banner has actually loaded, so a
 * missing or failed ad leaves no empty strip. Intended for menu screens only
 * — never mount it over active gameplay.
 */
export function AdBanner() {
  const { bottom } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [ready, setReady] = useState(AdService.isReady());
  const [size, setSize] = useState<LevelPlayAdSize | null>(null);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<LevelPlayBannerAdViewMethods>(null);

  useEffect(() => AdService.onReady(() => setReady(true)), []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    LevelPlayAdSize.createAdaptiveAdSize(Math.floor(width))
      .then((s) => {
        if (!cancelled) setSize(s ?? LevelPlayAdSize.BANNER);
      })
      .catch(() => {
        if (!cancelled) setSize(LevelPlayAdSize.BANNER);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, width]);

  // The view does not request an ad by itself: load once it has a size.
  useEffect(() => {
    if (size) ref.current?.loadAd();
  }, [size]);

  // Release the native banner (and stop its refresh) when the menu goes away.
  useEffect(
    () => () => {
      ref.current?.destroy();
    },
    [],
  );

  if (!ADS_CONFIGURED || !ready || !size) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottom,
        alignItems: 'center',
        height: loaded ? size.height : 0,
        overflow: 'hidden',
      }}
    >
      <LevelPlayBannerAdView
        ref={ref}
        adUnitId={BANNER_AD_UNIT_ID}
        adSize={size}
        placementName={null}
        style={{ width: size.width, height: size.height }}
        listener={{
          onAdLoaded: () => setLoaded(true),
          onAdLoadFailed: (error) => {
            if (__DEV__) console.log('[Ads]', 'banner load failed', error);
            setLoaded(false);
          },
        }}
      />
    </View>
  );
}

/** Development builds only: opens the LevelPlay Integration Test Suite. */
export function AdTestSuiteButton() {
  if (!__DEV__ || !ADS_CONFIGURED) return null;
  return (
    <Pressable
      onPress={() => void LevelPlay.launchTestSuite().catch(() => {})}
      style={{
        position: 'absolute',
        left: 8,
        bottom: 120,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 11 }}>Ad test suite</Text>
    </Pressable>
  );
}

```

### `src/components/AdConsentPrompt.tsx`

```ts
import { useState } from 'react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { GameLayout } from '@/hooks/useLayout';
import { AdService } from '@/services/AdService';

interface Props {
  layout: GameLayout;
}

/**
 * One-time ask for personalized-ads consent. Shown only until the player has
 * made a choice; either answer still leaves ads on (denied = non-personalized).
 * Back-press counts as "no", since the dialog's cancel is its dismiss.
 */
export function AdConsentPrompt({ layout }: Props) {
  const [answered, setAnswered] = useState(
    !AdService.consentRequired() || AdService.getConsent() !== null,
  );

  const answer = (consent: 'granted' | 'denied') => {
    AdService.setConsent(consent);
    setAnswered(true);
  };

  return (
    <ConfirmDialog
      layout={layout}
      visible={!answered}
      title="Personalized ads?"
      message="Ads keep Cube Fall free. Allow ads tailored to you, or keep them generic."
      confirmLabel="Allow"
      cancelLabel="No thanks"
      onCancel={() => answer('denied')}
      onConfirm={() => answer('granted')}
    />
  );
}

```

## 5. Wiring it into the game

**1. Init once at app start** (`src/App.tsx`):
```tsx
useEffect(() => { void AdService.init(); }, []);
```

**2. Banner** – mount on menu screens only, never over active gameplay:
```tsx
{phase === 'HOME' ? <AdBanner /> : null}
{phase === 'HOME' ? <AdTestSuiteButton /> : null}   // renders nothing outside __DEV__
```
It renders nothing until the SDK is ready and the banner has loaded, so a failed ad leaves no gap.

**3. Interstitial** – wrap a navigation action; the action runs after the ad closes
(or immediately if no ad is ready):
```tsx
onPress={() => void AdService.showInterstitial(() => setLeaderboardOpen(true))}
```
Used on the Leaderboard button (Home, Settings, Game Over). Pick natural pause points, not mid-play.

**4. Rewarded** – a player-initiated "continue" on game over (`CubeFall.tsx`):
```tsx
const [rewardedReady, setRewardedReady] = useState(false);
useEffect(() => {
  if (!continuePrompt) return;
  let live = true;
  void AdService.isRewardedReady().then((r) => live && setRewardedReady(r));
  return () => { live = false; };
}, [continuePrompt]);

<ContinuePromptOverlay
  onWatchAd={rewardedReady ? () => void continueRunWithAd(AdService.showRewarded) : undefined}
  ... />
```
`continueRunWithAd(showAd)` (in `useGameEngine.ts`) holds the offer timer while the ad plays,
then resumes the run **only if `showAd()` resolves `true`** (reward earned). `showRewarded`
resolves `true` once per show, on `onAdRewarded`.

**5. Consent dialog** – mount on the Home phase:
```tsx
{phase === 'HOME' ? <AdConsentPrompt layout={layout} /> : null}
```
(It uses the game's own `ConfirmDialog`; adapt to your UI.)

---

## 6. Consent / privacy

LevelPlay needs privacy flags **before** `LevelPlay.init()`:
- `setGDPRConsent(bool)`, `setCCPA(doNotSell: bool)`, `setCOPPA(bool)`.
- `setCOPPA` is **only accepted before init** (calling it later logs an error). GDPR/CCPA
  can be updated later, which is what `AdService.setConsent()` does after the dialog.

What the app does:
- Region comes from the device locale (`en-US` → `US`), not GPS (no permission needed).
- Regions with a consent rule (EU/EEA, UK, CH, US, CA, BR) get the dialog; other regions
  don't and are treated as consented. A locale with no region is asked.
- No stored choice in a consent region = **denied** (GDPR false, CCPA do-not-sell true).
- Limitation: locale ≠ real location. For stricter compliance use Google's **UMP**
  (User Messaging Platform): needs an AdMob account with a published consent message, plus the
  native `com.google.android.ump:user-messaging-platform` SDK; feed its result into the same
  `setGDPRConsent` / `setCCPA` calls. Not done in Cube Fall yet.

Consent was **not** what blocked ads in production (v10 shipped with everyone "denied" and
ads worked once Meta started filling).

---

## 7. Dev vs production

| | Debug build (`__DEV__`) | Release build |
|---|---|---|
| Ad ids | same LevelPlay ids (`TEST = PRODUCTION` in `ads.ts`) | production ids |
| Meta test ads | yes: `AdSettings.setTestMode(true)` + test device hash in `MainApplication.kt` (`BuildConfig.DEBUG`) | no |
| LevelPlay Test Suite | yes: "Ad test suite" button, `is_test_suite` metadata | no |
| JS ad logs (`[Ads]`) | yes | no (silent) |

LevelPlay has **no separate test ids**. To get test ads in debug:
1. Register the phone in Meta (Monetization Manager → Integration → Testing) with its
   Google Advertising ID (Settings → Google → Ads).
2. Meta SDK also needs its own **device hash**. Run the debug app and read logcat:
   `adb logcat | grep "Test mode device hash"` → it prints `AdSettings.addTestDevice("<hash>")`.
   Put that hash in `MainApplication.kt`. When the device is registered correctly, that
   warning no longer appears.
3. The in-app LevelPlay **Test Suite** has a **Live / Test** toggle. Test mode there loads
   test ads for each format, independent of your app code. Handy to prove setup works.

Never click live ads on your own device — policy violation. If you want hard separation, create a
second "test" app in LevelPlay and fill the `TEST` block in `ads.ts` with its ids.

---

## 8. Release checklist

- [ ] Bump `versionCode` / `versionName` in `android/app/build.gradle` (Play rejects a reused versionCode).
- [ ] `android/keystore.properties` exists (otherwise release is silently signed with the debug key and Play rejects it).
- [ ] `JAVA_HOME` points to the JDK folder (e.g. `C:\Program Files\Java\jdk-17`), **not** its `\bin`.
- [ ] Build: `cd android && gradlew.bat app:bundleRelease` →
      `android/app/build/outputs/bundle/release/app-release.aab`.
- [ ] Optional smoke test: `gradlew.bat app:installRelease` (uninstall the debug build first — different signing key). No "Ad test suite" button should appear.
- [ ] Upload to an **internal testing** track first, then promote to production.
- [ ] Play Console: ads declaration (Policy → App content → Ads = Yes), Data safety (advertising ID), `app-ads.txt` live.

---

## 9. Troubleshooting

Debug logs: `adb logcat | grep -E "LevelPlaySDK|\[Ads\]"` (use PowerShell/Git Bash; Metro must be running for debug).

| Symptom / log | Meaning | Fix |
|---|---|---|
| `LevelPlay initialised` missing, `init failed` | wrong App Key, no network, or privacy call order | check key in `ads.ts`; privacy flags before init |
| LevelPlay `509 Mediation No fill` + Meta `1001 No fill` | Meta has no ad to serve | new property/placement can take hours–days to start filling; check Meta approval + Issues tab; test devices need correct GAID **and** SDK hash |
| Meta `1002 Ad was re-loaded too frequently` | too many load requests in a short time | stop relaunching repeatedly; retry backoff is already in `AdService` |
| Meta `1203 unknown error` (rewarded) | placement misconfigured (wrong type, or LevelPlay instance has another format's placement id) | rewarded instance ↔ **Rewarded video** placement; verify the full id |
| `setCOPPA() must be called before LevelPlay.init()` | privacy call order | call COPPA only before init (done in `AdService.init`) |
| Banner never shows | no fill, or SDK not ready yet | banner renders nothing until `onAdLoaded`; check logs |
| "Watch ad" button missing | rewarded not loaded (`isRewardedReady()` false) | expected; fix fill |
| Test Suite ads work, in-app ads don't | Test Suite uses test mode; app is on Live | register test device + hash (section 7) or wait for real fill |
| `gradlew.bat is not recognized` (Git Bash) | shell issue | run from PowerShell |
| `JAVA_HOME is set to an invalid directory` | points at `...\bin` | set to the JDK root |

---

## 10. Gotchas learned the hard way

- The placement-id mapping lives in the **LevelPlay dashboard** (Meta network instances), not the app.
  A wrong id there looks like "No fill", not a clear error.
- Banner/interstitial can work while **rewarded** fails: each format is a separate placement.
- Test fill from Meta is **intermittent**. Don't conclude the app is broken from one run.
- In Cube Fall, production ads started working on their own once Meta/LevelPlay fill began;
  the app code didn't change for it. Always verify dashboards before debugging code.
- The `setConsent()` after init only updates GDPR/CCPA. Keep COPPA out of that path.
- Interstitials are fired only on explicit navigation actions so the player is never blocked.
- Keep `rewardGraceMs` (1500 ms): the reward callback can arrive just after the ad close callback.

To reuse in another game: copy the 4 files in section 4, change the ids in `ads.ts`, do the
install steps in section 3, create the dashboards in section 2, and wire the 5 hooks in section 5.

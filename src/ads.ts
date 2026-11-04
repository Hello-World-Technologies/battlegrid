import { LevelPlay, LevelPlayInitRequest, LevelPlayInterstitialAd, LevelPlayRewardedAd } from 'unity-levelplay-mediation';
import { AD_FREQUENCY, ADS_CONFIGURED, INTERSTITIAL_AD_UNIT_ID, LEVELPLAY_APP_KEY, REWARDED_AD_UNIT_ID } from './config/ads';

/**
 * Unity LevelPlay mediation (Meta Audience Network demand). Every public call
 * swallows its own failure: ads must never break or block the game. Ad objects
 * are created only after init succeeds, and reloaded after each close/failure.
 */

const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 60_000;

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
let battlesSinceAd = 0;
const readyListeners = new Set<() => void>();

const retryDelay = (attempt: number): number => Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt);

const loadInterstitial = (): void => {
  interstitial?.loadAd().catch((e) => log('interstitial load threw', e));
};
const loadRewarded = (): void => {
  rewarded?.loadAd().catch((e) => log('rewarded load threw', e));
};

let finishInterstitial: (() => void) | null = null;
let rewardSession: { earned: boolean; closed: boolean; settle: (earned: boolean) => void } | null = null;

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
    // The reward and the close can arrive in either order.
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
      if (session.earned) session.settle(true);
      else setTimeout(() => session.settle(session.earned), AD_FREQUENCY.rewardGraceMs);
    },
  });

  loadInterstitial();
  loadRewarded();
}

export const AdService = {
  /** Initialise LevelPlay once per app lifecycle. */
  async init(): Promise<void> {
    if (!ADS_CONFIGURED || initStarted) return;
    initStarted = true;
    try {
      if (__DEV__) {
        await LevelPlay.setAdaptersDebug(true);
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

  isReady: (): boolean => ready,

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
   * Shows an interstitial if one is loaded, then runs `proceed` once it is gone.
   * If none is ready (or anything fails) `proceed` runs immediately.
   */
  async showInterstitial(proceed: () => void): Promise<void> {
    try {
      if (!ready || !interstitial || interstitialShowing || rewardedShowing) return proceed();
      if (!(await interstitial.isAdReady())) return proceed();
      interstitialShowing = true;
      let done = false;
      finishInterstitial = () => {
        if (done) return;
        done = true;
        finishInterstitial = null;
        proceed();
      };
      await interstitial.showAd('Result');
    } catch (e) {
      log('interstitial show threw', e);
      interstitialShowing = false;
      if (finishInterstitial) finishInterstitial();
      else proceed();
    }
  },

  /**
   * Called when the player leaves a result screen for another battle or menu:
   * shows an interstitial every Nth time, otherwise just proceeds.
   */
  async afterBattle(proceed: () => void): Promise<void> {
    battlesSinceAd += 1;
    if (battlesSinceAd < AD_FREQUENCY.interstitialEveryBattles) return proceed();
    battlesSinceAd = 0;
    return AdService.showInterstitial(proceed);
  },

  /** Player-initiated rewarded ad. Resolves true only if the reward was earned. */
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
      rewarded!.showAd('DoubleCoins').catch((e) => {
        log('rewarded show threw', e);
        session.settle(false);
      });
    });
  },
};

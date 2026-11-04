/**
 * Unity LevelPlay (Meta Audience Network demand) identifiers.
 *
 * The App Key and ad unit ids are LevelPlay's. The Meta App ID (1674816817418403)
 * and the Meta placement ids live in the LevelPlay dashboard mapping, not in the
 * app. Meta placements, for reference:
 *   Rewarded     1674816817418403_1674959890737429
 *   Interstitial 1674816817418403_1674960087404076
 *   Banner       1674816817418403_1674960300737388
 */
export const LEVELPLAY_APP_KEY = '293583165';
export const BANNER_AD_UNIT_ID = '20znjx1mt9bgd9pg';
export const INTERSTITIAL_AD_UNIT_ID = 'fpksece4fk98det2';
export const REWARDED_AD_UNIT_ID = '199vl3i0n7hnr11x';

export const ADS_CONFIGURED = LEVELPLAY_APP_KEY.length > 0;

export const AD_FREQUENCY = {
  /** How long to wait for a late `onAdRewarded` after the ad closes. */
  rewardGraceMs: 1500,
  /** Show an interstitial every Nth time the player leaves a result screen. */
  interstitialEveryBattles: 2,
} as const;

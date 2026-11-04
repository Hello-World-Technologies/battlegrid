import React, { useEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LevelPlayAdSize, LevelPlayBannerAdView, type LevelPlayBannerAdViewMethods } from 'unity-levelplay-mediation';
import { ADS_CONFIGURED, BANNER_AD_UNIT_ID } from '../config/ads';
import { AdService } from '../ads';

/**
 * Height (dp) of the banner while one is showing, 0 otherwise. Menu screens add
 * it to their bottom spacing so the banner never covers their controls.
 */
let bannerHeight = 0;
const heightListeners = new Set<(h: number) => void>();
function setBannerHeight(h: number): void {
  if (h === bannerHeight) return;
  bannerHeight = h;
  heightListeners.forEach((fn) => fn(h));
}

export function useBannerHeight(): number {
  const [h, setH] = useState(bannerHeight);
  useEffect(() => {
    heightListeners.add(setH);
    setH(bannerHeight);
    return () => {
      heightListeners.delete(setH);
    };
  }, []);
  return h;
}

/**
 * Adaptive banner pinned to the bottom safe edge. Renders nothing until the SDK
 * is up and the banner has loaded, so a missing ad leaves no empty strip. Menu
 * screens only: never mount it over a battle.
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
      .then((s) => !cancelled && setSize(s ?? LevelPlayAdSize.BANNER))
      .catch(() => !cancelled && setSize(LevelPlayAdSize.BANNER));
    return () => {
      cancelled = true;
    };
  }, [ready, width]);

  useEffect(() => {
    if (size) ref.current?.loadAd();
  }, [size]);

  useEffect(() => setBannerHeight(loaded && size ? size.height : 0), [loaded, size]);

  useEffect(
    () => () => {
      ref.current?.destroy();
      setBannerHeight(0);
    },
    [],
  );

  if (!ADS_CONFIGURED || !ready || !size) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center', height: loaded ? size.height : 0, overflow: 'hidden' }}
    >
      <LevelPlayBannerAdView
        ref={ref}
        adUnitId={BANNER_AD_UNIT_ID}
        adSize={size}
        placementName={null}
        style={{ width: size.width, height: size.height }}
        listener={{
          onAdLoaded: () => setLoaded(true),
          onAdLoadFailed: () => setLoaded(false),
        }}
      />
    </View>
  );
}

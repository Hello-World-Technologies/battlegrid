import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFont, useImage } from '@shopify/react-native-skia';

// ───────────────────────── Game ─────────────────────────
import { levelSeed, winPayout, type Difficulty, type StarResult } from './src/game/core';
import { Haptics } from './src/game/haptics';
import { GameSession } from './src/game/session';
import { BG } from './src/game/theme';
import { GameView } from './src/ui/GameView';
import { setNumberTypeface, setTroopSprite } from './src/ui/draw';
import { SHAPE_ART } from './src/ui/sprites';

const NUMBER_FONT = require('./assets/fonts/LilitaOne-Regular.ttf');

// ───────────────────────── Shell ─────────────────────────
import Splash from './src/screens/Splash';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';
import Levels from './src/screens/Levels';
import Shop from './src/screens/Shop';
import DailyBonus from './src/screens/DailyBonus';
import { submitLeaderboardScore } from './src/leaderboard';
import Leaderboard from './src/screens/Leaderboard';
import Profile from './src/screens/Profile';
import Settings from './src/screens/Settings';
import Pause from './src/screens/Pause';
import { LoseScreen, WinScreen } from './src/screens/Result';
import { THEME, ThemeContext } from './src/theme';
import { Audio, Track } from './src/audio';
import { AdService } from './src/ads';
import { AdBanner } from './src/ui/AdBanner';

// ───────────────────────── State ─────────────────────────
import {
  Progress,
  CosmeticKind,
  DEFAULT_TITLE,
  buyCosmetic,
  buyItem,
  buySkin,
  buyUpgrade,
  canClaimDaily,
  addCoins,
  claimDaily,
  emptyProgress,
  mergeProgress,
  recordLoss,
  recordWin,
  selectCosmetic,
  selectSkin,
  spendItem,
  starsOf,
  stockOf,
  todayKey,
} from './src/progress';
import { DEFAULT_SETTINGS, SettingsValue } from './src/settings';
import { BOARDS, ITEM_SHOP, SHAPES, SKINS, TITLES, UPGRADES, applyBoard, applyShape, applySkin, packPrice, perksOf } from './src/shop';
import { SaveData, loadLocalSave, writeLocalSave } from './src/save';
import { GUEST_NUDGE_AFTER_WINS, markGuestNudgeShown, wasGuestNudgeShown } from './src/guestNudge';
import BackupNudge from './src/ui/BackupNudge';

/**
 * Test builds only: every level up to this number can be played from the Levels screen, whatever you have cleared
 * (the list then shows that many levels). 0 = normal: only your unlocked levels and three locked ones ahead.
 */
const TEST_OPEN_LEVELS = 0;

// ───────────────────────── Firebase ─────────────────────────
import { logLevelEnd } from './src/firebase/analytics';
import {
  loadOrCreatePlayer,
  markPlayerOnboarded,
  migrateGuestProgressIfFresh,
  savePlayerProfile,
  savePlayerProgress,
  savePlayerSettings,
} from './src/firebase/firestore';
import {
  PlayerProfile,
  SignInCancelled,
  isPlayGamesSignInAvailable,
  localGuestProfile,
  observePlayer,
  setGuestName,
  signInAsGuest,
  signInWithPlayGames,
  signOutPlayer,
} from './src/firebase/auth';

type Screen =
  | 'splash'
  | 'onboarding'
  | 'home'
  | 'levels'
  | 'shop'
  | 'daily'
  | 'profile'
  | 'leaderboard'
  | 'settings'
  | 'play'
  | 'paused'
  | 'won'
  | 'lost';

/** Where the level list / settings were opened from, so Back returns there. */
type LevelsFrom = 'home' | 'paused' | 'won' | 'lost';
type SettingsFrom = 'home' | 'profile';

type WinState = {
  level: number;
  payout: number;
  replay: boolean;
  result: StarResult;
  /** Battle time in seconds, shown on the result card. */
  seconds: number;
};

/** Which music loop each screen wants. Splash and pause are silent. */
const trackFor = (screen: Screen): Track | null => {
  if (screen === 'play') return 'game';
  if (screen === 'splash' || screen === 'paused') return null;
  return 'menu';
};

function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [levelsFrom, setLevelsFrom] = useState<LevelsFrom>('home');
  const [settingsFrom, setSettingsFrom] = useState<SettingsFrom>('home');
  const [splashDone, setSplashDone] = useState(false);
  const [today, setToday] = useState(todayKey);

  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [settings, setSettings] = useState<SettingsValue>(DEFAULT_SETTINGS);
  // null = not loaded yet. Onboarding shows once, before the player's first Home.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [showGuestNudge, setShowGuestNudge] = useState(false);
  // The uid whose cloud save has been read successfully (gates cloud writes).
  const [cloudUid, setCloudUid] = useState<string | null>(null);

  const [session, setSession] = useState<GameSession | null>(null);
  const [win, setWin] = useState<WinState | null>(null);

  // Battle art decoded once for the life of the app, not per level: GameView mounts and
  // unmounts every battle (see `inBattle` below), and loading these through a hook there
  // would decode a fresh native image/typeface on every level, leaking the old one.
  const numberFont = useFont(NUMBER_FONT, 20);
  useEffect(() => {
    setNumberTypeface(numberFont?.getTypeface() ?? null);
  }, [numberFont]);
  const planeImage = useImage(SHAPE_ART.plane.troop);
  const spriteImage = useImage(SHAPE_ART.sprite.troop);
  useEffect(() => {
    setTroopSprite('plane', planeImage);
    setTroopSprite('sprite', spriteImage);
  }, [planeImage, spriteImage]);
  // The refs are the source of truth for the save: reducers read the latest
  // value synchronously, so two quick updates can never act on stale state.
  const progressRef = useRef(progress);
  const settingsRef = useRef(settings);
  const onboardedRef = useRef(onboarded);
  const uidRef = useRef<string | null>(null);
  const cloudReady = useRef(false);
  const loadedUid = useRef<string | null>(null);
  // Consecutive losses on one level (not saved). Any win, or a different level, starts it over.
  const lossRun = useRef({ key: '', count: 0 });

  const persistLocal = useCallback(() => {
    if (!uidRef.current) return;
    const data: SaveData = {
      progress: progressRef.current,
      settings: settingsRef.current,
      onboarded: onboardedRef.current === true,
    };
    writeLocalSave(uidRef.current, data);
  }, []);

  const applySave = useCallback((save: SaveData) => {
    const loaded = save.progress;
    progressRef.current = loaded;
    settingsRef.current = save.settings;
    onboardedRef.current = save.onboarded;
    setProgress(loaded);
    setSettings(save.settings);
    setOnboarded(save.onboarded);
  }, []);

  // ── Identity ──
  // A player always exists. On first launch (or after a sign-out) the
  // observer reports no session, so mint a guest with a generated nickname;
  // the observer then fires again with the new account. If a guest cannot be
  // minted (offline on the very first launch) a device-local one is used so
  // the game is never blocked on the network.
  useEffect(() => {
    let active = true;
    const unsubscribe = observePlayer((p) => {
      if (!active) return;
      if (p) {
        setPlayer(p);
      } else {
        signInAsGuest()
          .then((guest) => guest ?? localGuestProfile())
          .then((guest) => {
            if (active) setPlayer(guest);
          });
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Load this uid's save: the device copy first (instant, works offline),
  // then the cloud copy, which wins when it can be read. Guarded by a ref
  // rather than a dependency array so a name/avatar change on the same uid
  // never re-fetches or clobbers local state with a stale read.
  const playerRef = useRef(player);
  playerRef.current = player;
  const uid = player?.uid;
  useEffect(() => {
    const current = playerRef.current;
    if (!uid || !current || loadedUid.current === uid) return;
    loadedUid.current = uid;
    uidRef.current = uid;
    cloudReady.current = false;
    setCloudUid(null);
    (async () => {
      const local = await loadLocalSave(uid);
      if (loadedUid.current !== uid) return; // the identity changed while reading
      const cloud = await loadOrCreatePlayer(
        uid,
        { displayName: current.name, avatarUrl: current.photoURL, ranked: !current.isGuest },
        local,
      );
      if (loadedUid.current !== uid) return;
      if (!cloud) {
        // Cloud unreadable (offline / Firebase off): play from the device copy
        // and hold back cloud writes so a default can't overwrite real data.
        applySave(local);
        return;
      }
      // Progress only ever grows (there is nothing to spend coins on), so a
      // copy played offline merges losslessly into the cloud copy.
      const merged: SaveData = {
        progress: mergeProgress(cloud.progress, local.progress),
        settings: cloud.settings,
        onboarded: cloud.onboarded || local.onboarded,
      };
      cloudReady.current = true;
      applySave(merged);
      setCloudUid(uid);
      writeLocalSave(uid, merged);
      if (merged.progress !== cloud.progress) savePlayerProgress(uid, merged.progress).catch(() => {});
      if (merged.onboarded && !cloud.onboarded) markPlayerOnboarded(uid).catch(() => {});
    })();
  }, [uid, applySave]);

  // Keeps players/{uid}'s profile fields current (name, avatar, ranked). Only
  // after that uid's save was read, so it can never create the document
  // before the load has seeded it from the device copy.
  useEffect(() => {
    if (!player || cloudUid !== player.uid) return;
    savePlayerProfile(player.uid, {
      displayName: player.name,
      avatarUrl: player.photoURL,
      ranked: !player.isGuest,
    }).catch(() => {});
  }, [cloudUid, player]);

  // Leaves the splash once both its animation has finished and we know
  // whether onboarding is needed, so a slow read never flashes Home before
  // redirecting to Onboarding.
  useEffect(() => {
    if (!splashDone || onboarded === null || screen !== 'splash') return;
    setScreen(onboarded ? 'home' : 'onboarding');
  }, [splashDone, onboarded, screen]);

  // Nudges a guest, once, to sign in with Play Games — their progress is saved, but to an anonymous identity
  // that cannot survive an uninstall (see src/guestNudge.ts). Shown on Home after a few wins, so it has
  // something to point at, and never more than once per device.
  useEffect(() => {
    if (screen !== 'home' || !player?.isGuest || !isPlayGamesSignInAvailable || progress.wins < GUEST_NUDGE_AFTER_WINS) return;
    let cancelled = false;
    wasGuestNudgeShown().then((shown) => {
      if (!cancelled && !shown) setShowGuestNudge(true);
    });
    return () => {
      cancelled = true;
    };
  }, [screen, player, progress.wins]);

  const dismissGuestNudge = useCallback(() => {
    setShowGuestNudge(false);
    markGuestNudgeShown();
  }, []);

  // ── Save updates ──
  /** Applies a progress reducer; returns whether it actually changed anything. */
  const updateProgress = useCallback(
    (reducer: (p: Progress) => Progress): boolean => {
      const next = reducer(progressRef.current);
      if (next === progressRef.current) return false;
      progressRef.current = next;
      setProgress(next);
      persistLocal();
      if (cloudReady.current && uidRef.current) savePlayerProgress(uidRef.current, next).catch(() => {});
      return true;
    },
    [persistLocal],
  );

  const applySettings = useCallback(
    (next: SettingsValue) => {
      settingsRef.current = next;
      setSettings(next);
      persistLocal();
      if (cloudReady.current && uidRef.current) savePlayerSettings(uidRef.current, next).catch(() => {});
    },
    [persistLocal],
  );

  const markOnboarded = useCallback(() => {
    onboardedRef.current = true;
    setOnboarded(true);
    persistLocal();
    if (cloudReady.current && uidRef.current) markPlayerOnboarded(uidRef.current).catch(() => {});
  }, [persistLocal]);

  // ── Settings take effect ──
  useEffect(() => {
    Haptics.set(settings.vibration);
  }, [settings.vibration]);

  useEffect(() => {
    Audio.configure({ music: settings.music, sound: settings.sound });
  }, [settings.music, settings.sound]);

  // The equipped skin recolours your side of the battlefield and the level maps.
  useEffect(() => {
    applySkin(progress.skin);
  }, [progress.skin]);

  // The equipped troop shape and board theme.
  useEffect(() => {
    applyShape(progress.shape);
    applyBoard(progress.board);
  }, [progress.shape, progress.board]);

  useEffect(() => {
    Audio.playMusic(trackFor(screen));
  }, [screen]);

  // ── Battle flow ──
  // Every level is one fixed map, so the same level number always has the same board (see levelSeed).
  const startLevel = useCallback((level: number, seed: number = levelSeed(level), difficulty: Difficulty = 'normal') => {
    // Your permanent upgrades (more starting troops, heavier bombs) go into every battle.
    const next = new GameSession(level, seed, difficulty, undefined, perksOf(progressRef.current.upgrades));
    // The items you hold go into the battle; each one used comes out of your save straight away.
    next.stock = stockOf(progressRef.current) as GameSession['stock'];
    next.onItem = (id) => updateProgress((p) => spendItem(p, id));
    setSession(next);
    setWin(null);
    setScreen('play');
  }, [updateProgress]);

  // Ads: start the SDK once, and offer the rewarded "double coins" only when one is loaded.
  useEffect(() => {
    void AdService.init();
  }, []);
  const [rewardedReady, setRewardedReady] = useState(false);
  useEffect(() => {
    if (screen !== 'won') return;
    let live = true;
    const check = () => void AdService.isRewardedReady().then((r) => live && setRewardedReady(r));
    check();
    const t = setTimeout(check, 3000);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [screen]);
  const handleDouble = useCallback(async () => {
    const payout = win?.payout ?? 0;
    if (payout <= 0 || !(await AdService.showRewarded())) return false;
    updateProgress((p) => addCoins(p, payout));
    Audio.sfx('reward');
    return true;
  }, [win, updateProgress]);

  const pause = useCallback(() => setScreen((s) => (s === 'play' ? 'paused' : s)), []);
  const resume = useCallback(() => setScreen((s) => (s === 'paused' ? 'play' : s)), []);

  const openLevels = (from: LevelsFrom) => {
    setLevelsFrom(from);
    setScreen('levels');
  };

  const openSettings = (from: SettingsFrom) => {
    setSettingsFrom(from);
    setScreen('settings');
  };

  const onEnd = useCallback(
    (status: 'won' | 'lost') => {
      if (!session) return;
      const result = session.result();
      logLevelEnd(session.level, status === 'won', result.stars, result.assisted);
      const key = String(session.level);
      if (status === 'won') {
        lossRun.current = { key, count: 0 };
        // Banked immediately, so closing the app on the result screen loses nothing.
        // Faster wins pay more (see winPayout); a replay pays only for stars it adds, or a quarter.
        const before = starsOf(progressRef.current, session.level);
        const replay = before > 0;
        const payout = winPayout(before, result);
        const nextProgress = recordWin(progressRef.current, session.level, payout, result.stars);
        updateProgress(() => nextProgress);
        // Leaderboard score is lifetime coins — the one Progress field that only ever grows.
        if (cloudReady.current && uidRef.current && player) {
          submitLeaderboardScore(
            nextProgress.coins,
            player.name,
            uidRef.current,
            player.photoURL,
            null,
            nextProgress.title === DEFAULT_TITLE ? null : nextProgress.title,
          );
        }
        setWin({ level: session.level, payout, replay, result, seconds: session.world.t });
        setScreen('won');
      } else {
        const run = lossRun.current;
        lossRun.current = { key, count: run.key === key ? run.count + 1 : 1 };
        updateProgress(recordLoss);
        setScreen('lost');
      }
    },
    [session, updateProgress, player],
  );

  const handleBuySkin = useCallback(
    (id: string) => {
      const skin = SKINS.find((k) => k.id === id);
      if (skin && updateProgress((p) => buySkin(p, id, skin.price))) Audio.sfx('purchase');
    },
    [updateProgress],
  );

  const handleBuyCosmetic = useCallback(
    (kind: CosmeticKind, id: string) => {
      const catalogue = kind === 'shape' ? SHAPES : kind === 'board' ? BOARDS : TITLES;
      const price = catalogue.find((k) => k.id === id)?.price;
      if (price !== undefined && updateProgress((p) => buyCosmetic(p, kind, id, price))) Audio.sfx('purchase');
    },
    [updateProgress],
  );

  const handleBuyItem = useCallback(
    (id: string, count: number) => {
      const item = ITEM_SHOP.find((k) => k.id === id);
      if (item && updateProgress((p) => buyItem(p, id, count, packPrice(item, count)))) Audio.sfx('purchase');
    },
    [updateProgress],
  );

  const handleBuyUpgrade = useCallback(
    (id: string) => {
      const up = UPGRADES.find((k) => k.id === id);
      if (!up) return;
      const changed = updateProgress((p) => {
        const level = p.upgrades[id] ?? 0;
        return level < up.prices.length ? buyUpgrade(p, id, up.prices[level], up.prices.length) : p;
      });
      if (changed) Audio.sfx('purchase');
    },
    [updateProgress],
  );

  const handleClaimDaily = useCallback(() => {
    updateProgress((p) => claimDaily(p, todayKey()));
    Audio.sfx('reward');
    setToday(todayKey());
  }, [updateProgress]);

  // ── Account ──
  // Linking is *meant* to keep the guest uid so the player's progress carries
  // over — but a genuine account collision swaps in a different uid instead.
  // If the uid did change, adopt the guest's progress onto the new account
  // here rather than silently losing it — but only when the destination is
  // untouched; a returning player's own history is never overwritten.
  const migrateIfIdentityChanged = useCallback(
    async (previous: PlayerProfile | null, next: PlayerProfile) => {
      if (!previous?.isGuest || previous.uid === next.uid) return;
      const migrated = await migrateGuestProgressIfFresh(next.uid, progressRef.current);
      if (migrated) {
        loadedUid.current = next.uid;
        uidRef.current = next.uid;
        cloudReady.current = true;
        setCloudUid(next.uid);
        applySave(migrated);
        writeLocalSave(next.uid, migrated);
      }
    },
    [applySave],
  );

  const handlePlayGames = useCallback(async () => {
    const previous = player;
    try {
      const p = await signInWithPlayGames();
      if (!p) throw new Error('Play Games sign-in failed. Please try again.');
      await migrateIfIdentityChanged(previous, p);
      setPlayer(p);
    } catch (e) {
      if (e instanceof SignInCancelled) return;
      throw e;
    }
  }, [player, migrateIfIdentityChanged]);

  // Unlike handlePlayGames (used from Profile, which stays put on cancel),
  // this one only advances to Home on an actual sign-in; a cancelled sheet
  // leaves the player on Onboarding to choose again.
  const handleOnboardPlayGames = useCallback(async () => {
    const previous = player;
    try {
      const p = await signInWithPlayGames();
      if (p) {
        await migrateIfIdentityChanged(previous, p);
        setPlayer(p);
      }
      markOnboarded();
      setScreen('home');
    } catch (e) {
      if (e instanceof SignInCancelled) return;
      throw e;
    }
  }, [player, migrateIfIdentityChanged, markOnboarded]);

  // The guest account already minted silently on mount (with its pseudonym)
  // was chosen; proceed to Home. It can be renamed later from Profile.
  const handleOnboardGuest = useCallback(() => {
    markOnboarded();
    setScreen('home');
  }, [markOnboarded]);

  // Renames the guest's Firebase auth profile. Resolves whether it actually
  // succeeded — setGuestName degrades to null instead of throwing, and the
  // rename modal needs that signal to know whether to close.
  const handleRenameGuest = useCallback(async (name: string): Promise<boolean> => {
    const updated = await setGuestName(name);
    if (updated) setPlayer(updated);
    return !!updated;
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutPlayer();
    setScreen('onboarding');
    // observePlayer emits null next, which mints a fresh guest.
  }, []);

  // ── System events ──
  // Pause when the app leaves the foreground, silence audio, and refresh the
  // day so the daily bonus is right after midnight.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      Audio.setSuspended(state !== 'active');
      if (state !== 'active') pause();
      else setToday(todayKey());
    });
    return () => sub.remove();
  }, [pause]);

  // Android back: pause mid-battle, resume from the pause dialog, otherwise
  // step back. Only Home (and the splash / onboarding) let the system close
  // the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      switch (screen) {
        case 'play':
          pause();
          return true;
        case 'paused':
          resume();
          return true;
        case 'levels':
          setScreen(levelsFrom === 'home' ? 'home' : levelsFrom);
          return true;
        case 'settings':
          setScreen(settingsFrom);
          return true;
        case 'shop':
        case 'daily':
        case 'profile':
        case 'leaderboard':
        case 'won':
        case 'lost':
          setScreen('home');
          return true;
        default:
          return false;
      }
    });
    return () => sub.remove();
  }, [screen, levelsFrom, settingsFrom, pause, resume]);

  const inBattle = screen === 'play' || screen === 'paused' || (screen === 'levels' && levelsFrom === 'paused');
  const dailyReady = canClaimDaily(progress, today);

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={{ theme: THEME }}>
        <View style={[styles.root, { backgroundColor: inBattle ? BG : THEME.bg }]}>
          <StatusBar barStyle={screen === 'splash' ? 'light-content' : 'dark-content'} />

          {screen === 'splash' && <Splash onDone={() => setSplashDone(true)} />}

          {screen === 'onboarding' && (
            <Onboarding
              playGamesAvailable={isPlayGamesSignInAvailable}
              onPlayGames={handleOnboardPlayGames}
              onGuest={handleOnboardGuest}
            />
          )}

          {screen === 'home' && (
            <Home
              player={player}
              progress={progress}
              dailyReady={dailyReady}
              onPlay={() => startLevel(progress.unlocked)}
              onLevels={() => openLevels('home')}
              onShop={() => setScreen('shop')}
              onDaily={() => setScreen('daily')}
              onProfile={() => setScreen('profile')}
              // Every tap: an interstitial (if one is loaded) plays first; the leaderboard opens once it is closed.
              onLeaderboard={() => void AdService.showInterstitial(() => setScreen('leaderboard'))}
              onSettings={() => openSettings('home')}
            />
          )}

          {/* The battle stays mounted while paused (and while the level map is
              open over it) so the world is preserved. */}
          {inBattle && session && (
            <SafeAreaView style={styles.battle}>
              <GameView
                session={session}
                running={screen === 'play'}
                onPause={pause}
                onEnd={onEnd}
              />
            </SafeAreaView>
          )}

          {screen === 'paused' && session && (
            <Pause
              level={session.level}
              settings={settings}
              onSettingsChange={applySettings}
              onResume={resume}
              // Same seed: same map (and the same difficulty).
              onRestart={() => startLevel(session.level, session.world.seed, session.difficulty)}
              onLevels={() => openLevels('paused')}
              onHome={() => setScreen('home')}
            />
          )}

          {screen === 'levels' && (
            <View style={StyleSheet.absoluteFill}>
              <Levels
                unlocked={progress.unlocked}
                stars={progress.stars}
                onPick={(level) => startLevel(level)}
                openUpTo={TEST_OPEN_LEVELS}
                onBack={() => setScreen(levelsFrom)}
              />
            </View>
          )}

          {screen === 'won' && win && (
            <WinScreen
              level={win.level}
              payout={win.payout}
              replay={win.replay}
              result={win.result}
              seconds={win.seconds}
              onNext={() => void AdService.afterBattle(() => startLevel(win.level + 1))}
              onDouble={rewardedReady ? handleDouble : undefined}
              onLevels={() => openLevels('won')}
              onHome={() => setScreen('home')}
            />
          )}

          {screen === 'lost' && session && (
            <LoseScreen
              level={session.level}
              attempts={lossRun.current.count}
              seconds={session.world.t}
              assisted={session.difficulty === 'easy'}
              // Same seed: a loss teaches something about the same map.
              onRetry={() => void AdService.afterBattle(() => startLevel(session.level, session.world.seed, session.difficulty))}
              onLevels={() => openLevels('lost')}
              onHome={() => setScreen('home')}
            />
          )}

          {screen === 'shop' && (
            <Shop
              progress={progress}
              onBuy={handleBuySkin}
              onBuyItem={handleBuyItem}
              onBuyCosmetic={handleBuyCosmetic}
              onEquipCosmetic={(kind, id) => updateProgress((p) => selectCosmetic(p, kind, id))}
              onBuyUpgrade={handleBuyUpgrade}
              onEquip={(id) => updateProgress((p) => selectSkin(p, id))}
              onBack={() => setScreen('home')}
            />
          )}

          {screen === 'daily' && (
            <DailyBonus progress={progress} onClaim={handleClaimDaily} onBack={() => setScreen('home')} />
          )}

          {screen === 'profile' && (
            <Profile
              player={player}
              progress={progress}
              playGamesAvailable={isPlayGamesSignInAvailable}
              onPlayGames={handlePlayGames}
              onSignOut={handleSignOut}
              onRenameGuest={handleRenameGuest}
              onBack={() => setScreen('home')}
            />
          )}

          {screen === 'leaderboard' && (
            <Leaderboard player={player} myScore={progress.coins} myTitle={progress.title} onBack={() => setScreen('home')} />
          )}

          {screen === 'settings' && (
            <Settings
              initial={settings}
              onSave={(next) => {
                applySettings(next);
                setScreen(settingsFrom);
              }}
              onBack={() => setScreen(settingsFrom)}
            />
          )}

          {/* Banner on menu screens only, never over a battle or result. */}
          {(screen === 'home' || screen === 'shop' || screen === 'profile' || screen === 'leaderboard' || screen === 'daily') && <AdBanner />}

          {showGuestNudge && <BackupNudge onSignIn={handlePlayGames} onDismiss={dismissGuestNudge} />}
        </View>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  battle: { flex: 1, backgroundColor: BG },
});

export default App;

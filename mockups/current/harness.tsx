// Draws the app's REAL screens (src/screens, src/ui) in a browser through react-native-web + Skia web,
// with mock data, laid out the way App.tsx composes them (root view + bottom tab bar).
// Pick the screen with the URL hash: #home, #levels, #play, ...
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Image, Text, View } from 'react-native';

import { emptyProgress, type Progress } from '../../src/progress';
import { dayKeyOf } from '../../src/dayKeys';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { BG } from '../../src/game/theme';
import { GameSession } from '../../src/game/session';
import { advance, scoreBattle, send, type ItemId } from '../../src/game/core';
import { Canvas, Picture } from '@shopify/react-native-skia';
import { recordFrame } from '../../src/ui/draw';
import { Audio } from '../../src/audio';

// There is no native sound module in the browser: items would throw when they play their effect.
(Audio as any).sfx = () => undefined;
import { applyBoard, applyShape, TITLES } from '../../src/shop';
import { THEME, ThemeContext } from '../../src/theme';
import { GameView } from '../../src/ui/GameView';
import Splash from '../../src/screens/Splash';
import Onboarding from '../../src/screens/Onboarding';
import Home from '../../src/screens/Home';
import Levels from '../../src/screens/Levels';
import Shop from '../../src/screens/Shop';
import DailyBonus from '../../src/screens/DailyBonus';
import Leaderboard from '../../src/screens/Leaderboard';
import BackupNudge from '../../src/ui/BackupNudge';
import Profile from '../../src/screens/Profile';
import Settings from '../../src/screens/Settings';
import Pause from '../../src/screens/Pause';
import { LoseScreen, WinScreen } from '../../src/screens/Result';
import ShareCard from '../../src/ui/ShareCard';

const noop = () => undefined;
const asyncNoop = async () => undefined;

/** A player a few levels in: some stars, a short daily streak (claimable today), a few conquered places. */
const yesterday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return dayKeyOf(d);
};
const base: Progress = {
  ...emptyProgress(),
  coins: 2840,
  unlocked: 6,
  wins: 9,
  losses: 3,
  streak: 3,
  bestStreak: 4,
  lastClaimDay: yesterday(),
  stars: { 1: 3, 2: 2, 3: 3, 4: 2, 5: 1 },
  titles: ['none', 'conqueror'],
  title: 'conqueror',
};
const progress: Progress = base;
const player = { uid: 'demo', name: 'Alex', isGuest: false, photoURL: null, email: null };
const streak = 3;

/** The Android status bar (App uses dark icons on the map screens and the battle). */
function SystemBar({ dark }: { dark: boolean }) {
  const c = dark ? '#1d1a4a' : '#f4f4ff';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 28, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 }}>
      <Text style={{ color: c, fontSize: 12, fontWeight: '700' }}>9:41</Text>
      <Text style={{ color: c, fontSize: 11, fontWeight: '700' }}>▲ ▮▮▮ ▮</Text>
    </View>
  );
}

function Frame({ battle, dark = false, children }: { battle?: boolean; dark?: boolean; children: React.ReactNode }) {
  return (
    <ThemeContext.Provider value={{ theme: THEME }}>
      <View style={{ flex: 1, backgroundColor: battle ? BG : THEME.bg }}>
        {children}
        <SystemBar dark={dark || !!battle} />
      </View>
    </ThemeContext.Provider>
  );
}

const campaign = new GameSession(5, 20260101);
const later = new GameSession(24, 7);
/** A battle with garrisons of every size, to show how a state deepens in colour as its troops grow. */
/** A battle with the bomb armed: every tower you could hit wears a target ring. */
const armed = (() => {
  const g = new GameSession(24, 7);
  g.bombsLeft = 2;
  g.armed = true;
  return g;
})();
const shaded = (() => {
  const g = new GameSession(24, 7);
  const sizes = [4, 22, 45, 70, 100, 140];
  g.world.territories.forEach((t, i) => {
    if (i < 12) t.owner = ((i % 3) + 1) as 1 | 2 | 3;
    if (t.owner) t.units = sizes[i % sizes.length];
  });
  return g;
})();
const battle = (s: GameSession, running = false, tray = false) => (
  <View style={{ flex: 1, backgroundColor: BG, paddingTop: 28, paddingBottom: 16 }}>
    <GameView session={s} running={running} onPause={noop} onEnd={noop} />
  </View>
);

const win = scoreBattle(5, true, 80);
const lose = scoreBattle(5, false, 40);

/** The real battle screen with a few items in the bottom row (and, if asked, one of them picked). */
const rowBattle = (armedItem: ItemId | null) => {
  const g = new GameSession(24, 7);
  g.stock = { bomb: 2, freeze: 1, shield: 1, surge: 1, airdrop: 2 };
  const mine = g.world.territories.filter((t) => t.owner === 1);
  const foes = g.world.territories.filter((t) => t.owner !== 1);
  mine.forEach((t) => (t.units = 60));
  send(g.world, mine[0].id, foes[0].id, 0.6);
  for (let i = 0; i < 14; i++) advance(g.world, 0.05);
  g.armed = armedItem;
  return <Frame battle>{battle(g, false)}</Frame>;
};

/** Two mid-flight sends side by side, a ~65-troop one and a ~150-troop one, to compare dot density. */
const densityCompare = () => {
  const mk = (units: number) => {
    const g = new GameSession(24, 7);
    const mine = g.world.territories.find((t) => t.owner === 1)!;
    const foe = g.world.territories.find((t) => t.owner !== 1 && t.owner !== 0)!;
    mine.units = units;
    send(g.world, mine.id, foe.id, 1);
    for (let i = 0; i < 20; i++) advance(g.world, 0.05);
    return g;
  };
  return (
    <Frame battle>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>{battle(mk(65))}</View>
        <View style={{ flex: 1 }}>{battle(mk(150))}</View>
      </View>
    </Frame>
  );
};

/** One frame of an item animation at an exact moment: the item is used on a tower, then the battle is stepped to `at` seconds. */
function FxStill({ item, at }: { item: ItemId; at: number }) {
  const W = 360;
  const H = 756;
  const g = new GameSession(24, 7);
  g.w = W;
  g.h = H;
  g.stock = { bomb: 2, megabomb: 1, freeze: 1, airdrop: 2, shield: 1, surge: 1, rally: 1, provoke: 1 };
  const T = g.world.territories;
  T.filter((t) => t.owner === 1).forEach((t) => (t.units = 60));
  const foe = T.find((t) => t.owner === 2) ?? T[0];
  const mine = T.find((t) => t.owner === 1) ?? T[0];
  const target = item === 'airdrop' || item === 'shield' ? mine : foe;
  g.pickItem(item);
  if (g.armed) g.pointerDown(g.px(target), g.py(target));
  for (let t = 0; t < at; t += 1 / 60) g.update(1 / 60, true);
  (window as any).__fx = { x: g.px(target), y: g.py(target) + 28 };
  const pic = recordFrame(g, false);
  return (
    <Frame battle>
      <View style={{ flex: 1, backgroundColor: BG, paddingTop: 28, paddingBottom: 16 }}>
        <Canvas style={{ flex: 1 }}>
          <Picture picture={pic} />
        </Canvas>
      </View>
    </Frame>
  );
}

const SCREENS: Record<string, () => React.ReactElement> = {
  splash: () => <Frame><Splash onDone={noop} /></Frame>,
  onboarding: () => <Frame><Onboarding playGamesAvailable onPlayGames={asyncNoop} onGuest={noop} /></Frame>,
  home: () => (
    <Frame dark>
      <Home player={player} progress={progress} dailyReady onPlay={noop} onLevels={noop} onShop={noop} onDaily={noop} onProfile={noop} onLeaderboard={noop} onSettings={noop} />
    </Frame>
  ),
  guestnudge: () => (
    <Frame dark>
      <Home player={player} progress={progress} dailyReady onPlay={noop} onLevels={noop} onShop={noop} onDaily={noop} onProfile={noop} onLeaderboard={noop} onSettings={noop} />
      <BackupNudge onSignIn={asyncNoop} onDismiss={noop} />
    </Frame>
  ),
  levels: () => (
    <Frame>
      <Levels unlocked={progress.unlocked} stars={progress.stars} onPick={noop} onBack={noop} />
    </Frame>
  ),
  shop: () => (
    <Frame>
      <Shop progress={progress} onBuy={noop} onEquip={noop} onBuyItem={noop} onBuyUpgrade={noop} onBuyCosmetic={noop} onEquipCosmetic={noop} onBack={noop} />
    </Frame>
  ),
  daily: () => (
    <Frame>
      <DailyBonus progress={progress} onClaim={noop} onBack={noop} />
    </Frame>
  ),
  profile: () => (
    <Frame>
      <Profile player={player} progress={progress} playGamesAvailable onPlayGames={asyncNoop} onSignOut={asyncNoop} onRenameGuest={async () => true} onBack={noop} />
    </Frame>
  ),
  leaderboard: () => (
    <Frame>
      <Leaderboard player={player} myScore={progress.coins} myTitle={progress.title} onBack={noop} />
    </Frame>
  ),
  /** Design review only: the new shop Titles catalogue (normally below the fold on the real Shop screen). */
  titlesdemo: () => (
    <Frame>
      <View style={{ flex: 1, backgroundColor: '#cfe2f0', padding: 20, paddingTop: 60, flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {TITLES.map((t) => (
          <View key={t.id} style={{ width: 150, alignItems: 'center', gap: 6, backgroundColor: '#fff3d9', borderRadius: 16, borderWidth: 3, borderColor: '#9a6632', padding: 12 }}>
            <View style={{ width: 84, height: 84, borderRadius: 14, borderWidth: 2, borderColor: '#ffffff', backgroundColor: '#f8e2b2', alignItems: 'center', justifyContent: 'center' }}>
              {t.icon ? <Image source={t.icon} resizeMode="contain" style={{ width: 40, height: 40, tintColor: t.tint }} /> : <Text style={{ fontSize: 28 }}>—</Text>}
            </View>
            <Text style={{ fontFamily: 'System', fontWeight: '700' }}>{t.name}</Text>
            <Text>{t.price} coins</Text>
          </View>
        ))}
      </View>
    </Frame>
  ),
  settings: () => (
    <Frame>
      <Settings initial={DEFAULT_SETTINGS} onSave={noop} onBack={noop} />
    </Frame>
  ),
  play: () => <Frame battle>{battle(campaign)}</Frame>,
  density: densityCompare,
  later: () => <Frame battle>{battle(later)}</Frame>,
  shaded: () => <Frame battle>{battle(shaded)}</Frame>,
  armed: () => <Frame battle>{battle(armed)}</Frame>,
  /** The same busy battle with the 3D-render troop shapes: the war plane and the water sprite. */
  row: () => rowBattle(null),
  rowarmed: () => rowBattle('freeze'),
  planes: () => busyBattle('plane'),
  sprites: () => busyBattle('sprite'),
  /** A busy battle: troops in flight in the equipped shape, a frozen and a shielded tower, running buffs, the tray open. */
  items: () => busyBattle('star'),
  bombplay: () => <Frame battle>{battle((() => { const g = new GameSession(24, 7); g.bombsLeft = 2; return g; })())}</Frame>,
  curvedemo: () => <Frame battle>{battle((() => {
    const g = new GameSession(14, 20260101);
    const mine = g.world.territories.filter((t) => t.owner === 1);
    const foes = g.world.territories.filter((t) => t.owner !== 1);
    mine.forEach((t) => (t.units = 80));
    send(g.world, mine[0].id, foes[0].id, 0.8);
    send(g.world, mine[0].id, foes[1].id, 0.6);
    for (let i = 0; i < 16; i++) advance(g.world, 0.05);
    return g;
  })())}</Frame>,
  pause: () => (
    <Frame battle>
      {battle(campaign)}
      <Pause level={5} settings={DEFAULT_SETTINGS} onSettingsChange={noop} onResume={noop} onRestart={noop} onLevels={noop} onHome={noop} />
    </Frame>
  ),
  won: () => <Frame><WinScreen level={5} payout={200} replay={false} result={win} seconds={80} onNext={noop} onLevels={noop} onHome={noop} /></Frame>,
  lost: () => <Frame><LoseScreen level={5} attempts={2} seconds={84} onRetry={noop} onLevels={noop} onHome={noop} /></Frame>,
  /** The hidden share-card image itself (normally captured off-screen, never seen) — shown here for design review. */
  sharecardwin: () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#cfe2f0' }}>
      <ShareCard kind="win" level={5} stars={2} seconds={80} />
    </View>
  ),
  sharecardlose: () => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#cfe2f0' }}>
      <ShareCard kind="lose" level={5} seconds={84} />
    </View>
  ),
};

function busyBattle(shape: string) {
  {
    applyShape(shape);
    applyBoard('sand');
    const g = new GameSession(24, 7);
    g.stock = { bomb: 2, megabomb: 1, freeze: 1, airdrop: 2, shield: 1, surge: 1, rally: 1, provoke: 1 };
    const mine = g.world.territories.filter((t) => t.owner === 1);
    const foes = g.world.territories.filter((t) => t.owner !== 1);
    mine.forEach((t) => (t.units = 90));
    send(g.world, mine[0].id, foes[0].id, 0.6);
    send(g.world, mine[0].id, foes[3].id, 0.5);
    send(g.world, foes.find((t) => t.owner === 2)!.id, foes[5].id, 0.6);
    for (let i = 0; i < 14; i++) advance(g.world, 0.05);
    const enemy = g.world.territories.find((t) => t.owner === 2)!;
    enemy.freeze = 7;
    mine[0].shield = 9;
    g.world.buffs = { surge: 8, rally: 5 };
    return <Frame battle>{battle(g, false, true)}</Frame>;
  }
}

export function mount() {
  const id = location.hash.slice(1) || 'home';
  const fxm = /^fx-(\w+)-([\d.]+)$/.exec(id);
  const make = fxm ? () => <FxStill item={fxm[1] as ItemId} at={Number(fxm[2])} /> : SCREENS[id];
  const el = document.getElementById('root')!;
  if (!make) {
    el.textContent = `unknown screen: ${id}`;
    return;
  }
  createRoot(el).render(make());
  // Tell the screenshot script when the first frame has been drawn.
  setTimeout(() => { if (!document.title.startsWith('ERR')) document.title = `ready:${id}`; }, id === "splash" ? 700 : 1500);
}

export const SCREEN_IDS = Object.keys(SCREENS);
void lose;

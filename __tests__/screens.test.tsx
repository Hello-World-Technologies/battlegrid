/**
 * Every shell screen renders with realistic props and exposes its main actions.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import Onboarding from '../src/screens/Onboarding';
import Home from '../src/screens/Home';
import Levels from '../src/screens/Levels';
import Shop from '../src/screens/Shop';
import DailyBonus from '../src/screens/DailyBonus';
import Leaderboard from '../src/screens/Leaderboard';
import Profile from '../src/screens/Profile';
import Settings from '../src/screens/Settings';
import Pause from '../src/screens/Pause';
import { LoseScreen, WinScreen } from '../src/screens/Result';
import BackupNudge from '../src/ui/BackupNudge';
import { DEFAULT_SETTINGS } from '../src/settings';
import { emptyProgress } from '../src/progress';
import { scoreBattle } from '../src/game/core';

const player = {
  uid: 'u1',
  name: 'NeonFalcon',
  isGuest: true,
  photoURL: null,
  email: null,
};
const progress = {
  ...emptyProgress(),
  unlocked: 7,
  coins: 1234,
  wins: 8,
  losses: 3,
  streak: 2,
  bestStreak: 4,
};
const noop = () => {};

// The looping hero animations (Float) never finish, so
// timers are faked and every renderer is unmounted to keep them from outliving
// the test environment.
jest.useFakeTimers();

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    mounted.splice(0).forEach(r => r.unmount());
  });
});

const render = async (element: React.ReactElement) => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  mounted.push(renderer);
  return renderer;
};

const text = (r: ReactTestRenderer.ReactTestRenderer) =>
  JSON.stringify(r.toJSON());
/** The same, with text that React split into pieces ("0", "/", "222") joined back together. */
const flat = (r: ReactTestRenderer.ReactTestRenderer) =>
  text(r).split('","').join('');

test('Onboarding offers Play Games only when available', async () => {
  const on = await render(
    <Onboarding
      playGamesAvailable
      onPlayGames={async () => {}}
      onGuest={noop}
    />,
  );
  expect(text(on)).toContain('Sign in with Play Games');
  expect(text(on)).toContain('Play as guest');
  const off = await render(
    <Onboarding
      playGamesAvailable={false}
      onPlayGames={async () => {}}
      onGuest={noop}
    />,
  );
  expect(text(off)).not.toContain('Sign in with Play Games');
});

test('Home is a menu: play the current level, levels, shop, and the daily, profile and settings buttons', async () => {
  const onPlay = jest.fn();
  const onShop = jest.fn();
  const r = await render(
    <Home
      player={player}
      progress={progress}
      dailyReady
      onPlay={onPlay}
      onLevels={noop}
      onShop={onShop}
      onDaily={noop}
      onProfile={noop}
      onLeaderboard={noop}
      onSettings={noop}
    />,
  );
  const press = (label: string) =>
    r.root.findAll(n => n.props.accessibilityLabel === label && n.props.onPress)[0];
  expect(text(r)).toContain('PLAY');
  expect(press('PLAY, LEVEL 7')).toBeTruthy();
  expect(press('LEVELS')).toBeTruthy();
  expect(press('Daily bonus, ready')).toBeTruthy();
  expect(press('Profile')).toBeTruthy();
  expect(press('Settings')).toBeTruthy();
  await ReactTestRenderer.act(async () => press('PLAY, LEVEL 7').props.onPress());
  await ReactTestRenderer.act(async () => press('SHOP').props.onPress());
  expect(onPlay).toHaveBeenCalledTimes(1);
  expect(onShop).toHaveBeenCalledTimes(1);
});

test('Levels marks cleared, current and locked levels', async () => {
  // The list opens on your level (the one you cleared just before it sits underneath), so level 1 is below the fold.
  const r = await render(<Levels unlocked={3} onPick={noop} onBack={noop} />);
  const label = (s: string) =>
    r.root.findAll(n => n.props.accessibilityLabel?.startsWith(s));
  expect(label('Level 2,')[0].props.accessibilityLabel).toContain('cleared');
  expect(label('Level 3,')[0].props.accessibilityLabel).not.toMatch(
    /cleared|locked/,
  );
  expect(label('Level 4,')[0].props.accessibilityLabel).toContain('locked');
});

test('Shop sells skins: buy what you can afford, equip what you own', async () => {
  const onBuy = jest.fn();
  const onEquip = jest.fn();
  const owned = { ...emptyProgress(), coins: 2000, spent: 100, skins: ['classic', 'ocean'], skin: 'classic' };
  const r = await render(<Shop progress={owned} onBuy={onBuy} onEquip={onEquip} onBuyItem={noop} onBuyUpgrade={noop} onBuyCosmetic={noop} onEquipCosmetic={noop} />);
  const press = (label: string) =>
    r.root.findAll(n => n.props.accessibilityLabel === label && n.props.onPress)[0];
  expect(press('Equip Deep Ocean')).toBeTruthy();
  await ReactTestRenderer.act(async () => press('Equip Deep Ocean').props.onPress());
  expect(onEquip).toHaveBeenCalledWith('ocean');
  // 2000 earned, 100 spent: 1900 left. Gold costs 2500, so it cannot be bought yet.
  expect(r.root.findAll(n => n.props.accessibilityLabel === 'Buy Sunny Gold for 2500 coins' && n.props.disabled === true).length).toBeGreaterThan(0);
  expect(r.root.findAll(n => n.props.accessibilityLabel === 'Classic Blue, equipped').length).toBeGreaterThan(0);
  expect(onBuy).not.toHaveBeenCalled();
});

test('Levels is a path: tapping an open level plays it, a locked one does nothing', async () => {
  const onPick = jest.fn();
  const r = await render(<Levels unlocked={3} onPick={onPick} />);
  const btn = (s: string) =>
    r.root.findAll(n => n.props.accessibilityLabel?.startsWith(s) && n.props.onPress)[0];
  await ReactTestRenderer.act(async () => btn('Level 2,').props.onPress());
  expect(onPick).toHaveBeenCalledWith(2);
  expect(btn('Level 5,').props.disabled).toBe(true);
  expect(btn('Go to level 3')).toBeTruthy();
});

test('Levels lists your open levels and three locked ones ahead, no more', async () => {
  const r = await render(<Levels unlocked={5} onPick={noop} />);
  const label = (n: number) => r.root.findAll(x => x.props.accessibilityLabel?.startsWith(`Level ${n},`));
  expect(label(5)[0].props.accessibilityLabel).not.toMatch(/cleared|locked/); // the level you are on
  for (const n of [6, 7, 8]) expect(label(n)[0].props.accessibilityLabel).toContain('locked');
  expect(label(9)).toHaveLength(0);
});

test('Levels opens on your level, and grows by one when you clear it', async () => {
  const far = await render(<Levels unlocked={247} onPick={noop} />);
  expect(far.root.findAll(n => n.props.accessibilityLabel === 'Go to level 247').length).toBeGreaterThan(0);
  const label = (r: ReactTestRenderer.ReactTestRenderer, n: number) => r.root.findAll(x => x.props.accessibilityLabel?.startsWith(`Level ${n},`));
  expect(label(far, 247).length).toBeGreaterThan(0);
  expect(label(far, 250).length).toBeGreaterThan(0); // 247 + three locked
  expect(label(far, 251)).toHaveLength(0);
  const next = await render(<Levels unlocked={248} onPick={noop} />);
  expect(label(next, 251).length).toBeGreaterThan(0);
});

test('Levels can open every level up to a test limit without changing your progress', async () => {
  const r = await render(<Levels unlocked={3} openUpTo={900} onPick={noop} />);
  const label = (s: string) =>
    r.root.findAll(n => n.props.accessibilityLabel?.startsWith(s));
  expect(label('Level 5,')[0].props.accessibilityLabel).not.toContain('locked');
  expect(label('Level 5,')[0].props.accessibilityLabel).not.toContain('cleared');
});

test('DailyBonus claims through the parent', async () => {
  const onClaim = jest.fn();
  const r = await render(
    <DailyBonus progress={emptyProgress()} onClaim={onClaim} onBack={noop} />,
  );
  const claim = r.root.findAll(
    n => n.props.accessibilityLabel === 'CLAIM TODAY' && n.props.onPress,
  )[0];
  await ReactTestRenderer.act(async () => claim.props.onPress());
  expect(onClaim).toHaveBeenCalledTimes(1);
  expect(text(r)).toContain('CLAIMED!');
});

test('Profile shows the battle record and the sign-in action', async () => {
  const r = await render(
    <Profile
      player={player}
      progress={progress}
      playGamesAvailable
      onPlayGames={async () => {}}
      onSignOut={async () => {}}
      onRenameGuest={async () => true}
    />,
  );
  expect(text(r)).toContain('SIGN IN WITH PLAY GAMES');
  expect(text(r)).toContain('73%'); // 8 wins of 11 battles
});

test('Profile lets a guest rename: the pencil opens a dialog, Save calls onRenameGuest and closes it', async () => {
  const onRenameGuest = jest.fn(async (_name: string) => true);
  const r = await render(
    <Profile
      player={player}
      progress={progress}
      playGamesAvailable
      onPlayGames={async () => {}}
      onSignOut={async () => {}}
      onRenameGuest={onRenameGuest}
    />,
  );
  expect(text(r)).not.toContain('CHANGE USERNAME');

  const pencil = r.root.findAll(
    n => n.props.accessibilityLabel === 'Change username' && n.props.onPress,
  )[0];
  await ReactTestRenderer.act(async () => pencil.props.onPress());
  expect(text(r)).toContain('CHANGE USERNAME');

  const input = r.root.findAll(n => n.props.onChangeText)[0];
  await ReactTestRenderer.act(async () => input.props.onChangeText('Rex'));

  const save = r.root.findAll(
    n => n.props.accessibilityLabel === 'SAVE' && n.props.onPress,
  )[0];
  await ReactTestRenderer.act(async () => save.props.onPress());

  expect(onRenameGuest).toHaveBeenCalledWith('Rex');
  expect(text(r)).not.toContain('CHANGE USERNAME');
});

test('Profile keeps the rename dialog open with an error when the save fails', async () => {
  const onRenameGuest = jest.fn(async () => false);
  const r = await render(
    <Profile
      player={player}
      progress={progress}
      playGamesAvailable
      onPlayGames={async () => {}}
      onSignOut={async () => {}}
      onRenameGuest={onRenameGuest}
    />,
  );

  const pencil = r.root.findAll(
    n => n.props.accessibilityLabel === 'Change username' && n.props.onPress,
  )[0];
  await ReactTestRenderer.act(async () => pencil.props.onPress());

  const input = r.root.findAll(n => n.props.onChangeText)[0];
  await ReactTestRenderer.act(async () => input.props.onChangeText('Rex'));

  const save = r.root.findAll(
    n => n.props.accessibilityLabel === 'SAVE' && n.props.onPress,
  )[0];
  await ReactTestRenderer.act(async () => save.props.onPress());

  expect(onRenameGuest).toHaveBeenCalledWith('Rex');
  expect(text(r)).toContain('CHANGE USERNAME');
  expect(flat(r)).toContain("Couldn't save that");
});

test('Leaderboard offers Worldwide, Country and City tabs and degrades without a server', async () => {
  const r = await render(<Leaderboard player={player} myScore={1234} myTitle="champion" onBack={noop} />);
  // Firebase is unconfigured in tests, so the Worldwide fetch resolves offline straight away.
  expect(text(r)).toContain('Leaderboard unavailable');
  const retry = r.root.findAll(n => n.props.accessibilityLabel === 'RETRY' && n.props.onPress)[0];
  expect(retry).toBeTruthy();

  const countryTab = r.root.findAll(n => n.props.accessibilityLabel === 'Country' && n.props.onPress)[0];
  await ReactTestRenderer.act(async () => countryTab.props.onPress());
  // No device location in a test environment either, so the Country tab falls back the same way.
  expect(text(r)).toContain('Location unavailable');
});

test('Settings saves the staged toggles', async () => {
  const onSave = jest.fn();
  const r = await render(
    <Settings initial={DEFAULT_SETTINGS} onSave={onSave} onBack={noop} />,
  );
  const music = r.root.findAll(
    n => n.props.accessibilityLabel === 'Music' && n.props.onValueChange,
  )[0];
  await ReactTestRenderer.act(async () => music.props.onValueChange(false));
  const save = r.root.findAll(
    n => n.props.accessibilityLabel === 'SAVE' && n.props.onPress,
  )[0];
  await ReactTestRenderer.act(async () => save.props.onPress());
  expect(onSave).toHaveBeenCalledWith({
    sound: true,
    music: false,
    vibration: true,
  });
});

test('Pause toggles write through to settings', async () => {
  const onChange = jest.fn();
  const r = await render(
    <Pause
      level={4}
      settings={DEFAULT_SETTINGS}
      onSettingsChange={onChange}
      onResume={noop}
      onRestart={noop}
      onLevels={noop}
      onHome={noop}
    />,
  );
  const vib = r.root.findAll(
    n => n.props.accessibilityLabel === 'Vibration' && n.props.onPress,
  )[0];
  await ReactTestRenderer.act(async () => vib.props.onPress());
  expect(onChange).toHaveBeenCalledWith({
    ...DEFAULT_SETTINGS,
    vibration: false,
  });
});

test('WinScreen shows the reward and offers no ad', async () => {
  const props = {
    level: 5,
    payout: 1000,
    replay: false,
    onNext: noop,
    onLevels: noop,
    onHome: noop,
  };
  const r = await render(<WinScreen {...props} />);
  expect(text(r)).toContain('+1,000');
  expect(text(r)).not.toContain('WATCH AD');
  expect(text(r)).toContain('NEXT LEVEL');
});

test('LoseScreen offers a retry', async () => {
  const r = await render(
    <LoseScreen level={5} onRetry={noop} onLevels={noop} onHome={noop} />,
  );
  expect(text(r)).toContain('TRY AGAIN');
  expect(text(r)).toContain('Defeated');
});

test('WinScreen and LoseScreen offer a share button that opens the share sheet', async () => {
  const RNShare = require('react-native-share').default;
  const press = (r: ReactTestRenderer.ReactTestRenderer) =>
    r.root.findAll(n => n.props.accessibilityLabel === 'Share result' && n.props.onPress)[0];

  const win = await render(
    <WinScreen level={5} payout={200} replay={false} onNext={noop} onLevels={noop} onHome={noop} />,
  );
  await ReactTestRenderer.act(async () => press(win).props.onPress());
  expect(RNShare.open).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Level 5') }));

  const lose = await render(
    <LoseScreen level={5} onRetry={noop} onLevels={noop} onHome={noop} />,
  );
  await ReactTestRenderer.act(async () => press(lose).props.onPress());
  expect(RNShare.open).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('defeated') }));
});

test('Levels shows the best stars on cleared levels', async () => {
  // With 5 unlocked the list opens on level 4 (cleared, 2 stars) and level 5 (current, no stars shown yet).
  const r = await render(
    <Levels unlocked={5} stars={{ 4: 2 }} onPick={noop} onBack={noop} />,
  );
  const stars = (n: number) =>
    r.root.findAll(x => x.props.accessibilityLabel === `${n} of 3 stars`);
  expect(stars(2).length).toBeGreaterThan(0); // level 4
  expect(stars(3)).toHaveLength(0);
  expect(stars(0)).toHaveLength(0); // the current level shows no stars
});

test('WinScreen shows the win time against the star times, with what each pays', async () => {
  const props = {
    level: 5,
    payout: 200,
    replay: false,
    onNext: noop,
    onLevels: noop,
    onHome: noop,
  };
  // Level 5 times: 1:05 / 1:35 / 2:10 (they stretch a little with the level). Won in 1:20: two stars.
  const result = scoreBattle(5, true, 80);
  const r = await render(<WinScreen {...props} result={result} seconds={80} />);
  expect(text(r)).toContain('Win the battle');
  expect(text(r)).toContain('Win in under 1:35');
  expect(text(r)).toContain('Win in under 1:05');
  expect(text(r)).toContain('250 coins');
  expect(text(r)).toContain('1:20');
  expect(
    r.root.findAll(n => n.props.accessibilityLabel === '2 of 3 stars').length,
  ).toBeGreaterThan(0);
});

test('Shop sells every battle item: it says how many you hold and buys one or five', async () => {
  const onBuyItem = jest.fn();
  const some = { ...emptyProgress(), coins: 1000, items: { bomb: 3, freeze: 1 }, itemsUsed: { bomb: 1 } };
  const r = await render(<Shop progress={some} onBuy={noop} onEquip={noop} onBuyItem={onBuyItem} onBuyUpgrade={noop} onBuyCosmetic={noop} onEquipCosmetic={noop} />);
  expect(text(r)).toContain('You have 2');
  for (const name of ['Bomb', 'Mega bomb', 'Freeze', 'Airdrop', 'Shield', 'Surge', 'Rally', 'Provoke']) {
    expect(text(r)).toContain(name);
  }
  const press = (label: string) =>
    r.root.findAll(n => n.props.accessibilityLabel === label && n.props.onPress)[0];
  await ReactTestRenderer.act(async () => press('Buy 5 Freeze for 1000 coins').props.onPress());
  expect(onBuyItem).toHaveBeenCalledWith('freeze', 5);
  await ReactTestRenderer.act(async () => press('Buy 1 Bomb for 200 coins').props.onPress());
  expect(onBuyItem).toHaveBeenCalledWith('bomb', 1);
  // 1000 coins: a mega bomb (600) is affordable, five of them (2,400) are not.
  expect(r.root.findAll(n => n.props.accessibilityLabel === 'Buy 5 Mega bomb for 2400 coins' && n.props.disabled === true).length).toBeGreaterThan(0);
});

test('Shop sells permanent upgrades one level at a time, and says when one is maxed', async () => {
  const onBuyUpgrade = jest.fn();
  const some = { ...emptyProgress(), coins: 1200, upgrades: { heavy: 3 } };
  const r = await render(<Shop progress={some} onBuy={noop} onEquip={noop} onBuyItem={noop} onBuyUpgrade={onBuyUpgrade} onBuyCosmetic={noop} onEquipCosmetic={noop} />);
  const press = (label: string) =>
    r.root.findAll(n => n.props.accessibilityLabel === label && n.props.onPress)[0];
  expect(text(r)).toContain('Next: +2 troops on each tower you start with');
  await ReactTestRenderer.act(async () => press('Buy Reserves level 1 for 600 coins').props.onPress());
  expect(onBuyUpgrade).toHaveBeenCalledWith('reserves');
  // All three levels of Heavy bombs are already owned, so it is maxed.
  expect(r.root.findAll(n => n.props.accessibilityLabel === 'Heavy bombs, maxed').length).toBeGreaterThan(0);
  expect(r.root.findAll(n => n.props.accessibilityLabel === 'Heavy bombs level 3 of 3').length).toBeGreaterThan(0);
});

test('Shop sells troop shapes and board themes: buy one, equip one you own', async () => {
  const onBuyCosmetic = jest.fn();
  const onEquipCosmetic = jest.fn();
  const some = { ...emptyProgress(), coins: 1000, boards: ['classic', 'sand'], board: 'classic', shapes: ['round'], shape: 'round' };
  const r = await render(
    <Shop progress={some} onBuy={noop} onEquip={noop} onBuyItem={noop} onBuyUpgrade={noop} onBuyCosmetic={onBuyCosmetic} onEquipCosmetic={onEquipCosmetic} />,
  );
  const press = (label: string) =>
    r.root.findAll(n => n.props.accessibilityLabel === label && n.props.onPress)[0];
  await ReactTestRenderer.act(async () => press('Buy Square for 900 coins').props.onPress());
  expect(onBuyCosmetic).toHaveBeenCalledWith('shape', 'square');
  await ReactTestRenderer.act(async () => press('Equip Desert sand').props.onPress());
  expect(onEquipCosmetic).toHaveBeenCalledWith('board', 'sand');
  expect(r.root.findAll(n => n.props.accessibilityLabel === 'Round, equipped').length).toBeGreaterThan(0);
  expect(r.root.findAll(n => n.props.accessibilityLabel === 'Buy Star for 1500 coins' && n.props.disabled === true).length).toBeGreaterThan(0);
});

test('Shop sells leaderboard titles: buy one, equip No title back', async () => {
  const onBuyCosmetic = jest.fn();
  const onEquipCosmetic = jest.fn();
  const some = { ...emptyProgress(), coins: 5000, titles: ['none', 'veteran'], title: 'veteran' };
  const r = await render(
    <Shop progress={some} onBuy={noop} onEquip={noop} onBuyItem={noop} onBuyUpgrade={noop} onBuyCosmetic={onBuyCosmetic} onEquipCosmetic={onEquipCosmetic} />,
  );
  const press = (label: string) =>
    r.root.findAll(n => n.props.accessibilityLabel === label && n.props.onPress)[0];
  expect(r.root.findAll(n => n.props.accessibilityLabel === 'Veteran, equipped').length).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => press('Equip No title').props.onPress());
  expect(onEquipCosmetic).toHaveBeenCalledWith('title', 'none');
  await ReactTestRenderer.act(async () => press('Buy Conqueror for 2000 coins').props.onPress());
  expect(onBuyCosmetic).toHaveBeenCalledWith('title', 'conqueror');
});

test('BackupNudge dismisses on sign-in, and surfaces an error without dismissing on failure', async () => {
  const onDismiss = jest.fn();
  const press = (r: ReactTestRenderer.ReactTestRenderer, label: string) =>
    r.root.findAll(n => n.props.accessibilityLabel === label && n.props.onPress)[0];

  const ok = await render(<BackupNudge onSignIn={async () => {}} onDismiss={onDismiss} />);
  expect(text(ok)).toContain('Sign in with Play Games');
  await ReactTestRenderer.act(async () => press(ok, 'SIGN IN WITH PLAY GAMES').props.onPress());
  expect(onDismiss).toHaveBeenCalledTimes(1);

  onDismiss.mockClear();
  const failing = await render(
    <BackupNudge onSignIn={async () => { throw new Error('Try again in a moment.'); }} onDismiss={onDismiss} />,
  );
  await ReactTestRenderer.act(async () => press(failing, 'SIGN IN WITH PLAY GAMES').props.onPress());
  expect(text(failing)).toContain('Try again in a moment.');
  expect(onDismiss).not.toHaveBeenCalled();

  await ReactTestRenderer.act(async () => press(failing, 'MAYBE LATER').props.onPress());
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

/**
 * Meta-progression rules: level payouts, the daily-bonus streak and merging
 * two copies of a save. Every reducer takes the day key explicitly, so these
 * run without a clock.
 */

import {
  DAILY_REWARDS,
  addCoins,
  FREE_BOMBS,
  buyItem,
  buyCosmetic,
  buySkin,
  buyUpgrade,
  selectCosmetic,
  coinsLeft,
  upgradeLevel,
  heldOf,
  sanitizeCounts,
  spendItem,
  stockOf,
  selectSkin,
  sanitizeSkins,
  canClaimDaily,
  claimDaily,
  dailyIndex,
  emptyProgress,
  liveStreak,
  mergeProgress,
  recordLoss,
  recordWin,
  sanitizeStars,
  starsOf,
  totalStars,
  untilReset,
} from '../src/progress';

const DAY = '2026-09-17';
const NEXT_DAY = '2026-09-18';
const LATER = '2026-09-20';

describe('recordWin / recordLoss', () => {
  it('pays coins and unlocks the next level on the frontier', () => {
    const p = recordWin(emptyProgress(), 1, 550);
    expect(p.coins).toBe(550);
    expect(p.unlocked).toBe(2);
    expect(p.wins).toBe(1);
  });

  it('never lowers the unlocked level when a cleared level is replayed', () => {
    const p = recordWin({ ...emptyProgress(), unlocked: 9 }, 3, 100);
    expect(p.unlocked).toBe(9);
    expect(p.coins).toBe(100);
  });

  it('counts losses without touching coins or level', () => {
    const p = recordLoss({ ...emptyProgress(), coins: 40, unlocked: 4 });
    expect(p).toMatchObject({ losses: 1, coins: 40, unlocked: 4 });
  });

  it('adds bonus coins, ignoring negatives', () => {
    expect(addCoins(emptyProgress(), 300).coins).toBe(300);
    expect(addCoins(emptyProgress(), -5).coins).toBe(0);
  });
});

describe('daily bonus', () => {
  it('can be claimed once a day', () => {
    const first = claimDaily(emptyProgress(), DAY);
    expect(canClaimDaily(first, DAY)).toBe(false);
    expect(claimDaily(first, DAY)).toBe(first);
    expect(canClaimDaily(first, NEXT_DAY)).toBe(true);
  });

  it('pays day one, then advances the streak on consecutive days', () => {
    const d1 = claimDaily(emptyProgress(), DAY);
    expect(d1.coins).toBe(DAILY_REWARDS[0].amount);
    expect(d1.streak).toBe(1);

    const d2 = claimDaily(d1, NEXT_DAY);
    expect(d2.coins).toBe(DAILY_REWARDS[0].amount + DAILY_REWARDS[1].amount);
    expect(d2.streak).toBe(2);
  });

  it('restarts the streak at day one after a missed day', () => {
    const d2 = claimDaily(claimDaily(emptyProgress(), DAY), NEXT_DAY);
    const back = claimDaily(d2, LATER);
    expect(back.streak).toBe(1);
    expect(back.coins).toBe(d2.coins + DAILY_REWARDS[0].amount);
    // The best run is remembered even though the live streak reset.
    expect(back.bestStreak).toBe(2);
  });

  it('shows day one as up next once the streak is broken', () => {
    const d2 = claimDaily(claimDaily(emptyProgress(), DAY), NEXT_DAY);
    expect(liveStreak(d2, NEXT_DAY)).toBe(2);
    expect(dailyIndex(d2, NEXT_DAY)).toBe(2); // tomorrow's reward, already claimed today
    expect(liveStreak(d2, LATER)).toBe(0);
    expect(dailyIndex(d2, LATER)).toBe(0);
  });

  it('wraps to day one after the chest', () => {
    let p = emptyProgress();
    for (let i = 0; i < DAILY_REWARDS.length; i++) {
      p = claimDaily(p, new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10));
    }
    expect(p.streak).toBe(DAILY_REWARDS.length);
    expect(DAILY_REWARDS[DAILY_REWARDS.length - 1].kind).toBe('chest');
    expect(dailyIndex(p, '2026-09-08')).toBe(0);
  });

  it('counts down to the next UTC midnight', () => {
    expect(untilReset(new Date('2026-09-17T22:30:00.000Z'))).toBe('1h 30m');
  });
});

describe('mergeProgress', () => {
  it('keeps the larger of every counter', () => {
    const a = { ...emptyProgress(), coins: 100, unlocked: 3, wins: 2 };
    const b = { ...emptyProgress(), coins: 900, unlocked: 2, wins: 5, losses: 1 };
    expect(mergeProgress(a, b)).toMatchObject({ coins: 900, unlocked: 3, wins: 5, losses: 1 });
  });

  it('takes the streak from whichever copy claimed most recently', () => {
    const a = { ...emptyProgress(), streak: 5, lastClaimDay: DAY, bestStreak: 5 };
    const b = { ...emptyProgress(), streak: 1, lastClaimDay: NEXT_DAY, bestStreak: 1 };
    expect(mergeProgress(a, b)).toMatchObject({ streak: 1, lastClaimDay: NEXT_DAY, bestStreak: 5 });
  });

  it('returns the same object when nothing needs merging', () => {
    const a = { ...emptyProgress(), coins: 10, unlocked: 2 };
    expect(mergeProgress(a, emptyProgress())).toBe(a);
  });
});

describe('stars', () => {
  it('records the best stars per level and never lowers them', () => {
    let p = recordWin(emptyProgress(), 3, 100, 2);
    expect(starsOf(p, 3)).toBe(2);
    p = recordWin(p, 3, 100, 1);
    expect(starsOf(p, 3)).toBe(2);
    p = recordWin(p, 3, 100, 3);
    expect(starsOf(p, 3)).toBe(3);
    expect(totalStars(recordWin(p, 4, 100, 1))).toBe(4);
  });

  it('a win with no stars given leaves the map untouched', () => {
    const start = emptyProgress();
    expect(recordWin(start, 2, 50).stars).toEqual({});
  });

  it('merges as the per-level maximum', () => {
    const a = { ...emptyProgress(), stars: { 1: 3, 2: 1 } };
    const b = { ...emptyProgress(), stars: { 2: 2, 5: 1 } };
    expect(mergeProgress(a, b).stars).toEqual({ 1: 3, 2: 2, 5: 1 });
    expect(mergeProgress(a, { ...emptyProgress(), stars: { 1: 2 } })).toBe(a);
  });

  it('cleans stars read from a save', () => {
    expect(sanitizeStars({ 1: 3, 2: 9, 3: 0, x: 2, '-4': 2, 5: 'two', 6: 1.9 })).toEqual({ 1: 3, 2: 3, 6: 1 });
    expect(sanitizeStars(undefined)).toEqual({});
    expect(sanitizeStars('nope')).toEqual({});
  });
});

describe('shop', () => {
  const rich = { ...emptyProgress(), coins: 5000 };

  it('spends coins, owns the skin and equips it', () => {
    const p = buySkin(rich, 'violet', 1500);
    expect(coinsLeft(p)).toBe(3500);
    expect(p.skins).toEqual(['classic', 'violet']);
    expect(p.skin).toBe('violet');
    expect(p.coins).toBe(5000); // lifetime earned never goes down
  });

  it('refuses what you cannot afford or already own', () => {
    expect(buySkin({ ...emptyProgress(), coins: 100 }, 'violet', 1500)).toEqual({ ...emptyProgress(), coins: 100 });
    const once = buySkin(rich, 'violet', 1500);
    expect(buySkin(once, 'violet', 1500)).toBe(once);
  });

  it('equips only skins you own', () => {
    const p = buySkin(rich, 'violet', 1500);
    expect(selectSkin(p, 'classic').skin).toBe('classic');
    expect(selectSkin(p, 'gold')).toBe(p);
  });

  it('merges by keeping the most spent and every skin owned', () => {
    const phone = buySkin(rich, 'violet', 1500);
    const cloud = buySkin(rich, 'gold', 2500);
    const merged = mergeProgress(phone, cloud);
    expect(merged.spent).toBe(2500);
    expect(merged.skins.sort()).toEqual(['classic', 'gold', 'violet']);
    expect(merged.skins).toContain(merged.skin);
    expect(mergeProgress(merged, phone)).toBe(merged);
  });

  it('cleans skins read from a save', () => {
    expect(sanitizeSkins(['violet', 'violet', 42, '', 'gold'])).toEqual(['classic', 'violet', 'gold']);
    expect(sanitizeSkins(null)).toEqual(['classic']);
  });
});

describe('items', () => {
  const rich = { ...emptyProgress(), coins: 3000 };

  it('starts with a couple of free bombs and nothing else', () => {
    expect(heldOf(emptyProgress(), 'bomb')).toBe(FREE_BOMBS);
    expect(heldOf(emptyProgress(), 'freeze')).toBe(0);
    expect(stockOf(emptyProgress())).toEqual({ bomb: FREE_BOMBS });
  });

  it('buying spends coins and adds that item only', () => {
    const p = buyItem(rich, 'freeze', 5, 1000);
    expect(coinsLeft(p)).toBe(2000);
    expect(heldOf(p, 'freeze')).toBe(5);
    expect(heldOf(p, 'bomb')).toBe(FREE_BOMBS);
  });

  it('refuses what you cannot afford', () => {
    const poor = { ...emptyProgress(), coins: 100 };
    expect(buyItem(poor, 'freeze', 5, 1000)).toBe(poor);
  });

  it('spending uses one and never goes below none', () => {
    let p = emptyProgress();
    for (let i = 0; i < FREE_BOMBS; i++) p = spendItem(p, 'bomb');
    expect(heldOf(p, 'bomb')).toBe(0);
    expect(spendItem(p, 'bomb')).toBe(p);
    expect(spendItem(p, 'freeze')).toBe(p);
  });

  it('merges per item by the most bought and the most used, so an item used on either copy stays used', () => {
    const phone = spendItem(buyItem(rich, 'freeze', 5, 1000), 'freeze');
    const cloud = buyItem(rich, 'airdrop', 5, 600);
    const merged = mergeProgress(phone, cloud);
    expect(merged.items).toEqual({ bomb: FREE_BOMBS, freeze: 5, airdrop: 5 });
    expect(merged.itemsUsed).toEqual({ freeze: 1 });
    expect(mergeProgress(merged, phone)).toBe(merged);
  });

  it('cleans counts read from a save', () => {
    expect(sanitizeCounts({ bomb: 3.9, freeze: -2, shield: 'x', '': 4, rally: 2e9 })).toEqual({ bomb: 3, rally: 1_000_000 });
    expect(sanitizeCounts(null)).toEqual({});
    expect(sanitizeCounts([1, 2])).toEqual({});
  });
});

describe('upgrades', () => {
  const rich = { ...emptyProgress(), coins: 5000 };

  it('buys one level at a time, spending coins', () => {
    const one = buyUpgrade(rich, 'reserves', 600, 4);
    expect(upgradeLevel(one, 'reserves')).toBe(1);
    expect(coinsLeft(one)).toBe(4400);
    const two = buyUpgrade(one, 'reserves', 1000, 4);
    expect(upgradeLevel(two, 'reserves')).toBe(2);
    expect(coinsLeft(two)).toBe(3400);
  });

  it('refuses past the top level and what you cannot afford', () => {
    const top = { ...rich, upgrades: { heavy: 3 } };
    expect(buyUpgrade(top, 'heavy', 2500, 3)).toBe(top);
    const poor = { ...emptyProgress(), coins: 100 };
    expect(buyUpgrade(poor, 'reserves', 600, 4)).toBe(poor);
  });

  it('merges by the higher level, so a level bought on either copy is kept', () => {
    const phone = buyUpgrade(rich, 'reserves', 600, 4);
    const cloud = buyUpgrade(buyUpgrade(rich, 'bandolier', 1000, 2), 'bandolier', 2000, 2);
    const merged = mergeProgress(phone, cloud);
    expect(merged.upgrades).toEqual({ reserves: 1, bandolier: 2 });
    expect(mergeProgress(merged, cloud)).toBe(merged);
  });
});

describe('troop shapes and board themes', () => {
  const rich = { ...emptyProgress(), coins: 5000 };

  it('start with the plain ones owned and equipped', () => {
    const p = emptyProgress();
    expect([p.shapes, p.shape, p.boards, p.board]).toEqual([['round'], 'round', ['classic'], 'classic']);
  });

  it('buying equips it and spends coins, for each kind', () => {
    const p = buyCosmetic(buyCosmetic(rich, 'shape', 'star', 1500), 'board', 'night', 1500);
    expect(p.shape).toBe('star');
    expect(p.board).toBe('night');
    expect(p.shapes).toEqual(['round', 'star']);
    expect(coinsLeft(p)).toBe(2000);
    expect(p.skin).toBe('classic');
  });

  it('refuses what you own or cannot afford, and equips only what you own', () => {
    const p = buyCosmetic(rich, 'shape', 'square', 900);
    expect(buyCosmetic(p, 'shape', 'square', 900)).toBe(p);
    const poor = { ...emptyProgress(), coins: 100 };
    expect(buyCosmetic(poor, 'board', 'sand', 1000)).toBe(poor);
    expect(selectCosmetic(p, 'shape', 'round').shape).toBe('round');
    expect(selectCosmetic(p, 'shape', 'star')).toBe(p);
    expect(selectCosmetic(p, 'board', 'night')).toBe(p);
  });

  it('merge by owning everything either copy owns', () => {
    const phone = buyCosmetic(rich, 'shape', 'square', 900);
    const cloud = buyCosmetic(rich, 'board', 'mint', 1000);
    const merged = mergeProgress(phone, cloud);
    expect(merged.shapes.sort()).toEqual(['round', 'square']);
    expect(merged.boards.sort()).toEqual(['classic', 'mint']);
    expect(merged.spent).toBe(1000);
    expect(merged.shapes).toContain(merged.shape);
    expect(merged.boards).toContain(merged.board);
    expect(mergeProgress(merged, phone)).toBe(merged);
  });
});

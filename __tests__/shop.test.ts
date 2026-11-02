import { ITEM_IDS } from '../src/game/core';
import { look } from '../src/ui/look';
import { SHAPE_ART } from '../src/ui/sprites';
import { BOARDS, ITEM_PACKS, ITEM_SHOP, SHAPES, SKINS, TITLES, UPGRADES, applyBoard, applyShape, itemShopById, packPrice, perksOf, titleById } from '../src/shop';

describe('the shop catalogue', () => {
  it('sells every battle item exactly once, at a sensible price', () => {
    expect(ITEM_SHOP.map(i => i.id).sort()).toEqual([...ITEM_IDS].sort());
    for (const i of ITEM_SHOP) {
      expect(i.price).toBeGreaterThanOrEqual(100);
      expect(i.price).toBeLessThanOrEqual(600);
      expect(i.name.length).toBeGreaterThan(0);
      expect(i.blurb.length).toBeGreaterThan(10);
      expect(itemShopById(i.id)).toBe(i);
    }
  });

  it('a pack of five is 20% cheaper than five singles', () => {
    for (const i of ITEM_SHOP) {
      expect(packPrice(i, 1)).toBe(i.price);
      expect(packPrice(i, 5)).toBe(Math.round(i.price * 5 * 0.8));
      expect(packPrice(i, 5)).toBeLessThan(5 * i.price);
    }
    expect(ITEM_PACKS).toEqual([1, 5]);
  });

  it('upgrades get dearer with each level and are capped', () => {
    for (const u of UPGRADES) {
      for (let i = 1; i < u.prices.length; i++) expect(u.prices[i]).toBeGreaterThan(u.prices[i - 1]);
      expect(u.prices.length).toBeLessThanOrEqual(4);
    }
  });

  it('perks add up from the upgrade levels and never exceed the caps', () => {
    const none = { startTroops: 0, bombBonus: 0, freezeBonus: 0, shieldBonus: 0, airdropBonus: 0 };
    expect(perksOf({})).toEqual(none);
    expect(perksOf({ reserves: 2, heavy: 1, coldsnap: 1, fortify: 1, supplydrop: 1 })).toEqual({ startTroops: 4, bombBonus: 1, freezeBonus: 2, shieldBonus: 3, airdropBonus: 2 });
    expect(perksOf({ reserves: 99, heavy: 99, coldsnap: 99, fortify: 99, supplydrop: 99 })).toEqual({ startTroops: 8, bombBonus: 3, freezeBonus: 6, shieldBonus: 9, airdropBonus: 6 });
    expect(perksOf({ reserves: -3 })).toEqual(none);
  });

  it('has five distinct troop colours, the first one free', () => {
    expect(SKINS).toHaveLength(5);
    expect(new Set(SKINS.map(s => s.id)).size).toBe(5);
    expect(SKINS[0].price).toBe(0);
  });

  it('equipping a shape or a board changes what the renderer reads, and unknown ids fall back to the plain ones', () => {
    expect(SHAPES[0].id).toBe('round');
    expect(BOARDS[0].id).toBe('classic');
    applyShape('star');
    expect(look.shape).toBe('star');
    applyShape('no-such-shape');
    expect(look.shape).toBe('round');
    applyBoard('night');
    expect([look.board, look.water]).toEqual(['night', BOARDS.find(b => b.id === 'night')!.water]);
    applyBoard('no-such-board');
    expect([look.board, look.water, look.neutral]).toEqual(['classic', '#dfe6ee', '#a6a6a6']);
  });

  it('the picture shapes have art for the shop card and for battle, and equipping one is accepted', () => {
    for (const id of ['plane', 'sprite']) {
      expect(SHAPES.map(x => x.id)).toContain(id);
      expect(SHAPE_ART[id].troop).toBeDefined();
      expect(SHAPE_ART[id].card).toBeDefined();
      applyShape(id);
      expect(look.shape).toBe(id);
    }
    applyShape('round');
  });

  it('every shape and board has a name and a price, the first of each free', () => {
    for (const x of [...SHAPES, ...BOARDS]) {
      expect(x.name.length).toBeGreaterThan(0);
      expect(x.price).toBeGreaterThanOrEqual(0);
    }
    expect(SHAPES[0].price).toBe(0);
    expect(BOARDS[0].price).toBe(0);
    expect(new Set(BOARDS.map(b => b.id)).size).toBe(BOARDS.length);
  });
});

describe('leaderboard titles', () => {
  it('has a free, iconless "no title" first, then priced badges that only get dearer', () => {
    expect(TITLES[0]).toMatchObject({ id: 'none', price: 0, icon: null });
    expect(new Set(TITLES.map(t => t.id)).size).toBe(TITLES.length);
    for (let i = 1; i < TITLES.length; i++) {
      expect(TITLES[i].icon).not.toBeNull();
      expect(TITLES[i].tint.length).toBeGreaterThan(0);
      expect(TITLES[i].price).toBeGreaterThan(TITLES[i - 1].price);
    }
  });

  it('falls back to "no title" for an unknown id', () => {
    expect(titleById('champion').id).toBe('champion');
    expect(titleById('no-such-title').id).toBe('none');
  });
});

describe('the third enemy colour', () => {
  it('has a colour for every side, and no troop colour for you looks like the purple enemy', () => {
    const { COL, LIGHT } = require('../src/game/theme');
    const { THEME } = require('../src/theme');
    expect(COL).toHaveLength(5);
    expect(LIGHT).toHaveLength(5);
    expect(THEME.region).toHaveLength(5);
    expect(THEME.regionDeep).toHaveLength(5);
    expect(SKINS.some(s => s.id === 'violet')).toBe(false);
  });
});

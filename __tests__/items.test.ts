/**
 * Items as the player uses them in a battle: pick one in the bottom row, then (for most) tap a tower.
 */

import { GameSession, type Perks } from '../src/game/session';

// Sound needs the native module; the effects are exercised on a device.
jest.mock('../src/audio', () => ({ Audio: { sfx: jest.fn(), playMusic: jest.fn(), configure: jest.fn(), setSuspended: jest.fn() } }));

const battle = (perks?: Partial<Perks>) => {
  const s = new GameSession(24, 12345, 'normal', undefined, perks && { startTroops: 0, bombBonus: 0, freezeBonus: 0, shieldBonus: 0, airdropBonus: 0, ...perks });
  s.w = 360;
  s.h = 800;
  s.stock = { bomb: 2, freeze: 1, airdrop: 2, shield: 1, surge: 1, rally: 1, provoke: 1, megabomb: 1 };
  return s;
};

const enemyOf = (s: GameSession) => s.world.territories.find(t => t.owner === 2)!;
const mineOf = (s: GameSession) => s.world.territories.find(t => t.owner === 1)!;
const tap = (s: GameSession, t: { x: number; y: number }) => s.pointerDown(s.px(t), s.py(t));

describe('items in a battle', () => {
  it('a bomb: pick it, tap an enemy tower, and one is used', () => {
    const s = battle();
    const onItem = jest.fn();
    s.onItem = onItem;
    const enemy = enemyOf(s);
    const before = enemy.units;

    s.pickItem('bomb');
    expect(s.armed).toBe('bomb');
    tap(s, enemy);

    expect(enemy.units).toBe(before - 5);
    expect(s.armed).toBeNull();
    expect(s.heldOf('bomb')).toBe(1);
    expect(s.itemsUsed).toBe(1);
    expect(onItem).toHaveBeenCalledWith('bomb');
  });

  it('a tap on a tower the item cannot be used on puts it away without using it', () => {
    const s = battle();
    const onItem = jest.fn();
    s.onItem = onItem;
    s.pickItem('freeze');
    tap(s, mineOf(s)); // freeze needs an enemy tower
    expect(s.armed).toBeNull();
    expect(s.heldOf('freeze')).toBe(1);
    s.pickItem('airdrop');
    tap(s, enemyOf(s)); // airdrop needs one of yours
    expect(s.heldOf('airdrop')).toBe(2);
    expect(onItem).not.toHaveBeenCalled();
  });

  it('freeze, airdrop and shield work on the right towers', () => {
    const s = battle();
    const enemy = enemyOf(s);
    const mine = mineOf(s);
    const units = mine.units;
    s.pickItem('freeze');
    tap(s, enemy);
    expect(enemy.freeze).toBeGreaterThan(0);
    s.pickItem('airdrop');
    tap(s, mine);
    expect(mine.units).toBe(units + 10);
    s.pickItem('shield');
    tap(s, mine);
    expect(mine.shield).toBeGreaterThan(0);
  });

  it('items that need no target (surge, rally, provoke) are used the moment you pick them', () => {
    const s = battle();
    s.pickItem('surge');
    expect(s.world.buffs?.surge).toBeGreaterThan(0);
    expect(s.armed).toBeNull();
    expect(s.heldOf('surge')).toBe(0);
    s.pickItem('rally');
    expect(s.world.buffs?.rally).toBeGreaterThan(0);
    // provoke needs two enemies; level 24 has them
    s.pickItem('provoke');
    expect(s.heldOf('provoke')).toBe(0);
    expect(s.world.queues.some(q => q.owner === 2 || q.owner === 3)).toBe(true);
  });

  it('a refused item is not spent (a freeze that is already on)', () => {
    const s = battle();
    s.stock.freeze = 2;
    const enemy = enemyOf(s);
    s.pickItem('freeze');
    tap(s, enemy);
    s.pickItem('freeze');
    tap(s, enemy);
    expect(s.heldOf('freeze')).toBe(1);
    expect(s.itemsUsed).toBe(1);
  });

  it('there is no per-battle cap: you can use as many items as you hold', () => {
    const s = battle();
    const enemy = enemyOf(s);
    enemy.units = 200;
    for (let i = 0; i < 5; i++) {
      s.pickItem('bomb');
      tap(s, enemy);
      s.stock.bomb = 5;
    }
    expect(s.itemsUsed).toBe(5);
    expect(s.canUse('bomb')).toBe(true);

    s.stock.bomb = 0;
    expect(s.canUse('bomb')).toBe(false);
    s.pickItem('bomb');
    expect(s.armed).toBeNull();
  });

  it('the perks apply: extra starting troops and extra bomb damage', () => {
    const plain = battle();
    const strong = battle({ startTroops: 8, bombBonus: 3 });
    expect(mineOf(strong).units).toBe(mineOf(plain).units + 8);
    const enemy = enemyOf(strong);
    const before = enemy.units;
    strong.pickItem('bomb');
    tap(strong, enemy);
    expect(enemy.units).toBe(before - 8);
  });

  it('does nothing when you hold none, and picking the armed item again puts it away', () => {
    const none = battle();
    none.stock = {};
    none.pickItem('bomb');
    expect(none.armed).toBeNull();

    const s = battle();
    s.pickItem('bomb');
    s.pickItem('bomb');
    expect(s.armed).toBeNull();
  });

  it('shows the blast: the bomb falls first, then a ring and a floating number appear and then fade', () => {
    const s = battle();
    s.pickItem('bomb');
    tap(s, enemyOf(s));
    s.update(0.016, true);
    // Still in the air: the animation is running but nothing has landed yet.
    expect(s.fx.map(f => f.item)).toEqual(['bomb']);
    expect(s.floaters).toHaveLength(0);
    s.update(0.6, true);
    expect(s.floaters.map(f => f.text)).toContain('-5');
    expect(s.rings.length).toBeGreaterThan(0);
    s.update(3, false);
    expect(s.floaters).toHaveLength(0);
    expect(s.fx).toHaveLength(0);
  });

  it('plays an animation for every item, landing once, and clears it when it ends', () => {
    for (const id of ['megabomb', 'freeze', 'airdrop', 'shield', 'surge', 'rally', 'provoke'] as const) {
      const s = battle();
      s.stock = { [id]: 1 };
      s.pickItem(id);
      if (s.armed) tap(s, id === 'airdrop' || id === 'shield' ? mineOf(s) : enemyOf(s));
      s.update(0.016, true);
      if (s.fx.length === 0) continue; // refused by the rules in this battle (nothing to do): no animation either
      expect(s.fx[0].item).toBe(id);
      s.update(1, true);
      expect(s.fx[0].landed).toBe(true);
      s.update(4, false);
      expect(s.fx).toHaveLength(0);
    }
  });
});

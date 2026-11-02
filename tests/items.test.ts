import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AIRDROP_TROOPS,
  BOMB_DAMAGE,
  FREEZE_SECONDS,
  ITEM_IDS,
  ITEM_TARGET,
  MEGABOMB_DAMAGE,
  RALLY_SECONDS,
  SHIELD_SECONDS,
  SURGE_SECONDS,
  advance,
  applyItem,
  bomb,
  canTarget,
  generateLevel,
  levelSeed,
  send,
} from '../src/game/core/index.ts';
import type { World } from '../src/game/core/index.ts';

/** Runs the world forward `seconds` (advance() takes at most a quarter second per call). */
const sim = (w: World, seconds: number) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.25) advance(w, Math.min(0.25, seconds - t));
};

/** A hand-built board: [x, y, owner, units] per tower, no storms, nobody thinking. */
const board = (towers: [number, number, 0 | 1 | 2 | 3 | 4, number][]): World => {
  const w = generateLevel(1, 1);
  w.territories = towers.map(([x, y, owner, units], id) => ({ id, x, y, tier: 1, kind: 'normal' as const, owner, units, flash: 0 }));
  w.aiClock = [0, 0, 1e9, 1e9, 1e9];
  w.storms = [];
  w.collide = false;
  w.trackEvents = true;
  return w;
};

test('there is a rule and a target kind for every item', () => {
  assert.equal(ITEM_IDS.length, 10);
  for (const id of ITEM_IDS) assert.ok(ITEM_TARGET[id], id);
});

test('canTarget: bombs hit anything that is not yours, freeze only enemies, airdrop and shield only your own', () => {
  const w = board([[10, 10, 1, 10], [20, 20, 2, 10], [30, 30, 0, 10], [40, 40, 3, 10]]);
  const [mine, red, grey, green] = w.territories;
  assert.deepEqual([mine, red, grey, green].map((t) => canTarget('bomb', t)), [false, true, true, true]);
  assert.deepEqual([mine, red, grey, green].map((t) => canTarget('freeze', t)), [false, true, false, true]);
  assert.deepEqual([mine, red, grey, green].map((t) => canTarget('airdrop', t)), [true, false, false, false]);
  assert.deepEqual([mine, red, grey, green].map((t) => canTarget('shield', t)), [true, false, false, false]);
  assert.equal(canTarget('surge', undefined), true, 'items that need no target');
  assert.equal(canTarget('bomb', undefined), false, 'a target that is not there');
});

test('a bomb destroys 5 enemy troops, never captures, and never takes more than the garrison holds', () => {
  const w = board([[10, 10, 1, 40], [50, 50, 2, 30]]);
  const enemy = w.territories[1];
  assert.equal(BOMB_DAMAGE, 5);
  assert.equal(applyItem(w, 'bomb', 1), 5);
  assert.equal(enemy.units, 25);
  assert.equal(enemy.owner, 2, 'a bomb does not capture');
  enemy.units = 3.4;
  assert.equal(applyItem(w, 'bomb', 1), 3, 'only the whole troops that are there');
  assert.equal(applyItem(w, 'bomb', 1), null, 'nothing left to destroy: refused, so the item is kept');
});

test('the Heavy Bombs bonus adds damage to a bomb but not to a mega bomb', () => {
  const w = board([[10, 10, 1, 40], [50, 50, 2, 100]]);
  assert.equal(applyItem(w, 'bomb', 1, 3), 8);
  assert.equal(applyItem(w, 'megabomb', 1, 3), MEGABOMB_DAMAGE);
  assert.equal(w.territories[1].units, 100 - 8 - MEGABOMB_DAMAGE);
  assert.ok(w.events.some((e) => e.type === 'item' && e.item === 'megabomb' && e.amount === MEGABOMB_DAMAGE));
});

test('bombs are refused on your own tower, a missing tower and after the battle is over; neutral towers can be hit', () => {
  const w = board([[10, 10, 1, 40], [50, 50, 2, 30], [90, 90, 0, 20]]);
  assert.equal(applyItem(w, 'bomb', 0), null);
  assert.equal(w.territories[0].units, 40);
  assert.equal(applyItem(w, 'bomb', 9999), null);
  assert.equal(applyItem(w, 'bomb', 2), 5, 'a neutral tower can be bombed');
  assert.equal(bomb(w, 1), 5, 'the plain bomb function still works');
  w.status = 'won';
  assert.equal(applyItem(w, 'bomb', 1), null);
});

test('freeze: an enemy tower makes no troops for 10 seconds, then production comes back', () => {
  const run = (freeze: boolean) => {
    const w = board([[10, 150, 1, 20], [50, 50, 2, 20]]);
    if (freeze) assert.equal(applyItem(w, 'freeze', 1), FREEZE_SECONDS);
    sim(w, 6);
    const mid = w.territories[1].units;
    sim(w, 8);
    return { mid, end: w.territories[1].units, left: w.territories[1].freeze };
  };
  const frozen = run(true);
  const free = run(false);
  assert.equal(frozen.mid, 20, 'no troops while frozen');
  assert.ok(free.mid > 20.5, 'but the same tower unfrozen grows');
  assert.equal(frozen.left, 0, 'the freeze runs out');
  assert.ok(frozen.end > 20, 'and production resumes after it');
});

test('freeze is refused on your own tower, a neutral one, or a tower that is already frozen', () => {
  const w = board([[10, 10, 1, 20], [50, 50, 2, 20], [90, 90, 0, 20]]);
  assert.equal(applyItem(w, 'freeze', 0), null);
  assert.equal(applyItem(w, 'freeze', 2), null);
  assert.equal(applyItem(w, 'freeze', 1), FREEZE_SECONDS);
  assert.equal(applyItem(w, 'freeze', 1), null, 'no waste on a frozen tower');
});

test('airdrop adds 10 troops to one of your towers, and only yours', () => {
  const w = board([[10, 10, 1, 20], [50, 50, 2, 20]]);
  assert.equal(applyItem(w, 'airdrop', 0), AIRDROP_TROOPS);
  assert.equal(w.territories[0].units, 30);
  assert.equal(applyItem(w, 'airdrop', 1), null);
  assert.equal(w.territories[1].units, 20);
});

test('shield: a shielded tower takes half damage for 15 seconds', () => {
  const assault = (shield: boolean) => {
    const w = board([[50, 150, 1, 20], [50, 100, 2, 24]]);
    if (shield) assert.equal(applyItem(w, 'shield', 0), SHIELD_SECONDS);
    send(w, 1, 0, 1); // 24 troops at a tower with 20
    sim(w, 4);
    return w.territories[0];
  };
  assert.equal(assault(false).owner, 2, 'without a shield the tower falls');
  const held = assault(true);
  assert.equal(held.owner, 1, 'with a shield it holds');
  assert.ok(held.units > 5, 'and keeps troops');
});

test('shield stacks with a fortress, expires, and is refused twice or on an enemy', () => {
  const w = board([[50, 150, 1, 20], [50, 100, 2, 20]]);
  assert.equal(applyItem(w, 'shield', 1), null, 'only your own towers');
  assert.equal(applyItem(w, 'shield', 0), SHIELD_SECONDS);
  assert.equal(applyItem(w, 'shield', 0), null, 'already shielded');
  sim(w, SHIELD_SECONDS + 1);
  assert.equal(w.territories[0].shield, 0);
  assert.equal(applyItem(w, 'shield', 0), SHIELD_SECONDS, 'it can be used again once it ends');
});

test('surge: your towers make double troops for 10 seconds, the enemy is not affected', () => {
  const gain = (surge: boolean) => {
    const w = board([[10, 150, 1, 10], [90, 20, 2, 10]]);
    if (surge) assert.equal(applyItem(w, 'surge'), SURGE_SECONDS);
    sim(w, 5);
    return { mine: w.territories[0].units - 10, theirs: w.territories[1].units - 10 };
  };
  const on = gain(true);
  const off = gain(false);
  assert.ok(Math.abs(on.mine / off.mine - 2) < 0.05, `double: ${on.mine} vs ${off.mine}`);
  assert.ok(Math.abs(on.theirs - off.theirs) < 1e-9, 'the enemy makes the same');
  const w = board([[10, 150, 1, 10], [90, 20, 2, 10]]);
  applyItem(w, 'surge');
  assert.equal(applyItem(w, 'surge'), null, 'already running');
  sim(w, SURGE_SECONDS + 1);
  assert.equal(w.buffs?.surge, 0);
});

test('rally: your troops fly twice as fast for 10 seconds, the enemy is not affected', () => {
  const travelled = (rally: boolean) => {
    const w = board([[10, 150, 1, 40], [10, 30, 2, 40], [90, 150, 2, 40]]);
    if (rally) assert.equal(applyItem(w, 'rally'), RALLY_SECONDS);
    send(w, 0, 1, 1);
    send(w, 2, 0, 1);
    sim(w, 0.5);
    return { mine: w.dots.find((d) => d.owner === 1)!.p, theirs: w.dots.find((d) => d.owner === 2)!.p };
  };
  const on = travelled(true);
  const off = travelled(false);
  assert.ok(on.mine > off.mine * 1.8, `faster: ${on.mine} vs ${off.mine}`);
  assert.ok(Math.abs(on.theirs - off.theirs) < 1e-9, 'enemy troops are not sped up');
});

test('provoke: the strongest enemy sends half its fullest tower at the other enemy', () => {
  const w = board([[10, 150, 1, 40], [50, 100, 2, 80], [50, 40, 2, 20], [90, 60, 3, 30]]);
  const sent = applyItem(w, 'provoke');
  assert.equal(sent, 40, 'half of its fullest tower (80)');
  assert.equal(w.queues.length, 1);
  assert.equal(w.queues[0].from, 1);
  assert.equal(w.queues[0].to, 3, 'at the other enemy');
  assert.equal(w.territories[1].units, 40);
});

test('provoke needs two enemies alive and a tower with troops to send', () => {
  const one = board([[10, 150, 1, 40], [50, 100, 2, 80]]);
  assert.equal(applyItem(one, 'provoke'), null, 'one enemy only: refused');
  const weak = board([[10, 150, 1, 40], [50, 100, 2, 4], [90, 60, 3, 3]]);
  assert.equal(applyItem(weak, 'provoke'), null, 'nothing worth sending');
  assert.equal(weak.queues.length, 0);
});

test('flak shoots down troops already heading for one of your towers, never your own and never queued-but-unsent troops elsewhere', () => {
  const w = board([[10, 10, 1, 40], [50, 50, 2, 40], [90, 90, 3, 40]]);
  send(w, 1, 0, 1); // 40 red troops toward tower 0
  send(w, 2, 0, 1); // 40 green troops toward tower 0 too
  sim(w, 1);
  const before = w.dots.reduce((n, d) => n + (d.to === 0 ? d.v : 0), 0);
  assert.ok(before > 0, 'something is in flight toward tower 0');
  const shot = applyItem(w, 'flak', 0);
  assert.ok(shot !== null && shot > 0);
  const after = w.dots.reduce((n, d) => n + (d.to === 0 ? d.v : 0), 0);
  assert.equal(before - after, shot);
  assert.equal(applyItem(w, 'flak', 1), null, 'only your own tower can be defended');
});

test('flak is refused when nothing is incoming', () => {
  const w = board([[10, 10, 1, 40], [50, 50, 2, 40]]);
  assert.equal(applyItem(w, 'flak', 0), null);
});

test('recall brings every troop sent from a tower home, queued or already flying, and only from your own tower', () => {
  const w = board([[10, 10, 1, 40], [90, 90, 0, 10], [50, 150, 2, 10]]);
  send(w, 0, 1, 1); // all 40 troops leave tower 0
  assert.equal(w.territories[0].units, 0);
  sim(w, 0.2); // some have left the queue as dots, some are still queued; the tower also produced a trickle meanwhile
  const before = w.territories[0].units;
  const n = applyItem(w, 'recall', 0);
  assert.ok(n !== null && n! > 35, `most of the 40 troops came home: ${n}`);
  assert.equal(w.territories[0].units, before + n!);
  assert.equal(w.dots.length, 0);
  assert.equal(w.queues.length, 0);
});

test('recall is refused with nothing out, and on a tower that is not yours', () => {
  const w = board([[10, 10, 1, 40], [50, 50, 2, 40]]);
  assert.equal(applyItem(w, 'recall', 0), null, 'nothing sent yet');
  assert.equal(applyItem(w, 'recall', 1), null, 'not your tower');
});

test('every item is refused when the battle is over, and items keep runs deterministic', () => {
  const w = board([[10, 10, 1, 40], [50, 50, 2, 30], [90, 90, 3, 30]]);
  w.status = 'lost';
  for (const id of ITEM_IDS) assert.equal(applyItem(w, id, ITEM_TARGET[id] === 'mine' ? 0 : 1), null, id);

  const run = (track: boolean) => {
    const g = generateLevel(9, levelSeed(9));
    g.trackEvents = track;
    sim(g, 3);
    const enemy = g.territories.find((t) => t.owner === 2)!.id;
    const mine = g.territories.find((t) => t.owner === 1)!.id;
    applyItem(g, 'bomb', enemy);
    applyItem(g, 'freeze', enemy);
    applyItem(g, 'airdrop', mine);
    applyItem(g, 'shield', mine);
    applyItem(g, 'surge');
    applyItem(g, 'rally');
    sim(g, 20);
    return { units: g.territories.map((t) => Math.round(t.units * 1000)), owners: g.territories.map((t) => t.owner), events: g.events };
  };
  const a = run(true);
  const b = run(false);
  assert.deepEqual(a.units, b.units);
  assert.deepEqual(a.owners, b.owners);
  assert.ok(a.events.some((e) => e.type === 'item' && e.item === 'bomb' && e.amount === 5));
});

test('with three enemies, freeze and bombs work on the third, and provoke picks the strongest at the nearest other', () => {
  const w = board([[10, 150, 1, 40], [50, 100, 2, 80], [50, 40, 3, 30], [90, 150, 4, 20], [90, 120, 4, 10]]);
  assert.equal(canTarget('freeze', w.territories[3]), true, 'the third enemy can be frozen');
  assert.equal(applyItem(w, 'bomb', 3), 5);
  // Red is strongest (80); its fullest tower sends half at the nearest tower of green or purple.
  const sent = applyItem(w, 'provoke');
  assert.equal(sent, 40);
  assert.equal(w.queues[0].from, 1);
  assert.equal(w.queues[0].to, 4, 'the purple tower at (90,120) is nearer to red (50,100) than green');
});

test('provoke needs at least two enemies even when three exist at the start', () => {
  const w = board([[10, 150, 1, 40], [50, 100, 2, 80]]);
  assert.equal(applyItem(w, 'provoke'), null);
});

// src/game/core/items.ts
//
// Battle items: what each one does to a world. Pure and deterministic (no randomness), so replays are unchanged. The AI
// never uses items. `applyItem` returns the amount it achieved (troops destroyed or added, or seconds), or null when it
// was refused (the battle is over, the wrong kind of target, or it would do nothing), in which case the caller keeps the
// item. Buying, holding and the per-battle limit live in the app (progress.ts, session.ts).

import { emit, power, send } from './world.ts';
import {
  AIRDROP_TROOPS,
  ENEMIES,
  BOMB_DAMAGE,
  FLAK_DAMAGE,
  FREEZE_SECONDS,
  ITEM_TARGET,
  MEGABOMB_DAMAGE,
  PROVOKE_FRACTION,
  RALLY_SECONDS,
  SHIELD_SECONDS,
  SURGE_SECONDS,
  type ItemId,
  type Territory,
  type World,
} from './types.ts';

/** Whether a tower is a valid target for an item (always true for items that need none). */
export function canTarget(item: ItemId, t: Territory | undefined): boolean {
  const kind = ITEM_TARGET[item];
  if (kind === 'none') return true;
  if (!t) return false;
  if (kind === 'foe') return t.owner !== 1;
  if (kind === 'enemy') return t.owner >= 2;
  return t.owner === 1;
}

/** Destroys up to `damage` of a tower's troops (never more than the whole troops there). It never captures. */
export function bomb(w: World, targetId: number, damage = BOMB_DAMAGE): number {
  const t = w.territories[targetId];
  if (w.status !== 'play' || !t || t.owner === 1) return 0;
  const removed = Math.min(damage, Math.floor(t.units));
  if (removed < 1) return 0;
  t.units -= removed;
  t.flash = 0.25;
  emit(w, { type: 'item', item: damage > BOMB_DAMAGE + 3 ? 'megabomb' : 'bomb', id: targetId, owner: t.owner, amount: removed });
  return removed;
}

/**
 * Provoke: the strongest enemy sends half of its fullest tower at the nearest tower of another enemy. Needs two enemies
 * alive (with three, the others are all fair game).
 */
function provoke(w: World): number | null {
  const sides = ENEMIES.filter((o) => w.territories.some((t) => t.owner === o));
  if (sides.length < 2) return null;
  const strong = sides.reduce((x, y) => (power(w, y) > power(w, x) ? y : x));
  const from = w.territories.filter((t) => t.owner === strong).reduce((x, y) => (y.units > x.units ? y : x));
  if (from.units < 6) return null;
  const others = w.territories.filter((t) => t.owner >= 2 && t.owner !== strong);
  const to = others.reduce((x, y) => (Math.hypot(y.x - from.x, y.y - from.y) < Math.hypot(x.x - from.x, x.y - from.y) ? y : x));
  const sent = send(w, from.id, to.id, PROVOKE_FRACTION);
  if (sent < 1) return null;
  emit(w, { type: 'item', item: 'provoke', id: from.id, owner: from.owner, amount: sent });
  return sent;
}

/** Flak: shoots up to `damage` troops out of the sky, picking the hostile dots already heading for this tower. */
function flak(w: World, targetId: number, damage: number): number {
  const t = w.territories[targetId];
  if (w.status !== 'play' || !t || t.owner !== 1) return 0;
  let left = damage;
  let destroyed = 0;
  for (const d of w.dots) {
    if (left <= 0) break;
    if (d.to !== targetId || d.owner === 1) continue;
    const hit = Math.min(left, d.v);
    d.v -= hit;
    left -= hit;
    destroyed += hit;
  }
  if (destroyed < 1) return 0;
  w.dots = w.dots.filter((d) => d.v > 0);
  t.flash = 0.25;
  emit(w, { type: 'item', item: 'flak', id: targetId, owner: 1, amount: destroyed });
  return destroyed;
}

/** Recall: every troop you sent from this tower, in flight or still queued, turns around and comes home. */
function recall(w: World, sourceId: number): number {
  const t = w.territories[sourceId];
  if (w.status !== 'play' || !t || t.owner !== 1) return 0;
  let n = 0;
  for (const d of w.dots) {
    if (d.from !== sourceId || d.owner !== 1) continue;
    n += d.v;
    d.v = 0;
  }
  if (n > 0) w.dots = w.dots.filter((d) => d.v > 0);
  for (const q of w.queues) {
    if (q.from !== sourceId || q.owner !== 1) continue;
    n += q.vals.reduce((a, b) => a + b, 0);
    q.vals.length = 0;
  }
  if (n < 1) return 0;
  w.queues = w.queues.filter((q) => q.vals.length);
  t.units += n;
  t.flash = 0.25;
  emit(w, { type: 'item', item: 'recall', id: sourceId, owner: 1, amount: n });
  return n;
}

/**
 * Uses an item. `target` is the tower id for items that need one. `bonus` is whatever permanent upgrade grows this
 * item (Heavy Bombs, Cold Snap, Fortify, Supply Drop; see src/shop.ts). Returns the amount it achieved, or null if
 * refused.
 */
export function applyItem(w: World, item: ItemId, target?: number, bonus = 0): number | null {
  if (w.status !== 'play') return null;
  const t = target === undefined ? undefined : w.territories[target];
  if (!canTarget(item, t)) return null;
  switch (item) {
    case 'bomb': {
      const n = bomb(w, target!, BOMB_DAMAGE + bonus);
      return n > 0 ? n : null;
    }
    case 'megabomb': {
      const n = bomb(w, target!, MEGABOMB_DAMAGE);
      return n > 0 ? n : null;
    }
    case 'freeze': {
      if (!t || (t.freeze ?? 0) > 0) return null;
      const secs = FREEZE_SECONDS + bonus;
      t.freeze = secs;
      t.flash = 0.25;
      emit(w, { type: 'item', item, id: t.id, owner: t.owner, amount: secs });
      return secs;
    }
    case 'airdrop': {
      if (!t) return null;
      const n = AIRDROP_TROOPS + bonus;
      t.units += n;
      t.flash = 0.25;
      emit(w, { type: 'item', item, id: t.id, owner: 1, amount: n });
      return n;
    }
    case 'shield': {
      if (!t || (t.shield ?? 0) > 0) return null;
      const secs = SHIELD_SECONDS + bonus;
      t.shield = secs;
      emit(w, { type: 'item', item, id: t.id, owner: 1, amount: secs });
      return secs;
    }
    case 'surge':
    case 'rally': {
      const buffs = (w.buffs ??= { surge: 0, rally: 0 });
      const secs = item === 'surge' ? SURGE_SECONDS : RALLY_SECONDS;
      if (buffs[item] > 0) return null;
      buffs[item] = secs;
      emit(w, { type: 'item', item, id: -1, owner: 1, amount: secs });
      return secs;
    }
    case 'provoke':
      return provoke(w);
    case 'flak': {
      const n = flak(w, target!, FLAK_DAMAGE);
      return n > 0 ? n : null;
    }
    case 'recall': {
      const n = recall(w, target!);
      return n > 0 ? n : null;
    }
  }
}

import { Audio } from '../audio';
import { LIGHT } from './theme';
import { Haptics } from './haptics';
import { ITEM_FX_TIMING, type ItemFx } from './fx';
import {
  BOARD,
  WORLD_H,
  WORLD_W,
  advance,
  ITEM_TARGET,
  SEND_FRACTION,
  applyItem,
  canTarget,
  generateLevel,
  growth,
  newTipMemory,
  nextTip,
  power,
  radius,
  scoreBattle,
  send,
  sendMany,
  territoryAt,
  type Difficulty,
  type ItemId,
  type StarResult,
  type Territory,
  type World,
} from './core';

export interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  t: number;
  dur: number;
  color: string;
  w: number;
}

interface Drag {
  set: number[];
  first: Territory;
  moved: boolean;
  sx: number;
  sy: number;
}

/** The colour each item shows in: its target rings, its blast and its floating number. */
export const ITEM_COLOR: Readonly<Record<ItemId, string>> = {
  bomb: '#ff8a1c',
  megabomb: '#e01010',
  freeze: '#58b8ff',
  airdrop: '#22b573',
  shield: '#3a78d8',
  surge: '#ffb400',
  rally: '#9a5bd8',
  provoke: '#e8590c',
  flak: '#9fb3c8',
  recall: '#2fb8a6',
};

/** What floats up over the target when an item lands: "-5" for a bomb, a word for the rest. */
const ITEM_TEXT = (item: ItemId, amount: number): string => {
  switch (item) {
    case 'bomb':
    case 'megabomb':
      return `-${amount}`;
    case 'airdrop':
      return `+${amount}`;
    case 'freeze':
      return 'FROZEN';
    case 'shield':
      return 'SHIELD';
    case 'surge':
      return 'SURGE!';
    case 'rally':
      return 'RALLY!';
    case 'provoke':
      return 'PROVOKED!';
    case 'flak':
      return `-${amount}`;
    case 'recall':
      return `+${amount}`;
  }
};

/** Permanent upgrades the player has bought (see src/shop.ts), applied to every battle. */
export interface Perks {
  /** Extra troops on each of your starting towers. */
  startTroops: number;
  /** Extra damage on a bomb. */
  bombBonus: number;
  /** Extra seconds on a freeze. */
  freezeBonus: number;
  /** Extra seconds on a shield. */
  shieldBonus: number;
  /** Extra troops on an airdrop. */
  airdropBonus: number;
}

/** A number that floats up from a spot and fades (the "-5" of a bomb). Visual only. */
export interface Floater {
  x: number;
  y: number;
  t: number;
  dur: number;
  text: string;
  color: string;
}

export interface Hud {
  /** Share of total power, 0-100. */
  red: number;
  orange: number;
  you: number;
  prod: number;
}

/**
 * One playthrough of one level: the world plus everything the interface needs
 * around it (selection, drag, effects). Game rules stay in ./core.
 */
export class GameSession {
  readonly world: World;
  readonly level: number;
  /** 'easy' is the assisted retry offered after repeated losses. */
  readonly difficulty: Difficulty;
  /** Every send uses all the troops in the tower: there is no send-size choice. */
  readonly sendFrac = SEND_FRACTION;
  /** Counts kept for analytics. Stars are judged on the battle time alone. */
  stats = { lost: 0 };
  w = 1;
  h = 1;
  sel: Territory | null = null;
  drag: Drag | null = null;
  ptr = { x: 0, y: 0 };
  clock = 0;
  rings: Ring[] = [];
  floaters: Floater[] = [];
  /** Item animations in progress (a bomb falling, a freeze bursting): see src/ui/itemFx.ts. */
  fx: ItemFx[] = [];
  shake = 0;
  /** The items you hold, by id (set by the app from your save). */
  stock: Partial<Record<ItemId, number>> = {};
  /** The item you have picked and not yet aimed: your next tap on a valid tower uses it there. */
  armed: ItemId | null = null;
  /** Items used so far in this battle (unlimited; only how many you hold caps you). */
  itemsUsed = 0;
  /** Extra bomb damage from the Heavy Bombs upgrade. */
  bombBonus = 0;
  /** Extra freeze seconds from the Cold Snap upgrade. */
  freezeBonus = 0;
  /** Extra shield seconds from the Fortify upgrade. */
  shieldBonus = 0;
  /** Extra airdrop troops from the Supply Drop upgrade. */
  airdropBonus = 0;
  /** Called once for every item used, so the app can take it out of your save. */
  onItem: (id: ItemId) => void = () => {};
  onTip: (text: string) => void = () => {};

  private tipMem = newTipMemory();
  private tipClock = 0;
  private ringAt: Record<number, number> = {};
  private warnedAt = -Infinity;
  private clashAt = -Infinity;

  /**
   * `level` is the level number (stars and rewards are judged on it); a prebuilt `world` may be passed in for tests.
   */
  constructor(level: number, seed: number, difficulty: Difficulty = 'normal', world?: World, perks?: Perks) {
    this.level = level;
    this.difficulty = difficulty;
    this.world = world ?? generateLevel(level, seed, difficulty);
    this.world.trackEvents = true;
    if (perks) {
      this.bombBonus = perks.bombBonus;
      this.freezeBonus = perks.freezeBonus;
      this.shieldBonus = perks.shieldBonus;
      this.airdropBonus = perks.airdropBonus;
      if (perks.startTroops > 0) for (const t of this.world.territories) if (t.owner === 1) t.units += perks.startTroops;
    }
  }

  /** How many of an item you still hold in this battle. */
  heldOf(id: ItemId): number {
    return this.stock[id] ?? 0;
  }

  /** Stars for the battle as it stands (call once it is won). */
  result(): StarResult {
    return scoreBattle(this.level, this.world.status === 'won', this.world.t, this.difficulty);
  }

  // world units -> screen pixels. The world is drawn at one uniform scale (never stretched): big enough that the
  // map is the dominant thing on screen, with a little breathing room around it rather than bled to the edges.
  scale = () => {
    const top = this.w * 0.1;
    const band = this.h - top - this.w * 0.04;
    return 0.84 * Math.max(this.w / WORLD_W, band / (BOARD.y1 - BOARD.y0));
  };
  sx = () => this.scale();
  sy = () => this.scale();
  /** Screen position of the world's top-left corner. */
  ox = () => (this.w - WORLD_W * this.scale()) / 2;
  oy = () => {
    const top = this.w * 0.1;
    const band = this.h - top - this.w * 0.04;
    const S = this.scale();
    const boardH = BOARD.y1 - BOARD.y0;
    return top + (band - boardH * S) * 0.45 - BOARD.y0 * S;
  };
  px = (t: { x: number }) => this.ox() + t.x * this.scale();
  py = (t: { y: number }) => this.oy() + t.y * this.scale();
  pr = (t: Territory) => radius(t) * this.scale();

  /** Sources highlighted right now: the drag in progress, or the tapped territory. */
  sources(): number[] {
    if (this.drag && this.drag.moved) return this.drag.set;
    return this.sel ? [this.sel.id] : [];
  }

  update(dt: number, running: boolean) {
    this.clock += dt;
    if (running) {
      advance(this.world, dt);
      this.handleEvents();
      this.tipClock -= dt;
      if (this.tipClock <= 0) {
        const tip = nextTip(this.world, this.tipMem, this.sendFrac);
        if (tip) this.onTip(tip.text);
        this.tipClock = 0.5;
      }
    }
    for (const g of this.rings) g.t += dt;
    this.rings = this.rings.filter((g) => g.t < g.dur);
    for (const f of this.floaters) f.t += dt;
    this.floaters = this.floaters.filter((f) => f.t < f.dur);
    // Item animations keep playing while paused or after the battle ends; the landing (the number, the shake, the sound) happens once.
    for (const f of this.fx) {
      f.t += dt;
      if (!f.landed && f.t >= f.impactAt) this.land(f);
    }
    this.fx = this.fx.filter((f) => f.t < f.dur);
    this.shake = Math.max(0, this.shake - dt);
  }

  hud(): Hud {
    const w = this.world;
    const a = power(w, 1);
    const r = power(w, 2);
    const o = power(w, 3);
    const total = Math.max(1, a + r + o);
    return { red: (r / total) * 100, orange: (o / total) * 100, you: (a / total) * 100, prod: growth(w, 1) };
  }

  private ring(id: number, color: string, big: boolean) {
    const t = this.world.territories[id];
    if (!big && this.clock - (this.ringAt[id] ?? -1) < 0.18) return;
    this.ringAt[id] = this.clock;
    const r = this.pr(t);
    this.rings.push({
      x: this.px(t),
      y: this.py(t),
      r0: r * 0.8,
      r1: r * (big ? 4.2 : 1.9),
      t: 0,
      dur: big ? 0.7 : 0.3,
      color,
      w: big ? 5 : 2.5,
    });
  }

  /** The moment an item lands: the blast ring, a number or a word over the tower it hit, the shake, the buzz and the sound. */
  private land(f: ItemFx) {
    f.landed = true;
    // The middle of the board for items that need no tower.
    const t = f.id >= 0 ? this.world.territories[f.id] : undefined;
    const color = ITEM_COLOR[f.item];
    if (t) this.ring(t.id, color, true);
    this.floaters.push({
      x: t ? this.px(t) : this.ox() + (WORLD_W / 2) * this.scale(),
      y: t ? this.py(t) - this.pr(t) : this.oy() + (WORLD_H / 2) * this.scale(),
      t: 0,
      dur: t ? 0.9 : 1.2,
      text: ITEM_TEXT(f.item, f.amount),
      color,
    });
    Haptics.capture();
    Audio.sfx('capture');
    if (f.item === 'bomb' || f.item === 'megabomb') this.shake = Math.max(this.shake, f.item === 'megabomb' ? 0.5 : 0.3);
  }

  private handleEvents() {
    for (const e of this.world.events.splice(0)) {
      if (e.type === 'send') {
        Audio.sfx('dispatch');
        if (e.owner === 1) {
          Haptics.send();
        } else if (this.world.territories[e.to].owner === 1 && this.clock - this.warnedAt > 2.5) {
          // An enemy squad is heading for one of ours: a buzz, at most every couple of seconds.
          this.warnedAt = this.clock;
          Haptics.warning();
        }
      } else if (e.type === 'land') {
        const t = this.world.territories[e.id];
        if (e.owner === 1 || t.owner === 1) this.ring(e.id, LIGHT[e.owner], false);
      } else if (e.type === 'clash') {
        // A spark and a crack where two streams meet. Throttled: a big fight can destroy dozens of dots a second.
        if (this.clock - this.clashAt > 0.06 && this.rings.length < 24) {
          this.clashAt = this.clock;
          const r = this.scale() * 1.4;
          this.rings.push({ x: this.px({ x: e.x }), y: this.py({ y: e.y }), r0: r * 0.4, r1: r * 1.8, t: 0, dur: 0.22, color: '#ffffff', w: 1.5 });
          Audio.sfx('clash');
        }
      } else if (e.type === 'item') {
        // Start the item's animation. Items that act at once land now; a falling bomb or a parachute lands when it arrives.
        Audio.sfx('itemUse');
        const timing = ITEM_FX_TIMING[e.item];
        const f: ItemFx = { item: e.item, id: e.id, t: 0, dur: timing.dur, impactAt: timing.impactAt, landed: false, amount: e.amount, seed: 1 + this.itemsUsed * 7.31 + e.id };
        this.fx.push(f);
        if (f.impactAt <= 0) this.land(f);
      } else if (e.type === 'capture') {
        this.ring(e.id, LIGHT[e.owner], true);
        if (e.owner === 1) {
          Haptics.capture();
          Audio.sfx('capture');
          this.shake = Math.max(this.shake, 0.22);
        } else if (e.previous === 1) {
          this.stats.lost++;
          Haptics.lostTerritory();
          Audio.sfx('lostTerritory');
          this.shake = Math.max(this.shake, 0.3);
        }
      } else if (e.type === 'end') {
        if (e.status === 'won') {
          Haptics.win();
          Audio.sfx('win');
        } else {
          Haptics.lose();
          Audio.sfx('lose');
        }
      }
    }
  }

  /** The territory under a touch: the nearest disc within 1.5 radii, else the territory whose whole state holds the point. */
  hit(x: number, y: number): Territory | null {
    let best: Territory | null = null;
    let bd = 1e9;
    for (const n of this.world.territories) {
      const d = Math.hypot(this.px(n) - x, this.py(n) - y);
      if (d < this.pr(n) * 1.5 && d < bd) {
        bd = d;
        best = n;
      }
    }
    if (best) return best;
    const id = territoryAt(this.world, (x - this.ox()) / this.scale(), (y - this.oy()) / this.scale());
    return id === null ? null : this.world.territories[id] ?? null;
  }

  /** Whether an item can be used right now: the battle is on and you still hold one. */
  canUse(id: ItemId): boolean {
    return this.world.status === 'play' && this.heldOf(id) > 0;
  }

  /**
   * Picks an item. One that needs no target is used at once; the rest are armed, and your next tap on a valid tower uses
   * them there. Picking the armed item again puts it away.
   */
  pickItem(id: ItemId) {
    if (!this.canUse(id)) {
      this.armed = null;
      return;
    }
    if (ITEM_TARGET[id] === 'none') {
      this.armed = null;
      this.fire(id);
    } else {
      this.armed = this.armed === id ? null : id;
    }
  }

  /** The upgrade bonus (Heavy Bombs, Cold Snap, Fortify, Supply Drop) that grows this item, if any. */
  private bonusFor(id: ItemId): number {
    if (id === 'bomb') return this.bombBonus;
    if (id === 'freeze') return this.freezeBonus;
    if (id === 'shield') return this.shieldBonus;
    if (id === 'airdrop') return this.airdropBonus;
    return 0;
  }

  /** Uses an item for real. If the rule refuses it (nothing to hit, a freeze already on), nothing is spent. */
  private fire(id: ItemId, target?: number): boolean {
    if (!this.canUse(id)) return false;
    if (applyItem(this.world, id, target, this.bonusFor(id)) === null) return false;
    this.stock[id] = this.heldOf(id) - 1;
    this.itemsUsed++;
    this.onItem(id);
    return true;
  }

  /** Uses the armed item where you tapped. A tap anywhere else (or on a tower it cannot be used on) puts it away. */
  private dropItem(x: number, y: number) {
    const id = this.armed;
    this.armed = null;
    const n = this.hit(x, y);
    if (id && n && canTarget(id, n)) this.fire(id, n.id);
  }

  pointerDown(x: number, y: number) {
    this.ptr = { x, y };
    if (this.armed) {
      this.dropItem(x, y);
      return;
    }
    const n = this.hit(x, y);
    if (n && n.owner === 1) {
      this.drag = { set: [n.id], first: n, moved: false, sx: x, sy: y };
    } else if (n && this.sel) {
      send(this.world, this.sel.id, n.id, this.sendFrac);
      this.sel = null;
    } else {
      this.sel = null;
    }
  }

  pointerMove(x: number, y: number) {
    this.ptr = { x, y };
    const d = this.drag;
    if (!d) return;
    if (Math.hypot(x - d.sx, y - d.sy) > 10) d.moved = true;
    const n = d.moved ? this.hit(x, y) : null;
    // Dragging across another of your territories adds it to the attack.
    if (n && n.owner === 1 && !d.set.includes(n.id)) d.set.push(n.id);
  }

  pointerUp(x: number, y: number) {
    const d = this.drag;
    if (!d) return;
    this.ptr = { x, y };
    const n = this.hit(x, y);
    if (d.moved) {
      if (n) {
        const from = d.set.filter((id) => id !== n.id);
        if (from.length) sendMany(this.world, from, n.id, this.sendFrac);
      }
      this.sel = null;
    } else if (this.sel && this.sel !== d.first) {
      send(this.world, this.sel.id, d.first.id, this.sendFrac);
      this.sel = null;
    } else {
      this.sel = d.first;
    }
    this.drag = null;
  }

  pointerCancel() {
    this.drag = null;
  }
}

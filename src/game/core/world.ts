import { next, range } from './rng.ts';
import { MISTAKE_CHANCE, ramp } from './difficulty.ts';
import { ENEMIES, RALLY_FACTOR, SHIELD_FACTOR, STEP, SURGE_FACTOR, type AiParams, type Dot, type GameEvent, type Kind, type Owner, type Territory, type Tier, type World } from './types.ts';

export const TIERS: readonly { scale: number; rate: number; cap: number }[] = [
  { scale: 0.8, rate: 0.9, cap: 60 },
  { scale: 1, rate: 1.4, cap: 100 },
  { scale: 1.25, rate: 2.1, cap: 150 },
];

/** Starting troops for a fresh neutral territory, by tier. */
export const NEUTRAL_UNITS: readonly [number, number][] = [
  [8, 25],
  [20, 50],
  [45, 90],
];

export const DOT_SPEED = 40;
const BASE_RADIUS = 6.2;
const DOT_INTERVAL = 0.08;
const PROD_SCALE = 0.8;
const STORM_SLOW = 0.4;

// Dot count tracks troop count almost 1:1 (not just a handful of oversized dots), so a big force
// reads as a dense mass the way the reference did; BASE_MAX_DOTS is exactly the old cap, so every
// send up to 60 troops is byte-for-byte unchanged (every send in tests/core.test.ts stays ≤60).
// HARD_MAX_DOTS is purely a perf ceiling, well above the realistic max single send (~150-160,
// tier-2 cap plus an airdrop). The spawn interval shrinks above 60 so the whole mass still arrives
// within roughly the same total spawn window as a 60-troop send, not a long trickle.
const BASE_MAX_DOTS = 60;
const HARD_MAX_DOTS = 220;
const MIN_DOT_INTERVAL = 0.01;

const dotsFor = (total: number): number => Math.min(HARD_MAX_DOTS, total);
const intervalFor = (n: number): number => {
  if (n <= BASE_MAX_DOTS) return DOT_INTERVAL;
  return Math.max(MIN_DOT_INTERVAL, DOT_INTERVAL * (BASE_MAX_DOTS / n));
};

// Parallel column formation: dots still leave one at a time, at the same pace as before (so a siege's
// timing against a regenerating defender is unchanged), but cycle through a fixed set of side-by-side
// lanes instead of a random sideways jitter. A big push spans a wider column (more lanes) than a trickle.
const laneCountFor = (n: number): number => (n <= 1 ? 1 : n === 2 ? 2 : n < 10 ? 3 : n < 30 ? 4 : 5);
/** World-unit gap between adjacent lanes, scaled by the source's own radius. */
const LANE_GAP = 0.35;

export const inStorm = (w: World, x: number, y: number) => w.storms.some((s) => Math.hypot(s.x - x, s.y - y) < s.r);

export const emit = (w: World, e: GameEvent) => {
  if (w.trackEvents) w.events.push(e);
};

export const radius = (t: { tier: Tier }) => BASE_RADIUS * TIERS[t.tier].scale;
/** How many troops it takes to beat a territory's garrison. A fortress counts double. */
export const holdStrength = (t: { units: number; kind: Kind }) => t.units * (t.kind === 'fortress' ? 2 : 1);

export const dist = (a: Territory, b: Territory) => Math.hypot(a.x - b.x, a.y - b.y);

export const count = (w: World, owner: Owner) => w.territories.reduce((n, t) => n + (t.owner === owner ? 1 : 0), 0);

/** Snowball: every extra territory lifts production on all of them by 10%. */
export const growth = (w: World, owner: Owner) => 1 + 0.1 * Math.max(0, count(w, owner) - 1);

/** Total troops a side has: garrisons, troops in flight, troops queued to leave. */
export function power(w: World, owner: Owner): number {
  let p = 0;
  for (const t of w.territories) if (t.owner === owner) p += t.units;
  for (const d of w.dots) if (d.owner === owner) p += d.v;
  for (const q of w.queues) if (q.owner === owner) for (const v of q.vals) p += v;
  return p;
}

/** Sends `frac` of a territory's troops toward another. Returns troops sent (0 if refused). */
export function send(w: World, fromId: number, toId: number, frac: number): number {
  const from = w.territories[fromId];
  if (w.status !== 'play' || !from || fromId === toId || from.owner === 0) return 0;
  const total = Math.floor(from.units * frac);
  if (total < 1) return 0;
  from.units -= total;
  const n = dotsFor(total);
  const width = laneCountFor(n);
  const vals: number[] = [];
  let left = total;
  for (let i = 0; i < n; i++) {
    const v = Math.ceil(left / (n - i));
    vals.push(v);
    left -= v;
  }
  w.queues.push({ from: fromId, to: toId, owner: from.owner, vals, wait: 0, interval: intervalFor(n), width, lane: 0 });
  emit(w, { type: 'send', from: fromId, to: toId, owner: from.owner, troops: total });
  return total;
}

/** Sends from several territories at once (multi-select). Returns total troops sent. */
export function sendMany(w: World, fromIds: readonly number[], toId: number, frac: number): number {
  let total = 0;
  for (const id of fromIds) total += send(w, id, toId, frac);
  return total;
}

/** Troops a send would launch right now, without sending. Used for previews. */
export const previewSend = (w: World, fromIds: readonly number[], toId: number, frac: number) =>
  fromIds.reduce((n, id) => (id === toId || w.territories[id]?.owner === 0 ? n : n + Math.floor(w.territories[id].units * frac)), 0);

/** A dot lands: reinforce a friend, or fight. Negative troops means the attacker takes it. */
function arrive(w: World, d: Dot) {
  const t = w.territories[d.to];
  t.flash = 0.25;
  emit(w, { type: 'land', id: d.to, owner: d.owner });
  if (t.owner === d.owner) {
    t.units += d.v;
    return;
  }
  // A fortress holds twice as strong, and so does a shielded tower (the two stack).
  t.units -= (t.kind === 'fortress' ? d.v * 0.5 : d.v) * (t.shield && t.shield > 0 ? SHIELD_FACTOR : 1);
  if (t.units < 0) {
    emit(w, { type: 'capture', id: d.to, owner: d.owner, previous: t.owner });
    t.owner = d.owner;
    t.units = -t.units;
    t.flash = 0.6;
  }
}

/** Troops of other owners flying or queued toward a territory. */
function incomingTo(w: World, id: number, owner: Owner): number {
  let n = 0;
  for (const d of w.dots) if (d.to === id && d.owner !== owner) n += d.v;
  for (const q of w.queues) if (q.to === id && q.owner !== owner) for (const v of q.vals) n += v;
  return n;
}

/**
 * Collide rule: if hostile troops would take one of `owner`'s territories, send help from the nearest other
 * territory that can cover the shortfall. Returns true if it sent.
 */
function guard(w: World, owner: Owner, p: AiParams): boolean {
  for (const t of w.territories) {
    if (t.owner !== owner) continue;
    const short = incomingTo(w, t.id, owner) - holdStrength(t);
    if (short <= 0) continue;
    let donor: Territory | null = null;
    for (const s of w.territories) {
      if (s === t || s.owner !== owner || s.units < p.minUnits || s.units * p.fraction < short + 2) continue;
      if (s.freeze && s.freeze > 0) continue;
      if (incomingTo(w, s.id, owner) > s.units * 0.4) continue;
      if (!donor || dist(s, t) < dist(donor, t)) donor = s;
    }
    if (donor) {
      send(w, donor.id, t.id, p.fraction);
      return true;
    }
  }
  return false;
}

/** Collide rule: two dots of different owners closer than this destroy each other. */
const CLASH_R = 1.3;

/**
 * Opposing troops that meet in flight cancel one for one; the larger dot survives with the difference.
 * Dots close at under 2 units per step, less than the contact diameter, so none slip through.
 * Deterministic: a spatial grid, dots visited in index order, no randomness.
 */
function clash(w: World) {
  const dots = w.dots;
  if (dots.length < 2) return;
  const cell = CLASH_R * 2;
  const xs: number[] = [];
  const ys: number[] = [];
  const grid = new Map<number, number[]>();
  const key = (cx: number, cy: number) => (cx + 8) * 1024 + (cy + 8);
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i];
    const a = w.territories[d.from];
    xs.push(a.x + Math.cos(d.ang) * d.p);
    ys.push(a.y + Math.sin(d.ang) * d.p);
    const k = key(Math.floor(xs[i] / cell), Math.floor(ys[i] / cell));
    const bucket = grid.get(k);
    if (bucket) bucket.push(i);
    else grid.set(k, [i]);
  }
  let hit = false;
  for (let i = 0; i < dots.length; i++) {
    const a = dots[i];
    if (a.v <= 0) continue;
    const cx = Math.floor(xs[i] / cell);
    const cy = Math.floor(ys[i] / cell);
    for (let gx = cx - 1; gx <= cx + 1 && a.v > 0; gx++) {
      for (let gy = cy - 1; gy <= cy + 1 && a.v > 0; gy++) {
        const bucket = grid.get(key(gx, gy));
        if (!bucket) continue;
        for (const j of bucket) {
          const b = dots[j];
          if (j <= i || b.v <= 0 || b.owner === a.owner) continue;
          if (Math.hypot(xs[i] - xs[j], ys[i] - ys[j]) >= CLASH_R) continue;
          const m = Math.min(a.v, b.v);
          a.v -= m;
          b.v -= m;
          hit = true;
          emit(w, { type: 'clash', x: (xs[i] + xs[j]) / 2, y: (ys[i] + ys[j]) / 2, a: a.owner, b: b.owner });
          if (a.v <= 0) break;
        }
      }
    }
  }
  if (hit) w.dots = dots.filter((d) => d.v > 0);
}

/** Troops heading for a territory (flying or queued) from sides other than its owner. */
function hostileInflow(w: World, to: Territory): number {
  let n = 0;
  for (const d of w.dots) if (d.to === to.id && d.owner !== to.owner) n += d.v;
  for (const q of w.queues) if (q.to === to.id && q.owner !== to.owner) for (const v of q.vals) n += v;
  return n;
}

/** The side that is clearly ahead (15% more total troops than the next), or null when it is close. */
function leaderOf(w: World): Owner | null {
  const p = ([1, 2, 3, 4] as const).map((o) => ({ o, v: power(w, o) })).sort((a, b) => b.v - a.v);
  return p[0].v > p[1].v * 1.15 ? p[0].o : null;
}

/** How close an enemy tower must be for one of ours to count as on the front line. */
const FRONT = 30;
/** A cautious enemy empties a front-line tower only when the attack has this many times the troops it needs. */
const CAUTION_OVERKILL = 2;

/**
 * Nothing to attack, so spend the time on defence: the fullest tower that is not on the front sends half its troops to
 * the weakest tower that is. Returns true if it sent.
 */
function reinforce(w: World, owner: Owner): boolean {
  const mine = w.territories.filter((t) => t.owner === owner);
  const front = (t: Territory) => w.territories.some((o) => o.owner !== owner && o.owner !== 0 && dist(t, o) < FRONT);
  const fronts = mine.filter(front);
  const backs = mine.filter((t) => !front(t) && t.units >= 24 && hostileInflow(w, t) === 0 && !(t.freeze && t.freeze > 0));
  if (!fronts.length || !backs.length) return false;
  const from = backs.reduce((a, b) => (b.units > a.units ? b : a));
  const to = fronts.reduce((a, b) => (b.units < a.units ? b : a));
  if (to.units >= from.units * 0.7) return false;
  send(w, from.id, to.id, 0.5);
  return true;
}

/**
 * Whether a smart skill is used on this decision. With no `skill` set (hand-built settings, the balance bot) the flag
 * decides on its own. With one, the skill is used with a chance that rises from 0 at `lo` to 1 at `hi`, so enemies learn
 * their tricks gradually, a little more on every level, instead of all at once.
 */
function uses(w: World, p: AiParams, flag: boolean | undefined, lo: number, hi: number): boolean {
  if (!flag) return false;
  if (p.skill === undefined) return true;
  const c = ramp(p.skill, lo, hi);
  return c >= 1 || (c > 0 && next(w) < c);
}

/** One decision for one faction: attack the best target it can beat, alone or with several territories together. */
export function think(w: World, owner: Owner, p: AiParams): boolean {
  // Which smart skills this decision uses (each is a chance that grows with the enemy's skill).
  const doGuard = uses(w, p, true, 0.05, 0.35);
  const doCoordinate = uses(w, p, p.coordinate, 0.1, 0.45);
  const doReinforce = uses(w, p, p.reinforce, 0.45, 0.8);
  const doStrike = uses(w, p, p.strike, 0.6, 0.9);
  const doCaution = uses(w, p, p.caution, 0.25, 0.7);
  if (w.collide && doGuard && guard(w, owner, p)) return true;
  // With collisions on, a territory that has troops heading for it keeps its own troops at home.
  const mine = w.territories.filter((t) => t.owner === owner && t.units >= p.minUnits && !(t.freeze && t.freeze > 0) && !(w.collide && incomingTo(w, t.id, owner) > t.units * 0.4));
  for (let i = mine.length - 1; i > 0; i--) {
    const j = Math.floor(next(w) * (i + 1));
    [mine[i], mine[j]] = [mine[j], mine[i]];
  }
  const leader = p.leader ? leaderOf(w) : null;
  for (const from of mine) {
    const force = from.units * p.fraction;
    // Every send takes all the troops, so a tower with an enemy next door is only emptied for an overwhelming attack.
    const exposed = doCaution && w.territories.some((o) => o.owner !== owner && o.owner !== 0 && dist(from, o) < FRONT);
    let best: Territory | null = null;
    let bestScore = Infinity;
    const options: Territory[] = [];
    for (const to of w.territories) {
      if (to.owner === owner) continue;
      const d = dist(from, to);
      // Enemy garrisons keep producing while the troops walk over.
      const need = holdStrength(to) + (to.owner ? d * 0.06 : 0);
      if (force <= need + p.margin) continue;
      if (exposed && force < (need + p.margin) * CAUTION_OVERKILL) continue;
      let score = holdStrength(to) + d * 0.16 - (to.owner === 1 ? p.playerBias : 0);
      // Smarter play: pile on whoever is winning.
      if (leader !== null && to.owner === leader) score -= p.leader ?? 0;
      options.push(to);
      if (score < bestScore) {
        bestScore = score;
        best = to;
      }
    }
    // A novice sometimes picks any target it could take instead of the best one; the mistakes fade as skill grows.
    if (best && p.skill !== undefined && options.length > 1 && next(w) < (1 - p.skill) * MISTAKE_CHANCE) {
      best = options[Math.floor(next(w) * options.length)];
    }
    if (best) {
      // Strike: when the rest of the army in range would more than double the force, send it all together.
      if (doStrike) {
        const others = mine.filter((m) => m !== from && dist(m, best!) < 55);
        const extra = others.reduce((sum, m) => sum + m.units * p.fraction, 0);
        if (force + extra > (holdStrength(best) + p.margin) * 2) for (const m of others) send(w, m.id, best.id, p.fraction);
      }
      send(w, from.id, best.id, p.fraction);
      return true;
    }
  }
  if (!doCoordinate || mine.length < 2) return doReinforce ? reinforce(w, owner) : false;

  // Nobody can win alone: pool the nearest territories against the weakest target they can beat together.
  let plan: { to: Territory; from: Territory[] } | null = null;
  for (const to of w.territories) {
    if (to.owner === owner) continue;
    const need = holdStrength(to) + p.margin + (to.owner ? 5 : 0);
    // A cautious enemy pools only towers that are not on the front line, since every send empties the tower.
    const near = mine.filter((m) => !(doCaution && w.territories.some((o) => o.owner !== owner && o.owner !== 0 && dist(m, o) < FRONT))).sort((a, b) => dist(a, to) - dist(b, to));
    const pool: Territory[] = [];
    let sum = 0;
    for (const s of near) {
      pool.push(s);
      sum += s.units * p.fraction;
      if (sum > need) break;
    }
    if (sum > need && (!plan || holdStrength(to) < holdStrength(plan.to))) plan = { to, from: pool };
  }
  if (!plan) return doReinforce ? reinforce(w, owner) : false;
  for (const s of plan.from) send(w, s.id, plan.to.id, p.fraction);
  return true;
}

function step(w: World, dt: number) {
  w.t += dt;
  const mult = w.factionProd;
  const g = [0, growth(w, 1), growth(w, 2), growth(w, 3), growth(w, 4)];

  const buffs = w.buffs;
  if (buffs) {
    buffs.surge = Math.max(0, buffs.surge - dt);
    buffs.rally = Math.max(0, buffs.rally - dt);
  }
  const surge = buffs && buffs.surge > 0 ? SURGE_FACTOR : 1;
  for (const t of w.territories) {
    t.flash = Math.max(0, t.flash - dt);
    if (t.shield) t.shield = Math.max(0, t.shield - dt);
    if (t.owner === 0) continue;
    // A frozen tower makes no troops until the freeze runs out.
    if (t.freeze && t.freeze > 0) {
      t.freeze = Math.max(0, t.freeze - dt);
      continue;
    }
    const tier = TIERS[t.tier];
    const kindRate = t.kind === 'factory' ? 2 : 1;
    const boost = t.owner === 1 ? surge : 1;
    if (t.units < tier.cap) t.units = Math.min(tier.cap, t.units + tier.rate * kindRate * g[t.owner] * mult[t.owner] * boost * dt * PROD_SCALE);
  }

  for (const q of w.queues) {
    q.wait -= dt;
    while (q.wait <= 0 && q.vals.length) {
      q.wait += q.interval;
      const a = w.territories[q.from];
      const b = w.territories[q.to];
      const mid = (q.width - 1) / 2;
      // Same release pace as a single-file stream; only the lane cycles, so the troops arriving at any
      // instant are the same as before (the siege's timing against a regenerating defender is unchanged).
      // This spawn still draws from the RNG exactly where the old random sideways jitter did (see rng
      // order notes), so every later AI roll in the match lands on the same numbers as before this change.
      next(w);
      w.dots.push({
        from: q.from,
        to: q.to,
        owner: q.owner,
        v: q.vals.shift()!,
        p: radius(a) * 0.6,
        off: (q.lane - mid) * radius(a) * LANE_GAP,
        ang: Math.atan2(b.y - a.y, b.x - a.x),
      });
      q.lane = (q.lane + 1) % q.width;
    }
  }
  w.queues = w.queues.filter((q) => q.vals.length);

  for (let i = w.dots.length - 1; i >= 0; i--) {
    const d = w.dots[i];
    const a = w.territories[d.from];
    const b = w.territories[d.to];
    const rally = d.owner === 1 && buffs && buffs.rally > 0 ? RALLY_FACTOR : 1;
    d.p += DOT_SPEED * dt * rally * (inStorm(w, a.x + Math.cos(d.ang) * d.p, a.y + Math.sin(d.ang) * d.p) ? STORM_SLOW : 1);
    if (d.p >= dist(a, b) - radius(b) * 0.8) {
      arrive(w, d);
      w.dots.splice(i, 1);
    }
  }
  if (w.collide) clash(w);

  for (const f of ENEMIES) {
    if (!count(w, f) && !w.dots.some((d) => d.owner === f)) continue;
    w.aiClock[f] -= dt;
    if (w.aiClock[f] <= 0) {
      const ai = w.factionAi[f];
      think(w, f, ai);
      w.aiClock[f] = Math.max(ai.intervalMin, ai.interval) * range(w, 0.8, 1.3);
    }
  }

  const enemyAlive = count(w, 2) + count(w, 3) + count(w, 4) > 0 || w.dots.some((d) => d.owner > 1) || w.queues.some((q) => q.owner > 1);
  const youAlive = count(w, 1) > 0 || w.dots.some((d) => d.owner === 1) || w.queues.some((q) => q.owner === 1);
  if (w.status === 'play') {
    if (!enemyAlive) w.status = 'won';
    else if (!youAlive) w.status = 'lost';
  }
  if (w.status !== 'play') emit(w, { type: 'end', status: w.status });
}

/** Advances the world by real elapsed time in fixed 1/60 s steps, so results replay exactly. */
export function advance(w: World, elapsed: number) {
  w.acc += Math.min(elapsed, 0.25);
  while (w.acc >= STEP && w.status === 'play') {
    step(w, STEP);
    w.acc -= STEP;
  }
}

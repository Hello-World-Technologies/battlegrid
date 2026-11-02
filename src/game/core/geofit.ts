// src/game/core/geofit.ts
//
// Real geography under a level. The level's layout (authored, or generated) is laid over a real region of the world
// (Europe and North Africa, South America, East Asia, ...): each tower moves to the nearest country that is big enough
// to hold it, and that country becomes the tower's state. Every other country in view stays as pale scenery, so the
// board looks like a map of the world with a few countries in play.
//
// Pure and deterministic: the same layout and seed always pick the same region and the same countries, and nothing here
// is random. The rules never see geography; only positions move, by a few world units.

import { WORLD_GEO_JSON } from './worldgeo.ts';
import { range } from './rng.ts';
import { NEUTRAL_UNITS, radius } from './world.ts';
import { WORLD_H, WORLD_W, type Land, type Territory, type Tier, type World } from './types.ts';

type GeoCountry = { iso: string; lx: number; ly: number; rings: number[][] };

let loaded: GeoCountry[] | null = null;
const countries = (): GeoCountry[] =>
  (loaded ??= (JSON.parse(WORLD_GEO_JSON) as [string, number, number, number[][]][]).map(([iso, lx, ly, rings]) => ({ iso, lx, ly, rings })));

/** Mercator y of a latitude, in the data's units (1 unit = 1 degree of longitude, growing south). */
const mercY = (lat: number) => -(180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/** A window on the world: its centre and how many degrees of longitude the 100-wide board spans. */
interface Theater {
  name: string;
  lon: number;
  lat: number;
  width: number;
}

export const THEATERS: readonly Theater[] = [
  { name: 'Europe and North Africa', lon: 17, lat: 40, width: 60 },
  { name: 'Western Europe', lon: 4, lat: 45, width: 40 },
  { name: 'Eastern Europe', lon: 40, lat: 53, width: 52 },
  { name: 'Africa', lon: 20, lat: 2, width: 82 },
  { name: 'West and Central Africa', lon: 10, lat: 8, width: 52 },
  { name: 'South America', lon: -60, lat: -18, width: 66 },
  { name: 'North America', lon: -98, lat: 40, width: 80 },
  { name: 'Central America', lon: -80, lat: 10, width: 48 },
  { name: 'Middle East and Central Asia', lon: 58, lat: 33, width: 58 },
  { name: 'South Asia', lon: 80, lat: 22, width: 50 },
  { name: 'East Asia', lon: 112, lat: 34, width: 58 },
  { name: 'Southeast Asia', lon: 112, lat: 4, width: 58 },
  { name: 'Oceania', lon: 140, lat: -24, width: 70 },
  { name: 'Russia', lon: 80, lat: 58, width: 90 },
];

/** Where a tower may go: inside the playable part of the board (the HUD and the item row need the rest). */
const PLAY = { x0: 9, x1: 91, y0: 16, y1: 152 };
/**
 * How strict the fit is. A country must be at least `area` (world units squared, its largest part) to hold a tower,
 * towers never end up closer than `gap` (so two discs never touch), and none moves further than `move` to reach its
 * country. Crowded levels (up to 18 towers) fall back to the looser rows when the strict one finds no room.
 */
const FIT_LEVELS = [
  { area: 26, gap: 9, move: 30 },
  { area: 14, gap: 8, move: 40 },
  { area: 6, gap: 7, move: 55 },
] as const;
/** The world beyond the board that is still drawn as scenery (the screen shows a little more than the board). */
const VIEW = { x0: -45, x1: 145, y0: -40, y1: 210 };

const ringArea = (r: readonly number[]) => {
  let a = 0;
  for (let i = 0; i < r.length; i += 2) {
    const j = (i + 2) % r.length;
    a += r[i] * r[j + 1] - r[j] * r[i + 1];
  }
  return Math.abs(a) / 2;
};

interface Anchor {
  /** Index into `countries()`. */
  c: number;
  x: number;
  y: number;
  /** The country's own footprint, in world units squared (its largest part). */
  area: number;
}

/** How much wider a theater's view is than its nominal width, so more of the map is visible at once. */
const ZOOM_OUT = 1.4;

const project = (th: Theater) => {
  const k = WORLD_W / (th.width * ZOOM_OUT);
  const cx = th.lon;
  const cy = mercY(th.lat);
  return { k, px: (x: number) => (x - cx) * k + WORLD_W / 2, py: (y: number) => (y - cy) * k + WORLD_H / 2 };
};

const anchorCache = new Map<string, Anchor[]>();
/** The countries of a theater that can hold a tower: their label point is on the play area and they are big enough. */
function anchorsOf(ti: number, level: number): Anchor[] {
  const key = ti + ':' + level;
  let hit = anchorCache.get(key);
  if (hit) return hit;
  const { area: MIN_AREA } = FIT_LEVELS[level];
  const { k, px, py } = project(THEATERS[ti]);
  hit = [];
  countries().forEach((c, i) => {
    const x = px(c.lx);
    const y = py(c.ly);
    if (x < PLAY.x0 || x > PLAY.x1 || y < PLAY.y0 || y > PLAY.y1) return;
    const area = Math.max(...c.rings.map(ringArea)) * k * k;
    if (area >= MIN_AREA) hit!.push({ c: i, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, area: Math.round(area * 100) / 100 });
  });
  anchorCache.set(key, hit);
  return hit;
}

/** Matches each point to its own country, closest pairs first, keeping towers apart. Null if some tower cannot be placed. */
function match(points: readonly Territory[], anchors: readonly Anchor[], gap: number, move: number): { pick: number[]; cost: number } | null {
  const pairs: [number, number, number][] = [];
  points.forEach((p, i) => anchors.forEach((a, j) => pairs.push([i, j, Math.hypot(p.x - a.x, p.y - a.y)])));
  pairs.sort((a, b) => a[2] - b[2] || a[0] - b[0] || a[1] - b[1]);
  const pick = new Array<number>(points.length).fill(-1);
  const used = new Set<number>();
  const taken: { x: number; y: number; r: number }[] = [];
  let cost = 0;
  let left = points.length;
  for (const [i, j, d] of pairs) {
    if (pick[i] >= 0 || used.has(j)) continue;
    const a = anchors[j];
    if (d > move) break;
    // Discs never touch: apart by both radii (and at least `gap`).
    const r = radius(points[i]);
    if (taken.some((t) => Math.hypot(t.x - a.x, t.y - a.y) < Math.max(gap, t.r + r + 0.8))) continue;
    pick[i] = j;
    used.add(j);
    taken.push({ x: a.x, y: a.y, r });
    cost += d;
    if (--left === 0) return { pick, cost };
  }
  return null;
}

/** How many of the best-fitting regions a level may be drawn on: some variety, never a poor fit. */
const VARIETY = 4;

/**
 * Lays the level over the world: picks the region, moves every tower to its country and remembers the choice on the
 * world (`w.geo`) for `geoLand`. Returns false (and changes nothing) when no region fits. `fillNeutrals` turns every
 * other sizeable country in the region into a small neutral territory too, so even the hand-authored levels (1-10)
 * get a full, colourful map instead of a few towers on mostly plain scenery.
 */
export function snapToGeography(w: World, fillNeutrals = true, fillMaxTier: Tier = 2): boolean {
  let fits: { ti: number; fit: number; pick: number[]; cost: number }[] = [];
  for (let fit = 0; fit < FIT_LEVELS.length && !fits.length; fit++) {
    THEATERS.forEach((_, ti) => {
      const anchors = anchorsOf(ti, fit);
      if (anchors.length < w.territories.length) return;
      const m = match(w.territories, anchors, FIT_LEVELS[fit].gap, FIT_LEVELS[fit].move);
      if (m) fits.push({ ti, fit, ...m });
    });
  }
  if (!fits.length) return false;
  fits = fits.sort((a, b) => a.cost - b.cost || a.ti - b.ti);
  const h = Math.imul((w.seed | 0) ^ Math.imul(w.level + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
  const chosen = fits[h % Math.min(VARIETY, fits.length)];
  const anchors = anchorsOf(chosen.ti, chosen.fit);
  w.territories.forEach((t, i) => {
    const a = anchors[chosen.pick[i]];
    t.x = a.x;
    t.y = a.y;
  });
  w.geo = { theater: chosen.ti, countries: w.territories.map((_, i) => anchors[chosen.pick[i]].c) };
  if (fillNeutrals) fillNeutralCountries(w, chosen.ti, fillMaxTier);
  return true;
}

/** The fit level used to find every sizeable country in a theater, not just the ones a level's own towers need. */
const FILL_FIT = FIT_LEVELS.length - 1;

/**
 * Turns every other country in the theater's play area into a small neutral territory, so the whole map a level is
 * drawn on can be fought over — nothing is left as mere scenery just because the level didn't need that many towers.
 * Bigger countries become bigger (tougher) neutral territories, by the same area bands `FIT_LEVELS` itself uses,
 * capped at `maxTier` so an early level can be kept low-stakes.
 */
function fillNeutralCountries(w: World, ti: number, maxTier: Tier) {
  const geo = w.geo!;
  const used = new Set(geo.countries);
  const taken = w.territories.map((t) => ({ x: t.x, y: t.y, r: radius(t) }));
  for (const a of anchorsOf(ti, FILL_FIT)) {
    if (used.has(a.c)) continue;
    const tier = Math.min(maxTier, a.area >= FIT_LEVELS[0].area ? 2 : a.area >= FIT_LEVELS[1].area ? 1 : 0) as Tier;
    const r = radius({ tier });
    if (taken.some((t) => Math.hypot(t.x - a.x, t.y - a.y) < Math.max(FIT_LEVELS[FILL_FIT].gap, t.r + r + 0.8))) continue;
    const [lo, hi] = NEUTRAL_UNITS[tier];
    const units = Math.round(range(w, lo, hi) * w.profile.neutralScale);
    w.territories.push({ id: w.territories.length, x: a.x, y: a.y, tier, kind: 'normal', owner: 0, units, flash: 0 });
    geo.countries.push(a.c);
    used.add(a.c);
    taken.push({ x: a.x, y: a.y, r });
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** The ground for a world that has been snapped to geography: one country per tower, the rest as scenery. */
export function geoLand(w: World): Land | null {
  const geo = w.geo;
  if (!geo) return null;
  const th = THEATERS[geo.theater];
  const { px, py } = project(th);
  const all = countries();
  const flat = (ring: readonly number[]) => {
    const out: number[] = [];
    for (let i = 0; i < ring.length; i += 2) out.push(round2(px(ring[i])), round2(py(ring[i + 1])));
    return out;
  };
  const owned = new Set(geo.countries);
  const parts = geo.countries.map((ci) => all[ci].rings.map(flat));
  const cells = parts.map((rings) => rings.reduce((big, r) => (ringArea(r) > ringArea(big) ? r : big), rings[0]));
  const scenery: number[][] = [];
  const filler: number[][] = [];
  all.forEach((c, i) => {
    if (owned.has(i)) return;
    // A country whose label is on the board is part of the map being fought over; the rest is pale background.
    const lx = px(c.lx);
    const ly = py(c.ly);
    const onBoard = lx >= 0 && lx <= WORLD_W && ly >= 8 && ly <= WORLD_H - 8;
    for (const ring of c.rings) {
      const f = flat(ring);
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let j = 0; j < f.length; j += 2) {
        x0 = Math.min(x0, f[j]);
        x1 = Math.max(x1, f[j]);
        y0 = Math.min(y0, f[j + 1]);
        y1 = Math.max(y1, f[j + 1]);
      }
      if (x1 < VIEW.x0 || x0 > VIEW.x1 || y1 < VIEW.y0 || y0 > VIEW.y1) continue;
      if ((x1 - x0) * (y1 - y0) < 0.5) continue;
      (onBoard ? filler : scenery).push(f);
    }
  });
  return { cells, parts, filler, scenery, theater: th.name };
}

/** Whether a point is inside a ring (flat [x, y, ...]), by the even-odd rule. */
export function inRing(ring: readonly number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i];
    const yi = ring[i + 1];
    const xj = ring[j];
    const yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

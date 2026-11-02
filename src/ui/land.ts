// src/ui/land.ts
//
// The ground under a level (see game/core/land.ts) as Skia paths in world units. Built once per level and kept, because
// the land never changes while the level is played.

import { Skia, type SkPath } from '@shopify/react-native-skia';

import type { Land } from '../game/core';

const toPath = (rings: readonly (readonly number[])[]): SkPath => {
  let d = '';
  for (const cell of rings) {
    for (let i = 0; i < cell.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${cell[i].toFixed(2)},${cell[i + 1].toFixed(2)}`;
    d += 'Z';
  }
  return Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();
};

/** A small, deterministic [0,1) value from two integers — no `Math.random`, so the same edge always wobbles the same way. */
function hash2(a: number, b: number): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** How many wobbles a boundary edge gets, and how far it strays from the straight line, in world units. */
const EDGE_SEGMENTS = 6;
const EDGE_AMPLITUDE = 2.1;

/**
 * The points of one boundary edge, a->b, nudged sideways into a gentle, irregular wobble instead of a ruler-straight
 * line — a coastline rather than a drafting line. Pinned exactly at both ends (so corners where several states meet
 * stay put), and computed the same regardless of which direction it's walked: two neighbouring states sharing this
 * edge always draw the identical wobble, so they still tile with no gap or overlap between them.
 */
function wavyEdge(ax: number, ay: number, bx: number, by: number): [number, number][] {
  const reversed = ax > bx || (ax === bx && ay > by);
  const [px0, py0, px1, py1] = reversed ? [bx, by, ax, ay] : [ax, ay, bx, by];
  const dx = px1 - px0;
  const dy = py1 - py0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const seed = Math.round(px0 * 53) * 1000003 + Math.round(py0 * 53);
  const pts: [number, number][] = [];
  for (let i = 0; i <= EDGE_SEGMENTS; i++) {
    const t = i / EDGE_SEGMENTS;
    let x = px0 + dx * t;
    let y = py0 + dy * t;
    if (i > 0 && i < EDGE_SEGMENTS) {
      const r = hash2(seed + i * 7919, Math.round(len * 10)) - 0.5;
      // Tapers to zero at both ends, so the edge is pinned exactly at its corners and only wobbles in between.
      const amp = EDGE_AMPLITUDE * Math.sin(Math.PI * t) * Math.min(1, len / 3);
      x += nx * r * amp * 2;
      y += ny * r * amp * 2;
    }
    pts.push([x, y]);
  }
  return reversed ? pts.reverse() : pts;
}

/** Like `toPath`, but every straight edge is redrawn as a gentle, deterministic wobble — a coastline, not a polygon. */
const toWavyPath = (rings: readonly (readonly number[])[]): SkPath => {
  let d = '';
  for (const cell of rings) {
    const n = cell.length / 2;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const ax = cell[2 * i];
      const ay = cell[2 * i + 1];
      const bx = cell[(2 * ((i + 1) % n))];
      const by = cell[(2 * ((i + 1) % n)) + 1];
      const pts = wavyEdge(ax, ay, bx, by);
      for (let k = i === 0 ? 0 : 1; k < pts.length; k++) {
        d += `${i === 0 && k === 0 ? 'M' : 'L'}${pts[k][0].toFixed(2)},${pts[k][1].toFixed(2)}`;
      }
    }
    d += 'Z';
  }
  return Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();
};

interface LandPaths {
  /** One path per territory, in territory order (a real country has all its islands in one path). */
  cells: SkPath[];
  /** Real geography only: countries on the board without a tower, and the pale land around the board. */
  filler: SkPath | null;
  scenery: SkPath | null;
}

const cache = new WeakMap<Land, LandPaths>();

/** All the paths of a land. */
export function landPaths(land: Land): LandPaths {
  let hit = cache.get(land);
  if (!hit) {
    hit = {
      cells: land.cells.map((c, i) => toWavyPath(land.parts?.[i] ?? [c])),
      filler: land.filler?.length ? toPath(land.filler) : null,
      scenery: land.scenery?.length ? toPath(land.scenery) : null,
    };
    cache.set(land, hit);
  }
  return hit;
}

/** One path per territory, in territory order. */
export const cellPaths = (land: Land): SkPath[] => landPaths(land).cells;

// src/game/core/land.ts
//
// The ground under a level, State.io style: the board is cut into one "state" per territory, each state being
// the area closer to its territory than to any other (a Voronoi cell), clipped to the board. Pure geometry from
// the territory positions: no randomness, so a level always has the same land, and replays are unchanged.

import { geoLand, inRing } from './geofit.ts';
import { WORLD_H, WORLD_W, type Land, type World } from './types.ts';

/** The board the states fill, in world units: the whole 100 wide world, a little inside top and bottom. */
export const BOARD = { x0: 0, y0: 8, x1: WORLD_W, y1: WORLD_H - 8 } as const;

type Pt = readonly [number, number];

/** Keeps the part of a convex polygon on the near side of the perpendicular bisector of a and b (a's side). */
function clipToward(poly: Pt[], ax: number, ay: number, bx: number, by: number): Pt[] {
  // Points p with |p-a| <= |p-b|  <=>  (b-a).p <= (|b|^2 - |a|^2) / 2.
  const nx = bx - ax;
  const ny = by - ay;
  const c = (bx * bx + by * by - ax * ax - ay * ay) / 2;
  const side = (p: Pt) => nx * p[0] + ny * p[1] - c;
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const sp = side(p);
    const sq = side(q);
    if (sp <= 0) out.push(p);
    if (sp <= 0 !== sq <= 0) {
      const k = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
    }
  }
  return out;
}

/** One state per point: the board cut into Voronoi cells. Points must be distinct. */
export function voronoiCells(points: readonly Pt[], box = BOARD): number[][] {
  return points.map((a, i) => {
    let poly: Pt[] = [
      [box.x0, box.y0],
      [box.x1, box.y0],
      [box.x1, box.y1],
      [box.x0, box.y1],
    ];
    for (let j = 0; j < points.length && poly.length; j++) {
      if (j !== i) poly = clipToward(poly, a[0], a[1], points[j][0], points[j][1]);
    }
    return poly.flatMap((p) => [p[0], p[1]]);
  });
}

/**
 * Builds the ground for a world and stores it on the world. When `snapToGeography` placed the level on a real
 * region, each territory is drawn as its actual country (`geoLand`); otherwise the board is cut into one Voronoi
 * state per territory, tiling it exactly so every state borders its neighbours and none is left without a tower.
 *
 * Real geography only: a neutral's real country is often much smaller than the troop count sitting on it, leaving it
 * stranded on a sliver of land with bare sea or scenery all around. Every neutral gets a Voronoi state instead of its
 * own tiny country outline — big, and tiling edge to edge with every neighbour (the towers' real countries included)
 * — so the whole board reads as solid, fought-over ground instead of a few islands in empty water.
 */
export function buildLand(w: World): Land {
  const land: Land = geoLand(w) ?? { cells: voronoiCells(w.territories.map((t) => [t.x, t.y] as const)) };
  if (land.parts && w.territories.some((t) => t.owner === 0)) {
    const vcells = voronoiCells(w.territories.map((t) => [t.x, t.y] as const));
    w.territories.forEach((t, i) => {
      if (t.owner !== 0) return;
      land.parts![i] = [vcells[i]];
      land.cells[i] = vcells[i];
    });
  }
  w.land = land;
  return land;
}

/** Whether a world point is inside territory `i`'s state: a convex cell, or any part of a real country. */
export function inState(land: Land, i: number, x: number, y: number): boolean {
  const parts = land.parts?.[i];
  if (parts) return parts.some((ring) => inRing(ring, x, y));
  return inCell(land.cells[i], x, y);
}

/** Whether a point is inside a convex polygon given as a flat [x, y, ...] list. */
export function inCell(cell: readonly number[], x: number, y: number): boolean {
  const n = cell.length / 2;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = (cell[2 * j] - cell[2 * i]) * (y - cell[2 * i + 1]) - (cell[2 * j + 1] - cell[2 * i + 1]) * (x - cell[2 * i]);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** The territory whose state holds a world point, or null when it is on no territory (the sea, or scenery). */
export function territoryAt(w: World, x: number, y: number): number | null {
  const land = w.land;
  if (!land) return null;
  for (let i = 0; i < land.cells.length; i++) if (inState(land, i, x, y)) return i;
  return null;
}

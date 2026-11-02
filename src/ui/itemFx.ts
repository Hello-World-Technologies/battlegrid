// src/ui/itemFx.ts
//
// The animation of each battle item, drawn on top of the board. Visual only: the rules (src/game/core/items.ts) have
// already been applied by the time one of these plays. Every effect is stateless: its picture at time `t` is worked
// out from `t` and a seed, so nothing is allocated per frame beyond the paths it draws.
//
//   bomb       a reticle lands, the bomb falls in, then a fireball, sparks, debris, smoke and a scorch mark
//   megabomb   the same with a meteor streaking in and a much bigger blast and a screen flash
//   freeze     frost bursts out of the tower: ice shards, a snowflake, a cold ring, falling snow
//   airdrop    a parachute lowers a crate onto the tower, which bursts into confetti
//   shield     a blue dome snaps on with ripples, a sheen sweep and sparkles
//   surge      lightning strikes every tower of yours
//   rally      speed lines burst from your towers and wind streaks sweep the board
//   provoke    the angry tower steams, flares red and shows a pulsing anger mark
//   flak       tracers fire up and out from the tower, each popping into a small burst
//   recall     a ring collapses inward and chevrons stream back toward the tower, pulling your troops home

import { BlurStyle, PaintStyle, Skia, StrokeCap, StrokeJoin, type SkCanvas, type SkMaskFilter, type SkPaint } from '@shopify/react-native-skia';
import type { ItemFx } from '../game/fx';

/** Where things are on screen, worked out by the renderer each frame. */
export interface FxGeo {
  W: number;
  H: number;
  /** The target tower's centre and disc radius (for items without a tower, the middle of the board). */
  tx: number;
  ty: number;
  r: number;
  /** Your towers, for the items that touch all of them. */
  spots: readonly { x: number; y: number; r: number }[];
}

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (k: number) => 1 - Math.pow(1 - clamp01(k), 3);
const easeIn = (k: number) => clamp01(k) * clamp01(k);
const backOut = (k: number) => {
  const c = 1.70158;
  const v = clamp01(k) - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
};
const rnd = (seed: number, i: number) => {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// One paint is reused for every call (Skia copies it into the recording), like draw.ts does.
let shared: SkPaint | null = null;
const colorCache = new Map<string, ReturnType<typeof Skia.Color>>();
const blurCache = new Map<number, SkMaskFilter>();

function pen(color: string, alpha = 1, width = 0, blur = 0): SkPaint {
  if (!shared) {
    shared = Skia.Paint();
    shared.setAntiAlias(true);
  }
  let c = colorCache.get(color);
  if (!c) {
    c = Skia.Color(color);
    colorCache.set(color, c);
  }
  shared.setStyle(width ? PaintStyle.Stroke : PaintStyle.Fill);
  shared.setColor(c);
  shared.setAlphaf(clamp01(alpha));
  shared.setStrokeWidth(width);
  shared.setStrokeCap(StrokeCap.Round);
  shared.setStrokeJoin(StrokeJoin.Round);
  shared.setPathEffect(null);
  if (blur > 0) {
    const key = Math.round(blur);
    let m = blurCache.get(key);
    if (!m) {
      m = Skia.MaskFilter.MakeBlur(BlurStyle.Normal, key, true);
      blurCache.set(key, m);
    }
    shared.setMaskFilter(m);
  } else {
    shared.setMaskFilter(null);
  }
  return shared;
}

const rect = (x: number, y: number, r: number) => Skia.XYWHRect(x - r, y - r, r * 2, r * 2);

/** A four-pointed sparkle. */
function sparkle(canvas: SkCanvas, x: number, y: number, r: number, color: string, alpha: number) {
  const p = Skia.Path.Make();
  p.moveTo(x, y - r);
  p.quadTo(x + r * 0.12, y - r * 0.12, x + r, y);
  p.quadTo(x + r * 0.12, y + r * 0.12, x, y + r);
  p.quadTo(x - r * 0.12, y + r * 0.12, x - r, y);
  p.quadTo(x - r * 0.12, y - r * 0.12, x, y - r);
  p.close();
  canvas.drawPath(p, pen(color, alpha));
}

/** The blast of a bomb `q` seconds after it lands: flash, fireball, sparks, debris, smoke and a scorch mark. */
function blast(canvas: SkCanvas, g: FxGeo, f: ItemFx, q: number, big: boolean) {
  const R = g.r * (big ? 1.9 : 1);
  const { tx, ty } = g;
  if (big && q < 0.28) {
    // The whole screen blinks white for a moment.
    canvas.drawRect(Skia.XYWHRect(0, 0, g.W, g.H), pen('#ffffff', 0.5 * (1 - q / 0.28)));
  }
  if (q < 0.18) canvas.drawCircle(tx, ty, R * (1.7 + q * 15), pen('#ffffff', 1 - q / 0.18));
  const life = clamp01(q / 0.75);
  if (life < 1) {
    const rad = R * (1 + 3 * easeOut(q / 0.5));
    const a = 1 - life;
    canvas.drawCircle(tx, ty, rad, pen('#e8431a', a * 0.85, 0, 6));
    canvas.drawCircle(tx, ty, rad * 0.78, pen('#ff8a1c', a * 0.95, 0, 4));
    canvas.drawCircle(tx, ty, rad * 0.5, pen('#ffd23f', a, 0, 3));
    canvas.drawCircle(tx, ty, rad * 0.24, pen('#ffffff', a));
  }
  canvas.drawCircle(tx, ty, R * 1.35, pen('#2b1d14', 0.32 * (1 - clamp01(q / 1.4))));

  // Sparks fly out and fall, with a short streak behind each.
  const sparks = big ? 28 : 15;
  for (let i = 0; i < sparks; i++) {
    const a = rnd(f.seed, i) * TAU;
    const sp = R * (7 + rnd(f.seed, i + 40) * 12);
    const x = tx + Math.cos(a) * sp * q * (1 - q * 0.45);
    const y = ty + Math.sin(a) * sp * q * (1 - q * 0.45) + R * 26 * q * q;
    const len = R * 1.3 * (1 - q / 0.9);
    const al = 1 - q / 0.9;
    if (al > 0) canvas.drawLine(x, y, x - Math.cos(a) * len, y - Math.sin(a) * len, pen(i % 2 ? '#ffd23f' : '#ff8a1c', al, 2.4));
  }

  // Chunks of the tower, tumbling.
  const chunks = big ? 12 : 7;
  for (let i = 0; i < chunks; i++) {
    const a = rnd(f.seed, i + 100) * TAU;
    const sp = R * (5 + rnd(f.seed, i + 140) * 8);
    const x = tx + Math.cos(a) * sp * q;
    const y = ty + Math.sin(a) * sp * q - R * 5 * q + R * 36 * q * q;
    const al = 1 - q / 1.1;
    if (al <= 0) continue;
    const s = R * (0.25 + rnd(f.seed, i + 180) * 0.25);
    canvas.save();
    canvas.translate(x, y);
    canvas.rotate(q * (200 + rnd(f.seed, i) * 500), 0, 0);
    canvas.drawRect(Skia.XYWHRect(-s, -s, s * 2, s * 2), pen(i % 3 ? '#4a3a30' : '#8a7a68', al));
    canvas.restore();
  }

  // Smoke drifts up and spreads.
  const puffs = big ? 10 : 6;
  for (let i = 0; i < puffs; i++) {
    const a = rnd(f.seed, i + 200) * TAU;
    const off = R * rnd(f.seed, i + 240) * 1.4;
    const al = 0.5 * (1 - clamp01(q / 1.2)) * clamp01(q / 0.1);
    if (al <= 0) continue;
    const rr = R * (0.8 + q * 2.2 * (0.6 + rnd(f.seed, i + 280)));
    canvas.drawCircle(tx + Math.cos(a) * off, ty + Math.sin(a) * off * 0.6 - q * R * 3.2, rr, pen('#5a5a5a', al, 0, 5));
  }
}

function bombFall(canvas: SkCanvas, g: FxGeo, f: ItemFx, big: boolean) {
  const p = clamp01(f.t / f.impactAt);
  const R = g.r * (big ? 1.9 : 1);
  const { tx, ty } = g;
  // Where it will land: a reticle that closes in, and a shadow that grows on the ground.
  const ring = R * ((big ? 4.4 : 3.4) - (big ? 2.4 : 1.8) * p);
  canvas.drawCircle(tx, ty, ring, pen('#ffffff', 0.9, 5));
  canvas.drawCircle(tx, ty, ring, pen(big ? '#e01010' : '#ff8a1c', 1, 3));
  const tick = ring * 0.4;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + f.t * 2;
    canvas.drawLine(tx + Math.cos(a) * (ring - tick * 0.5), ty + Math.sin(a) * (ring - tick * 0.5), tx + Math.cos(a) * (ring + tick), ty + Math.sin(a) * (ring + tick), pen('#e01010', 1, 3));
  }
  canvas.drawCircle(tx, ty + 2, R * (0.3 + 0.9 * p), pen('#000000', 0.12 + 0.2 * p, 0, 3));

  if (big) {
    // A meteor streaking in from the upper right with a fiery tail.
    const dist = (1 - easeIn(p)) * g.H * 0.62;
    const dx = 0.45 / Math.hypot(0.45, 1);
    const dy = -1 / Math.hypot(0.45, 1);
    const hx = tx + dx * dist;
    const hy = ty + dy * dist;
    for (let i = 14; i >= 1; i--) {
      canvas.drawCircle(hx + dx * i * R * 0.95, hy + dy * i * R * 0.95, R * (1.25 - i * 0.07), pen(i % 2 ? '#ff6a1c' : '#ffb400', 0.65 - i * 0.04, 0, 4));
    }
    canvas.drawCircle(hx, hy, R * 1.6, pen('#ff8a1c', 0.8, 0, 7));
    canvas.drawCircle(hx, hy, R * 1.1, pen('#4a3a30'));
    canvas.drawCircle(hx - R * 0.3, hy - R * 0.3, R * 0.5, pen('#ffd23f', 0.9, 0, 2));
    return;
  }
  // The bomb itself: drops in on a slight slant, with a streak behind it and a spitting fuse.
  const dist = (1 - easeIn(p)) * g.H * 0.55;
  const hx = tx + (1 - p) * R * 2.2;
  const hy = ty - dist;
  for (let i = 1; i <= 7; i++) {
    canvas.drawCircle(hx + (i * R * 0.18) * (1 - p), hy - i * R * 0.75, R * (0.55 - i * 0.05), pen('#ffb400', 0.5 - i * 0.06, 0, 2));
  }
  canvas.drawCircle(hx, hy, R * 0.95, pen('#1a1a1a'));
  canvas.drawCircle(hx - R * 0.3, hy - R * 0.3, R * 0.28, pen('#ffffff', 0.55));
  canvas.drawRect(Skia.XYWHRect(hx - R * 0.18, hy - R * 1.2, R * 0.36, R * 0.35), pen('#6b4a2b'));
  canvas.drawCircle(hx, hy - R * 1.35, R * (0.28 + 0.12 * Math.sin(f.t * 60)), pen('#ffd23f'));
  sparkle(canvas, hx, hy - R * 1.35, R * 0.55, '#ffffff', 0.9);
}

function drawBomb(canvas: SkCanvas, g: FxGeo, f: ItemFx, big: boolean) {
  if (f.t < f.impactAt) bombFall(canvas, g, f, big);
  else blast(canvas, g, f, f.t - f.impactAt, big);
  if (big && f.t >= f.impactAt) {
    // A second, slower shockwave.
    const q = f.t - f.impactAt;
    canvas.drawCircle(g.tx, g.ty, g.r * (2 + 9 * easeOut(q / 0.9)), pen('#ffffff', 0.7 * (1 - clamp01(q / 0.9)), 4));
  }
}

function drawFreeze(canvas: SkCanvas, g: FxGeo, f: ItemFx) {
  const k = clamp01(f.t / f.dur);
  const { tx, ty, r } = g;
  const fade = 1 - clamp01((k - 0.65) / 0.35);
  canvas.drawCircle(tx, ty, r * (1.3 + 1.6 * easeOut(k * 1.6)), pen('#bfeaff', 0.4 * (1 - k), 0, 5));
  canvas.drawCircle(tx, ty, r * (1 + 2.8 * easeOut(k * 1.5)), pen('#ffffff', 1 - clamp01(k * 1.5), 4));
  canvas.drawCircle(tx, ty, r * (1 + 2.2 * easeOut(k * 1.5)), pen('#58b8ff', 1 - clamp01(k * 1.5), 2.5));
  // Eight ice shards pop out and settle.
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8 + 0.2;
    const len = r * (0.8 + 1.5 * backOut(k * 2.2)) * (i % 2 ? 0.8 : 1.1);
    const w = r * 0.26;
    const bx = tx + Math.cos(a) * r * 0.85;
    const by = ty + Math.sin(a) * r * 0.85;
    const p = Skia.Path.Make();
    p.moveTo(bx + Math.cos(a + Math.PI / 2) * w, by + Math.sin(a + Math.PI / 2) * w);
    p.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
    p.lineTo(bx + Math.cos(a - Math.PI / 2) * w, by + Math.sin(a - Math.PI / 2) * w);
    p.close();
    canvas.drawPath(p, pen('#d7f1ff', 0.95 * fade));
    canvas.drawPath(p, pen('#ffffff', fade, 1.6));
  }
  // A snowflake turns on the tower.
  const sr = r * (0.4 + 1.1 * easeOut(k * 2.4));
  canvas.save();
  canvas.translate(tx, ty);
  canvas.rotate(k * 90, 0, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    canvas.drawLine(-Math.cos(a) * sr, -Math.sin(a) * sr, Math.cos(a) * sr, Math.sin(a) * sr, pen('#ffffff', fade, 2.6));
  }
  canvas.restore();
  // Snow falling around it.
  for (let i = 0; i < 14; i++) {
    const a = rnd(f.seed, i) * TAU;
    const d = r * (0.8 + rnd(f.seed, i + 30) * 2.4);
    const y = ty + Math.sin(a) * d - r * 1.5 + f.t * r * (2 + rnd(f.seed, i + 60) * 2);
    sparkle(canvas, tx + Math.cos(a) * d, y, r * (0.14 + rnd(f.seed, i + 90) * 0.14), '#ffffff', fade * 0.9);
  }
}

function drawAirdrop(canvas: SkCanvas, g: FxGeo, f: ItemFx) {
  const { tx, ty, r } = g;
  const p = clamp01(f.t / f.impactAt);
  if (f.t < f.impactAt) {
    const y = ty - (1 - easeOut(p)) * g.H * 0.5;
    const x = tx + Math.sin(f.t * 7) * r * 0.7 * (1 - p);
    const canopyR = r * 1.9;
    const cy = y - r * 3.4;
    canvas.drawCircle(tx, ty + 2, r * (0.3 + 0.7 * p), pen('#000000', 0.12 + 0.15 * p, 0, 3));
    // Cords, then the striped canopy, then the crate.
    for (const s of [-1, -0.5, 0, 0.5, 1]) canvas.drawLine(x + s * canopyR, cy, x + s * r * 0.55, y - r * 0.5, pen('#ffffff', 0.9, 1.4));
    for (let i = 0; i < 5; i++) {
      canvas.drawArc(rect(x, cy, canopyR), 180 + i * 36, 36, true, pen(i % 2 ? '#ffffff' : '#22b573'));
    }
    canvas.drawArc(rect(x, cy, canopyR), 180, 180, false, pen('#14663f', 1, 2.2));
    canvas.drawRect(Skia.XYWHRect(x - r * 0.6, y - r * 0.6, r * 1.2, r * 1.2), pen('#a6642a'));
    canvas.drawRect(Skia.XYWHRect(x - r * 0.6, y - r * 0.6, r * 1.2, r * 1.2), pen('#4a2a10', 1, 2));
    canvas.drawLine(x - r * 0.6, y, x + r * 0.6, y, pen('#4a2a10', 1, 1.6));
    canvas.drawLine(x, y - r * 0.6, x, y + r * 0.6, pen('#4a2a10', 1, 1.6));
    return;
  }
  const q = f.t - f.impactAt;
  // The canopy sags and slides off; the crate bursts into confetti and a green ring.
  const fade = 1 - clamp01(q / 0.6);
  if (fade > 0) {
    const cx = tx + q * r * 4;
    canvas.save();
    canvas.translate(cx, ty - r * 0.3 + q * r);
    canvas.scale(1, 0.4 + 0.6 * fade);
    canvas.drawArc(rect(0, 0, r * 1.9), 180, 180, true, pen('#22b573', fade));
    canvas.restore();
  }
  canvas.drawCircle(tx, ty, r * (1 + 3 * easeOut(q / 0.6)), pen('#ffffff', 1 - clamp01(q / 0.6), 5));
  canvas.drawCircle(tx, ty, r * (1 + 3 * easeOut(q / 0.6)), pen('#22b573', 1 - clamp01(q / 0.6), 3));
  const colors = ['#22b573', '#ffd23f', '#ffffff', '#7be0a8'];
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + (rnd(f.seed, i) - 0.5) * 2.4;
    const sp = r * (6 + rnd(f.seed, i + 30) * 8);
    const x = tx + Math.cos(a) * sp * q;
    const y = ty + Math.sin(a) * sp * q + r * 26 * q * q;
    const al = 1 - q / 1.2;
    if (al <= 0) continue;
    canvas.save();
    canvas.translate(x, y);
    canvas.rotate(q * 400 * (rnd(f.seed, i + 60) - 0.5) * 2, 0, 0);
    canvas.drawRect(Skia.XYWHRect(-r * 0.14, -r * 0.08, r * 0.28, r * 0.16), pen(colors[i % 4], al));
    canvas.restore();
  }
}

function drawShield(canvas: SkCanvas, g: FxGeo, f: ItemFx) {
  const { tx, ty, r } = g;
  const k = clamp01(f.t / f.dur);
  const fade = 1 - clamp01((k - 0.6) / 0.4);
  const dome = r * (1.1 + 0.95 * backOut(k * 2.4));
  canvas.drawCircle(tx, ty, dome, pen('#3a78d8', 0.25 * fade));
  canvas.drawCircle(tx, ty, dome, pen('#ffffff', fade, 4));
  canvas.drawCircle(tx, ty, dome, pen('#3a78d8', fade, 2.2));
  canvas.drawCircle(tx, ty, dome * 0.72, pen('#7db3ff', 0.55 * fade, 1.6));
  // A bright sheen sweeps around the dome.
  canvas.drawArc(rect(tx, ty, dome * 0.9), -90 + k * 720, 70, false, pen('#ffffff', 0.85 * fade, 5));
  // Ripples roll outwards.
  for (let i = 0; i < 3; i++) {
    const kk = clamp01((f.t - i * 0.16) / 0.9);
    if (kk <= 0 || kk >= 1) continue;
    canvas.drawCircle(tx, ty, r * (1.3 + 2.2 * easeOut(kk)), pen('#7db3ff', 1 - kk, 3));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6 + k * 3;
    const tw = 0.5 + 0.5 * Math.sin(f.t * 12 + i * 2);
    sparkle(canvas, tx + Math.cos(a) * dome, ty + Math.sin(a) * dome, r * (0.28 + 0.2 * tw), '#ffffff', fade * tw);
  }
}

function drawSurge(canvas: SkCanvas, g: FxGeo, f: ItemFx) {
  const k = clamp01(f.t / f.dur);
  const fade = 1 - clamp01((k - 0.55) / 0.45);
  if (f.t < 0.3) canvas.drawRect(Skia.XYWHRect(0, 0, g.W, g.H), pen('#ffd23f', 0.22 * (1 - f.t / 0.3)));
  const step = Math.floor(f.t / 0.06);
  g.spots.forEach((s, n) => {
    // A zig-zag bolt from the top of the screen down to the tower, re-rolled every few frames so it flickers.
    const delay = n * 0.07;
    if (f.t < delay || f.t > delay + 0.55) return;
    const bolt = Skia.Path.Make();
    const segs = 7;
    let x = s.x + (rnd(f.seed + step, n) - 0.5) * 30;
    bolt.moveTo(x, -6);
    for (let i = 1; i <= segs; i++) {
      const y = -6 + ((s.y + 6) * i) / segs;
      x = i === segs ? s.x : s.x + (rnd(f.seed + step, n * 9 + i) - 0.5) * 34 * (1 - i / segs);
      bolt.lineTo(x, y);
    }
    const flick = 0.55 + 0.45 * rnd(step, n);
    canvas.drawPath(bolt, pen('#ffb400', 0.8 * flick, 13, 5));
    canvas.drawPath(bolt, pen('#ffd23f', flick, 6.5));
    canvas.drawPath(bolt, pen('#ffffff', flick, 2.6));
    const kk = clamp01((f.t - delay) / 0.9);
    canvas.drawCircle(s.x, s.y, s.r * (1 + 3 * easeOut(kk)), pen('#ffffff', 1 - kk, 6));
    canvas.drawCircle(s.x, s.y, s.r * (1 + 3 * easeOut(kk)), pen('#ffb400', 1 - kk, 3.6));
    for (let i = 0; i < 5; i++) {
      const a = rnd(f.seed, n * 7 + i) * TAU;
      const d = s.r * (1 + 3 * easeOut(kk)) * (0.6 + rnd(f.seed, i + 5) * 0.6);
      sparkle(canvas, s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, s.r * 0.35, '#ffd23f', (1 - kk) * fade);
    }
  });
}

function drawRally(canvas: SkCanvas, g: FxGeo, f: ItemFx) {
  const k = clamp01(f.t / f.dur);
  const fade = 1 - clamp01((k - 0.55) / 0.45);
  // Wind streaks race across the board.
  for (let i = 0; i < 7; i++) {
    const y = g.H * (0.2 + 0.1 * i) + rnd(f.seed, i) * 20;
    const sp = 0.7 + rnd(f.seed, i + 20) * 0.6;
    const x = -g.W * 0.4 + easeOut(clamp01(k * sp * 1.3)) * g.W * 1.7;
    canvas.drawLine(x, y, x + g.W * 0.3, y, pen('#9a5bd8', 0.75 * fade, 6));
    canvas.drawLine(x + g.W * 0.06, y, x + g.W * 0.26, y, pen('#ffffff', 0.9 * fade, 2.4));
  }
  g.spots.forEach((s, n) => {
    // Speed lines burst outwards from each tower, and chevrons pulse.
    for (let i = 0; i < 10; i++) {
      const a = (i * TAU) / 10 + n * 0.3;
      const d0 = s.r * (1.4 + 5 * easeOut(k * 1.4));
      const len = s.r * (2 + rnd(f.seed, i + n) * 1.6);
      canvas.drawLine(s.x + Math.cos(a) * d0, s.y + Math.sin(a) * d0, s.x + Math.cos(a) * (d0 + len), s.y + Math.sin(a) * (d0 + len), pen(i % 2 ? '#9a5bd8' : '#ffffff', fade * (1 - k * 0.5), 5));
    }
    const kk = clamp01(f.t / 0.7);
    canvas.drawCircle(s.x, s.y, s.r * (1 + 3 * easeOut(kk)), pen('#ffffff', 1 - kk, 6));
    canvas.drawCircle(s.x, s.y, s.r * (1 + 3 * easeOut(kk)), pen('#9a5bd8', 1 - kk, 3.6));
    for (let c = 0; c < 2; c++) {
      const cx = s.x + s.r * (1.7 + c * 0.9) + easeOut(k) * s.r;
      const ch = Skia.Path.Make();
      ch.moveTo(cx - s.r * 0.35, s.y - s.r * 0.6);
      ch.lineTo(cx + s.r * 0.25, s.y);
      ch.lineTo(cx - s.r * 0.35, s.y + s.r * 0.6);
      canvas.drawPath(ch, pen('#ffffff', fade * (1 - c * 0.35), 5));
    }
  });
}

function drawProvoke(canvas: SkCanvas, g: FxGeo, f: ItemFx) {
  const { tx, ty, r } = g;
  const k = clamp01(f.t / f.dur);
  const fade = 1 - clamp01((k - 0.65) / 0.35);
  // The tower flares red and shakes, with steam puffing off the top.
  const shakeR = r * (1.5 + 0.12 * Math.sin(f.t * 45));
  canvas.drawCircle(tx, ty, shakeR, pen('#e8262f', 0.25 * fade));
  canvas.drawCircle(tx, ty, shakeR, pen('#ffffff', fade, 5));
  canvas.drawCircle(tx, ty, shakeR, pen('#e8262f', fade, 3));
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10;
    const d0 = r * 1.7 + r * 0.5 * Math.sin(f.t * 14 + i);
    canvas.drawLine(tx + Math.cos(a) * d0, ty + Math.sin(a) * d0, tx + Math.cos(a) * (d0 + r * 0.9), ty + Math.sin(a) * (d0 + r * 0.9), pen('#ff6a1c', fade, 3));
  }
  for (let i = 0; i < 4; i++) {
    const kk = clamp01((f.t - i * 0.18) / 0.8);
    if (kk <= 0 || kk >= 1) continue;
    canvas.drawCircle(tx + (i - 1.5) * r * 0.5, ty - r * 1.1 - kk * r * 2.2, r * (0.3 + kk * 0.6), pen('#ffffff', 0.7 * (1 - kk), 0, 2));
  }
  // The anger mark: four curved ticks, popping in big and settling.
  const sc = 0.4 + 1.1 * backOut(k * 3) - 0.25 * clamp01((k - 0.3) * 2);
  const ax = tx + r * 1.5;
  const ay = ty - r * 1.9;
  const m = r * 0.9 * sc;
  for (const [color, width] of [['#ffffff', 7], ['#e8262f', 3.4]] as const) {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const c = Skia.Path.Make();
      const sx = ax + Math.cos(a) * m * 0.25;
      const sy = ay + Math.sin(a) * m * 0.25;
      c.moveTo(sx, sy);
      c.quadTo(ax + Math.cos(a + 0.7) * m * 0.9, ay + Math.sin(a + 0.7) * m * 0.9, ax + Math.cos(a) * m, ay + Math.sin(a) * m);
      canvas.drawPath(c, pen(color, fade, width));
    }
  }
}

/** Tracers fire up and out from the tower, each popping into a small burst: troops shot out of the sky. */
function drawFlak(canvas: SkCanvas, g: FxGeo, f: ItemFx) {
  const { tx, ty, r } = g;
  const fade = 1 - clamp01((f.t / f.dur - 0.6) / 0.4);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.32;
    const delay = i * 0.05;
    const kk = clamp01((f.t - delay) / 0.5);
    if (kk <= 0) continue;
    const d0 = r * 1.1;
    const d1 = r * (3.2 + rnd(f.seed, i) * 1.6);
    const d = d0 + (d1 - d0) * easeOut(kk);
    const x = tx + Math.cos(a) * d;
    const y = ty + Math.sin(a) * d;
    canvas.drawLine(tx + Math.cos(a) * d0, ty + Math.sin(a) * d0, x, y, pen('#eef2f6', fade * (1 - kk * 0.4), 2.6));
    if (kk >= 0.92) {
      const burst = clamp01((f.t - delay - 0.46) / 0.3);
      canvas.drawCircle(x, y, r * (0.22 + 0.5 * easeOut(burst)), pen('#ff8a1c', (1 - burst) * fade));
      canvas.drawCircle(x, y, r * (0.1 + 0.3 * easeOut(burst)), pen('#ffffff', (1 - burst) * fade));
    }
  }
  const flash = 1 - clamp01(f.t / 0.2);
  if (flash > 0) canvas.drawCircle(tx, ty - r * 1.1, r * 0.6, pen('#eef2f6', flash * 0.8));
}

/** A ring collapses inward and chevrons stream back toward the tower: everything you sent, coming home. */
function drawRecall(canvas: SkCanvas, g: FxGeo, f: ItemFx) {
  const { tx, ty, r } = g;
  const k = clamp01(f.t / f.dur);
  const fade = 1 - clamp01((k - 0.6) / 0.4);
  const ring = Math.max(r * 0.9, r * (3.4 - 2.2 * easeOut(Math.min(1, k * 1.3))));
  canvas.drawCircle(tx, ty, ring, pen('#2fb8a6', 0.7 * fade, 3));
  canvas.drawCircle(tx, ty, ring * 0.72, pen('#8fe9dd', 0.5 * fade, 2));
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8;
    const kk = clamp01((f.t - i * 0.03) / 0.9);
    const d = r * (2.6 - 1.6 * easeOut(kk));
    const x = tx + Math.cos(a) * d;
    const y = ty + Math.sin(a) * d;
    const ang = Math.atan2(ty - y, tx - x);
    canvas.save();
    canvas.translate(x, y);
    canvas.rotate((ang * 180) / Math.PI, 0, 0);
    canvas.drawLine(-r * 0.22, -r * 0.18, 0, 0, pen('#2fb8a6', fade * (1 - kk * 0.5), 3));
    canvas.drawLine(-r * 0.22, r * 0.18, 0, 0, pen('#2fb8a6', fade * (1 - kk * 0.5), 3));
    canvas.restore();
  }
  const home = clamp01((f.t - 0.6) / 0.4);
  if (home > 0 && home < 1) canvas.drawCircle(tx, ty, r * (1 + 1.4 * easeOut(home)), pen('#ffffff', (1 - home) * fade, 3));
}

/** Draws one item animation. */
export function drawItemFx(canvas: SkCanvas, g: FxGeo, f: ItemFx) {
  switch (f.item) {
    case 'bomb':
      return drawBomb(canvas, g, f, false);
    case 'megabomb':
      return drawBomb(canvas, g, f, true);
    case 'freeze':
      return drawFreeze(canvas, g, f);
    case 'airdrop':
      return drawAirdrop(canvas, g, f);
    case 'shield':
      return drawShield(canvas, g, f);
    case 'surge':
      return drawSurge(canvas, g, f);
    case 'rally':
      return drawRally(canvas, g, f);
    case 'provoke':
      return drawProvoke(canvas, g, f);
    case 'flak':
      return drawFlak(canvas, g, f);
    case 'recall':
      return drawRecall(canvas, g, f);
  }
}

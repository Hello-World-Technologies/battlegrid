import {
  BlurStyle,
  FilterMode,
  MipmapMode,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  matchFont,
  type SkCanvas,
  type SkFont,
  type SkMaskFilter,
  type SkPaint,
  type SkImage,
  type SkPath,
  type SkPicture,
  type SkTypeface,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';

import { COL, GREEN, LIGHT } from '../game/theme';
import { troopShade } from './color';
import { TIERS, canTarget, holdStrength, incomingThreats, previewSend, radius } from '../game/core';
import type { Territory, Threat } from '../game/core';
import { ITEM_COLOR, type GameSession } from '../game/session';
import { drawItemFx } from './itemFx';
import { cellPaths, landPaths } from './land';
import { look } from './look';

const DEG = 180 / Math.PI;
const ORANGE = '#ff8a1c';
/** A stream below this total isn't labelled — skips routine small reinforcements. */
const MIN_LABEL_TROOPS = 20;

interface Pen {
  color: string;
  alpha?: number;
  /** Stroke width; leave out to fill. */
  width?: number;
  dash?: [number, number];
  phase?: number;
  /** Gaussian blur sigma, used for glows. */
  blur?: number;
  round?: boolean;
  /** Rounds the corners of paths drawn with this pen (in current canvas units). */
  corner?: number;
}

// One paint is reused for every draw call: Skia copies it into the recording.
let sharedPaint: SkPaint | null = null;
const colors = new Map<string, ReturnType<typeof Skia.Color>>();
const blurs = new Map<number, SkMaskFilter>();
const fonts = new Map<number, SkFont>();
let numberFace: SkTypeface | null = null;

/** Uses the bundled display face for troop counts (set once it has loaded). */
export function setNumberTypeface(face: SkTypeface | null) {
  numberFace = face;
  fonts.clear();
}

/**
 * Disc radius in pixels: 3.1% of the screen width (a small 45 px marker on a 720 px reference), nudged a little
 * by tier so bigger territories still read as bigger. The hit area stays the larger game radius.
 */
const discRadius = (s: GameSession, n: Territory) => s.w * 0.031 * (0.92 + 0.5 * (radius(n) / 6.2 - 1));

function pen(o: Pen): SkPaint {
  if (!sharedPaint) {
    sharedPaint = Skia.Paint();
    sharedPaint.setAntiAlias(true);
  }
  const p = sharedPaint;
  let c = colors.get(o.color);
  if (!c) {
    c = Skia.Color(o.color);
    colors.set(o.color, c);
  }
  p.setStyle(o.width ? PaintStyle.Stroke : PaintStyle.Fill);
  p.setColor(c);
  p.setAlphaf(o.alpha ?? 1);
  p.setStrokeWidth(o.width ?? 0);
  p.setStrokeCap(o.round ? StrokeCap.Round : StrokeCap.Butt);
  p.setStrokeJoin(StrokeJoin.Round);
  p.setPathEffect(
    o.dash ? Skia.PathEffect.MakeDash(o.dash, o.phase ?? 0) : o.corner ? Skia.PathEffect.MakeCorner(o.corner) : null,
  );
  if (o.blur) {
    const key = Math.round(o.blur);
    let m = blurs.get(key);
    if (!m) {
      m = Skia.MaskFilter.MakeBlur(BlurStyle.Normal, key, true);
      blurs.set(key, m);
    }
    p.setMaskFilter(m);
  } else {
    p.setMaskFilter(null);
  }
  return p;
}

function font(size: number): SkFont {
  const key = Math.max(6, Math.round(size));
  let f = fonts.get(key);
  if (!f) {
    f = numberFace
      ? Skia.Font(numberFace, key)
      : matchFont({
          fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
          fontWeight: 'bold',
          fontSize: key,
        });
    fonts.set(key, f);
  }
  return f;
}

function text(canvas: SkCanvas, str: string, cx: number, cy: number, size: number, color: string) {
  const f = font(size);
  const w = f.measureText(str).width;
  canvas.drawText(str, cx - w / 2, cy + size * 0.35, pen({ color }), f);
}

/**
 * A point (and its direction of travel) a distance `p` along the straight route from `a` to `b`, offset sideways
 * by `off` so a stream reads as a marching mass of parallel lines rather than one thread. World units in, world
 * units out.
 */
function linePoint(ax: number, ay: number, bx: number, by: number, p: number, off: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const t = Math.min(1, Math.max(0, p / dist));
  return { x: ax + dx * t - uy * off, y: ay + dy * t + ux * off, ux, uy };
}

/** Rounds the corners of the states a little, so the board reads as soft shapes rather than a wireframe. */
const CORNER = 1.6;

/** Moves the canvas into world units (the board's own coordinates). Returns pixels per world unit. */
function enterWorld(canvas: SkCanvas, s: GameSession): number {
  const S = s.scale();
  canvas.save();
  canvas.translate(s.ox(), s.oy());
  canvas.scale(S, S);
  return S;
}

/** Water, then every state in neutral grey (owned states are redrawn each frame in their owner's colour). */
function drawLand(canvas: SkCanvas, s: GameSession) {
  canvas.drawRect(Skia.XYWHRect(-20, -20, s.w + 40, s.h + 40), pen({ color: look.water }));
  const land = s.world.land;
  if (!land) return;
  const px = enterWorld(canvas, s);
  const paths = landPaths(land);
  if (paths.scenery) canvas.drawPath(paths.scenery, pen({ color: look.scenery }));
  if (paths.filler) {
    canvas.drawPath(paths.filler, pen({ color: look.neutral, corner: CORNER }));
    canvas.drawPath(paths.filler, pen({ color: look.seam, width: 1.4 / px, round: true, corner: CORNER }));
  }
  for (const p of paths.cells) {
    canvas.drawPath(p, pen({ color: look.neutral, corner: CORNER }));
    canvas.drawPath(p, pen({ color: look.seam, width: 1.4 / px, round: true, corner: CORNER }));
  }
  canvas.restore();
}

// A five-pointed star, unit size, built once and reused for every star-shaped troop.
let starPath: SkPath | null = null;
function unitStar(): SkPath {
  if (!starPath) {
    const p = Skia.Path.Make();
    for (let i = 0; i < 10; i++) {
      const a = ((-90 + i * 36) * Math.PI) / 180;
      const r = i % 2 ? 0.48 : 1;
      if (i) p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else p.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    p.close();
    starPath = p;
  }
  return starPath;
}

// Picture troops (src/ui/sprites.ts): the loaded images by shape id, and how big each draws relative to a dot's radius.
const troopSprites = new Map<string, SkImage>();
const SPRITE_SCALE: Record<string, number> = { plane: 5, sprite: 4.6 };

/** Registers (or clears, with null) the picture a picture-shape troop is drawn with; set once it has loaded. */
export function setTroopSprite(shape: string, image: SkImage | null) {
  if (image) troopSprites.set(shape, image);
  else troopSprites.delete(shape);
}

/** A picture troop: a disc in the owner's colour (so you can tell whose it is), then the picture on top. */
function drawSpriteTroop(canvas: SkCanvas, image: SkImage, x: number, y: number, rad: number, ang: number, color: string) {
  const size = rad * SPRITE_SCALE[look.shape];
  canvas.drawCircle(x, y, size * 0.4 + 1.6, pen({ color: '#ffffff' }));
  canvas.drawCircle(x, y, size * 0.4, pen({ color, alpha: 0.9 }));
  canvas.save();
  canvas.translate(x, y);
  // The plane turns along its route (its picture has the nose pointing right); the sprite always stands upright.
  if (look.shape === 'plane') canvas.rotate(ang * DEG, 0, 0);
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(-size / 2, -size / 2, size, size),
    FilterMode.Linear,
    MipmapMode.None,
    pen({ color: '#ffffff' }),
  );
  canvas.restore();
}

/** One troop, in the equipped shape, with a white rim so it reads on any colour. */
function drawTroop(canvas: SkCanvas, x: number, y: number, rad: number, ang: number, color: string) {
  const shape = look.shape;
  const picture = troopSprites.get(shape);
  if (picture && SPRITE_SCALE[shape]) {
    drawSpriteTroop(canvas, picture, x, y, rad, ang, color);
    return;
  }
  // A picture shape whose image has not loaded yet flies as plain round troops.
  if (shape === 'round' || SPRITE_SCALE[shape]) {
    canvas.drawCircle(x, y, rad + 1.6, pen({ color: '#ffffff' }));
    canvas.drawCircle(x, y, rad, pen({ color }));
    return;
  }
  canvas.save();
  canvas.translate(x, y);
  canvas.rotate(ang * DEG + (shape === 'diamond' ? 45 : 0), 0, 0);
  if (shape === 'star') {
    const k = rad * 1.45;
    canvas.scale(k + 1.8, k + 1.8);
    canvas.drawPath(unitStar(), pen({ color: '#ffffff' }));
    canvas.scale(k / (k + 1.8), k / (k + 1.8));
    canvas.drawPath(unitStar(), pen({ color }));
  } else {
    const r = shape === 'diamond' ? rad * 0.9 : rad * 0.95;
    canvas.drawRect(Skia.XYWHRect(-r - 1.6, -r - 1.6, (r + 1.6) * 2, (r + 1.6) * 2), pen({ color: '#ffffff' }));
    canvas.drawRect(Skia.XYWHRect(-r, -r, r * 2, r * 2), pen({ color }));
  }
  canvas.restore();
}

/** Draws one frame of the battlefield (screen pixels, origin top-left). */
export function drawScene(canvas: SkCanvas, s: GameSession, interactive: boolean) {
  const { w: W, clock } = s;
  const world = s.world;
  const T = world.territories;

  canvas.save();
  if (s.shake > 0) canvas.translate((Math.random() - 0.5) * s.shake * 26, (Math.random() - 0.5) * s.shake * 26);
  // The board: the states are drawn once into a cached image; only owned (or flashing) states are redrawn each frame.
  const ox = s.ox();
  const oy = s.oy();
  const S = s.scale();
  drawLand(canvas, s);
  if (world.land) {
    const paths = cellPaths(world.land);
    const px = enterWorld(canvas, s);
    for (const n of T) {
      if (n.owner === 0 && n.flash <= 0) continue;
      const p = paths[n.id];
      if (!p) continue;
      // An owned state deepens in colour as its garrison grows, so strong towers read at a glance.
      canvas.drawPath(p, pen({ color: n.flash > 0.3 ? '#ffffff' : troopShade(LIGHT[n.owner], COL[n.owner], n.units, TIERS[n.tier].cap), corner: CORNER }));
      canvas.drawPath(p, pen({ color: look.seam, width: 1.7 / px, round: true, corner: CORNER }));
    }
    canvas.restore();
  }

  for (const st of world.storms) {
    const cx = ox + st.x * S;
    const cy = oy + st.y * S;
    const rx = st.r * S;
    const ry = st.r * S;
    const oval = Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2);
    canvas.drawOval(oval, pen({ color: '#5b6bd6', alpha: 0.14 }));
    canvas.drawOval(oval, pen({ color: '#3a4bd6', alpha: 0.55, width: 2, dash: [10, 8], phase: clock * 18 }));
    const inner = Skia.XYWHRect(cx - rx * 0.55, cy - ry * 0.55, rx * 1.1, ry * 1.1);
    for (let k = 0; k < 3; k++) {
      const a0 = (clock * 1.4 + k * 2.1) * DEG;
      canvas.drawArc(inner, a0, 1.1 * DEG, false, pen({ color: '#3a4bd6', alpha: 0.4, width: 3 }));
    }
    // Small chevrons drift inward round the ring: a field that drags on anything flying through it.
    const arrowPen = pen({ color: '#3a4bd6', alpha: 0.55, width: 2.4, round: true });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + clock * 0.6;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const tx = -dy;
      const ty = dx;
      const bx = cx + dx * rx * 0.82;
      const by = cy + dy * ry * 0.82;
      const tip = { x: cx + dx * rx * 0.6, y: cy + dy * ry * 0.6 };
      const arrow = Skia.Path.Make();
      arrow.moveTo(bx - dx * 9 + tx * 6, by - dy * 9 + ty * 6);
      arrow.lineTo(tip.x, tip.y);
      arrow.lineTo(bx - dx * 9 - tx * 6, by - dy * 9 - ty * 6);
      canvas.drawPath(arrow, arrowPen);
    }
  }

  const src = interactive ? s.sources() : [];
  const hov = src.length ? s.hit(s.ptr.x, s.ptr.y) : null;

  // Aim lines from every selected source: the same straight line troops in flight fly along.
  if (src.length) {
    const aim = pen({ color: '#ffffff', alpha: 0.95, width: 4, dash: [9, 8], round: true, phase: clock * 26 });
    for (const id of src) {
      const f = T[id];
      if (hov && hov.id === id) continue;
      const ax = s.px(f);
      const ay = s.py(f);
      const bx = hov ? s.px(hov) : s.ptr.x;
      const by = hov ? s.py(hov) : s.ptr.y;
      const path = Skia.Path.Make();
      path.moveTo(ax, ay);
      path.lineTo(bx, by);
      canvas.drawPath(path, aim);
    }
  }

  const total = src.length ? previewSend(world, src, -1, s.sendFrac) : 0;
  for (const n of T) drawTerritory(canvas, s, n, src, total);

  // An item is armed: every tower it could be used on wears a pulsing target ring in the item's colour.
  if (s.armed) {
    const color = ITEM_COLOR[s.armed];
    for (const n of T) {
      if (!canTarget(s.armed, n)) continue;
      const beat = 0.5 + 0.5 * Math.sin(s.clock * 8);
      const ring = discRadius(s, n) + 14 + beat * 4;
      canvas.drawCircle(s.px(n), s.py(n), ring, pen({ color: '#ffffff', width: 7, alpha: 0.9 }));
      canvas.drawCircle(s.px(n), s.py(n), ring, pen({ color, width: 4, dash: [9, 7], phase: s.clock * 22 }));
    }
  }

  // Troops in flight: bigger squads read as a heavier mass, with a white rim, in the equipped shape.
  // Each stream (one from/to/owner route) is also tallied, so its total can be labelled below.
  const streams = new Map<string, { owner: number; total: number; bestP: number; x: number; y: number }>();
  for (const d of world.dots) {
    const a = T[d.from];
    const b = T[d.to];
    const { x: wx, y: wy, ux, uy } = linePoint(a.x, a.y, b.x, b.y, d.p, d.off);
    const x = ox + wx * S;
    const y = oy + wy * S;
    const rad = 2.4 + Math.sqrt(d.v) * 1.1;
    const len = 6 + rad * 3;
    const ang = Math.atan2(uy, ux);
    canvas.drawLine(x, y, x - ux * len, y - uy * len, pen({ color: COL[d.owner], alpha: 0.35, width: rad * 1.4, round: true }));
    drawTroop(canvas, x, y, rad, ang, COL[d.owner]);

    const key = `${d.from},${d.to},${d.owner}`;
    const stream = streams.get(key);
    if (!stream) streams.set(key, { owner: d.owner, total: d.v, bestP: d.p, x, y });
    else {
      stream.total += d.v;
      if (d.p > stream.bestP) {
        stream.bestP = d.p;
        stream.x = x;
        stream.y = y;
      }
    }
  }

  // A sizeable force in flight gets its total labelled near its lead edge, so a big push reads as one number.
  streams.forEach((stream) => {
    if (stream.total < MIN_LABEL_TROOPS) return;
    const label = Math.round(stream.total).toString();
    const size = s.w * 0.025;
    const bw = font(size).measureText(label).width + 14;
    const bh = size + 8;
    const bx = Math.min(W - bw - 4, Math.max(4, stream.x - bw / 2));
    const by = stream.y - 28;
    const pill = Skia.RRectXY(Skia.XYWHRect(bx, by, bw, bh), bh / 2, bh / 2);
    canvas.drawRRect(pill, pen({ color: COL[stream.owner] }));
    canvas.drawRRect(pill, pen({ color: '#ffffff', width: 2 }));
    text(canvas, label, bx + bw / 2, by + bh / 2, size, '#ffffff');
  });

  // Warn about enemy squads heading for our territories, above the troops so it is never hidden.
  incomingThreats(world, 1).forEach((th, id) => drawThreat(canvas, s, T[id], th));

  // Capture shockwaves and landing pulses.
  for (const g of s.rings) {
    const k = g.t / g.dur;
    const e = 1 - Math.pow(1 - k, 3);
    canvas.drawCircle(g.x, g.y, g.r0 + (g.r1 - g.r0) * e, pen({ color: g.color, alpha: (1 - k) * 0.9, width: g.w * (1 - k * 0.6) }));
  }

  // Item animations: a falling bomb, frost, lightning on your towers... (src/ui/itemFx.ts).
  if (s.fx.length) {
    const spots = T.filter((n) => n.owner === 1).map((n) => ({ x: s.px(n), y: s.py(n), r: discRadius(s, n) }));
    for (const f of s.fx) {
      const n = f.id >= 0 ? T[f.id] : undefined;
      drawItemFx(canvas, { W, H: s.h, tx: n ? s.px(n) : W / 2, ty: n ? s.py(n) : s.h / 2, r: n ? discRadius(s, n) : W * 0.031, spots }, f);
    }
  }

  // Numbers that float up and fade (the "-5" of a bomb).
  for (const f of s.floaters) {
    const k = f.t / f.dur;
    const size = s.w * 0.06;
    const y = f.y - k * s.w * 0.1;
    const a = 1 - Math.max(0, (k - 0.55) / 0.45);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) canvas.drawText(f.text, f.x + dx - font(size).measureText(f.text).width / 2, y + dy + size * 0.35, pen({ color: '#ffffff', alpha: a }), font(size));
    canvas.drawText(f.text, f.x - font(size).measureText(f.text).width / 2, y + size * 0.35, pen({ color: f.color, alpha: a }), font(size));
  }

  // How many troops the current selection would send, next to the target.
  if (src.length && hov && !src.every((id) => id === hov.id)) {
    const n = previewSend(world, src, hov.id, s.sendFrac);
    const enemy = hov.owner !== 1;
    const hold = holdStrength(hov);
    const win = enemy && n > hold;
    // How many more troops would do it, so a short attack says what to change.
    const label = '> ' + n + (enemy ? (win ? '  TAKES IT' : `  NEED +${Math.floor(hold) + 1 - n}`) : '');
    const f = font(15);
    const bw = f.measureText(label).width + 18;
    const bx = Math.min(W - bw - 6, Math.max(6, s.px(hov) - bw / 2));
    let by = s.py(hov) - s.pr(hov) - 40;
    if (by < 90) by = s.py(hov) + s.pr(hov) + 14;
    const r = Skia.RRectXY(Skia.XYWHRect(bx, by, bw, 28), 9, 9);
    const accent = enemy ? (win ? GREEN : ORANGE) : COL[1];
    canvas.drawRRect(r, pen({ color: '#ffffff' }));
    canvas.drawRRect(r, pen({ color: accent, width: 2.5 }));
    text(canvas, label, bx + bw / 2, by + 14, 15, enemy ? (win ? GREEN : '#c25a00') : COL[1]);
  }
  canvas.restore();
}

function drawTerritory(canvas: SkCanvas, s: GameSession, n: Territory, src: number[], total: number) {
  const x = s.px(n);
  const y = s.py(n);
  const cap = TIERS[n.tier].cap;
  const full = n.owner !== 0 && n.units >= cap - 1;
  const base = discRadius(s, n);
  const r = base * (full ? 1 + 0.035 * Math.sin(s.clock * 7) : 1);
  const owned = n.owner !== 0;

  // A flat disc: white for neutral, the owner's deep colour otherwise. The count sits below it.
  canvas.drawCircle(x, y, r, pen({ color: owned ? (n.flash > 0.3 ? LIGHT[n.owner] : COL[n.owner]) : '#ffffff' }));

  // A frozen tower wears ice and a shielded one a blue ring, so you can see what is in effect and for whom.
  if (n.freeze && n.freeze > 0) {
    canvas.drawCircle(x, y, r + 5, pen({ color: '#8fd3ff', alpha: 0.5 }));
    canvas.drawCircle(x, y, r + 5, pen({ color: '#58b8ff', width: 3, dash: [4, 4], phase: s.clock * 6 }));
  }
  if (n.shield && n.shield > 0) {
    canvas.drawCircle(x, y, r + 9, pen({ color: '#ffffff', width: 7 }));
    canvas.drawCircle(x, y, r + 9, pen({ color: '#3a78d8', width: 4 }));
  }

  if (src.includes(n.id)) {
    canvas.drawCircle(x, y, r + 11, pen({ color: '#ffffff', width: 5 }));
    canvas.drawCircle(x, y, r + 11, pen({ color: '#2f6a92', width: 2 }));
  } else if (total > 0 && n.owner !== 1 && total > holdStrength(n)) {
    // The selected troops are enough to take this one.
    canvas.drawCircle(x, y, r + 10, pen({ color: '#ffffff', width: 5.5, dash: [5, 5], phase: s.clock * 14 }));
    canvas.drawCircle(x, y, r + 10, pen({ color: GREEN, width: 3, dash: [5, 5], phase: s.clock * 14 }));
  }

  // The troop count, bold black, just under the disc.
  // Same size on every territory, so a tier-0 count is as easy to read as a tier-2 one.
  const size = s.w * 0.027;
  text(canvas, String(Math.floor(n.units)), x, y + r + size * 0.85, size, '#0b0b0b');
}

const DANGER = '#e01010';

/**
 * A pulsing ring and a "! N" badge on a territory enemy troops are heading for. Red when they
 * would take it, orange when the garrison can still hold. The pulse quickens as they close in.
 */
function drawThreat(canvas: SkCanvas, s: GameSession, n: Territory, th: Threat) {
  const x = s.px(n);
  const y = s.py(n);
  const r = discRadius(s, n);
  const color = th.lethal ? DANGER : ORANGE;
  const beat = 0.5 + 0.5 * Math.sin(s.clock * (th.eta < 2.5 ? 12 : 6));
  const ring = r + 15 + beat * 4;
  canvas.drawCircle(x, y, ring, pen({ color: '#ffffff', width: 6, alpha: 0.9 }));
  canvas.drawCircle(x, y, ring, pen({ color, width: 3.5, alpha: 0.55 + beat * 0.45 }));

  const label = '! ' + Math.round(th.troops);
  const size = s.w * 0.03;
  const bw = font(size).measureText(label).width + 16;
  const bh = size + 10;
  const bx = Math.min(s.w - bw - 4, Math.max(4, x - bw / 2));
  const by = y - ring - bh - 2;
  const pill = Skia.RRectXY(Skia.XYWHRect(bx, by, bw, bh), bh / 2, bh / 2);
  canvas.drawRRect(pill, pen({ color }));
  canvas.drawRRect(pill, pen({ color: '#ffffff', width: 2.5 }));
  text(canvas, label, bx + bw / 2, by + bh / 2, size, '#ffffff');
}

/** Records a frame into a picture the Skia canvas can show. */
export function recordFrame(s: GameSession, interactive: boolean): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, s.w, s.h));
  drawScene(canvas, s, interactive);
  return recorder.finishRecordingAsPicture();
}

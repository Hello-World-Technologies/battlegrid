// Generates the store art: node scripts/brand-art.js
// Output: assets/brand/{logo-1024,play-icon-512,feature-graphic}.png
// Rendered with canvaskit-wasm (Skia) using the palette from GAMEPLAY_SPEC.md.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'brand');
const FONT = 'C:/Windows/Fonts/ariblk.ttf';

// Palette matches the shipped game: src/theme.tsx (parchment/wood shell) and
// src/game/theme.ts's region colours (the actual blue/red/grey territory fills).
const BG = '#3a220f';
const ACCENT = '#e6bd72'; // gold — decorative lines/glow, ties to coins & stars elsewhere
const YOU = ['#1d6fb8', '#7cc8ff'];
const RED = ['#8a2413', '#f97057'];
const NEUTRAL = ['#7a7a7a', '#a3a3a3'];

async function main() {
  const CanvasKit = await require('canvaskit-wasm/bin/canvaskit.js')({
    locateFile: f => path.join(__dirname, '..', 'node_modules', 'canvaskit-wasm', 'bin', f),
  });
  const typeface = CanvasKit.Typeface.MakeFreeTypeFaceFromData(fs.readFileSync(FONT));
  const col = (hex, a = 1) => {
    const c = CanvasKit.parseColorString(hex);
    return CanvasKit.Color4f(c[0], c[1], c[2], a);
  };
  const paint = (hex, a = 1, style = CanvasKit.PaintStyle.Fill) => {
    const p = new CanvasKit.Paint();
    p.setAntiAlias(true);
    p.setColor(col(hex, a));
    p.setStyle(style);
    return p;
  };
  const blur = (p, sigma) => {
    p.setMaskFilter(CanvasKit.MaskFilter.MakeBlur(CanvasKit.BlurStyle.Normal, sigma, true));
    return p;
  };

  // Text with manual letter spacing; returns total width.
  const text = (c, str, x, y, size, color, spacing = 0, draw = true) => {
    const font = new CanvasKit.Font(typeface, size);
    const p = paint(color);
    let cx = x;
    for (const ch of str) {
      const ids = font.getGlyphIDs(ch);
      const w = font.getGlyphWidths(ids)[0];
      if (draw) c.drawText(ch, cx, y, p, font);
      cx += w + spacing;
    }
    return cx - x - spacing;
  };

  const background = (c, W, H) => {
    c.drawRect(CanvasKit.XYWHRect(0, 0, W, H), paint(BG));
    const g = new CanvasKit.Paint();
    g.setShader(
      CanvasKit.Shader.MakeRadialGradient(
        [W * 0.6, H * 0.45], Math.max(W, H) * 0.75,
        [col('#2a2168'), col(BG, 1)], [0, 1], CanvasKit.TileMode.Clamp),
    );
    c.drawRect(CanvasKit.XYWHRect(0, 0, W, H), g);
    // faint grid
    const step = Math.max(W, H) / 16;
    const line = paint('#7b6dff', 0.09, CanvasKit.PaintStyle.Stroke);
    line.setStrokeWidth(Math.max(1, step / 40));
    for (let x = step / 2; x < W; x += step) c.drawLine(x, 0, x, H, line);
    for (let y = step / 2; y < H; y += step) c.drawLine(0, y, W, y, line);
  };

  const node = (c, x, y, r, [base, light], count) => {
    c.drawCircle(x, y, r * 1.35, blur(paint(base, 0.55), r * 0.35)); // glow
    const fill = new CanvasKit.Paint();
    fill.setAntiAlias(true);
    fill.setShader(
      CanvasKit.Shader.MakeRadialGradient(
        [x - r * 0.3, y - r * 0.35], r * 1.3,
        [col(light), col(base)], [0, 1], CanvasKit.TileMode.Clamp),
    );
    c.drawCircle(x, y, r, fill);
    const ring = paint(light, 0.95, CanvasKit.PaintStyle.Stroke);
    ring.setStrokeWidth(r * 0.09);
    c.drawCircle(x, y, r, ring);
    if (count != null) {
      const size = r * 0.85;
      const w = text(c, String(count), 0, 0, size, '#000', 0, false);
      text(c, String(count), x - w / 2, y + size * 0.36, size, '#ffffff');
    }
  };

  // Battle scene in unit coordinates centred at (cx, cy), `s` px per unit.
  const scene = (c, cx, cy, s, numbers) => {
    const P = { x: cx - 0.45 * s, y: cy + 0.38 * s, r: 0.36 * s };
    const E = { x: cx + 0.48 * s, y: cy - 0.36 * s, r: 0.29 * s };
    const N1 = { x: cx + 0.5 * s, y: cy + 0.55 * s, r: 0.15 * s };
    const N2 = { x: cx - 0.42 * s, y: cy - 0.55 * s, r: 0.12 * s };

    // lanes
    const lane = paint('#b9b0ff', 0.25, CanvasKit.PaintStyle.Stroke);
    lane.setStrokeWidth(s * 0.012);
    lane.setPathEffect(CanvasKit.PathEffect.MakeDash([s * 0.03, s * 0.04], 0));
    c.drawLine(P.x, P.y, N1.x, N1.y, lane);
    c.drawLine(P.x, P.y, N2.x, N2.y, lane);

    node(c, N1.x, N1.y, N1.r, NEUTRAL, numbers ? 9 : null);
    node(c, N2.x, N2.y, N2.r, NEUTRAL, null);
    node(c, E.x, E.y, E.r, RED, numbers ? 27 : null);
    node(c, P.x, P.y, P.r, YOU, numbers ? 42 : null);

    // troop stream P -> E, dots grow toward the target
    const dx = E.x - P.x, dy = E.y - P.y, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const a = P.r * 1.12, b = len - E.r * 1.12, n = 9;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const d = a + (b - a) * t;
      const wob = Math.sin(i * 1.7) * s * 0.012;
      const x = P.x + ux * d - uy * wob, y = P.y + uy * d + ux * wob;
      const r = s * (0.02 + 0.016 * t);
      c.drawCircle(x, y, r * 2.6, blur(paint('#b9b0ff', 0.6), r));
      c.drawCircle(x, y, r, paint('#ffffff'));
    }
  };

  const render = (W, H, name, draw) => {
    const surface = CanvasKit.MakeSurface(W, H);
    const c = surface.getCanvas();
    draw(c, W, H);
    const png = surface.makeImageSnapshot().encodeToBytes(CanvasKit.ImageFormat.PNG);
    fs.writeFileSync(path.join(OUT, name), png);
    surface.delete();
    console.log('wrote', name, `${W}x${H}`);
  };

  fs.mkdirSync(OUT, { recursive: true });

  // Square icon: full-bleed, no rounded corners (stores/OS apply their own mask);
  // artwork stays inside the central 66% adaptive-icon safe zone.
  const icon = (c, W, H) => {
    background(c, W, H);
    scene(c, W / 2, H / 2, W * 0.36, false);
  };
  render(1024, 1024, 'logo-1024.png', icon);
  render(512, 512, 'play-icon-512.png', icon);

  render(1024, 500, 'feature-graphic.png', (c, W, H) => {
    background(c, W, H);
    scene(c, 835, 255, 190, true);
    const x = 64;
    text(c, 'BATTLE', x, 226, 130, '#ffffff', 4);
    text(c, 'GRID', x, 348, 130, '#7b6dff', 4);
    text(c, 'CONQUER EVERY TERRITORY', x + 4, 410, 22, '#b9b0ff', 5);
  });
}

main().catch(e => { console.error(e); process.exit(1); });

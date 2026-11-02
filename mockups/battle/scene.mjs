// Draws a level of the REAL battle map (same level data, real-world regions, colours and disc style as src/ui/draw.ts)
// as SVG, with a real city name on each territory. Used by the battle mockups and by the menu mockups (thumbnails).
//   battleScene(level, opts) -> { body, names, map, pts, geom }      body = SVG elements in a W x H phone space
//   svgDoc(level, opts, crop) -> standalone SVG string cropped to [x, y, w, h] of that space
// Needs mockups/battle/cities.json (node mockups/battle/build-cities.mjs).
import { REGIONS, TIERS, generateLevel, radius } from '../../src/game/core/index.ts';
import cities from './cities.json' with { type: 'json' };

// Same palette as src/game/theme.ts
export const COL = ['#7a7a7a', '#2c6a99', '#8b160d', '#147a22'];
export const LIGHT = ['#a6a6a6', '#70bceb', '#ff6b57', '#86d88f'];
export const LAND = '#d6d6d6', LAND_EDGE = '#f4f4f4', WATER = '#dfe6ee', INK = '#1d1a4a';

export const cityOf = (t) => {
  const r = REGIONS[t.region];
  return r ? cities[`${r.s}:${r.n}`] ?? r.n : null;
};

/**
 * opts: W,H phone size · labels 'all' | 'owned' | 'none' · discScale (grow discs for small thumbnails)
 *       counts (troop numbers under discs) · discs (draw territories at all) · seed
 */
export function battleScene(level, { W = 360, H = 780, labels = 'all', discScale = 1, counts = true, discs = true, seed = 1 } = {}) {
  const w = generateLevel(level, seed);
  const T = w.territories;
  const view = w.view;
  const top = W * 0.17, band = H - top - W * 0.1;
  const S = Math.min((W * 0.84) / 100, (band * 0.94) / 170);
  const ox = (W - 100 * S) / 2;
  const oy = top + (band - 170 * S) * 0.45;
  const px = S * view.k;
  const owned = new Map();
  for (const n of T) if (n.region !== undefined && n.region >= 0) owned.set(n.region, n);

  let land = '';
  for (const i of view.regions) {
    const r = REGIONS[i];
    const wx = (r.x - view.cx) * view.k + 50, wy = (r.y - view.cy) * view.k + 85;
    const board = r.s === (view.us ? 'u' : 'w') && wx > -3 && wx < 103 && wy > -3 && wy < 173;
    const n = owned.get(i);
    const fill = n ? LIGHT[n.owner] : board ? LIGHT[0] : LAND;
    const stroke = n || board ? '#fff' : LAND_EDGE;
    const sw = (n ? 1.7 : board ? 1.4 : 0.8) / px;
    land += `<path d="${r.d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  }

  const discR = (n) => W * 0.031 * (0.92 + 0.5 * (radius(n) / 6.2 - 1)) * discScale;
  let storms = '';
  for (const st of w.storms) storms += `<circle cx="${ox + st.x * S}" cy="${oy + st.y * S}" r="${st.r * S}" fill="#5b6bd6" fill-opacity=".14" stroke="#3a4bd6" stroke-opacity=".55" stroke-width="${2 * discScale}" stroke-dasharray="10 8"/>`;

  let dsc = '', lab = '';
  const pending = [], blocks = [], pts = [];
  for (const n of T) {
    const x = ox + n.x * S, y = oy + n.y * S, r = discR(n);
    pts.push({ x, y, r, owner: n.owner, tier: n.tier });
    if (!discs) continue;
    const isOwned = n.owner !== 0, cap = TIERS[n.tier].cap;
    if (n.region === undefined || n.region < 0) dsc += `<circle cx="${x}" cy="${y}" r="${radius(n) * 2.2 * S}" fill="${LIGHT[n.owner]}"/>`;
    dsc += `<circle cx="${x}" cy="${y + 2 * discScale}" r="${r}" fill="#000" opacity=".18" filter="url(#bl)"/>`;
    dsc += `<circle cx="${x}" cy="${y}" r="${r}" fill="${isOwned ? COL[n.owner] : '#fff'}"/>`;
    if (isOwned) {
      const rr = r + 5 * discScale, circ = 2 * Math.PI * rr, frac = Math.min(1, n.units / cap);
      dsc += `<circle cx="${x}" cy="${y}" r="${rr}" fill="none" stroke="#fff" stroke-width="${3 * discScale}" stroke-linecap="round" stroke-dasharray="${frac * circ} ${circ}" transform="rotate(-90 ${x} ${y})"/>`;
    }
    if (n.kind === 'fortress') dsc += `<circle cx="${x}" cy="${y}" r="${r + 1}" fill="none" stroke="${isOwned ? '#fff' : '#3a3a3a'}" stroke-opacity=".9" stroke-width="${4 * discScale}" stroke-dasharray="7 5"/>`;
    if (n.kind === 'factory') {
      const bx = x + r * 0.8, by = y - r * 0.8, k = r * 0.34;
      const bolt = [[0.2, -1], [-0.55, 0.1], [-0.05, 0.1], [-0.2, 1], [0.55, -0.2], [0.05, -0.2]].map((p) => `${bx + p[0] * k},${by + p[1] * k}`).join(' ');
      dsc += `<circle cx="${bx}" cy="${by}" r="${k * 1.4}" fill="#fff" stroke="#c98a00" stroke-width="2"/><polygon points="${bolt}" fill="#ffb400"/>`;
    }
    const size = W * 0.027 * Math.min(discScale, 1.6);
    if (counts) dsc += `<text x="${x}" y="${y + r + size * 0.85 + size * 0.35}" text-anchor="middle" font-family="Lilita" font-size="${size}" fill="#0b0b0b">${Math.floor(n.units)}</text>`;
    blocks.push([x - r - 6, y - r - 6, x + r + 6, y + r + (counts ? size * 2.4 : 6)]);
    const name = cityOf(n);
    if (name && (labels === 'all' || (labels === 'owned' && isOwned))) pending.push({ x, y, r, name, isOwned, size, bi: blocks.length - 1 });
  }

  // Place each name in the first free spot (above, right, left, below the count); players' cities claim theirs first.
  const taken = [];
  const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const free = (box, own) => !taken.some((t) => hit(box, t)) && !blocks.some((b) => b !== own && hit(box, b)) && box[0] > 2 && box[2] < W - 2;
  for (const p of pending.sort((a, b) => Number(b.isOwned) - Number(a.isOwned))) {
    const fs = W * (p.isOwned ? 0.03 : 0.026) * Math.min(discScale, 1.5), tw = p.name.length * fs * 0.6, th = fs * 1.15, own = blocks[p.bi];
    const dy = counts ? p.size * 2.5 : p.r + 4;
    const tries = [
      { ax: 'middle', x: p.x, y: p.y - p.r - 5, box: [p.x - tw / 2, p.y - p.r - 5 - th, p.x + tw / 2, p.y - p.r - 3] },
      { ax: 'start', x: p.x + p.r + 6, y: p.y + fs * 0.35, box: [p.x + p.r + 6, p.y - th / 2, p.x + p.r + 6 + tw, p.y + th / 2] },
      { ax: 'end', x: p.x - p.r - 6, y: p.y + fs * 0.35, box: [p.x - p.r - 6 - tw, p.y - th / 2, p.x - p.r - 6, p.y + th / 2] },
      { ax: 'middle', x: p.x, y: p.y + p.r + dy, box: [p.x - tw / 2, p.y + p.r + dy - th, p.x + tw / 2, p.y + p.r + dy + 2] },
    ];
    const pick = tries.find((t) => free(t.box, own)) ?? tries[0];
    taken.push(pick.box);
    lab += `<text x="${pick.x}" y="${pick.y}" text-anchor="${pick.ax}" font-family="Poppins" font-weight="700" font-size="${fs}" fill="${p.isOwned ? '#0c1030' : INK}" stroke="#fff" stroke-width="${3.4 * Math.min(discScale, 1.5)}" stroke-linejoin="round" paint-order="stroke fill">${p.name}</text>`;
  }

  const body = `<defs><filter id="bl"><feGaussianBlur stdDeviation="1.5"/></filter></defs>
    <rect x="-3000" y="-3000" width="${W + 6000}" height="${H + 6000}" fill="${WATER}"/>
    <g transform="translate(${ox} ${oy}) scale(${S}) translate(50 85) scale(${view.k}) translate(${-view.cx} ${-view.cy})">${land}</g>${storms}${dsc}${lab}`;
  return {
    body, w, map: w.map, pts,
    names: T.filter((t) => t.owner === 1).map(cityOf).filter(Boolean),
    enemies: T.filter((t) => t.owner >= 2).length,
    geom: { S, ox, oy, view },
  };
}

/** A standalone SVG of a level, cropped to [x, y, w, h] (default: the whole phone). */
export function svgDoc(level, opts = {}, crop) {
  const W = opts.W ?? 360, H = opts.H ?? 780;
  const sc = battleScene(level, opts);
  const [cx, cy, cw, ch] = crop ?? [0, 0, W, H];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cx} ${cy} ${cw} ${ch}" width="${cw}" height="${ch}" preserveAspectRatio="xMidYMid slice"><style>@font-face{font-family:Lilita;src:url('../../assets/fonts/LilitaOne-Regular.ttf')}</style>${sc.body}</svg>`;
}

/** A crop rectangle around all territories (padded), grown to a target aspect ratio and kept inside the map. */
export function cropAround(sc, aspect, pad = 36, owners = null) {
  const pts = sc.pts.filter((p) => !owners || owners.includes(p.owner));
  const x0 = Math.min(...pts.map((p) => p.x - p.r)) - pad, x1 = Math.max(...pts.map((p) => p.x + p.r)) + pad;
  const y0 = Math.min(...pts.map((p) => p.y - p.r)) - pad, y1 = Math.max(...pts.map((p) => p.y + p.r)) + pad;
  let w = x1 - x0, h = y1 - y0;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return [cx - w / 2, cy - h / 2, w, h];
}

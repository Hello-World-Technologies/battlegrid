// Builds the BattleGrid game logo (chunky cartoon style) and renders it with headless Chrome.
//   node scripts/logo/build-logo.mjs
// Output: assets/brand/battlegrid-logo.png (transparent, 2400x1600), battlegrid-logo.svg (needs
// Lilita One installed to render the text), plus scripts/logo/preview.png (on light + dark).
//
// Look: hand-set letters (each glyph its own size / tilt / bounce), a layered outline (dark ink,
// cream rim, coloured extrusion), a lit bevel on the face (SVG lighting filter), and a conquest
// flag planted in the "I" of GRID, with the game's two orbs tucked under the word.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const fontUrl = pathToFileURL(join(root, 'assets', 'fonts', 'LilitaOne-Regular.ttf')).href;

const W = 1200;
const H = 850;
const INK = '#26103f';

/** A word as one <text>: per-glyph size, tilt (deg) and baseline bounce (absolute px). */
function wordText(id, { x, y, letters, spacing }) {
  const rotate = letters.map((l) => l.rot).join(' ');
  let prev = 0;
  const dy = letters
    .map((l) => {
      const d = l.dy - prev;
      prev = l.dy;
      return d;
    })
    .join(' ');
  const spans = letters.map((l) => `<tspan font-size="${l.size}">${l.ch}</tspan>`).join('');
  return `<text id="${id}" x="${x}" y="${y}" dy="${dy}" rotate="${rotate}" font-family="LilitaOne" letter-spacing="${spacing}" text-anchor="middle">${spans}</text>`;
}

/** Layered 3D word: ink silhouette + extrusion, cream rim, lit gradient face. */
function word({ id, extrude, extrudeDark, rim, gradId, edge, depth = 24, extra = '' }) {
  const steps = [];
  for (let d = 0; d <= depth; d += 2) steps.push(d);
  const sil = steps
    .map((d) => `<use href="#${id}" transform="translate(0 ${d})" fill="${INK}" stroke="${INK}" stroke-width="50" stroke-linejoin="round"/>`)
    .join('');
  const ext = steps
    .filter((d) => d > 0)
    .map((d) => `<use href="#${id}" transform="translate(0 ${d})" fill="${d > depth * 0.55 ? extrudeDark : extrude}" stroke="${d > depth * 0.55 ? extrudeDark : extrude}" stroke-width="22" stroke-linejoin="round"/>`)
    .join('');
  return `
  <g>
    ${sil}
    ${ext}
    <use href="#${id}" fill="${rim}" stroke="${rim}" stroke-width="20" stroke-linejoin="round"/>
    <use href="#${id}" fill="${edge}" stroke="${edge}" stroke-width="6" stroke-linejoin="round"/>
    <g filter="url(#bevel)"><use href="#${id}" fill="url(#${gradId})"/></g>
    ${extra}
  </g>`;
}

const grad = (id, y1, y2, stops) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y1}" x2="0" y2="${y2}">${stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`;

const sparkle = (x, y, r, fill = '#fff') =>
  `<path transform="translate(${x} ${y}) scale(${r})" fill="${fill}" stroke="${INK}" stroke-width="${3.5 / r}" stroke-linejoin="round" d="M0 -1 Q0.12 -0.12 1 0 Q0.12 0.12 0 1 Q-0.12 0.12 -1 0 Q-0.12 -0.12 0 -1Z"/>`;

function orb(cx, cy, r, c1, c2, c3, label) {
  const rid = `o${cx}`;
  return `
  <radialGradient id="${rid}" cx="0.35" cy="0.3" r="0.8">
    <stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/>
  </radialGradient>
  <circle cx="${cx}" cy="${cy + 9}" r="${r + 12}" fill="${INK}"/>
  <circle cx="${cx}" cy="${cy}" r="${r + 12}" fill="${INK}"/>
  <circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="#fff"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 3}" fill="url(#${rid})"/>
  <ellipse cx="${cx - r * 0.3}" cy="${cy - r * 0.42}" rx="${r * 0.42}" ry="${r * 0.22}" transform="rotate(-28 ${cx - r * 0.3} ${cy - r * 0.42})" fill="#fff" opacity="0.7"/>
  <text x="${cx}" y="${cy + r * 0.32}" text-anchor="middle" font-family="LilitaOne" font-size="${r * 0.98}" fill="#fff" stroke="${INK}" stroke-width="8" paint-order="stroke" stroke-linejoin="round">${label}</text>`;
}

const L = (ch, size, rot, dy) => ({ ch, size, rot, dy });

const BATTLE = wordText('tBattle', {
  x: 600,
  y: 318,
  spacing: 4,
  letters: [L('B', 292, -9, 30), L('A', 256, -5, 6), L('T', 268, -1, -14), L('T', 258, 2, -16), L('L', 264, 5, 4), L('E', 284, 9, 30)],
});
const GRID = wordText('tGrid', {
  x: 600,
  y: 690,
  spacing: 8,
  letters: [L('G', 336, -5, 8), L('R', 322, 2, -4), L('I', 372, 0, -14), L('D', 330, 5, 8)],
});

/** Conquest flag planted on the "I" of GRID (local coords: pole base at 0,0). */
const FLAG_PATH = 'M4 -128 C60 -154 96 -98 170 -128 L150 -72 L176 -24 C100 6 64 -50 4 -20Z';
const flag = `
  <g transform="translate(686 482) scale(0.72)">
    <path d="M0 20 V-150" stroke="${INK}" stroke-width="32" stroke-linecap="round"/>
    <path d="${FLAG_PATH}" fill="${INK}" stroke="${INK}" stroke-width="30" stroke-linejoin="round"/>
    <path d="M0 20 V-150" stroke="#ffd25a" stroke-width="15" stroke-linecap="round"/>
    <path d="${FLAG_PATH}" fill="url(#gFlag)" stroke="#fff" stroke-width="7" stroke-linejoin="round"/>
    <path d="M14 -116 C62 -136 96 -88 150 -112" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="8" stroke-linecap="round"/>
    <circle cx="0" cy="-156" r="16" fill="#ffd25a" stroke="${INK}" stroke-width="8"/>
    <path transform="translate(86 -66) scale(26)" fill="#fff" d="M0 -1 L0.30 -0.34 L0.95 -0.31 L0.44 0.14 L0.59 0.81 L0 0.45 L-0.59 0.81 L-0.44 0.14 L-0.95 -0.31 L-0.30 -0.34Z"/>
  </g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <style>@font-face{font-family:LilitaOne;src:url("${fontUrl}")}</style>
  ${grad('gBattle', 90, 350, [[0, '#fffbc4'], [0.28, '#ffe14d'], [0.62, '#ffa31c'], [1, '#f2560e']])}
  ${grad('gGrid', 430, 710, [[0, '#e3fdff'], [0.3, '#74e3ff'], [0.65, '#2f8fff'], [1, '#1b46dc']])}
  <linearGradient id="gFlag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7b8a"/><stop offset="1" stop-color="#e01f43"/></linearGradient>
  ${BATTLE}
  ${GRID}
  <clipPath id="clipGrid"><use href="#tGrid"/></clipPath>
  <pattern id="gridPat" width="48" height="48" patternUnits="userSpaceOnUse" x="10" y="14">
    <path d="M48 0H0V48" fill="none" stroke="#fff" stroke-opacity="0.38" stroke-width="3"/>
  </pattern>
  <!-- lit bevel: soft specular rim from the upper left, a shaded underside -->
  <filter id="bevel" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur"/>
    <feSpecularLighting in="blur" surfaceScale="10" specularConstant="1.25" specularExponent="26" lighting-color="#ffffff" result="spec">
      <feDistantLight azimuth="235" elevation="48"/>
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
    <feDiffuseLighting in="blur" surfaceScale="10" diffuseConstant="1.18" lighting-color="#ffffff" result="diff">
      <feDistantLight azimuth="235" elevation="62"/>
    </feDiffuseLighting>
    <feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="shaded"/>
    <feComposite in="shaded" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.8" k4="0" result="lit"/>
    <feComposite in="lit" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="drop" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="14" stdDeviation="9" flood-color="#000" flood-opacity="0.32"/></filter>
</defs>

<g filter="url(#drop)">
${word({ id: 'tBattle', extrude: '#d4480c', extrudeDark: '#9e2c08', rim: '#fff3c4', edge: '#c2410c', gradId: 'gBattle' })}

${word({
  id: 'tGrid',
  extrude: '#1546c4',
  extrudeDark: '#0b2a8c',
  rim: '#e6fbff',
  edge: '#1a47c9',
  gradId: 'gGrid',
  extra: `<rect x="0" y="430" width="${W}" height="300" fill="url(#gridPat)" clip-path="url(#clipGrid)"/>`,
})}

${flag}

${orb(168, 690, 74, '#d7d4ff', '#7b6dff', '#4128d8', '42')}
${orb(1040, 686, 64, '#ffc4cc', '#ff4a63', '#c4102f', '27')}
</g>

${sparkle(92, 190, 36, '#fff3a6')}
${sparkle(1112, 168, 28, '#fff')}
${sparkle(1000, 70, 18, '#fff3a6')}
${sparkle(236, 74, 17, '#fff')}
${sparkle(1128, 800, 20, '#fff3a6')}
${sparkle(60, 804, 15, '#fff')}
</svg>`;

writeFileSync(join(root, 'assets', 'brand', 'battlegrid-logo.svg'), svg);

const browser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!browser) throw new Error('Chrome or Edge not found');

const shot = (htmlFile, png, w, h, scale, transparent) => {
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--virtual-time-budget=3000',
  ];
  if (transparent) args.push('--default-background-color=00000000');
  args.push(`--screenshot=${png}`, pathToFileURL(htmlFile).href);
  execFileSync(browser, args, { stdio: 'ignore' });
};

const logoHtml = join(here, 'logo.html');
writeFileSync(logoHtml, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
shot(logoHtml, join(root, 'assets', 'brand', 'battlegrid-logo.png'), W, H, 2, true);

const previewHtml = join(here, 'preview.html');
writeFileSync(
  previewHtml,
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;display:flex}div{width:${W / 2}px;height:${H / 2 + 40}px;display:flex;align-items:center;justify-content:center}svg{width:${W / 2 - 20}px;height:auto}</style>
<div style="background:#eaf3ff">${svg}</div><div style="background:linear-gradient(#1b1450,#0b0828)">${svg}</div>`,
);
shot(previewHtml, join(here, 'preview.png'), W, H / 2 + 40, 1, false);
console.log('Wrote assets/brand/battlegrid-logo.png');

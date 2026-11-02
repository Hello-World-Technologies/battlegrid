// Builds the VICTORY / DEFEAT ribbon banners (flat vector style) and renders them with headless Chrome.
//   node scripts/logo/build-banners.mjs
// Output: assets/brand/banner-victory.{svg,png}, banner-defeat.{svg,png} (transparent, 2000x1240),
// plus scripts/logo/banners-preview.png.
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const fontUrl = pathToFileURL(join(root, 'assets', 'fonts', 'LilitaOne-Regular.ttf')).href;
const W = 1000;
const H = 620;
const SHADOW = 'rgba(10,30,100,0.32)';
const GOLD = '#ffb648';
const GOLD_LIGHT = '#ffd98a';

/** Sword pointing up from (500,250), scaled so it fans out past the orb; `broken` snaps the blade. */
function sword(angle, broken) {
  const blade = broken
    ? `<path d="M490 226 V138 L496 124 L501 140 L508 120 L510 136 V226Z" fill="#cfd8e8"/><path d="M501 140 L508 120 L510 136 V226 H501Z" fill="#aab6cc"/>`
    : `<path d="M490 226 V80 L500 48 L510 80 V226Z" fill="#cfd8e8"/><path d="M500 52 L510 80 V226 H500Z" fill="#aab6cc"/>`;
  return `<g transform="rotate(${angle} 500 250) translate(500 250) scale(1.5) translate(-500 -250)">
    ${blade}
    <rect x="452" y="222" width="96" height="16" rx="8" fill="${GOLD}"/>
    <rect x="452" y="222" width="96" height="6" rx="3" fill="${GOLD_LIGHT}"/>
    <rect x="490" y="238" width="20" height="62" rx="6" fill="#7a3f2e"/>
    <circle cx="500" cy="308" r="13" fill="${GOLD}"/>
  </g>`;
}

/** A snapped-off blade tip lying loose, for the defeat banner. */
const shard = (x, y, rot) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-9 30 L-9 -10 L0 -36 L9 -10 L9 30 L3 24 L-3 32Z" fill="#cfd8e8"/><path d="M0 -32 L9 -10 V30 L3 24 L0 28Z" fill="#aab6cc"/></g>`;

const crown = (tilt, dx = 0, dy = 0) => `
  <g transform="translate(${dx} ${dy}) rotate(${tilt} 500 150)">
    <path d="M440 170 L430 112 L468 138 L500 96 L532 138 L570 112 L560 170Z" fill="${GOLD}"/>
    <path d="M440 170 L430 112 L468 138 L474 160Z" fill="#e8962a" opacity="0.55"/>
    <rect x="440" y="160" width="120" height="16" rx="6" fill="#e8962a"/>
    <circle cx="430" cy="110" r="9" fill="${GOLD_LIGHT}"/><circle cx="500" cy="94" r="10" fill="${GOLD_LIGHT}"/><circle cx="570" cy="110" r="9" fill="${GOLD_LIGHT}"/>
  </g>`;

const starPath = 'M0 -1 L0.30 -0.34 L0.95 -0.31 L0.44 0.14 L0.59 0.81 L0 0.45 L-0.59 0.81 L-0.44 0.14 L-0.95 -0.31 L-0.30 -0.34Z';

const sparkle = (x, y, r, c = '#fff') =>
  `<path transform="translate(${x} ${y}) scale(${r})" fill="${c}" d="M0 -1 Q0.12 -0.12 1 0 Q0.12 0.12 0 1 Q-0.12 0.12 -1 0 Q-0.12 -0.12 0 -1Z"/>`;

/** Torn horizontal edge from x0 to x1 around y, as path segments (starts with L). */
function zig(x0, x1, y, amp, step, seed) {
  let d = '';
  let i = 0;
  for (let x = x0; (x1 > x0 ? x <= x1 : x >= x1); x += step * Math.sign(x1 - x0)) {
    const j = Math.sin((i + seed) * 12.9898) * 43758.5453;
    const r = j - Math.floor(j);
    d += ` L${x} ${(y + (i % 2 ? amp * (0.4 + r) : -amp * 0.3 * r)).toFixed(1)}`;
    i++;
  }
  return d;
}

function banner({ label, defeat, c }) {
  const arcTop = 'M250 335 Q500 295 750 335';
  const arcBot = 'M255 448 Q500 408 745 448';

  // Ribbon tails (left; the right is the mirror image).
  const tail = defeat
    ? 'M275 362 L128 378 L160 404 L132 424 L172 446 L136 470 L168 492 L300 496 L300 440Z'
    : 'M275 362 L128 378 L172 446 L128 520 L300 496Z';
  const tailShade = defeat
    ? 'M170 380 L132 425 L172 446 L152 470 L210 470 L200 400Z'
    : 'M290 440 L350 470 L300 496Z';

  const centre = defeat
    ? `M250 335 Q500 295 750 335 L750 440 ${zig(745, 255, 445, 16, 28, 3).replace(/^ L/, 'L')} L250 440Z`
    : `M250 335 Q500 295 750 335 L750 445 Q500 405 250 445Z`;
  const plate = defeat
    ? 'M286 348 Q500 312 714 348 L714 424 Q500 392 286 424Z'
    : 'M286 348 Q500 312 714 348 L714 428 Q500 392 286 428Z';

  const shadowShapes = `
    <path d="${tail}" transform="translate(0 20)"/>
    <path d="${tail}" transform="translate(1000 20) scale(-1 1)"/>
    <path d="${centre}" transform="translate(0 20)"/>`;

  const trimDash = defeat ? 'stroke-dasharray="150 18 70 30 120 14 90 40 200"' : '';

  const orbCore = defeat
    ? `<radialGradient id="orbD" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stop-color="#9a4a62"/><stop offset="0.6" stop-color="#6b2a47"/><stop offset="1" stop-color="#3a1630"/></radialGradient>`
    : `<radialGradient id="orbV" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stop-color="#bcd6ff"/><stop offset="0.55" stop-color="#4f8bff"/><stop offset="1" stop-color="#2447d6"/></radialGradient>`;

  const orb = defeat
    ? `<circle cx="500" cy="250" r="96" fill="#d99a3a"/><circle cx="500" cy="250" r="80" fill="url(#orbD)"/>
       <path d="M470 175 L492 215 L470 232 L500 262 L484 300 M500 262 L538 246 L552 214" fill="none" stroke="#1d0d2a" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
       <g stroke="#ffd9e0" stroke-width="8" stroke-linecap="round"><path d="M452 232 l22 22 M474 232 l-22 22 M526 232 l22 22 M548 232 l-22 22"/></g>
       <path d="M474 290 Q500 272 526 290" fill="none" stroke="#ffd9e0" stroke-width="8" stroke-linecap="round"/>`
    : `<circle cx="500" cy="250" r="96" fill="${GOLD}"/><circle cx="500" cy="250" r="96" fill="none" stroke="#e8962a" stroke-width="6" stroke-dasharray="10 600" />
       <circle cx="500" cy="250" r="80" fill="url(#orbV)"/>
       <ellipse cx="470" cy="208" rx="30" ry="14" transform="rotate(-28 470 208)" fill="#fff" opacity="0.6"/>
       <path transform="translate(500 254) scale(40)" fill="#fff" stroke="#1d3fb0" stroke-width="0.09" stroke-linejoin="round" d="${starPath}"/>`;

  const swordA = defeat ? sword(-52, true) : sword(-52, false);
  const swordB = defeat ? sword(52, true) : sword(52, false);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
  <style>@font-face{font-family:LilitaOne;src:url("${fontUrl}")}</style>
  ${orbCore}
  <path id="txtArc" d="M250 404 Q500 362 750 404"/>
</defs>

<!-- flat drop shadow -->
<g fill="${SHADOW}">${shadowShapes}</g>

${swordA}${swordB}${defeat ? shard(165, 330, -70) + shard(840, 345, 80) : ''}

${orb}
${crown(defeat ? 24 : 0, defeat ? 70 : 0, defeat ? 18 : 0)}

<!-- tails -->
<g>
  <path d="${tail}" fill="${c.tail}"/><path d="${tailShade}" fill="${c.tailDark}"/>
  <path d="M128 378 L276 360" stroke="${GOLD}" stroke-width="12" stroke-linecap="round" fill="none"/>
  <path d="${defeat ? 'M170 494 L300 498' : 'M128 520 L300 496'}" stroke="${GOLD}" stroke-width="12" stroke-linecap="round" fill="none"/>
</g>
<g transform="translate(1000 0) scale(-1 1)">
  <path d="${tail}" fill="${c.tail}"/><path d="${tailShade}" fill="${c.tailDark}"/>
  <path d="M128 378 L276 360" stroke="${GOLD}" stroke-width="12" stroke-linecap="round" fill="none"/>
  <path d="${defeat ? 'M170 494 L300 498' : 'M128 520 L300 496'}" stroke="${GOLD}" stroke-width="12" stroke-linecap="round" fill="none"/>
</g>

<!-- centre band -->
<path d="${centre}" fill="${c.edge}"/>
<path d="${plate}" fill="${c.plate}"/>
<path d="M286 348 Q500 312 714 348" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="6" stroke-linecap="round"/>
<path d="${arcTop}" fill="none" stroke="${GOLD}" stroke-width="13" stroke-linecap="round" ${trimDash}/>
<path d="${arcBot}" fill="none" stroke="${GOLD}" stroke-width="13" stroke-linecap="round" ${trimDash}/>
<path d="M330 330 Q500 296 670 330" fill="none" stroke="${GOLD_LIGHT}" stroke-width="5" stroke-linecap="round" ${trimDash}/>

<text font-family="LilitaOne" font-size="72" letter-spacing="4" text-anchor="middle" fill="${c.ink}" transform="translate(0 6)"><textPath href="#txtArc" startOffset="50%">${label}</textPath></text>
<text font-family="LilitaOne" font-size="72" letter-spacing="4" text-anchor="middle" fill="#fff"><textPath href="#txtArc" startOffset="50%">${label}</textPath></text>

${defeat ? '' : `${sparkle(160, 200, 24, GOLD_LIGHT)}${sparkle(850, 190, 30, '#fff')}${sparkle(905, 270, 14, GOLD_LIGHT)}${sparkle(110, 290, 14, '#fff')}`}
${defeat ? `<g fill="#ffd9e0" opacity="0.8"><circle cx="200" cy="230" r="7"/><circle cx="800" cy="215" r="9"/><circle cx="830" cy="270" r="5"/></g>` : ''}
</svg>`;
}

const variants = [
  {
    name: 'victory',
    svg: banner({ label: 'VICTORY', defeat: false, c: { tail: '#2c5fd6', tailDark: '#2049ad', edge: '#6db3ff', plate: '#3b82f6', ink: '#16348f' } }),
  },
  {
    name: 'defeat',
    svg: banner({ label: 'DEFEAT', defeat: true, c: { tail: '#a3154b', tailDark: '#7d0f3a', edge: '#ff6a7a', plate: '#e5304f', ink: '#6b0f2e' } }),
  },
];

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

for (const v of variants) {
  writeFileSync(join(root, 'assets', 'brand', `banner-${v.name}.svg`), v.svg);
  const html = join(here, `banner-${v.name}.html`);
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>${v.svg}`);
  shot(html, join(root, 'assets', 'brand', `banner-${v.name}.png`), W, H, 2, true);
}

const preview = join(here, 'banners-preview.html');
writeFileSync(
  preview,
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#3fb8ff;display:flex;flex-direction:column;align-items:center}svg{width:${W * 0.8}px;height:auto}</style>${variants.map((v) => v.svg.replace(/id="(\w+)"/g, `id="$1${v.name}"`).replace(/url\(#(\w+)\)/g, `url(#$1${v.name})`).replace(/href="#(\w+)"/g, `href="#$1${v.name}"`)).join('')}`,
);
shot(preview, join(here, 'banners-preview.png'), W, H * 1.6, 1, false);
console.log('Wrote assets/brand/banner-{victory,defeat}.png');

// Renders frames of every item animation from the REAL renderer (via the mockup harness) and tiles them into one sheet.
//   node mockups/current/build.mjs && node mockups/redesign/fx-shots.mjs
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const puppeteer = createRequire(join(root, 'mockups', 'current', 'package.json'))('puppeteer-core');
const out = join(here, 'fx');
mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ttf': 'font/ttf', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  const p = normalize(join(root, decodeURIComponent(req.url.split('?')[0])));
  if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(5388, r));

// item -> [[seconds into the animation, caption], ...]
const PLAN = {
  bomb: [[0.12, 'Reticle + drop'], [0.4, 'Closing in'], [0.56, 'Impact'], [0.7, 'Fireball'], [1.0, 'Smoke + scorch']],
  megabomb: [[0.25, 'Meteor'], [0.6, 'Closing in'], [0.82, 'Impact'], [1.0, 'Fireball'], [1.5, 'Smoke + scorch']],
  freeze: [[0.12, 'Frost burst'], [0.35, 'Ice shards'], [0.7, 'Snowflake'], [1.2, 'Settles']],
  airdrop: [[0.3, 'Parachute'], [0.7, 'Landing'], [0.95, 'Crate bursts'], [1.3, 'Confetti']],
  shield: [[0.15, 'Dome snaps on'], [0.4, 'Ripples'], [0.8, 'Sheen + sparkles']],
  surge: [[0.1, 'Flash'], [0.25, 'Lightning'], [0.5, 'Strikes']],
  rally: [[0.2, 'Speed lines'], [0.5, 'Wind streaks'], [0.9, 'Fade']],
  provoke: [[0.15, 'Flare'], [0.4, 'Anger mark'], [0.9, 'Steam']],
};
const WHOLE = new Set(['surge', 'rally']);

const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--disable-gpu', '--hide-scrollbars'] });
const sheet = [];
for (const [item, frames] of Object.entries(PLAN)) {
  const row = [];
  for (const [at, caption] of frames) {
    const page = await browser.newPage();
    const whole = WHOLE.has(item);
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: whole ? 1 : 2 });
    const id = `fx-${item}-${at}`;
    try {
      await page.goto(`http://localhost:5388/mockups/current/dist/index.html#${id}`);
      await page.waitForFunction(() => document.title.startsWith('ready:') || document.title.startsWith('ERR'), { timeout: 120000 });
      await new Promise((r) => setTimeout(r, 300));
      const t = await page.evaluate(() => window.__fx);
      const file = `${item}-${String(at).replace('.', '_')}.png`;
      const clip = whole ? { x: 0, y: 40, width: 360, height: 400 } : { x: Math.max(0, Math.min(360 - 230, t.x - 115)), y: Math.max(30, t.y - 135), width: 230, height: 230 };
      await page.screenshot({ path: join(out, file), clip });
      row.push({ file, caption: `${caption} · ${at}s`, whole });
      console.log('ok', id);
    } catch (e) { console.log('FAIL', id, String(e.message).slice(0, 100)); }
    await page.close();
  }
  sheet.push({ item, row });
}
await browser.close();
server.close();
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Lilita;src:url("../../../assets/fonts/LilitaOne-Regular.ttf")}
body{margin:0;background:#cfd9e8;font-family:Arial,sans-serif;color:#2b2118;padding:20px;width:1380px}
h1{font:400 30px Lilita;margin:0 0 14px}
.item{display:flex;align-items:center;gap:12px;margin-bottom:14px;background:#e9eff8;border-radius:16px;padding:10px 14px}
.item h2{font:400 24px Lilita;width:130px;margin:0;text-transform:capitalize}
.f{text-align:center;font-size:12px;font-weight:700}
.f img{display:block;border-radius:10px;box-shadow:0 3px 8px rgba(0,0,0,.25);width:230px;margin-bottom:4px}
.f img.w{width:auto;height:230px}
</style><h1>Item animations: real frames from the app renderer</h1>
${sheet.map((s) => `<div class="item"><h2>${s.item === 'megabomb' ? 'Mega bomb' : s.item}</h2>${s.row.map((r) => `<div class="f"><img class="${r.whole ? 'w' : ''}" src="fx/${r.file}">${r.caption}</div>`).join('')}</div>`).join('')}`;
import { writeFileSync } from 'node:fs';
writeFileSync(join(here, 'fx-sheet.html'), html);
console.log('sheet html written');

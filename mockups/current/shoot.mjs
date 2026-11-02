// Renders the app's REAL screens to PNGs so they can be compared with the design mockups (mockups/png4).
//   node mockups/current/build.mjs           (bundle the harness: run again after every code change)
//   node mockups/current/shoot.mjs [id ...]  -> mockups/png_new/<id>.png   (default: every screen)
// Chrome or Edge must be installed. Screens are drawn in a 360x800 viewport and saved at 3x (1080x2400).
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
// Parallel runs: HARNESS_DIST=dist-a SHOOT_PORT=5201 SHOOT_OUT=png_a node mockups/current/shoot.mjs home
const distName = process.env.HARNESS_DIST ?? 'dist';
const port = Number(process.env.SHOOT_PORT ?? 5199);
const out = join(here, '..', process.env.SHOOT_OUT ?? 'png_new');
mkdirSync(out, { recursive: true });

const ALL = ['splash', 'onboarding', 'home', 'levels', 'shop', 'daily', 'profile', 'settings', 'play', 'later', 'pause', 'won', 'lost'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  const path = normalize(join(root, decodeURIComponent(req.url.split('?')[0])));
  if (!path.startsWith(root) || !existsSync(path) || statSync(path).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(readFileSync(path));
});
await new Promise((r) => server.listen(port, r));

const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!executablePath) throw new Error('Chrome or Edge not found');
const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--disable-gpu', '--hide-scrollbars'] });

for (const id of ids) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 360, height: 800, deviceScaleFactor: 3 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    await page.goto(`http://localhost:${port}/mockups/current/${distName}/index.html#${id}`);
    await page.waitForFunction(() => document.title.startsWith('ready:') || document.title.startsWith('ERR') || document.title === 'ERROR', { timeout: 30_000 });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: join(out, `${id}.png`) });
    const title = await page.title();
    console.log(title.startsWith('ready:') ? 'shot' : 'PROBLEM', id, title.startsWith('ready:') ? '' : title.slice(0, 160), errors.length ? errors.join(' | ') : '');
  } catch (e) {
    console.log('FAILED', id, String(e.message).slice(0, 120));
  }
  await page.close();
}
await browser.close();
server.close();

// Puts every screen from mockups/png_new into ONE contact-sheet PNG: mockups/png_new/all_screens.png
//   node mockups/current/shoot.mjs        (first: refreshes the per-screen PNGs)
//   node mockups/current/montage.mjs
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'png_new');
const ORDER = ['splash', 'onboarding', 'home', 'levels', 'shop', 'daily', 'profile', 'settings', 'credits', 'play', 'later', 'pause', 'won', 'lost'];
const ids = ORDER.filter((id) => existsSync(join(dir, `${id}.png`)));
const COLS = 7;
const W = 360;
const H = 800;
const GAP = 28;
const LABEL = 44;
const PAD = 40;
const rows = Math.ceil(ids.length / COLS);
const width = PAD * 2 + COLS * W + (COLS - 1) * GAP;
const height = PAD * 2 + rows * (H + LABEL) + (rows - 1) * GAP;

const cells = ids
  .map((id) => `<figure><img src="${pathToFileURL(join(dir, `${id}.png`)).href}"><figcaption>${id.toUpperCase()}</figcaption></figure>`)
  .join('');
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#2b1d14;font-family:Arial,Helvetica,sans-serif}
  main{display:grid;grid-template-columns:repeat(${COLS},${W}px);gap:${GAP}px;padding:${PAD}px}
  figure{margin:0}
  img{display:block;width:${W}px;height:${H}px;border-radius:18px;box-shadow:0 6px 18px #0008}
  figcaption{height:${LABEL}px;line-height:${LABEL}px;text-align:center;color:#f3e2bf;font-weight:700;letter-spacing:2px;font-size:18px}
</style><main>${cells}</main>`;

const tmp = join(dir, '_montage.html');
writeFileSync(tmp, html);
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!executablePath) throw new Error('Chrome or Edge not found');
const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--disable-gpu', '--allow-file-access-from-files', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(tmp).href);
await page.waitForFunction(() => [...document.images].every((i) => i.complete), { timeout: 30_000 });
const out = join(dir, 'all_screens.png');
await page.screenshot({ path: out });
await browser.close();
unlinkSync(tmp);
console.log(`wrote ${out} (${width * 2}x${height * 2}, ${ids.length} screens)`);

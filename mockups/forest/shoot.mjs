// Renders the forest-theme design mockups (mockups/forest/index.html) to PNGs.
//   node mockups/forest/shoot.mjs   -> mockups/forest/png/<id>.png (1080x2400) and mockups/forest/png/all_screens.png
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const puppeteer = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'current', 'x.js'))('puppeteer-core');

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'png');
mkdirSync(out, { recursive: true });
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!executablePath) throw new Error('Chrome or Edge not found');

const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--disable-gpu', '--allow-file-access-from-files', '--hide-scrollbars'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror:', String(e.message).slice(0, 200)));
await page.setViewport({ width: 1960, height: 1800, deviceScaleFactor: 3 });
await page.goto(pathToFileURL(join(here, 'index.html')).href);
await page.waitForFunction(() => document.title === 'ready', { timeout: 30_000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 500));

for (const id of ['splash', 'home', 'levels', 'shop', 'daily', 'profile', 'play', 'won', 'settings', 'logo']) {
  const el = await page.$(`#${id}`);
  await el.screenshot({ path: join(out, `${id}.png`) });
  console.log('shot', id);
}
await page.setViewport({ width: 1960, height: 1800, deviceScaleFactor: 1.5 });
const sheet = await page.$('#sheet');
await sheet.screenshot({ path: join(out, 'all_screens.png') });
console.log('shot all_screens');
await browser.close();

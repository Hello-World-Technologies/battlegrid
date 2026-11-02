// Renders the splash-match mockup (mockups/splash-match/index.html).
//   node mockups/splash-match/shoot.mjs -> mockups/splash-match/splash_new.png (1080x2400) and comparison.png
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const puppeteer = createRequire(join(here, '..', 'current', 'x.js'))('puppeteer-core');
const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!executablePath) throw new Error('Chrome or Edge not found');

const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--disable-gpu', '--allow-file-access-from-files', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1300, height: 1000, deviceScaleFactor: 3 });
await page.goto(pathToFileURL(join(here, 'index.html')).href);
await page.waitForFunction(() => document.title === 'ready', { timeout: 30_000 });
await new Promise((r) => setTimeout(r, 400));
await (await page.$('#new')).screenshot({ path: join(here, 'splash_new.png') });
await page.setViewport({ width: 1300, height: 1000, deviceScaleFactor: 1.5 });
await (await page.$('#sheet')).screenshot({ path: join(here, 'comparison.png') });
await browser.close();
console.log('done');

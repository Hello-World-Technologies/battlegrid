// Renders mockups/current/icon.html to a flat, fully-opaque 512x512 PNG for the
// Play Store app icon (store-assets/icon-512.png). Chrome or Edge must be installed.
//   node mockups/current/icon.mjs
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const outDir = join(root, 'store-assets');
mkdirSync(outDir, { recursive: true });

const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!executablePath) throw new Error('Chrome or Edge not found');

const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--disable-gpu', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, 'icon.html')).href);
await new Promise((r) => setTimeout(r, 150));
const out = join(outDir, 'icon-512.png');
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 512, height: 512 }, omitBackground: false });
console.log('wrote', out);
await browser.close();

// Renders the mockup screens to PNGs with headless Chrome/Edge.
//   node mockups/render.mjs          -> screens.html  -> mockups/png/*.png
//   node mockups/render.mjs v2       -> screens2.html -> mockups/png2/*.png
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const set = ['v2', 'v3', 'v4'].includes(process.argv[2]) ? process.argv[2] : 'v1';
const cfg =
  set === 'v4'
    ? { html: 'modern/screens4.html', dir: 'png4', ids: ['splash', 'onboarding', 'home', 'tour', 'levels', 'daily', 'profile', 'settings', 'pause', 'victory', 'defeat'], sheetW: 4600 }
    : set === 'v3'
    ? { html: 'screens3.html', dir: 'png3', ids: ['path', 'home', 'levels', 'battle', 'victory', 'daily'], sheetW: 2640 }
    : set === 'v2'
    ? { html: 'screens2.html', dir: 'png2', ids: ['title', 'hub', 'path', 'missions', 'settings', 'ranks'], sheetW: 2640 }
    : { html: 'screens.html', dir: 'png', ids: ['home', 'levels', 'battle', 'victory', 'defeat', 'daily'], sheetW: 2640 };
const out = join(here, cfg.dir);
mkdirSync(out, { recursive: true });

// The real theater outlines, so mockups can draw the actual campaign maps.
const src = readFileSync(join(here, '..', 'src', 'ui', 'mapData.ts'), 'utf8');
const m = src.match(/export const THEATERS: Theater\[\] = (\[.*\]);/s);
if (m) writeFileSync(join(here, 'theaters.js'), `window.THEATERS=${m[1]};\n`);

const browser = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
if (!browser) throw new Error('Chrome or Edge not found');

const page = pathToFileURL(join(here, cfg.html)).href;
const shoot = (hash, file, w, h, scale) =>
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`,
    '--virtual-time-budget=4000', `--screenshot=${join(out, file)}`, `${page}#${hash}`,
  ], { stdio: 'ignore' });

for (const id of cfg.ids) shoot(id, `${id}.png`, 360, 780, 3);
shoot('', 'overview.png', cfg.sheetW, 900, 1);
console.log('Wrote', out);

// Contact sheet of mockups/png_current/*.png  ->  mockups/png_current/overview.png
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'png_current');
const ITEMS = [
  ['splash', 'SPLASH'], ['onboarding', 'ONBOARDING'], ['home', 'HOME'], ['world', 'WORLD MAP'], ['rule', 'RULE'], ['levels', 'LEVELS'], ['daily', 'DAILY BONUS'], ['profile', 'PROFILE'],
  ['settings', 'SETTINGS'], ['credits', 'CREDITS'], ['play', 'BATTLE · LEVEL 5'], ['conquest', 'BATTLE · CONQUEST'], ['pause', 'PAUSE'], ['won', 'VICTORY'], ['lost', 'DEFEAT'],
].filter(([id]) => existsSync(join(dir, `${id}.png`)));
const PER = 8, W = 360, H = 799, GAP = 40;
const rows = Math.ceil(ITEMS.length / PER);
const html = `<body style="margin:0;background:#14172b;font:700 14px sans-serif;color:#c9cdf5"><div style="display:grid;grid-template-columns:repeat(${PER},${W}px);gap:${GAP}px;padding:${GAP}px;width:max-content">${ITEMS.map(
  ([id, cap]) => `<div><img src="${id}.png" style="width:${W}px;height:${H}px;border-radius:30px;box-shadow:0 0 0 7px #0b0d1c;display:block"><div style="text-align:center;margin-top:18px;letter-spacing:2px">${cap}</div></div>`,
).join('')}</div></body>`;
writeFileSync(join(dir, '_overview.html'), html);
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--window-size=${PER * (W + GAP) + GAP},${rows * (H + 90) + GAP}`, `--screenshot=${join(dir, 'overview.png')}`, pathToFileURL(join(dir, '_overview.html')).href], { stdio: 'ignore' });
console.log('overview.png');

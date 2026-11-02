// Renders the battle screen redesign mockup to PNG with headless Chrome.
//   node mockups/redesign/render.mjs  ->  mockups/redesign/battle-redesign.png (sheet) + battle-A.png, battle-B.png
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!browser) throw new Error('Chrome or Edge not found');
const url = pathToFileURL(join(here, 'battle.html')).href;
execFileSync(
  browser,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=2', '--window-size=1240,900', '--virtual-time-budget=4000', `--screenshot=${join(here, 'battle-redesign.png')}`, url],
  { stdio: 'ignore' },
);
console.log('Wrote', join(here, 'battle-redesign.png'));

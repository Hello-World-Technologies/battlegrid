// Draws the REAL battle screen (same level data, same real-world map, same colours and HUD as the app)
// with a real city name on every territory, then screenshots it with headless Chrome.
//   node mockups/battle/render-battle.mjs            -> mockups/battle/battle.html + mockups/png_battle/*.png
// Needs: node mockups/battle/build-cities.mjs  (writes cities.json)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ANCHORS, levelName } from '../../src/game/core/index.ts';
import { COL, INK, WATER, battleScene } from './scene.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'png_battle');
mkdirSync(out, { recursive: true });

/** Levels to render. Each caption is built from the level's real name and the map window the game picks for it. */
const LEVELS = [1, 2, 3, 8, 12, 33];

function phone(level, W = 360, H = 780) {
  const sc = battleScene(level, { W, H });
  const T = sc.w.territories;
  const held = (o) => T.filter((t) => t.owner === o).length;
  const u = W / 720;
  const hud = `
    <div style="position:absolute;left:${72 * u - 34 * u}px;top:${76 * u - 34 * u}px;width:${68 * u}px;height:${68 * u}px;display:grid;place-items:center"><i style="width:${30 * u}px;height:${30 * u}px;border-left:${9 * u}px solid #141414;border-bottom:${9 * u}px solid #141414;border-radius:${3 * u}px;transform:rotate(45deg);margin-left:${10 * u}px"></i></div>
    <div style="position:absolute;top:${85 * u - 15 * u}px;left:${(W - 376 * u) / 2}px;width:${376 * u}px;height:${30 * u}px;border-radius:${15 * u}px;border:${4 * u}px solid #fff;background:#5c5c5c;display:flex;overflow:hidden">
      <b style="flex:${held(1)};background:${COL[1]}"></b>${held(1) && held(2) ? '<i style="width:1.5px;background:#fff"></i>' : ''}<b style="flex:${held(2)};background:#e01010"></b>${held(2) && held(3) ? '<i style="width:1.5px;background:#fff"></i>' : ''}<b style="flex:${held(3)};background:#1fa01f"></b>${held(3) && held(0) ? '<i style="width:1.5px;background:#fff"></i>' : ''}<b style="flex:${held(0)};background:#5c5c5c"></b>
    </div>
    <div style="position:absolute;left:0;right:0;bottom:${26 * u}px;display:flex;justify-content:center;align-items:center;gap:${8 * u}px">
      <span style="font:400 ${22 * u}px Lilita;color:${INK};letter-spacing:1px;margin-right:${4 * u}px">SEND</span>
      ${[25, 50, 100].map((p) => `<span style="min-width:${104 * u}px;height:${54 * u}px;border-radius:${27 * u}px;display:grid;place-items:center;font:400 ${26 * u}px Lilita;color:${INK};background:${p === 50 ? '#fff' : 'rgba(255,255,255,.5)'};border:${3 * u}px solid ${p === 50 ? INK : 'transparent'};opacity:${p === 50 ? 1 : 0.8}">${p}%</span>`).join('')}
    </div>`;
  return { html: `<div class="phone"><svg width="${W}" height="${H}" style="position:absolute;inset:0">${sc.body}</svg>${hud}</div>`, names: sc.names, map: sc.map };
}

const items = LEVELS.map((lv) => {
  const p = phone(lv);
  const where = ANCHORS.find((a) => a.id === p.map)?.name ?? p.map;
  return { lv, cap: `LEVEL ${lv} · ${levelName(lv).toUpperCase()} · ${where.toUpperCase()}`, ...p };
});
const html = `<!doctype html><html><head><meta charset="utf-8"><title>BattleGrid battle with real cities</title>
<style>
@font-face{font-family:Lilita;src:url('../../assets/fonts/LilitaOne-Regular.ttf')}
@font-face{font-family:Poppins;font-weight:700;src:url('../../assets/fonts/Poppins-Bold.ttf')}
*{box-sizing:border-box;margin:0;padding:0} body{background:#14172b} .sheet{display:flex;gap:40px;padding:40px;width:max-content}
.phone{position:relative;width:360px;height:780px;overflow:hidden;background:${WATER}}
body:not(.solo) .phone{border-radius:36px;box-shadow:0 0 0 8px #0b0d1c,0 20px 60px rgba(0,0,0,.5)}
.cap{color:#c9cdf5;font:700 15px Poppins;letter-spacing:2px;text-align:center;margin-top:14px}
body.solo .sheet{padding:0} body.solo .cap,body.solo .item{display:none} body.solo .item.on{display:block}
</style></head><body><div class="sheet">${items.map((p) => `<div class="item" data-id="l${p.lv}">${p.html}<div class="cap">${p.cap}</div></div>`).join('')}</div>
<script>const id=location.hash.slice(1);if(id){document.body.classList.add('solo');document.querySelector('.item[data-id="'+id+'"]')?.classList.add('on')}</script></body></html>`;
writeFileSync(join(here, 'battle.html'), html);

const browser = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const page = pathToFileURL(join(here, 'battle.html')).href;
const shoot = (hash, file, w, h, scale) =>
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`,
    '--virtual-time-budget=4000', `--screenshot=${join(out, file)}`, `${page}#${hash}`], { stdio: 'ignore' });
for (const p of items) shoot(`l${p.lv}`, `battle_level${p.lv}.png`, 360, 780, 3);
shoot('', 'overview.png', 40 * 2 + 400 * items.length, 900, 1);
for (const p of items) console.log(p.cap, '·', p.map, '· you:', p.names.join(', '));

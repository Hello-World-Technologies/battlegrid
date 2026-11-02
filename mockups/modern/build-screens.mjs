// Inlines the real-map SVGs into template.html -> screens4.html (+ thumbs.js for the levels list).
//   node mockups/modern/build-maps.mjs && node mockups/modern/build-screens.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const svg = (name) =>
  readFileSync(new URL(`maps/${name}.svg`, here), 'utf8')
    .replace(/<style>.*?<\/style>/s, '')
    .replace(/ width="[\d.]+" height="[\d.]+"/, '');
const star = (on) => `<span class="ico${on ? '' : ' off'}" style="--m:url(../../assets/ui/star.png)"></span>`;

const html = readFileSync(new URL('template.html', here), 'utf8')
  .replace(/\{\{map:(\w+)\}\}/g, (_, n) => svg(n))
  .replace(/\{\{stars:(\d)\}\}/g, (_, n) => [0, 1, 2].map((i) => star(i < Number(n))).join(''));
writeFileSync(new URL('screens4.html', here), html);

const thumbs = {};
for (let n = 1; n <= 12; n++) thumbs[n] = svg(`thumb${n}`);
writeFileSync(new URL('thumbs.js', here), `window.THUMBS=${JSON.stringify(thumbs)};\n`);
console.log('screens4.html written');

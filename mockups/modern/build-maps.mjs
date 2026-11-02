// Writes real-map SVGs of levels (thumbnails, hero, backdrops) + levels.js for the menu mockups.
//   node mockups/modern/build-maps.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { ANCHORS, levelName, AUTHORED } from '../../src/game/core/index.ts';
import { battleScene, cropAround, svgDoc } from '../battle/scene.mjs';

const dir = new URL('maps/', import.meta.url);
mkdirSync(dir, { recursive: true });
const meta = [];
for (let n = 1; n <= 12; n++) {
  const sq = battleScene(n, { discScale: 2.3, counts: false, labels: 'none' });
  writeFileSync(new URL(`thumb${n}.svg`, dir), svgDoc(n, { discScale: 2.3, counts: false, labels: 'none' }, cropAround(sq, 1, 26)));
  const heroSc = battleScene(n, { labels: 'owned', discScale: 1.25 });
  const heroCrop = cropAround(heroSc, 1.3, 34);
  writeFileSync(new URL(`hero${n}.svg`, dir), svgDoc(n, { labels: 'owned', discScale: 1.25 }, heroCrop));
  // Drag demo: from the player's first territory to its nearest neutral one, as % of the hero crop.
  const me = heroSc.pts.find((p) => p.owner === 1);
  const neutral = heroSc.pts.filter((p) => p.owner === 0).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
  const pc = (p) => [((p.x - heroCrop[0]) / heroCrop[2]) * 100, ((p.y - heroCrop[1]) / heroCrop[3]) * 100];
  const [x1, y1] = pc(me);
  const [x2, y2] = pc(neutral);
  const w = sq.w;
  meta.push({
    n, drag: { x1, y1, x2, y2 }, name: levelName(n), lesson: AUTHORED[n]?.lesson ?? '', map: ANCHORS.find((a) => a.id === sq.map)?.name ?? sq.map,
    from: sq.names, rivals: sq.enemies, territories: w.territories.length,
    storms: w.storms.length, factories: w.territories.filter((t) => t.kind === 'factory').length, fortresses: w.territories.filter((t) => t.kind === 'fortress').length,
  });
}
writeFileSync(new URL('pause5.svg', dir), svgDoc(5, { labels: 'owned' }));
writeFileSync(new URL('full12.svg', dir), svgDoc(12, { labels: 'all' }));
writeFileSync(new URL('levels.js', import.meta.url), `window.LEVELS=${JSON.stringify(meta)};\n`);
console.log(meta.map((m) => `${m.n} ${m.name} | ${m.map} | from ${m.from.join(', ')} | rivals ${m.rivals}`).join('\n'));

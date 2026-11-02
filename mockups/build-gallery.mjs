// Collects every mockup image into one folder: mockups/gallery/
//   node mockups/build-gallery.mjs
// Run the renderers first: render.mjs (v1..v4) and battle/render-battle.mjs.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'gallery');
rmSync(out, { recursive: true, force: true });

const put = (src, dest) => {
  const from = join(here, src);
  if (!existsSync(from)) return console.warn('missing', src);
  mkdirSync(dirname(join(out, dest)), { recursive: true });
  copyFileSync(from, join(out, dest));
};

/* ── the app as it is today (real components rendered in a browser: mockups/current) ── */
const CURRENT = [
  ['splash', '01-splash'], ['onboarding', '02-onboarding'], ['home', '03-home'], ['world', '04-world-map'], ['rule', '05-rule'], ['levels', '06-levels'],
  ['daily', '07-daily-bonus'], ['profile', '08-profile'], ['settings', '09-settings'], ['credits', '10-credits'], ['play', '11-battle-campaign'],
  ['conquest', '12-battle-conquest'], ['pause', '13-pause'], ['won', '14-victory'], ['lost', '15-defeat'], ['overview', '00-overview'],
];
for (const [id, name] of CURRENT) put(`png_current/${id}.png`, `current-ui/${name}.png`);

/* ── proposed design: modern UI + the real battle ── */
const FINAL = [
  ['png4/splash.png', '01-splash.png'],
  ['png4/onboarding.png', '02-onboarding.png'],
  ['png4/home.png', '03-home.png'],
  ['png4/tour.png', '04-world-tour.png'],
  ['png4/levels.png', '05-levels.png'],
  ['png_battle/battle_level1.png', '06-battle-level1-central-europe.png'],
  ['png4/daily.png', '07-daily-bonus.png'],
  ['png4/profile.png', '08-profile.png'],
  ['png4/settings.png', '09-settings.png'],
  ['png4/pause.png', '10-pause.png'],
  ['png4/victory.png', '11-victory.png'],
  ['png4/defeat.png', '12-defeat.png'],
  ['png4/overview.png', '00-overview-ui.png'],
  ['png_battle/overview.png', '00-overview-battle.png'],
];
for (const [s, d] of FINAL) put(s, `final/${d}`);

/* ── more battle maps, each with real city names ── */
const battle = { 2: 'the-balkans', 3: 'east-africa', 8: 'eastern-europe', 12: 'eastern-europe', 33: 'north-africa' };
for (const [lv, region] of Object.entries(battle)) put(`png_battle/battle_level${lv}.png`, `battle-more/battle-level${lv}-${region}.png`);

/* ── earlier explorations ── */
const sets = {
  'explorations/a-candy-theme': ['png', ['home', 'levels', 'battle', 'victory', 'defeat', 'daily', 'overview']],
  'explorations/b-dark-concepts': ['png2', ['title', 'hub', 'path', 'missions', 'settings', 'ranks', 'overview']],
  'explorations/c-parchment-isometric': ['png3', ['path', 'home', 'levels', 'battle', 'victory', 'daily', 'overview']],
};
for (const [dir, [src, names]] of Object.entries(sets)) for (const n of names) put(`${src}/${n}.png`, `${dir}/${n}.png`);

const count = (d) => readdirSync(join(out, d), { recursive: true }).filter((f) => f.endsWith('.png')).length;
writeFileSync(
  join(out, 'README.md'),
  `# BattleGrid mockups

Two sets: **current-ui** is the app as it is today, **final** is the proposed redesign. Open each folder's 00-overview image first.

## current-ui/  (${count('current-ui')} images) — the app as it is today
Screenshots of the real screens (src/screens + src/ui, rendered with react-native-web and Skia on the web) with sample data: a player on level 6 with a 3-day streak and three conquered countries. Android-style 412 x 915 dp (1082 x 2402 px). Regenerate: \`node mockups/current/build.mjs && node mockups/current/render.mjs\` (first run needs \`npm install\` in mockups/current).

## final/  (${count('final')} images) — the proposed redesign
1080 x 2340 (360 x 780 at 3x).
Modern, gamified-but-subtle UI. The battle screen is the real game map (same level data, regions, colours and HUD as the app) with a real city on every territory.

| File | Screen |
|---|---|
| 01-splash | Splash |
| 02-onboarding | How to play: drag to send troops |
| 03-home | Home: current level on its real map, PLAY, daily bonus, world tour |
| 04-world-tour | Campaign path with real photos of each theater |
| 05-levels | Level list for a theater, with real-map thumbnails and start cities |
| 06-battle-level1-central-europe | The battle screen with real city names |
| 07-daily-bonus | Streak and daily reward |
| 08-profile | Level, XP, stats, achievements |
| 09-settings | Audio, gameplay, account |
| 10-pause | Pause over the live map |
| 11-victory | Result: stars, goals, rewards |
| 12-defeat | Result: retry, assisted retry |

## battle-more/  (${count('battle-more')} images)
The battle screen on other levels and map windows (the Balkans, East Africa, Eastern Europe, North Africa), each with real cities.

## explorations/  (${count('explorations')} images)
Earlier directions, kept for reference: a-candy-theme, b-dark-concepts, c-parchment-isometric.

## Sources and credits
- Maps: Natural Earth + US Census (public domain), as used by the game. City names: Natural Earth populated places (public domain) via mockups/battle/build-cities.mjs.
- Photos on the World Tour screen: Wikimedia Commons, CC BY-SA. Authors and licences: mockups/photos/CREDITS.md.
- Icons and isometric art in explorations: Kenney (CC0). Fonts: Lilita One, Poppins (SIL OFL).

## Regenerate
\`\`\`
node mockups/battle/build-cities.mjs
node mockups/battle/render-battle.mjs
node mockups/modern/build-maps.mjs && node mockups/modern/build-screens.mjs
node mockups/render.mjs v4        # also: v1, v2, v3 for the explorations
node mockups/build-gallery.mjs
\`\`\`
`,
);
console.log('gallery:', out);
for (const d of ['final', 'battle-more', 'explorations']) console.log(d, count(d));

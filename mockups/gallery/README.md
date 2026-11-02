# BattleGrid mockups

Two sets: **current-ui** is the app as it is today, **final** is the proposed redesign. Open each folder's 00-overview image first.

## current-ui/  (16 images) — the app as it is today
Screenshots of the real screens (src/screens + src/ui, rendered with react-native-web and Skia on the web) with sample data: a player on level 6 with a 3-day streak and three conquered countries. Android-style 412 x 915 dp (1082 x 2402 px). Regenerate: `node mockups/current/build.mjs && node mockups/current/render.mjs` (first run needs `npm install` in mockups/current).

## final/  (14 images) — the proposed redesign
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

## battle-more/  (5 images)
The battle screen on other levels and map windows (the Balkans, East Africa, Eastern Europe, North Africa), each with real cities.

## explorations/  (21 images)
Earlier directions, kept for reference: a-candy-theme, b-dark-concepts, c-parchment-isometric.

## Sources and credits
- Maps: Natural Earth + US Census (public domain), as used by the game. City names: Natural Earth populated places (public domain) via mockups/battle/build-cities.mjs.
- Photos on the World Tour screen: Wikimedia Commons, CC BY-SA. Authors and licences: mockups/photos/CREDITS.md.
- Icons and isometric art in explorations: Kenney (CC0). Fonts: Lilita One, Poppins (SIL OFL).

## Regenerate
```
node mockups/battle/build-cities.mjs
node mockups/battle/render-battle.mjs
node mockups/modern/build-maps.mjs && node mockups/modern/build-screens.mjs
node mockups/render.mjs v4        # also: v1, v2, v3 for the explorations
node mockups/build-gallery.mjs
```

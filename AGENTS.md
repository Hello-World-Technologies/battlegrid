This is a bare React Native CLI app (no Expo). Prioritize mobile-first patterns, performance, and cross-platform compatibility.

The game: an endless, State.io-style real-time conquest game. Every level is one fixed map: the board is cut into one state per territory, you drag troops from your towers to take the grey and enemy ones, and opposing troops destroy each other in flight. Levels never run out. `GAMEPLAY_SPEC.md` has the rules as built (sections 18-24). The real-world conquest map, the Rule phase and the rebel battles were removed; there are no ads.

## Stack

- React Native 0.87 via `@react-native-community/cli`. `android/` and `ios/` are committed native projects: edit them directly.
- The game is native React Native: rules in `src/game/core` (pure TypeScript, no UI), session/input/effects in `src/game/session.ts`, Skia drawing in `src/ui/draw.ts`, the battle view in `src/ui/GameView.tsx`.
  - Level layout is `core/levels.ts` + `core/campaign.ts` (authored 1-10); `core/land.ts` cuts the board into the states (Voronoi cells) the renderer and hit-testing use; `levelSeed(level)` makes every level a fixed map. All pure and deterministic.
- The shell around the game (Android-first):
  - `App.tsx` — screen state machine, save/load, account handling, audio, back button.
  - `src/screens/` — Splash, Onboarding, Home, Levels (the level path: picture cards, your unlocked levels plus three locked ahead), Shop (items, upgrades, cosmetics), DailyBonus, Profile, Settings, Credits, Pause, Result (win/lose).
  - `src/ui/` (except `GameView`/`draw`) + `src/theme.tsx` — the shared UI kit, in the Caveboy-Escape style: a cartoon sky (`Stage`) behind everything, parchment panels with chunky wood edges (`Card`), wooden-plank buttons (`Button`, tones tan/red/olive/slate), dark-brown ink, cream titles with a brown outline (`OutlineText`), a wooden tab bar (`TabBar`) and dark-wood `HeroPanel`s. Screens read colours from `useTheme()`; the battlefield palette stays in `src/game/theme.ts`, and the equipped shop skin recolours your side of it (`src/shop.ts`). `HomeLevelMap.tsx` draws a level's board as a thumbnail (`fill` for full-bleed art); `LevelScene.tsx` draws the scenery picture on a level card; `land.ts` turns the core's state polygons into cached Skia paths. Home is a menu (PLAY, LEVELS, SHOP plus Daily bonus, Profile and Settings buttons) with no tab bar; every other menu screen has one. To look at screens in Chrome: `node mockups/current/build.mjs` then `node mockups/current/shoot.mjs <screen ids>` (writes `mockups/png_new/`; ids are in `mockups/current/harness.tsx`). The gameplay screen follows `mockups/png_current/play.png` and is not restyled.
  - `src/progress.ts` — pure reducers: level wins and stars, coins, daily bonus + streak, save merging. `src/save.ts` — on-device save. `src/firebase/` — auth (guest + Play Games), Firestore cloud save (`players/{uid}`), analytics.
  - `src/audio.ts` — music loops and effects (files in `android/app/src/main/res/raw`); `src/game/haptics.ts` — vibration. Both follow the Settings toggles.
  - Coins: `progress.coins` is lifetime earned (only grows); what you can spend is `coinsLeft(p) = coins - spent`. A win pays 140, 200 or 250 coins by speed (GAMEPLAY_SPEC section 20). The shop (`src/shop.ts`) sells eight battle items, three permanent upgrades and cosmetics (colours, troop shapes, boards); everything in `Progress` still only grows (`spent`, per-item `items` and `itemsUsed`, `upgrades`, owned cosmetics), so `mergeProgress` takes the maximum or the union.
- Full gameplay spec: `GAMEPLAY_SPEC.md`.

## Commands

```bash
npm start            # Metro dev server
npm run android      # build and run on Android
npm run ios          # build and run on iOS (run `bundle exec pod install` in ios/ first)
npm run lint
npm run typecheck    # tsc --noEmit
npm test             # Jest (progress rules, every shell screen renders)
npm run test:core    # node:test suites: core rules, levels, land, collide
npm run balance      # bot win-rate curve: node scripts/balance.ts [maxLevel] [games] [difficulty]
BG_NO_COLLIDE=1 npm run balance   # the same without the collide rule
```

Run lint and typecheck before declaring any task done.

## Firebase / Play Games setup (one-time, needed for sign-in and cloud save)

The app builds and plays without any of this — it then runs as an offline, device-local guest.

1. Firebase console: create a project, add an Android app with package `com.battlegrid.game` and this build's SHA-1 (`cd android && ./gradlew signingReport`), enable **Authentication → Anonymous** and **Play Games** sign-in, create a **Firestore** database.
2. Download `google-services.json` to `android/app/` (the Gradle plugin is applied only when the file exists). Rebuild the native app; a Metro reload is not enough.
3. Play Console → Play Games Services: create the game, add the Android credential (OAuth client for `com.battlegrid.game` + SHA-1), and put its numeric **Application ID** in `android/app/src/main/res/values/strings.xml` (`app_id`, currently 1031307367641).
4. Deploy the rules: `firebase deploy --only firestore:rules` (`firestore.rules`).
5. iOS is not set up for Firebase, Play Games (Android-only), fonts or audio.

## Rules

- Drawing uses `@shopify/react-native-skia`. Progress is saved per player: `players/{uid}` in Firestore when reachable, mirrored to AsyncStorage (`bg.save.<uid>`) so it works offline. Never write a default to the cloud after a failed read (see `loadOrCreatePlayer`).
- Everything in `Progress` only grows, which is what makes `mergeProgress` safe (counters take the max, stars merge per level). Old saves may still carry `conquest`, `rule` and `dataVersion`; they are ignored.
- Daily bonus days are UTC days, shared with the countdown on the Daily Bonus screen.
- Keep `src/game/core` deterministic: no `Math.random`, `Date`, or DOM. All randomness uses the seeded RNG in the world. The app passes the clock in.
- Add native libraries with `npm install`, then rebuild the app (`npm run android|ios`); pods need `pod install` on iOS.
- Fair play: you and every enemy produce, start and send by the same rules (GAMEPLAY_SPEC section 18). Never give an enemy an economic edge to make a level harder; difficulty is enemy skill (`skillAt`, `profileFor`, `LevelDef.skill`).
- Do not change balance numbers (`difficulty.ts`, `campaign.ts`, `world.ts`, the AI skills in `think()`) without re-running `npm run balance` (and sampling later levels, with the balance bot) and `npm run test:core`.

# BattleGrid — Complete Gameplay & Implementation Spec

Purpose: everything needed to rebuild BattleGrid from scratch with identical gameplay. Hand this file to Claude as the brief.
All numbers below are the exact values of the current implementation (`src/game/core/*` and `web/ui.js`).

---

## 0. How to use this with Claude

Paste this whole file and say:

> Build BattleGrid exactly as specified. Build in the order of section 16. Implement the simulation as a pure, UI-free module first, and write the tests from section 15 before any rendering. Do not change any number without telling me.

Recommended architecture (this is what the current code does and it works well):

1. **Core** (`core/`): pure TypeScript, zero dependencies, no DOM, no React, no `Date`, no `Math.random`. All randomness comes from a seeded RNG stored in the world. Same `(level, seed, difficulty)` must always give the same map, and the same inputs must replay identically.
2. **UI/renderer**: reads the world each frame, draws it, turns touches into `send()` calls. Never contains game rules.
3. **Shell**: screens (menu, level map, pause, win, lose), saving, sound, haptics.

Stack is free to choose (React Native + Skia, Canvas in a WebView, Unity, etc.). The current app is a bare React Native app that shows one HTML page (canvas game) inside `react-native-webview`.

---

## 1. Game in one paragraph

Real-time, single-player territory-conquest game on one portrait screen (like Galcon / Phage Wars). The map has circular **territories** that each hold a number of **troops**. Owned territories produce troops over time. The player drags from their territory to a target to send a fraction of its troops as a stream of dots. When dots land on an enemy or neutral territory they subtract from its garrison; if the garrison goes below zero the attacker captures it. Win by eliminating every enemy; lose when you have nothing left. Levels are endless (1–10 a hand-made tutorial arc, every later one generated, each a fixed map), coins are a reward, and there is no time limit.

---

## 2. World model

### 2.1 Coordinates
- The world is a fixed **100 × 170** unit space (`WORLD_W = 100`, `WORLD_H = 170`). Portrait.
- Renderer scales to the screen independently per axis: `px = x * (screenW / 100)`, `py = y * (screenH / 170)`. The play area is the full canvas; a container max-width of 520 px is used and centred.
- Territory radii are in world units; on screen radius = `radius * (screenW / 100)`.

### 2.2 Owners
`Owner = 0 | 1 | 2 | 3 | 4`
- 0 = neutral (never produces, never sends)
- 1 = the player
- 2 = enemy A (red, starts north-east)
- 3 = enemy B (green, starts north-west; from level 7)
- 4 = enemy C (purple, starts south-east; from level 20)

Levels have one enemy up to level 6, two from level 7 and three from level 20 (`factionCount`). The sides fight each other as well as you. Every enemy is exactly as rich as you and as the other enemies, on every level. The battle is won when all of them are gone. Colours (`game/theme.ts`): neutral `#a6a6a6`, you `#70bceb` (deep `#2c6a99`), red `#ff6b57`, green `#86d88f`, purple `#b886ec` (deep `#5d2a91`). No troop colour for you in the Shop looks like the purple one.

### 2.3 Territory
```ts
Territory { id: number  // index in world.territories
            x, y: number            // world units
            tier: 0|1|2             // size
            kind: 'normal'|'factory'|'fortress'
            owner: 0|1|2|3
            units: number           // FLOAT; display Math.floor(units)
            flash: number }         // seconds left of hit/capture flash, visual only
```

### 2.4 Tiers (size, production, cap)
| tier | name | radius scale | rate (units/s base) | cap |
|---|---|---|---|---|
| 0 | small | 0.8 | 0.9 | 60 |
| 1 | medium | 1.0 | 1.4 | 100 |
| 2 | large | 1.25 | 2.1 | 150 |

`BASE_RADIUS = 6.2`; `radius(t) = 6.2 * TIERS[t.tier].scale`.

### 2.5 Kinds
- **normal**: nothing special.
- **factory**: produces **2×** troops (`kindRate = 2`). Drawn with a yellow lightning-bolt badge (`#ffd23f`) at the top-right of the circle.
- **fortress**: defends as **twice as strong**: `holdStrength = units * 2`, and each arriving attacking troop removes only **0.5** units (`units -= v * 0.5`). Drawn with a thick white dashed ring.

`holdStrength(t) = t.units * (t.kind === 'fortress' ? 2 : 1)` is the single number used for "how many troops do I need to beat this" everywhere (AI targeting, UI hints, "TAKES IT" test).

### 2.6 Other world objects
```ts
Dot    { from, to: number, owner, v: number /* troops it carries */,
         p: number  /* distance travelled from source centre */,
         off: number /* sideways offset, visual */, ang: number /* radians, fixed at spawn */ }
Queue  { from, to, owner, vals: number[] /* troop values still waiting to leave */, wait: number /* s until next dot */ }
Storm  { x, y, r }   // circle; slows dots flying through it
```

### 2.7 World
```ts
World { level, seed, rng /* mutable mulberry32 state */, t /* sim seconds */, acc /* fixed-step accumulator */,
        status: 'play'|'won'|'lost',
        territories, dots, queues, storms,
        profile: DifficultyProfile, name: string, lesson: string,
        factionAi: AiParams[4], factionProd: number[4], personality: Personality[4],
        aiClock: [n,n,n,n],           // seconds until each faction next "thinks"
        trackEvents: boolean, events: GameEvent[] }
```

---

## 3. Deterministic RNG

mulberry32, state kept in `world.rng` (int32). `world.rng = seed | 0` at creation.
```ts
next(s): s.rng = (s.rng + 0x6d2b79f5) | 0
         t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng)
         t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
         return ((t ^ (t >>> 14)) >>> 0) / 4294967296        // [0,1)
range(s,a,b) = a + next(s) * (b - a)
```
The RNG is consumed in exactly this order — do not reorder or the maps/AI change: level generation calls, then during play: dot spawn `off` (`range(-1,1)`), AI shuffle, AI clock reschedule. UI-only randomness (screen shake, sound pitch, seed choice) must NOT use the world RNG. A new game seed is `Math.floor(Math.random() * 2147483647)`.

---

## 4. Simulation loop

### 4.1 Fixed timestep
`STEP = 1/60`. `advance(world, elapsedSeconds)`:
```
world.acc += min(elapsed, 0.25)          // clamp long frames (tab switch, lag)
while (world.acc >= STEP && world.status === 'play') { step(world, STEP); world.acc -= STEP }
```
The UI calls `advance(world, dt)` once per rendered frame, only while state is `play` (not paused, not on a menu). `dt` = frame delta clamped to 0.25 s.

### 4.2 `step(w, dt)` — order matters
1. `w.t += dt`
2. Compute per-owner growth `g = [0, growth(1), growth(2), growth(3)]`.
3. **Production and flash** for every territory:
   - `flash = max(0, flash - dt)`
   - skip if owner 0
   - if `units < cap`: `units = min(cap, units + tier.rate * kindRate * g[owner] * factionProd[owner] * dt * 0.8)`  (`PROD_SCALE = 0.8`, `kindRate` 2 for factory else 1)
   - Note: units above cap (from incoming reinforcements) are **not** reduced; they just stop growing.
4. **Queues → dots**: for each queue: `wait -= dt`; `while (wait <= 0 && vals.length) { wait += 0.035; spawn dot }`. A spawned dot: `{from, to, owner, v: vals.shift(), p: radius(source)*0.6, off: range(-1,1)*radius(source)*0.55, ang: atan2(dy, dx) }`. After the loop remove empty queues. (`DOT_INTERVAL = 0.035`.)
5. **Move dots** (iterate backwards so splice is safe): `speed = 40 * dt * (inStorm(dotPositionOnLine) ? 0.4 : 1)` where dot position = `source + (cos ang, sin ang) * d.p` (centre line, ignoring `off`). `d.p += speed`. If `d.p >= dist(source, target) - radius(target) * 0.8` → `arrive(dot)` and remove it. (`DOT_SPEED = 40`, `STORM_SLOW = 0.4`.)
6. **Enemy AI clocks** for factions 2 and 3 only: skip a faction that has no territories and no dots in flight; otherwise `aiClock[f] -= dt`, and when `<= 0`: `think(w, f, factionAi[f])`, then `aiClock[f] = max(ai.intervalMin, ai.interval) * range(0.8, 1.3)`.
7. **Win/lose**:
   - `enemyAlive = count(2)+count(3) > 0 || any dot owner>1 || any queue owner>1`
   - `youAlive = count(1) > 0 || any dot owner==1 || any queue owner==1`
   - `!enemyAlive → 'won'` (checked first), else `!youAlive → 'lost'`. On status change emit `{type:'end', status}`.
   - Troops in flight/queue keep a side alive; a side with 0 territories but dots in flight is not dead yet, and dots landing on a neutral/enemy territory can recapture.

### 4.3 Helpers
- `dist(a,b)` = Euclidean between centres.
- `count(w, owner)` = number of territories owned.
- `growth(w, owner) = 1 + 0.1 * max(0, count(w, owner) - 1)` — the **snowball**: each extra territory adds +10 % production on *all* that owner's territories (owner 0 never produces). Shown in the HUD as `PROD ×1.3`.
- `power(w, owner)` = sum of garrison units + dots in flight `v` + queued `vals`. Troops in transit count as yours. Used for the HUD bar and tips.
- `inStorm(w, x, y)` = any storm with `hypot(s.x-x, s.y-y) < s.r`.

---

## 5. Sending troops and combat

### 5.1 `send(w, fromId, toId, frac) → troops sent`
Refuse (return 0) if: `w.status !== 'play'`, source doesn't exist, `fromId === toId`, source owner is 0. (It does **not** check that the caller owns the source — the UI only calls it with player-owned sources, and the AI with its own.)
```
total = floor(from.units * frac); if (total < 1) return 0
from.units -= total                       // leftover fraction stays
n = min(60, total)                        // MAX_DOTS_PER_SEND = 60
split total into n integer chunks: for i in 0..n-1: v = ceil(left / (n - i)); vals.push(v); left -= v
push Queue { from, to, owner: from.owner, vals, wait: 0 }
emit { type:'send', from, to, owner, troops: total }
```
So a send of 200 troops is 60 dots carrying about 3–4 each, released every 0.035 s (a visible stream that takes ~2.1 s to fully leave).

`sendMany(w, fromIds, toId, frac)` = sum of `send()` for each id (skips `id === toId` because `send` refuses it).
`previewSend(w, fromIds, toId, frac)` = sum of `floor(units * frac)` over ids that aren't the target and aren't neutral. `toId = -1` gives the total for a selection with no target.

### 5.2 Arrival / combat `arrive(w, dot)`
```
t = territories[dot.to]; t.flash = 0.25; emit {type:'land', id, owner: dot.owner}
if t.owner === dot.owner:  t.units += dot.v; return           // reinforce (can exceed cap)
t.units -= (t.kind === 'fortress' ? dot.v * 0.5 : dot.v)
if t.units < 0: emit {type:'capture', id, owner: dot.owner, previous: t.owner}
                t.owner = dot.owner; t.units = -t.units; t.flash = 0.6     // surplus becomes the new garrison
```
Important behaviours:
- Combat is troop-by-troop as dots land; the defender keeps producing while the stream arrives, so a weak stream can fail.
- Exactly 0 remaining units does not capture (needs `< 0`).
- Enemy dots landing on a territory the same enemy already took just reinforce it. Two enemy factions fight each other with the same rules.
- After capture the surplus is `-units` (positive); it is not divided by the fortress factor.
- Neutral territories never send, never produce, never defend actively.

---

## 6. Enemy AI

Two AI factions (owner 2 and 3) each have their own `AiParams`, production multiplier and personality. Bots use the same `think()`.

```ts
AiParams { interval, intervalMin, minUnits, fraction, margin, coordinate: boolean, playerBias }
```

### 6.1 `think(w, owner, p) → boolean` (did it send?)
1. `mine` = own territories with `units >= p.minUnits`, then **Fisher–Yates shuffle** using the world RNG (`for i = len-1..1: j = floor(next*(i+1)); swap`).
2. For each `from` in shuffled order:
   - `force = from.units * p.fraction`
   - Scan every territory `to` not owned by `owner`:
     - `need = holdStrength(to) + (to.owner ? dist * 0.06 : 0)` — owned (non-neutral) garrisons keep growing during travel.
     - skip if `force <= need + p.margin`
     - `score = holdStrength(to) + dist * 0.16 - (to.owner === 1 ? p.playerBias : 0)`; keep the lowest score.
   - If a best target exists: `send(w, from.id, best.id, p.fraction)` and return true (one attack per think).
3. If nothing could win alone and `p.coordinate && mine.length >= 2`: **pooled attack**. For every enemy/neutral `to`: `need = holdStrength(to) + p.margin + (to.owner ? 5 : 0)`; sort `mine` by distance to `to`; add sources nearest-first summing `units * fraction` until `sum > need`. Among achievable targets choose the one with the lowest `holdStrength`. Send from every pooled source. Return true.
4. Otherwise return false (waits for the next clock tick).

The AI never defends explicitly, never retreats, never reinforces its own territories, and only ever evaluates garrisons (not in-flight troops).

### 6.2 Personalities
```
balanced: base params.
aggressor: interval*0.75, intervalMin*0.75, minUnits 12, fraction 0.6, margin 2, playerBias 12
turtle:    interval*1.25, intervalMin*1.25, minUnits 26, fraction 0.4, margin 12;  production ×1.15
```
`aiFor(baseParams, personality)` returns the params; `personalityProd(p)` = 1.15 for turtle else 1.

---

## 7. Difficulty / balance profile

`profileFor(level, difficulty)`; difficulty factor `d`: easy 0.85, normal 1, hard 1.2. **The shipped UI has no difficulty selector: always `normal`.** (The engine supports all three.)
```
scale        = d                                   // multiplies authored enemy garrisons (Math.round)
playerStart  = 40
playerProd   = 1.1                                 // player's production multiplier
enemyStart   = (14 + level*1.2) * d                // generated levels only
enemyProd    = (0.8 + level*0.007) * d
neutralScale = 1 + level*0.02                      // generated levels only
grace        = [0, 0, 12 + max(0, 4-level)*2, 18]  // seconds before faction 2 / 3 first think
ai.interval  = max(3.6 - level*0.07, 1.8) / d
ai.intervalMin = 1.8 / d
ai.minUnits  = 18;  ai.fraction = 0.5;  ai.margin = 6
ai.coordinate = level >= 12
ai.playerBias = 0
```
Faction setup in every level: `factionAi = [profile.ai ×4]`, `factionProd = [0, playerProd, enemyProd, enemyProd]`, `personality = ['balanced' ×4]`, `aiClock = [0, 0, grace[2], grace[3]]`.

---

## 8. Levels

`generateLevel(level, seed, difficulty='normal')`: if `AUTHORED[level]` exists → build from definition; else generate procedurally. Same inputs → identical map.

### 8.1 Authored levels (1–10)
Node format `[x, y, tier, owner, units, kind?]`. Enemy (owner ≥ 2) units are multiplied by `profile.scale` and rounded; player/neutral units are used as written.
Setup per authored level: `setPersonality(f, def.personalities?.[f] ?? 'balanced')` for f in {2,3}, then `factionProd[f] *= def.pressure ?? 1` (applied to both factions even if faction 3 has no territories). Storms `[x, y, r]`.

```
1 "First Contact"   lesson: "Drag from your territory to another to send troops."
  nodes: [22,138,1,1,40] [62,118,0,0,10] [30,88,0,0,12] [70,72,0,0,16] [72,32,1,2,16]

2 "Snowball"        lesson: "Every territory you hold raises production on all of them."
  nodes: [20,140,1,1,40] [55,132,0,0,8] [82,112,0,0,10] [35,105,0,0,12] [62,88,1,0,22] [25,68,0,0,14] [72,30,1,2,20]

3 "Power Plant"     lesson: "Factories produce double troops. Take them early."
  nodes: [20,140,1,1,40] [50,136,0,0,10] [82,125,0,0,12] [25,100,0,0,14] [58,96,1,0,30,'factory']
         [80,70,1,0,24] [70,30,1,2,24] [28,45,0,0,15]

4 "The Wall"        lesson: "Fortresses hold twice as strong. Bring extra troops."
  nodes: [20,140,1,1,42] [52,138,0,0,12] [82,118,0,0,14] [28,100,0,0,16] [55,84,1,0,26,'fortress']
         [82,72,0,0,18] [72,30,1,2,30] [28,50,1,0,26]

5 "Hold the Line"   lesson: "This enemy attacks early. Keep troops home to defend."
  nodes: [22,138,1,1,45] [58,134,0,0,12] [84,108,0,0,16] [26,100,0,0,14] [50,70,1,0,26] [70,60,1,2,30] [30,40,0,0,18]
  personalities: {2:'aggressor'}

6 "Ion Storm"       lesson: "Storms slow troops. Go around them, or plan for the delay."
  nodes: [20,140,1,1,42] [62,138,0,0,12] [82,100,1,0,24] [22,98,0,0,14] [50,92,1,0,28,'factory']
         [30,56,0,0,18] [74,32,1,2,28]
  storms: [46,112,15] [62,62,13]     pressure: 1.3

7 "Second Empire"   lesson: "A second enemy. They fight each other as well as you."
  nodes: [22,140,1,1,44] [58,132,0,0,12] [84,112,0,0,16] [28,100,0,0,16] [55,84,1,0,28,'factory']
         [78,34,1,2,26] [24,34,1,3,26] [50,52,0,0,20]
  personalities: {2:'balanced', 3:'turtle'}     pressure: 1.25

8 "Pincer"          lesson: "Drag through several territories to attack together."
  nodes: [20,140,1,1,34] [76,140,1,1,34] [48,118,0,0,16] [82,96,0,0,18] [22,96,0,0,18]
         [50,78,1,0,40,'fortress'] [50,34,2,2,62,'fortress'] [24,56,0,0,20]
  pressure: 1.56

9 "Crossfire"       lesson: "Let them fight each other, then strike the weakened one."
  nodes: [50,142,1,1,50] [22,112,0,0,16] [80,112,0,0,16] [50,90,1,0,30,'factory'] [22,62,1,3,32]
         [78,62,1,2,32] [50,40,0,0,24] [50,66,0,0,20]
  personalities: {2:'aggressor', 3:'aggressor'}     pressure: 0.55

10 "The Citadel"    lesson: "Boss level. Crack the Citadel, one wall at a time."
  nodes: [20,142,1,1,44] [78,142,1,1,44] [50,122,0,0,20] [24,96,0,0,22] [80,96,1,0,30,'factory']
         [50,30,2,2,60,'fortress'] [24,52,1,2,30] [78,52,1,2,30,'fortress']
  storms: [50,88,14]     personalities: {2:'turtle'}     pressure: 1.35
```
Idea progression (a test enforces it): send → snowball → factory → fortress → defend → storm → 2nd enemy → combine attacks → crossfire → boss.

### 8.2 Generated levels (11+)
```
total = min(18, 5 + level*2)              // MAX_LEVEL_TERRITORIES = 18
minD  = min(20, 90 / sqrt(total * 1.6))   // minimum spacing
TOP = 16; BOTTOM = 170 - 18 = 152
place(x0,x1,y0,y1): try up to 300 times: x=range(x0,x1), y=range(y0,y1);
    gap = (i > 200) ? minD*0.7 : minD; accept if every existing territory is farther than gap.
    If all fail, return a random point anyway (rare).
```
Placement order (order affects RNG consumption):
1. Player: tier 1, units = playerStart(40), area x∈[12,40], y∈[BOTTOM-34, BOTTOM] (bottom-left).
2. Enemy 2: tier 1, units = round(enemyStart), x∈[60,88], y∈[TOP, TOP+34] (top-right).
3. If `factionCount(level) === 2` (level ≥ 7, so always in generated levels): Enemy 3: tier 1, round(enemyStart), x∈[12,40], y∈[TOP, TOP+34] (top-left).
4. Neutrals until `total`: `r = next(w)`; tier = r<0.25 → 2, r<0.5 → 1, else 0. units = `round(range(lo,hi) * neutralScale)` with `[lo,hi]` per tier: `[[8,25],[20,50],[45,90]]`. Area x∈[10,90], y∈[TOP+8, BOTTOM-8].
5. **Specials** (prizes are neutrals with tier ≥ 1): `factories = level>=12 ? (level>=20 ? 2 : 1) : 0`; `fortresses = level>=14 ? (level>=22 ? 2 : 1) : 0`. For i in 0..factories+fortresses-1 while prizes remain: remove a random prize (`floor(next*len)`), set kind = factory for the first `factories`, fortress for the rest.
6. **Storms**: `level>=11 ? min(3, 1 + floor((level-11)/6)) : 0`; each `{x: range(25,75), y: range(60,112), r: range(9,14)}`.
7. **Personalities**: for each faction f∈{2,3} that has a territory: `personality = ['balanced','aggressor','turtle'][floor(next*3)]`, `factionAi[f] = aiFor(profile.ai, p)`, `factionProd[f] = enemyProd * personalityProd(p) * generatedPressure(level)`, where `generatedPressure = 0.92 - min(19, level - 11) * 0.004`.

Level names: authored names above; for level ≥ 11: `NAMES[(level-11) % 20]` from
`Outpost, Frontier, Crossing, Meltdown, Highway, Blockade, Rift, Uprising, Siege, Ashfall, Overrun, Standoff, Last Light, Iron Belt, Whiteout, Long Night, Fault Line, Warpath, Dominion, The Grid`.

Campaign length: `CAMPAIGN_LEVELS = 30`. The game continues generating levels past 30 ("Endless levels continue").

### 8.3 Balance targets (simulated bot, normal, 100 games/level)
Levels 1–4 ≈ 100 %, 5: 92, 6: 100, 7: 87, 8: 72, 9: 76, 10: 69, 11: 71, 12: 78, 13: 64, 14: 59, 15: 63, 16: 51, 17: 57, 18: 50, 19: 52, 20: 47, 21: 48, 22: 39, 23: 34, 24: 37, 25: 34, 26: 33, 27: 24, 28: 30, 29: 22, 30: 21 %. Average win time 33 s (L1) → ~100 s (L10+). Tests only require early levels winnable and late levels harder. Known wrinkle: L12 (78 %) is easier than L10 (69 %).

The balance bot (`playMatch`): player = owner 1 controlled by `think()` with `{interval 1.5, intervalMin 1.5, minUnits 14, fraction 0.5, margin 4, coordinate true, playerBias 0}`, first decision after 3 s, then every 1.5 s; run `advance(w, 1/60)` until not `play` or `t >= 600`. Returns `{won, seconds}`. Keep a script that prints the win-rate curve (`balance.ts level games difficulty`).

---

## 9. Contextual tips

Non-blocking one-line hint above the Send button, shown for 4.5 s (sim time `TIP_SECONDS = 4.5`, UI fade-out at 4.6 s wall time). The UI evaluates `nextTip()` every 0.5 s of play time (`tipClock`). At most one tip at a time; a tip is suppressed while `w.t < mem.until`. Rules are checked **in this order**; the first eligible one wins. A tip is eligible if it never showed, or `w.t - lastShown > cooldown`.

| id | text | cooldown | condition |
|---|---|---|---|
| lesson | the level's `lesson` line | once per level | `lesson !== ''` and `t > 0.8` |
| factory | "Factories produce double troops. Take them early." | once | `t > 6` and a factory exists |
| fortress | "A fortress holds twice as strong. Bring extra troops or attack together." | once | `t > 6` and a fortress exists |
| storm | "Troops crossing a storm slow down. Go around it if you can." | once | `t > 6` and a storm exists |
| grow | "Capture small neutral territories first. More territory means more troops." | 40 s | `t > 6` and some neutral has `holdStrength < max(player territory units * sendFrac)` |
| adv | "You have a big troop advantage. Attack and overpower them!" | 30 s | `t > 8` and `power(1) > (power(2)+power(3)) * 2` |
| out | "You are outnumbered. Take weak territories and keep some troops home." | 30 s | `t > 8`, enemy power > `power(1) * 1.6`, and player still has a territory |
| full | "A territory is full. Send troops out or its production is wasted." | 25 s | any player territory `units >= cap - 1` |

Tip memory (`{shown: {id: lastTime}, until}`) resets on every level start.

---

## 10. Rewards, progress, saving

- `reward(level, territoriesHeld) = 400 + level*150 + territoriesHeld*20` where `territoriesHeld = count(world, 1)` at the moment of the win.
- Replay factor: if `level < unlocked` (already beaten) the reward is multiplied by `REPLAY_FACTOR = 0.25`; result is `Math.round`ed. (Prevents farming.)
- The reward is banked the moment the level is won. (The old placeholder "Watch ad → claim ×3" button and `AD_MULTIPLIER` were removed; there are no ads.)
- On claim: `if (level >= unlocked) unlocked = level + 1; level = unlocked;` then persist, generate a **new random seed**, and immediately start the next level (or open the level map for "Claim & Level Map").
- Retry after a loss keeps the **same seed** (same map) so a loss teaches something. Restart from pause also keeps the seed. Starting from the map / play button picks a new seed. (Authored levels don't change with the seed — only enemy choices and dot jitter do.)
- Persisted keys (localStorage in the current app; use AsyncStorage/MMKV natively): `bg.level` (= `unlocked`, default 1), `bg.coins` (default 0), `bg.sound` ('1'/'0', default on), `bg.haptics` ('1'/'0', default on). All reads/writes are try/catch guarded. On boot `unlocked = level = +bg.level || 1`.
- Coins are display-only currently — nothing spends them. Decide whether to add a shop; the spec of the current game has none.

---

## 11. Input model (touch / pointer)

State: `sel` (tap-selected territory), `drag = {set: [ids], first, moved, sx, sy}`, `sendFrac`, pointer position `ptr`. Only active while `state === 'play'`.

**Hit test** `hit(x,y)`: nearest territory whose centre is within `1.5 × screen radius` of the point (forgiving touch target); null otherwise.

**pointerdown**: unlock audio; `n = hit()`.
- `n` is player-owned → start `drag = {set:[n.id], first:n, moved:false}`.
- else `n` exists and `sel` exists → `send(sel → n, sendFrac)`; clear `sel`. (tap-source, then tap-target)
- else clear `sel`.

**pointermove**: update `ptr`. If dragging: `moved = true` once the finger moved > 10 px from the start. While `moved`, if the finger is over another **player-owned** territory not yet in `drag.set`, append it (that is the multi-select: drag through several of your territories, each pushes onto the set).

**pointerup** (listen on the window so it works if released off-canvas): `n = hit()`.
- If `moved`: if `n` exists → `sendMany(drag.set minus n.id, n.id, sendFrac)`; always clear `sel`.
- Else (it was a tap): if `sel` exists and `sel !== drag.first` → `send(sel → drag.first)` (tap own territory as target = reinforce) and clear `sel`; else `sel = drag.first` (select it).
- `drag = null`.

**Send size**: removed. Every send is 100% (the old 25 / 50 / 100% chips are gone), so the bottom of the battle holds only the items button.

**Pause**: pause button (II), Escape / `p` key, and page visibility hidden (app backgrounded) all pause. While paused, no `advance()`. Resume returns to play.

---

## 12. Rendering spec (canvas, 2D)

Full-screen canvas; per frame at devicePixelRatio (cap 2). DOM overlays for HUD/tips/screens. Single dark theme.

Draw order each frame:
1. Screen shake: if `shake > 0` translate by `(rand-0.5) * shake * 26` px on both axes. Fill background `#090812`; faint grid lines every 40 px, `rgba(80,72,140,.12)`, 1 px.
2. **Storms**: filled ellipse `rgba(123,109,255,.10)`; rotating dashed outline (10/8 dash, `rgba(185,176,255,.45)`, 2 px, rotation `clock*0.6`); three inner arcs at `0.55×` radius rotating `clock*1.4 + k*2.1`, sweep 1.1 rad, `rgba(185,176,255,.3)`, 3 px. Ellipse radii are `r*sx` and `r*sy`.
3. **Aim lines** (only while playing or paused, with a selection or an active moved drag): dashed (8/8), you-colour, 3 px, 70 % alpha, from each selected source to the hovered target, or to the pointer if no target. Skip the source under the pointer.
4. **Territories**: filled circle in owner colour (alpha 0.92 owned, 0.8 neutral); shadow blur 16 owned, 36 while `flash>0`, 0 neutral; colour switches to the light variant when `flash > 0.3`; 3 px `rgba(255,255,255,.18)` outline. Owned territories get a **fill ring** at `radius+6` px: an arc from 12 o'clock sweeping `units/cap` of a full circle in the light colour. A territory at cap (`units >= cap-1`, owned) pulses its radius `±3.5 %` with `sin(clock*7)`. Fortress/factory decorations as in 2.5. Selected sources: white 3 px ring at `radius+12`. A neutral/enemy territory that the current selection's total preview troops can beat (`total > holdStrength(n)`) shows a rotating dashed green ring (`#3dff9a`, 5/5, 2.5 px, `radius+11`). Troop count centred: `floor(units)`, white, `900 radius*0.8 px Orbitron`.
5. **Dots**: for each dot compute world position `(source + dir*p + perpendicular*off)`, screen radius `2.2 + sqrt(v)*1.1`; a trailing streak (round line, owner colour, 35 % alpha, width `rad*1.4`, length `6 + rad*3` behind); the dot itself in the light colour with shadow blur `6 + sqrt(v)*4`.
6. **Rings** (effects): expanding circles; small (landing) `dur 0.3 s`, radius `0.8r → 1.9r`, width 2.5; big (capture) `dur 0.7 s`, `0.8r → 4.2r`, width 5; ease-out cubic; alpha `(1-k)*0.9`. Landing rings are throttled to one per territory per 0.18 s.
7. **Send preview label** next to the hovered target when a selection exists and target ≠ the selection: `▸ N`; for an enemy/neutral target append `  TAKES IT` (green `#3dff9a`) if `N > holdStrength(target)` else `  NOT ENOUGH` (orange `#ff9f2e`); friendly targets use the you-colour. Rounded box (26 px tall), placed above the target (or below if it would collide with the HUD, `y < 90`), clamped to the screen width. Font `700 15px Rajdhani`.

HUD: top row `LVL n` (Orbitron 15 px) · `PROD ×1.3` (growth of player, 1 decimal) · `● coins` (locale-formatted) · pause button. Below it a 12 px **power bar**: red segment (enemy 2 power share) from the left, orange (enemy 3) next, player (purple) right-aligned; widths are `power / total * 100 %` with a 0.3 s width transition. Bottom: tip pill, then the Send button. Level banner in the upper third at level start: `LEVEL n` + level name in caps, visible 2.4 s.

Fonts used: Orbitron 700/900 (titles, numbers) and Rajdhani 600/700 (body). The current build loads them from Google Fonts (needs network) — bundle them locally for offline use.

---

## 13. Effects, sound, haptics (driven by `world.events`)

Only recorded when `trackEvents = true` (UI turns it on; the simulation/balance bot leaves it off). Events must not affect gameplay (a test enforces identical results with tracking on and off). The UI drains `world.events` every frame.

Events: `send{from,to,owner,troops}`, `land{id,owner}`, `capture{id,owner,previous}`, `end{status}`.

| event | effect |
|---|---|
| send by player | sound *send*; haptic 8 ms |
| land where owner is player or the territory is player's | sound *land* (max one per 70 ms); small ring in the arriving owner's light colour |
| capture (any) | big ring |
| capture by player | sound *capture(mine)*; haptic [18,30,18]; shake 0.22 |
| capture of a player territory by enemy | sound *capture(theirs)*; haptic 60; shake 0.3 |
| end won | win jingle; haptic [30,40,30,40,80] |
| end lost | lose sound; haptic 120 |

`shake` decays `1.0 s⁻¹` (`shake = max(0, shake - dt)`).

Synthesised WebAudio tones `tone(freq, dur, type, vol, slideTo?, delay?)` — gain starts at `vol` (default .12) and ramps exponentially to .0001 over `dur`:
- send: 300 Hz, .12 s, triangle, vol .1, slide to 620
- land: 170 + rand·70 Hz, .05 s, square, vol .035
- capture mine: 392 (.16 tri .13), 523 (.16 tri .11, +.07 s), 659 (.28 tri .13, +.14 s)
- capture theirs: 220 Hz, .3 s, sawtooth, vol .07, slide to 90
- win: 523, 659, 784, 1046 Hz, .22 s triangle .13, 0.11 s apart
- lose: 330, 262, 196, 147 Hz, .28 s sawtooth .07, 0.16 s apart
Audio context must be unlocked/resumed on the first user gesture. Sound and vibration toggles live in the pause menu and are persisted.

**Known issue to fix in a rebuild:** haptics use `navigator.vibrate`, which does nothing in iOS WebViews and is unreliable in Android WebViews. In a native app use `expo-haptics` / `react-native-haptic-feedback` (or a native module).

---

## 14. Screens and flow

State machine: `menu → play ⇄ paused`, `play → won | lost`, plus the `map` overlay reachable from menu, pause and lose (and win via "Claim & Level Map"). Behind the start screen a live world of the current level is rendered.

- **Start**: title `BATTLEGRID`; tagline "Own territory. Send troops. Take the map."; three instruction lines ("DRAG FROM YOUR TERRITORY TO A TARGET / DRAG THROUGH SEVERAL OF YOURS TO ATTACK TOGETHER / MORE TERRITORY MEANS MORE TROOPS"); buttons PLAY (starts `unlocked`) and LEVELS.
- **Level map**: grid of 30 buttons, 5 columns. Level `n < unlocked` = "DONE" (green), `n === unlocked` = "NEXT" (purple, pulsing, disabled under reduced-motion), `n > unlocked` disabled/dimmed. Every 10th is a "boss" (square corners). Hint text: "Replaying a cleared level pays 25%." or, if `unlocked > 30`, "Campaign complete. Endless levels continue.". Tapping a level starts it with a fresh seed. Back returns to where it was opened from (start / pause / lose).
- **Pause**: PAUSED, RESUME, RESTART LEVEL (same seed), LEVEL MAP, SOUND ON/OFF, VIBRATION ON/OFF.
- **Win**: "VICTORY", the three star goals, "YOUR REWARD" with gold `+N`, buttons: NEXT LEVEL, LEVELS, HOME. No ad button.
- **Lose**: "DEFEATED", "The enemy took every territory.", TRY AGAIN (same seed), LEVEL MAP.
- **Level start**: hide all screens, hide tip, create world with `trackEvents = true`, reset tip memory/drag/selection/effects, `state = 'play'`, show the banner.

Main loop (per animation frame): `dt = min(0.25, delta)`; `clock += dt` (for UI animation, also runs while paused); if playing → `advance`, drain events, every 0.5 s evaluate a tip, and if `status !== 'play'` show win/lose; always update rings/shake/HUD and draw.

---

## 15. Tests to write first (acceptance criteria)

The current suite is 25 `node:test` cases; recreate at least these against the pure core:
1. Cannot send from neutral, to self, or when the game has ended; sending removes troops from the source, queues them, and troops in transit still count in `power`.
2. Bigger attack captures and keeps the surplus; smaller attack fails and weakens the defender; reinforcing a friend adds troops.
3. Production capped per tier; neutral never produces; snowball (`growth`) increases production with territory count.
4. Win/lose detection incl. troops in flight keeping a side alive.
5. Determinism: same `(level, seed)` replays exactly (compare full state after N seconds).
6. Generated levels have the right shape (territory count, one player start, 1–2 enemies, factories/fortresses from level 12/14, storms from 11).
7. Every campaign level (1–30) builds, all territories lie within the 100×170 world, and is playable (a bot can win at least sometimes).
8. Authored levels 1–10 each have a lesson and introduce ideas in order; early levels have no big neutral territories.
9. Factory produces exactly double; fortress takes half damage; storms slow troops crossing them.
10. AI personalities change behaviour (aggressor targets the player more, turtle waits longer).
11. Tips honour cooldowns and show one at a time; rewards grow with level and territories.
12. Difficulty ordering: easy wins ≥ normal ≥ hard; balance guard: early levels winnable, late levels harder.
13. Events are recorded only when tracking is on, and enabling tracking does not change results.
14. Multi-select sends from every source and previews the total.

---

## 16. Suggested build order

1. `types` + `rng` + `world` (send / arrive / step / advance / think) + unit tests 1–4, 9.
2. `difficulty` + `levels` (authored data and the generator) + campaign names + tests 5–8.
3. `sim` bot + balance script; verify the win-rate curve in 8.3 within about ±10 pts (statistical, random seeds).
4. `tips`, `rewards`, events + tests 10–14.
5. Renderer (territories, dots, storms, rings, preview label) with the input model from section 11.
6. HUD, tips, banner; screens and the flow from section 14; persistence.
7. Sound, haptics (native haptics library), bundled fonts.
8. Polish: pause on background, reduced-motion, safe-area insets.

---

## 17. Known limitations of the current implementation (decide whether to fix)

- Haptics via `navigator.vibrate` (no-op on iOS, flaky on Android WebView).
- Fonts loaded from Google Fonts (need internet).
- Coins have no sink yet (the roadmap adds one: spending on the country in the Rule phase).
- No difficulty selector in the UI although the engine supports easy/normal/hard.
- Balance is not monotonic (e.g. L12 easier than L10).
- Only portrait; the play field stretches non-uniformly on very different aspect ratios (x and y scale independently).
- The AI never defends, retreats or reinforces; it only attacks based on garrison values.
- Release builds are signed with the debug keystore (Android) — create a real keystore before publishing.

---

## 18. Endless levels, and fair play (supersedes the 30-level cap)

Levels are unlimited and every one is harder than the one before. A level number is always the same map (`levelSeed`). The level list (`Levels.tsx`) shows your open levels and three locked ones ahead, and grows as you win.

**Everyone plays by the same rules.** You and every enemy produce troops at the same rate (`FAIR_PROD`), start with the same troops (`START_TROOPS = 40` each on generated levels; on the hand-made first ten levels each enemy gets the same total as you, split over its towers as the level is drawn), grow the same way (+10% per extra tower) and send the same way (all the troops in a tower, `SEND_FRACTION`). There are no hidden bonuses: the old per-level `pressure` multipliers, the Turtle's production bonus, the aggressor's grudge against the player and the unequal starting garrisons are gone. Neutral garrisons grow with the level for everyone alike (up to level 45). (The permanent upgrades you can buy, section 23, are the one deliberate exception: small, capped and earned with coins.)

**Fair maps.** A generated level is built up to 100 times (`START_TRIES`) and the map where every side's start has the most similar room to expand (`startRatio`, the nearby neutral towers weighted by distance and weakness) is kept; the median map is within 1.28 of perfectly even, nine in ten within 1.37.

**Difficulty is enemy skill, and it rises smoothly.** `skillAt(level) = 1 - 0.5^((level-1)/30)`: 0 on level 1, half by level 31, approaching but never reaching 1. Skill sets how the enemy plays (`profileFor`): how often it decides (every 9 s at skill 0 down to 2.5 s), how many troops a tower needs before it attacks (36 down to 14), how many extra troops it sends on top of what a target needs (28 down to 7), the share of its decisions that are a mistake (40% down to 0), and, one at a time, its tricks (section 24). Every enemy waits the same 4 seconds before its first move on every level. The first ten levels each set their enemy's skill by hand (`LevelDef.skill`), the only per-level difficulty knob, so they step down gradually from the first level to the tenth. An assisted retry plays a weaker enemy (skill x0.6), never a poorer one.

Balance bot (`node scripts/balance.ts` or the curve sampler over `playWorld`; a weak player that, like you, sends everything; humans win more): 100, 100, 89, 88, 87, 84, 85, 91, 70, 65% for levels 1-10, then 77 (11), 75 (14), 52 (20), 44 (30), 38 (40), 21 (60), 13 (100), and 7-9% from 150 up to 500.

## 19. The battlefield: one state per territory (supersedes the free-form node positions and the real-map snapping)

The game is State.io style. Every level is laid out as in §8 (authored positions for 1-10, generated positions from 11), and then `buildLand` (`core/land.ts`) cuts the board into one **state** per territory: the area closer to that territory than to any other (a Voronoi cell, found by clipping the board rectangle with the perpendicular bisector of each pair), in world units. The board is `BOARD`, the 100-wide world a little inside top and bottom. The cells tile it exactly; `world.land.cells[i]` is territory `i`'s polygon, a flat `[x, y, ...]` list. It is pure geometry from the positions: no randomness, so replays are unchanged.

- **Rendering.** `draw.ts` draws the water, then every state in neutral grey with a white seam (one cached image per level and screen size); only owned or flashing states are redrawn each frame in their owner's colour. Corners are softened with a Skia corner path effect. Territory discs, troop counts, storms, threats and the send preview are unchanged. The screen shows the world at one uniform scale, about 84% of its width, centred below the HUD.
- **Hit-testing.** A touch picks the nearest disc within 1.5 radii, else the territory whose state holds the point (`territoryAt`).
- **Levels never run out and never change.** `levelSeed(level)` is the one seed a level number is played with, so a level is a fixed map (State.io style), the Home preview is the board you will fight on, and retries replay it. Levels 1-10 are authored, later ones are generated (up to 18 states); past level 30 the difficulty repeats a ten-level wave (§18). The level list groups them in chapters of ten (`LEVELS_PER_CHAPTER`) and always shows one chapter past yours.
- **Balance.** Without the old real-map filler territories, authored levels 5-10 were retuned (`pressure` 0.99, 1.3, 1.18, 1.55, 0.55, 1.22): `npm run balance 10 100` gives 100, 100, 100, 100, 81, 100, 96, 74, 89, 69 % for levels 1-10, and 11+ track §8.3 (73, 85, 73, 65, 55 ... 18 % at level 30 with 40 games). Every level plays with the collide rule (§26).

## 20. Stars, coins, attack warning, send control, assisted retry

- **Stars are earned by speed** (`core/stars.ts`). Any win is one star; a win under the two-star time is two; under the three-star time is three. On level 1 the times are 1:30 and 1:00. Later levels are harder and slower, so the times stretch 1.5% per level up to level 41 (60% more), then stay (`starTimes`). Best stars per level are stored in `Progress.stars` and merge by maximum.
- **Coins by stars** (`coinsFor`): a fast one-star win (under 2:00 on level 1, stretched like the others) pays 140, two stars 200, three stars 250; a slower win or an assisted one pays 100 (`SLOW_COINS`). The first win of a level pays that in full. A replay that earns more stars pays the difference; any other replay pays a quarter (`winPayout`, `REPLAY_FACTOR`), so a level cannot be farmed. The daily bonus is 100 to 400 coins, 800 on day 7.
- **Attack warning** (`core/threat.ts`, drawn by `drawThreat`). `incomingThreats(world, 1)` reports, per player territory, the enemy troops in flight or queued towards it, an ETA and whether they outnumber the garrison (`holdStrength`). Drawn as a pulsing ring and a "! N" badge: red if it would fall, orange if it holds; the pulse quickens under 2.5 s. Read-only.
- **Sending.** There is no send-size choice: every send uses all the troops in the tower (`SEND_FRACTION = 1`, so a tower you send from is left with none). The attack preview says `NEED +N` when the selection is short. The enemy AI still sends a share (its `fraction`, 0.4 to 0.6).
- **Assisted retry.** After two losses in a row on the same level, the lose screen offers an assisted retry on the same map at `easy` (0.85). An assisted win banks the level but earns one star and the slow 100 coins.

## 21. What was removed

The real-world conquest campaign (every country and state as a level, with the World map), the Rule phase (population, food, funds, unrest) and the rebel battles were removed in favour of the endless State.io-style levels above. Saves made before keep working: the old `conquest`, `rule` and `dataVersion` fields are simply ignored. `Progress` is now coins earned, `unlocked`, wins, losses, the daily streak and stars per level; it all only grows, so `mergeProgress` takes the max. Coins are lifetime earned and currently have no sink.

## 22. Collide rule (State.io style combat)

`World.collide` (on for every level; `blank()` sets it, hand-built test worlds may leave it off). Modelled on State.io: troops that meet in flight destroy each other.

- **Clash** (`clash()` in `world.ts`, after dots move each step): two dots of different owners closer than `CLASH_R = 1.3` world units cancel one for one; the larger dot survives with the difference and keeps flying. Dots close at under 2 units per step, so none slip through. Same-owner dots never interact. Deterministic: a spatial grid, dots visited in index order, no randomness. Emits `{type:'clash', x, y, a, b}`; the session draws a throttled white spark.
- **AI guard** (`guard()` in `think()`): a territory whose incoming hostile troops exceed its garrison gets help from the nearest other territory that can cover the shortfall (`units * fraction >= shortfall + 2`). A territory with incoming troops above 40% of its garrison does not attack. Without `collide` the AI is unchanged.
- **Balance check** (`node scripts/balance.ts 30 40`, `BG_NO_COLLIDE=1` for the old rules): with the rule, levels 11-30 win 73, 85, 73, 65, 55, 63, 60, 50, 60, 43 % then 43, 30, 55, 35, 38, 30, 25, 23, 33, 18 %; without it 70, 88, 63, 57, 65, 65, 70, 53, 45, 40 % then 48, 35, 48, 35, 30, 33, 20, 18, 23, 18 %. The same curve within noise at 40 games per level.

## 23. Bombs and the shop

Coins buy battle items, permanent upgrades and cosmetics in the Shop (`src/screens/Shop.tsx`, catalogue in `src/shop.ts`). Prices are set against the 140-250 coins a win pays, so a consumable costs about one win.

### Battle items (`core/items.ts`, `applyItem`)
Pure and deterministic; the AI never uses them. `applyItem` returns what it achieved or null when refused (the battle is over, the wrong kind of target, or it would do nothing), and then the item is kept. One event `{type:'item', item, id, owner, amount}` is emitted.

| Item | Needs | Effect | Price |
|---|---|---|---|
| Bomb | a tower that is not yours | destroys 5 troops (never more than the garrison, never captures) | 200 |
| Mega bomb | the same | destroys 25 | 600 |
| Freeze | an enemy tower | it makes no troops for 10 s (refused if already frozen) | 250 |
| Airdrop | one of your towers | adds 10 troops | 150 |
| Shield | one of your towers | it takes half damage for 15 s (stacks with a fortress) | 150 |
| Surge | nothing | your towers make double troops for 10 s | 250 |
| Rally | nothing | your troops fly twice as fast for 10 s | 200 |
| Provoke | nothing | the strongest enemy sends half its fullest tower at the nearest tower of another enemy (needs two enemies alive) | 300 |
| Flak | one of your towers | shoots up to 12 troops out of the sky, picking the hostile dots already heading for it (refused if nothing is incoming) | 220 |
| Recall | one of your towers | every troop you sent from it, in flight or still queued, turns around and comes home (refused if nothing is out) | 200 |

Prices are per item; five cost 20% less (`packPrice`). Every player starts with 2 free bombs (`FREE_BOMBS`).

**In a battle** the item tray along the bottom shows one tile per item you hold, with how many are left on each tile; there is no per-battle limit, only how many you have bought. Tap a tile to pick it; an item that needs no target is used at once, the rest are armed: every valid tower gets a pulsing ring in the item's colour and a prompt, and your next tap on one uses it. A tap anywhere else puts it away. Effects: a ring, a floating number or word, a shake for bombs, a buzz; frozen towers wear ice, shielded ones a blue ring, and Surge and Rally show a countdown chip. `GameSession` holds `stock`, `armed`, `itemsUsed`, `onItem`; the app copies your stock in when a level starts and takes each item out of your save the moment it is used.

### Upgrades (permanent, small, capped)
Reserves (+2 troops on each starting tower per level, 4 levels: 600 / 1,000 / 1,500 / 2,200), Heavy bombs (+1 bomb damage per level, 3 levels: 800 / 1,500 / 2,500), Cold Snap (+2 s freeze per level, 3 levels: 700 / 1,300 / 2,000), Fortify (+3 s shield per level, 3 levels: 650 / 1,200 / 1,900), Supply Drop (+2 airdrop troops per level, 3 levels: 600 / 1,100 / 1,800). `perksOf` turns the levels into a `Perks` object that goes into `GameSession`.

### Cosmetics (visual only)
Troop colours (5), troop shapes (round, square, diamond, star) and boards (classic, desert sand, mint, night). The renderer reads the equipped choices from `src/ui/look.ts` and the colour arrays in `game/theme.ts`.

### Save
`items` (ever got) and `itemsUsed` per item id, `upgrades` per id, and the owned lists and equipped choice of each cosmetic all only grow, so they merge safely (per-id maximum, union). You hold `items - itemsUsed`. Purchases add to `spent` (`coinsLeft = coins - spent`).

## 24. Enemy AI skills (smarter level by level)

`AiParams` carries the enemy's `skill` (0 to 1). Every smart behaviour is used with a chance that rises with skill, so enemies learn their tricks gradually, a little more on every level, instead of all at once (`uses` in `world.ts`; a settings object with no `skill`, such as the balance bot's, has its flags decide on their own):

| Behaviour | What it does | Chance rises from skill to |
|---|---|---|
| Guard | sends help to a tower that is about to fall | 0.05 to 0.35 |
| Team up (`coordinate`) | pools several towers against one target none can take alone | 0.1 to 0.45 |
| Caution (`caution`) | because every send takes all the troops, a tower with an enemy tower within 30 units is emptied only for an attack with twice the troops it needs | 0.25 to 0.7 |
| Reinforce | with nothing worth attacking, the fullest safe tower sends to the weakest front-line tower | 0.45 to 0.8 |
| Strike | when the army in range would more than double the force needed, every tower in range attacks together | 0.6 to 0.9 |
| Pile on the leader (`leader`) | towers of the side clearly ahead (15% more troops than the next) are more attractive targets, by up to 6 troops | 0.1 to 0.8 (a weight, not a chance) |

A novice also sometimes picks a random target it could take instead of the best one. Measured against the balance bot, speed and carefulness (the numbers above) make an enemy hard; the tricks mostly change how it plays, not how often it wins, and one idea that made enemies weaker ("finish a tower someone else is already breaking") was removed. The enemies fight each other as well as you from level 7, and the leader skill makes that deliberate. Randomness is unchanged (the seeded shuffle and the skill rolls), so replays are exact.

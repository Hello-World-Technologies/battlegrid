// Plays the bot against the enemy AI and prints the win-rate curve.
// Usage: node scripts/balance.ts [maxLevel] [games] [difficulty]
//        BG_NO_COLLIDE=1 node scripts/balance.ts ...   (baseline without the State.io collide rule)
import { generateLevel, playWorld } from '../src/game/core/index.ts';
import type { Difficulty } from '../src/game/core/types.ts';

const maxLevel = Number(process.argv[2] ?? 30);
const games = Number(process.argv[3] ?? 100);
const difficulty = (process.argv[4] ?? 'normal') as Difficulty;

console.log(`difficulty=${difficulty} games/level=${games}${process.env.BG_NO_COLLIDE ? ' (no collide)' : ''}`);
console.log('level  win%   avg win time');
for (let level = 1; level <= maxLevel; level++) {
  let wins = 0;
  let time = 0;
  for (let seed = 1; seed <= games; seed++) {
    const world = generateLevel(level, seed * 7919 + level, difficulty);
    if (process.env.BG_NO_COLLIDE) world.collide = false;
    const r = playWorld(world);
    if (r.won) { wins++; time += r.seconds; }
  }
  const pct = ((wins / games) * 100).toFixed(0).padStart(3);
  const avg = wins ? (time / wins).toFixed(0) + 's' : '-';
  console.log(`${String(level).padStart(4)}   ${pct}%   ${avg}`);
}

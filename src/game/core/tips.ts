import { incomingThreats } from './threat.ts';
import { TIERS, count, holdStrength, power } from './world.ts';
import type { World } from './types.ts';

export interface TipMemory {
  /** When each tip was last shown, in world seconds. */
  shown: Record<string, number>;
  /** No new tip before this time. */
  until: number;
}

export const newTipMemory = (): TipMemory => ({ shown: {}, until: 0 });

const TIP_SECONDS = 4.5;

interface Rule {
  id: string;
  text: string;
  /** Seconds before the same tip may show again. Infinity = once per level. */
  cooldown: number;
  when: (w: World, sendFrac: number) => boolean;
}

const RULES: readonly Rule[] = [
  {
    id: 'lesson',
    text: '',
    cooldown: Infinity,
    when: (w) => w.lesson !== '' && w.t > 0.8,
  },
  {
    id: 'threat',
    text: 'A red ring means enemy troops are on the way. Reinforce it, or strike first.',
    cooldown: Infinity,
    when: (w) => incomingThreats(w, 1).size > 0,
  },
  {
    id: 'factory',
    text: 'Factories produce double troops. Take them early.',
    cooldown: Infinity,
    when: (w) => w.t > 6 && w.territories.some((t) => t.kind === 'factory'),
  },
  {
    id: 'fortress',
    text: 'A fortress holds twice as strong. Bring extra troops or attack together.',
    cooldown: Infinity,
    when: (w) => w.t > 6 && w.territories.some((t) => t.kind === 'fortress'),
  },
  {
    id: 'storm',
    text: 'Troops crossing a storm slow down. Go around it if you can.',
    cooldown: Infinity,
    when: (w) => w.t > 6 && w.storms.length > 0,
  },
  {
    id: 'grow',
    text: 'Capture small neutral territories first. More territory means more troops.',
    cooldown: 40,
    when: (w, frac) => {
      const best = Math.max(0, ...w.territories.filter((t) => t.owner === 1).map((t) => t.units * frac));
      return w.t > 6 && w.territories.some((t) => t.owner === 0 && holdStrength(t) < best);
    },
  },
  {
    id: 'adv',
    text: 'You have a big troop advantage. Attack and overpower them!',
    cooldown: 30,
    when: (w) => w.t > 8 && power(w, 1) > (power(w, 2) + power(w, 3)) * 2,
  },
  {
    id: 'out',
    text: 'You are outnumbered. Take weak territories and keep some troops home.',
    cooldown: 30,
    when: (w) => w.t > 8 && power(w, 2) + power(w, 3) > power(w, 1) * 1.6 && count(w, 1) > 0,
  },
  {
    id: 'full',
    text: 'A territory is full. Send troops out or its production is wasted.',
    cooldown: 25,
    when: (w) => w.territories.some((t) => t.owner === 1 && t.units >= TIERS[t.tier].cap - 1),
  },
];

/** Picks at most one tip to show now, honouring cooldowns. Mutates `mem`. */
export function nextTip(w: World, mem: TipMemory, sendFrac = 0.5): { id: string; text: string } | null {
  if (w.t < mem.until) return null;
  for (const r of RULES) {
    const last = mem.shown[r.id];
    if (last !== undefined && w.t - last <= r.cooldown) continue;
    if (!r.when(w, sendFrac)) continue;
    mem.shown[r.id] = w.t;
    mem.until = w.t + TIP_SECONDS;
    return { id: r.id, text: r.id === 'lesson' ? w.lesson : r.text };
  }
  return null;
}

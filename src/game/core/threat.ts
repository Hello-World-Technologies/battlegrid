import { DOT_SPEED, dist, holdStrength, radius } from './world.ts';
import type { Owner, World } from './types.ts';

/** Enemy troops on their way to one of the victim's territories. */
export interface Threat {
  /** Troops in flight and still queued to leave. */
  troops: number;
  /** Seconds until the first of them lands (straight-line estimate; storms ignored). */
  eta: number;
  /** They outnumber the garrison as it stands now, so the territory would fall. */
  lethal: boolean;
}

/**
 * Every territory of `victim` that hostile troops are heading for, keyed by territory id.
 * Read-only: the enemy AI never calls this, so it cannot change how the world plays.
 */
export function incomingThreats(w: World, victim: Owner = 1): Map<number, Threat> {
  const out = new Map<number, Threat>();
  const add = (to: number, troops: number, eta: number) => {
    const t = w.territories[to];
    const seen = out.get(to);
    const total = (seen?.troops ?? 0) + troops;
    out.set(to, { troops: total, eta: Math.min(seen?.eta ?? Infinity, eta), lethal: total > holdStrength(t) });
  };
  const hostile = (owner: Owner, to: number) => owner !== victim && owner !== 0 && w.territories[to]?.owner === victim;

  for (const d of w.dots) {
    if (!hostile(d.owner, d.to)) continue;
    const a = w.territories[d.from];
    const b = w.territories[d.to];
    add(d.to, d.v, Math.max(0, (dist(a, b) - radius(b) * 0.8 - d.p) / DOT_SPEED));
  }
  for (const q of w.queues) {
    if (!hostile(q.owner, q.to)) continue;
    const a = w.territories[q.from];
    const b = w.territories[q.to];
    add(q.to, q.vals.reduce((n, v) => n + v, 0), Math.max(0, (dist(a, b) - radius(a) * 0.6 - radius(b) * 0.8) / DOT_SPEED));
  }
  return out;
}

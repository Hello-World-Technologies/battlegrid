// src/game/fx.ts
//
// What the session tracks about an item animation in progress (visual only). Drawing it is src/ui/itemFx.ts.

import type { ItemId } from './core';

/** One item animation in progress. `impactAt` is when it lands (a bomb falling); effects that act at once use 0. */
export interface ItemFx {
  item: ItemId;
  /** The tower it hit (-1 for items that need none). */
  id: number;
  t: number;
  dur: number;
  impactAt: number;
  /** Set once the landing has been handled (the number, the shake and the sound). */
  landed: boolean;
  amount: number;
  seed: number;
}

/** How long each item's animation runs, and when it lands. */
export const ITEM_FX_TIMING: Readonly<Record<ItemId, { impactAt: number; dur: number }>> = {
  bomb: { impactAt: 0.5, dur: 1.9 },
  megabomb: { impactAt: 0.75, dur: 2.4 },
  freeze: { impactAt: 0, dur: 1.5 },
  airdrop: { impactAt: 0.85, dur: 1.9 },
  shield: { impactAt: 0, dur: 1.4 },
  surge: { impactAt: 0, dur: 1.3 },
  rally: { impactAt: 0, dur: 1.3 },
  provoke: { impactAt: 0, dur: 1.5 },
  flak: { impactAt: 0, dur: 1.3 },
  recall: { impactAt: 0, dur: 1.4 },
};

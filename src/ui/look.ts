// src/ui/look.ts
//
// What the battlefield looks like beyond your colour: the shape your troops fly as and the colours of the board. The
// renderer reads this every frame; the shop (src/shop.ts) changes it when you equip something. Visual only.

export const look = {
  shape: 'round' as string,
  board: 'classic' as string,
  /** The water around the board, the grey of neutral states, and the seams between states. */
  water: '#dfe6ee',
  neutral: '#a6a6a6',
  seam: '#ffffff',
  /** Real geography only: countries around the board that are not in play, pale against the water. */
  scenery: '#cdd7e3',
};

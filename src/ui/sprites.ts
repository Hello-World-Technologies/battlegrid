// src/ui/sprites.ts
//
// Troop shapes that are pictures instead of drawn shapes: stills rendered from our 3D models (the war plane and the
// water sprite). `troop` is what flies across the battlefield (the plane is seen from above, nose pointing right, so
// the renderer can turn it along its route); `card` is the larger picture on the shop card.

import type { ImageRequireSource } from 'react-native';

export type ShapeArt = { troop: ImageRequireSource; card: ImageRequireSource };

export const SHAPE_ART: Readonly<Record<string, ShapeArt>> = {
  plane: {
    troop: require('../../assets/ui/troop_plane.png'),
    card: require('../../assets/ui/shape_plane.png'),
  },
  sprite: {
    troop: require('../../assets/ui/troop_sprite.png'),
    card: require('../../assets/ui/shape_sprite.png'),
  },
};

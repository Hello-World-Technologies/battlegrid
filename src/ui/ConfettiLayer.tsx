// src/ui/ConfettiLayer.tsx
//
// The coloured dots and rounded squares scattered behind a victory (png4). Decoration only: fixed
// positions (fractions of the screen), each piece drifting gently so the screen feels alive.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Float } from './Decor';

// [x, y, size, colour, round?, tilt] with x / y as fractions of the layer.
const PIECES: [number, number, number, string, boolean, number][] = [
  [0.12, 0.06, 9, '#3b7bff', true, 0],
  [0.25, 0.04, 9, '#f2b21a', false, 35],
  [0.27, 0.1, 9, '#8f6bff', false, -25],
  [0.1, 0.2, 9, '#f2b21a', true, 0],
  [0.12, 0.23, 9, '#8f6bff', false, 20],
  [0.26, 0.2, 9, '#3b7bff', false, -35],
  [0.25, 0.23, 8, '#ff6b9a', true, 0],
  [0.12, 0.26, 8, '#34b27a', false, 10],
  [0.78, 0.14, 9, '#3b7bff', false, 30],
  [0.92, 0.15, 9, '#8f6bff', true, 0],
  [0.79, 0.17, 9, '#ff6b9a', false, -20],
  [0.93, 0.18, 9, '#34b27a', false, 0],
  [0.92, 0.21, 9, '#3b7bff', false, 25],
  [0.79, 0.2, 9, '#f2b21a', true, 0],
  [0.93, 0.25, 9, '#ff6b9a', true, 0],
];

export default function ConfettiLayer() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PIECES.map(([x, y, size, color, round, tilt], i) => (
        <Float
          key={i}
          distance={4 + (i % 3) * 2}
          duration={2200 + (i % 5) * 380}
          delay={i * 90}
          style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%` }}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: round ? size / 2 : size * 0.28,
              backgroundColor: color,
              transform: [{ rotate: `${tilt}deg` }],
            }}
          />
        </Float>
      ))}
    </View>
  );
}

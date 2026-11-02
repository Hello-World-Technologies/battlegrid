// src/ui/Emblem.tsx
//
// The brand art of the splash screen (png4): a big violet orb attacking a red one along a dashed
// line, with a small neutral orb beside them. It is the same picture as the app icon, drawn from
// views so it stays crisp at any size. `size` is the art's width; the height follows.

import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { alpha } from './color';

// Layout in design units (the splash mockup, in px at 923 wide, with its origin at the art's corner).
const W = 610;
const H = 460;
const BLUE = { x: 150, y: 302, r: 140 };
const RED = { x: 494, y: 106, r: 100 };
const GREY = { x: 463, y: 409, r: 43 };

export const ORB_ART_RATIO = H / W;

type OrbProps = {
  cx: number;
  cy: number;
  r: number;
  k: number;
  face: string;
  rim: string;
  light: string;
  halo: string;
};

function Orb({ cx, cy, r, k, face, rim, light, halo }: OrbProps) {
  const R = r * k;
  const ring = Math.max(2, 14 * k * (r / 140));
  return (
    <>
      {[2.2, 1.95, 1.7, 1.5, 1.3, 1.15].map((m, i) => (
        <View
          key={m}
          style={{
            position: 'absolute',
            left: cx * k - R * m,
            top: cy * k - R * m,
            width: R * m * 2,
            height: R * m * 2,
            borderRadius: R * m,
            backgroundColor: alpha(halo, 0.02 + i * 0.02),
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: cx * k - R,
          top: cy * k - R,
          width: R * 2,
          height: R * 2,
          borderRadius: R,
          backgroundColor: face,
          borderWidth: ring,
          borderColor: rim,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: -R * 0.1,
            top: -R * 0.1,
            width: R * 1.25,
            height: R * 1.25,
            borderRadius: R * 0.63,
            backgroundColor: alpha(light, 0.35),
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: R * 0.12,
            top: R * 0.12,
            width: R * 0.7,
            height: R * 0.7,
            borderRadius: R * 0.35,
            backgroundColor: alpha(light, 0.25),
          }}
        />
      </View>
    </>
  );
}

export function OrbArt({ size = 260, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const k = size / W;
  // The dashed line runs from the blue orb's rim to the red orb's rim.
  const dx = RED.x - BLUE.x;
  const dy = RED.y - BLUE.y;
  const dist = Math.hypot(dx, dy);
  const ux = dx / dist;
  const uy = dy / dist;
  const x1 = BLUE.x + ux * (BLUE.r + 6);
  const y1 = BLUE.y + uy * (BLUE.r + 6);
  const x2 = RED.x - ux * (RED.r + 6);
  const y2 = RED.y - uy * (RED.r + 6);
  const len = Math.hypot(x2 - x1, y2 - y1) * k;
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const dash = 14 * k;
  const count = 7;

  return (
    <View style={[{ width: size, height: H * k }, style]} pointerEvents="none" accessibilityIgnoresInvertColors>
      <Orb cx={RED.x} cy={RED.y} r={RED.r} k={k} face="#ff4d6a" rim="#ffa0ad" light="#ff9aa8" halo="#ff3d5a" />
      <Orb cx={BLUE.x} cy={BLUE.y} r={BLUE.r} k={k} face="#6a5cff" rim="#b7b0ff" light="#cfc9ff" halo="#5b6bff" />
      <Orb cx={GREY.x} cy={GREY.y} r={GREY.r} k={k} face="#6d6f85" rim="#9a9cb4" light="#b4b6cc" halo="#8a8cb0" />
      <View
        style={{
          position: 'absolute',
          left: ((x1 + x2) / 2) * k - len / 2,
          top: ((y1 + y2) / 2) * k - dash / 2,
          width: len,
          height: dash,
          flexDirection: 'row',
          justifyContent: 'space-between',
          transform: [{ rotate: `${angle}deg` }],
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={{ width: len / (count * 2 - 1), height: dash, borderRadius: dash / 4, backgroundColor: 'rgba(255,255,255,0.88)' }} />
        ))}
      </View>
    </View>
  );
}

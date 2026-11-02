// src/ui/LevelScene.tsx
//
// The "photo" on a level's card in the level path: a small scenery picture drawn in code, different for every level
// (its palette, sun or moon, clouds, mountains, hills, trees and a little tower all come from the level number, so a
// level always looks the same). No image files, so the path can be endless.

import React, { useMemo } from 'react';
import { View } from 'react-native';
import {
  Canvas,
  Group,
  LinearGradient,
  Path,
  vec,
} from '@shopify/react-native-skia';

import { levelSeed } from '../game/core';

/** Drawn in a 300 x 200 box and scaled to fit. */
const W = 300;
const H = 200;

type Palette = {
  sky: [string, string];
  sun: string;
  far: string;
  mid: string;
  near: string;
  tree: string;
  cloud: string;
  /** Snow caps on the mountains. */
  snow: boolean;
  /** Night: a moon and a few stars instead of a sun. */
  night?: boolean;
};

const PALETTES: readonly Palette[] = [
  {
    sky: ['#7fc4f5', '#e6f5ff'],
    sun: '#fff1a8',
    far: '#9fd4a6',
    mid: '#6fbf73',
    near: '#3f9d57',
    tree: '#2f7d45',
    cloud: '#ffffff',
    snow: false,
  },
  {
    sky: ['#a4d2ff', '#f1f8ff'],
    sun: '#ffffff',
    far: '#d5e4f5',
    mid: '#bcd0ea',
    near: '#f2f8ff',
    tree: '#5b8f8a',
    cloud: '#ffffff',
    snow: true,
  },
  {
    sky: ['#ffc27a', '#fff0cf'],
    sun: '#fff7d6',
    far: '#e9b57d',
    mid: '#d99b5c',
    near: '#c58247',
    tree: '#7c9a3c',
    cloud: '#fff6e6',
    snow: false,
  },
  {
    sky: ['#f58fb0', '#ffd6a5'],
    sun: '#fff2c4',
    far: '#9a78c0',
    mid: '#7352a8',
    near: '#523a8a',
    tree: '#3a2a6a',
    cloud: '#ffe3ef',
    snow: false,
  },
  {
    sky: ['#1b2a5e', '#5d6fc0'],
    sun: '#fdf6d8',
    far: '#34447e',
    mid: '#28376d',
    near: '#1b2658',
    tree: '#14204a',
    cloud: '#7e8fd0',
    snow: false,
    night: true,
  },
  {
    sky: ['#c8a4ff', '#ffdcee'],
    sun: '#fff4b0',
    far: '#ff9ec9',
    mid: '#ffc47e',
    near: '#98e0c4',
    tree: '#5fb89a',
    cloud: '#ffffff',
    snow: false,
  },
  {
    sky: ['#6fd1d8', '#e2fbf4'],
    sun: '#fff9c8',
    far: '#7fcfa0',
    mid: '#4fb98a',
    near: '#2f9a78',
    tree: '#1f7a62',
    cloud: '#ffffff',
    snow: false,
  },
];

/** A small deterministic random stream, so a scene depends only on its level. */
function stream(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);
const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)},${f(cy)}a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(
    r,
  )} 0 1,0 ${f(-2 * r)},0Z`;

/** A smooth rolling ridge across the picture at about `base`, closed down to the bottom edge. */
function ridge(rnd: () => number, base: number, amp: number): string {
  const pts: [number, number][] = [];
  const n = 5;
  for (let i = 0; i <= n; i++)
    pts.push([(W / n) * i, base + (rnd() - 0.5) * 2 * amp]);
  let d = `M0,${H} L${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${f(mx)},${f(y0)} ${f(mx)},${f(y1)} ${f(x1)},${f(y1)}`;
  }
  return d + ` L${W},${H} Z`;
}

type Scene = {
  palette: Palette;
  shapes: { d: string; color: string; opacity?: number }[];
  stars: string[];
};

function sceneFor(level: number): Scene {
  const rnd = stream(levelSeed(level) ^ 0x9e3779b9);
  const palette = PALETTES[Math.floor(rnd() * PALETTES.length)];
  const shapes: Scene['shapes'] = [];

  // Sun or moon.
  shapes.push({
    d: circle(40 + rnd() * 220, 28 + rnd() * 34, 15 + rnd() * 9),
    color: palette.sun,
  });

  // Clouds: three overlapping puffs each.
  for (let i = 0, n = 1 + Math.floor(rnd() * 3); i < n; i++) {
    const cx = 30 + rnd() * 240;
    const cy = 24 + rnd() * 60;
    const r = 9 + rnd() * 7;
    shapes.push({
      d:
        circle(cx - r, cy + 3, r * 0.8) +
        circle(cx, cy, r) +
        circle(cx + r * 1.1, cy + 3, r * 0.75),
      color: palette.cloud,
      opacity: 0.9,
    });
  }

  // Mountains behind the far hills, sometimes with snow caps.
  const peaks = Math.floor(rnd() * 3);
  for (let i = 0; i < peaks; i++) {
    const cx = 40 + rnd() * 220;
    const w = 60 + rnd() * 40;
    const top = 70 + rnd() * 25;
    shapes.push({
      d: `M${f(cx - w)},${H} L${f(cx)},${f(top)} L${f(cx + w)},${H} Z`,
      color: palette.far,
    });
    if (palette.snow)
      shapes.push({
        d: `M${f(cx - w * 0.22)},${f(top + w * 0.3)} L${f(cx)},${f(top)} L${f(
          cx + w * 0.22,
        )},${f(top + w * 0.3)} Q${f(cx)},${f(top + w * 0.2)} ${f(
          cx - w * 0.22,
        )},${f(top + w * 0.3)} Z`,
        color: '#ffffff',
      });
  }

  shapes.push({ d: ridge(rnd, 112, 14), color: palette.far });
  shapes.push({ d: ridge(rnd, 140, 12), color: palette.mid });
  shapes.push({ d: ridge(rnd, 170, 8), color: palette.near });

  // A few trees on the near hills.
  for (let i = 0, n = 2 + Math.floor(rnd() * 5); i < n; i++) {
    const x = 14 + rnd() * 272;
    const y = 150 + rnd() * 36;
    const s = 9 + rnd() * 8;
    shapes.push({
      d: `M${f(x - s * 0.5)},${f(y)} L${f(x)},${f(y - s * 1.8)} L${f(
        x + s * 0.5,
      )},${f(y)} Z`,
      color: palette.tree,
    });
  }

  // A little tower with a flag, like the ones you fight over.
  const tx = 40 + rnd() * 220;
  const ty = 128 + rnd() * 12;
  shapes.push({
    d: `M${f(tx - 7)},${f(ty)} L${f(tx - 7)},${f(ty - 22)} L${f(tx + 7)},${f(
      ty - 22,
    )} L${f(tx + 7)},${f(ty)} Z`,
    color: palette.night ? '#c9d2f5' : '#fff4e3',
  });
  shapes.push({
    d: `M${f(tx - 9)},${f(ty - 22)} L${f(tx - 9)},${f(ty - 27)} L${f(
      tx + 9,
    )},${f(ty - 27)} L${f(tx + 9)},${f(ty - 22)} Z`,
    color: palette.night ? '#9fb0ee' : '#e8d3b6',
  });
  shapes.push({
    d: `M${f(tx)},${f(ty - 27)} L${f(tx)},${f(ty - 40)} L${f(tx + 11)},${f(
      ty - 36,
    )} L${f(tx)},${f(ty - 32)} Z`,
    color: '#ff5d4a',
  });

  const stars: string[] = [];
  if (palette.night)
    for (let i = 0; i < 10; i++)
      stars.push(circle(rnd() * W, rnd() * 80, 1 + rnd() * 1.4));

  return { palette, shapes, stars };
}

type Props = { level: number; width: number; height: number };

export default function LevelScene({ level, width, height }: Props) {
  const scene = useMemo(() => sceneFor(level), [level]);
  const k = Math.max(width / W, height / H);
  // The sky colour sits under the canvas, so a card that is still drawing during a fast scroll is never plain white.
  return (
    <View style={{ width, height, backgroundColor: scene.palette.sky[0] }}>
      <Canvas
        style={{ width, height }}
        accessibilityLabel={`Level ${level} scenery`}
      >
        <Group
          transform={[
            { translateX: (width - W * k) / 2 },
            { translateY: (height - H * k) / 2 },
            { scale: k },
          ]}
        >
          <Path
            path={`M0,0 L${W},0 L${W},${H} L0,${H} Z`}
            color={scene.palette.sky[0]}
          >
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, H)}
              colors={scene.palette.sky}
            />
          </Path>
          {scene.stars.map((d, i) => (
            <Path key={i} path={d} color="#ffffff" opacity={0.85} />
          ))}
          {scene.shapes.map((s, i) => (
            <Path key={i} path={s.d} color={s.color} opacity={s.opacity ?? 1} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

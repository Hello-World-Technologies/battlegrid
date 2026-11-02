// src/ui/HomeLevelMap.tsx
//
// A small picture of a level's battlefield, for the Home card and the level rows: the states in neutral grey, the
// ones that start owned in their owner's colour, with a disc on each start. Every level is one fixed map
// (see levelSeed), so this is exactly the board you will fight on. Display-only and light: it builds the level once
// per number and draws plain paths.

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { BOARD, generateLevel, levelSeed, radius, type World } from '../game/core';
import { useTheme } from '../theme';
import { cellPaths } from './land';

export type LevelPreview = {
  world: World;
  /** How many enemy sides there are. */
  rivals: number;
  /** How many states the board has. */
  states: number;
};

const cache = new Map<number, LevelPreview>();

/** What a level looks like. Built once per level number (a few milliseconds). */
export function levelPreview(level: number): LevelPreview {
  const hit = cache.get(level);
  if (hit) return hit;
  const world = generateLevel(level, levelSeed(level));
  const p: LevelPreview = {
    world,
    rivals: new Set(world.territories.filter(t => t.owner >= 2).map(t => t.owner)).size,
    states: world.territories.length,
  };
  cache.set(level, p);
  return p;
}

/** "1 rival" / "2 rivals". */
export const rivalsLabel = (n: number) => `${n} ${n === 1 ? 'rival' : 'rivals'}`;

/** The one-line summary under a level's name: "9 states · 2 rivals". */
export function levelSubtitle(level: number): string {
  const p = levelPreview(level);
  return `${p.states} states · ${rivalsLabel(p.rivals)}`;
}

const disc = (x: number, y: number, r: number) =>
  `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;

type Props = {
  level: number;
  width: number;
  height: number;
  /** Shrinks the territory discs for thumbnails. */
  dotScale?: number;
  /** Full-bleed art: the board covers the whole box (cropped at the edges) on a transparent background. */
  fill?: boolean;
};

export default function HomeLevelMap({ level, width, height, dotScale = 1, fill = false }: Props) {
  const { theme } = useTheme();
  const { world } = useMemo(() => levelPreview(level), [level]);
  const paths = useMemo(() => (world.land ? cellPaths(world.land) : []), [world]);

  // The board fits the box with a little room around it.
  const bw = BOARD.x1 - BOARD.x0;
  const bh = BOARD.y1 - BOARD.y0;
  const s = fill ? Math.max(width / bw, height / bh) : Math.min(width / bw, height / bh) * 0.94;
  const ox = width / 2 - ((BOARD.x0 + BOARD.x1) / 2) * s;
  const oy = height / 2 - ((BOARD.y0 + BOARD.y1) / 2) * s;

  return (
    <View style={{ width, height, backgroundColor: fill ? 'transparent' : theme.mapWater, overflow: 'hidden' }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ translateX: ox }, { translateY: oy }, { scale: s }]}>
          {paths.map((p, i) => {
            const owner = world.territories[i]?.owner ?? 0;
            return (
              <React.Fragment key={i}>
                <Path path={p} color={owner ? theme.region[owner] : theme.mapLand} />
                <Path path={p} color="#FFFFFF" style="stroke" strokeWidth={1.2} />
              </React.Fragment>
            );
          })}
        </Group>
        {world.territories.map(t => {
          if (t.owner === 0) return null;
          const r = Math.max(2.5, radius(t) * s * 0.55 * dotScale);
          return (
            <React.Fragment key={t.id}>
              <Path path={disc(ox + t.x * s, oy + t.y * s, r)} color={theme.regionDeep[t.owner]} />
              {r > 5 ? <Path path={disc(ox + t.x * s, oy + t.y * s, r * 0.4)} color="#FFFFFF" /> : null}
            </React.Fragment>
          );
        })}
      </Canvas>
    </View>
  );
}

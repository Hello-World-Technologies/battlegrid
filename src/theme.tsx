// src/theme.tsx
//
// The shell palette. Every screen outside the battlefield reads colours from
// useTheme() instead of hard-coding hex values.
//
// The look is the Caveboy-Escape style: a warm cartoon sky behind everything, parchment panels with chunky wood
// edges, wooden-plank buttons (tan, red-brown, olive and slate), dark-brown ink, outlined titles and a wooden tab
// bar. "Hero" panels are dark wood with cream text. The battlefield keeps its own palette in game/theme.ts.
//
// There is a single theme. The shape is still a `Theme` object behind a context so
// the shared UI kit (src/ui) reads it from one place.

import { createContext, useContext } from 'react';

export type Theme = {
  // ── Screen ─────────────────────────────────────────────────────────────
  bg: string;
  /** Tint used for the soft shapes behind hero areas. */
  glow: string;
  scrim: string;
  /** Primary text on the screen background. */
  text: string;
  /** Secondary text on the screen background. */
  dim: string;
  /** Inactive icons and tab labels. */
  muted: string;

  // ── Cards ──────────────────────────────────────────────────────────────
  card: string;
  /** Recessed tile inside a card. */
  cardAlt: string;
  cardEdge: string;
  /** A hairline / pressed underside. */
  cardDeep: string;
  /** Text on cards. */
  ink: string;
  inkSoft: string;
  line: string;

  // ── Chips and soft fills ───────────────────────────────────────────────
  chip: string;
  chipEdge: string;
  chipIcon: string;
  softBlue: string;
  softYellow: string;
  softGreen: string;

  // ── Candy colours: [face, deep] pairs used by buttons and badges ───────
  green: string;
  greenDeep: string;
  blue: string;
  blueDeep: string;
  orange: string;
  orangeDeep: string;
  purple: string;
  purpleDeep: string;
  red: string;
  redDeep: string;
  gold: string;
  goldDeep: string;
  /** Text that sits on candy fills. */
  onCandy: string;
  outline: string;

  // ── Hero panels (dark wood) ────────────────────────────────────────────
  hero: string;
  heroDeep: string;
  heroText: string;
  heroDim: string;

  // ── Map ────────────────────────────────────────────────────────────────
  mapBg: string;
  mapWater: string;
  mapLand: string;
  mapLandEdge: string;
  /** Faction region colours, indexed by owner 0..4 (neutral, you, red, green, purple). */
  region: string[];
  regionDeep: string[];
};

export const THEME: Theme = {
  bg: '#cfe2f0',
  glow: '#e6a64a',
  scrim: 'rgba(48, 24, 6, 0.55)',
  text: '#4a2610',
  dim: '#8a5f3a',
  muted: '#8f6c3f',

  card: '#fff3d9',
  cardAlt: '#f8e2b2',
  cardEdge: '#9a6632',
  cardDeep: '#dcb97a',
  ink: '#5a2e14',
  inkSoft: '#8f6340',
  line: '#e8d0a0',

  chip: '#f6e0ae',
  chipEdge: '#dcb97a',
  chipIcon: '#ffe9ad',
  softBlue: '#fbe9c4',
  softYellow: '#ffe8a8',
  softGreen: '#e6f0c2',

  green: '#9ab53e',
  greenDeep: '#52651a',
  blue: '#3f78b8',
  blueDeep: '#234a7a',
  orange: '#e8892a',
  orangeDeep: '#9a560d',
  purple: '#8a62b0',
  purpleDeep: '#563a78',
  red: '#b8442c',
  redDeep: '#5a1c10',
  gold: '#e6bd72',
  goldDeep: '#8a5a2b',
  onCandy: '#ffffff',
  outline: '#3b1f0d',

  hero: '#a8672f',
  heroDeep: '#5e3416',
  heroText: '#fff3d9',
  heroDim: '#f0cf9c',

  mapBg: '#e4e4e4',
  mapWater: '#dde6f1',
  mapLand: '#a6a6a6',
  mapLandEdge: '#f4f4f4',
  region: ['#a3a3a3', '#7cc8ff', '#f97057', '#8be08b', '#b886ec'],
  regionDeep: ['#7a7a7a', '#1d6fb8', '#8a2413', '#1e7a1e', '#5d2a91'],
};

export const ThemeContext = createContext<{ theme: Theme }>({ theme: THEME });

export const useTheme = () => useContext(ThemeContext);

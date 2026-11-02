// src/ui/color.ts
//
// Tiny colour helpers. Gradients here are built from interpolated bands rather
// than a native gradient library, so these run on plain hex strings.

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export type RGB = { r: number; g: number; b: number };

export const toRgb = (hex: string): RGB => {
  const m = HEX.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export const toHex = ({ r, g, b }: RGB): string =>
  `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')}`;

/** Blend `a` toward `b`; t = 0 is a, t = 1 is b. */
export const mix = (a: string, b: string, t: number): string => {
  const x = toRgb(a);
  const y = toRgb(b);
  const k = Math.max(0, Math.min(1, t));
  return toHex({
    r: x.r + (y.r - x.r) * k,
    g: x.g + (y.g - x.g) * k,
    b: x.b + (y.b - x.b) * k,
  });
};

export const lighten = (hex: string, amount: number): string => mix(hex, '#FFFFFF', amount);
export const darken = (hex: string, amount: number): string => mix(hex, '#000000', amount);

/** `#RRGGBB` + alpha → `rgba(...)`, so opacity never needs a wrapper view. */
export const alpha = (hex: string, a: number): string => {
  const { r, g, b } = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
};

/**
 * Evenly spaced colours along a multi-stop ramp, used to paint gradient bands.
 * `steps` bands cover the whole ramp, first band = first stop.
 */
export const ramp = (stops: string[], steps: number): string[] => {
  if (stops.length === 0) return [];
  if (stops.length === 1) return Array.from({ length: steps }, () => stops[0]);
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const p = steps === 1 ? 0 : (i / (steps - 1)) * (stops.length - 1);
    const idx = Math.min(stops.length - 2, Math.floor(p));
    out.push(mix(stops[idx], stops[idx + 1], p - idx));
  }
  return out;
};

/** How many distinct shades a state can take between its light and deep colour (keeps the paint cache small). */
const SHADE_STEPS = 12;
/** How far toward the deep colour a full tower goes. 1 would be the deep disc colour itself, which hides the disc. */
const SHADE_DEPTH = 0.55;

/**
 * The fill of an owned state: its light colour, deepening toward its dark colour as the garrison fills toward its cap.
 * Quantised to `SHADE_STEPS` shades so the renderer reuses a small set of colours.
 */
export const troopShade = (light: string, deep: string, units: number, cap: number): string => {
  const k = cap > 0 ? Math.max(0, Math.min(1, units / cap)) : 0;
  return mix(light, deep, SHADE_DEPTH * (Math.round(k * SHADE_STEPS) / SHADE_STEPS));
};

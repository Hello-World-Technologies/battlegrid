import { troopShade, toRgb } from '../src/ui/color';

const LIGHT = '#70bceb';
const DEEP = '#2c6a99';
const lum = (hex: string) => {
  const { r, g, b } = toRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

describe('troopShade', () => {
  it('is the plain light colour for an empty garrison', () => {
    expect(troopShade(LIGHT, DEEP, 0, 100)).toBe(LIGHT);
  });

  it('gets darker as the garrison grows, and stops at the cap', () => {
    const shades = [0, 10, 25, 50, 75, 100].map(u => lum(troopShade(LIGHT, DEEP, u, 100)));
    for (let i = 1; i < shades.length; i++) expect(shades[i]).toBeLessThanOrEqual(shades[i - 1]);
    expect(shades[5]).toBeLessThan(shades[0]);
    expect(troopShade(LIGHT, DEEP, 500, 100)).toBe(troopShade(LIGHT, DEEP, 100, 100));
  });

  it('never reaches the deep disc colour, so the tower stays visible on its state', () => {
    expect(troopShade(LIGHT, DEEP, 100, 100)).not.toBe(DEEP);
  });

  it('uses a small set of shades', () => {
    const seen = new Set<string>();
    for (let u = 0; u <= 150; u++) seen.add(troopShade(LIGHT, DEEP, u, 150));
    expect(seen.size).toBeLessThanOrEqual(13);
  });
});

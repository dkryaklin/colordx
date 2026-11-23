import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import harmonies from '../src/plugins/harmonies.js';

beforeAll(() => extend([harmonies]));

const oklch = { space: 'oklch' } as const;
const HEXES = ['#3498db', '#c0ffee', '#123456', '#fedcba', '#ff0000', '#00ff00', '#0000ff', '#8a2be2'];
const raw = (c: ReturnType<typeof colordx>) => c.toOklch(10);
const hueGap = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

describe("lighten / darken with { space: 'oklch' }", () => {
  it('adds the amount to OKLCh lightness and keeps chroma and hue', () => {
    for (const hex of HEXES) {
      const before = raw(colordx(hex));
      const after = raw(colordx(hex).darken(0.1, oklch));
      expect(after.l).toBeCloseTo(before.l - 0.1, 9);
      expect(after.c).toBeCloseTo(before.c, 9);
      expect(hueGap(after.h, before.h)).toBeLessThan(1e-6);
    }
    expect(colordx('#3498db').lighten(0.1, oklch).toOklchString()).toBe('oklch(0.75309 0.1347 242.68667)');
  });

  it('multiplies lightness with relative: true', () => {
    const before = raw(colordx('#3498db'));
    expect(raw(colordx('#3498db').lighten(0.1, { ...oklch, relative: true })).l).toBeCloseTo(before.l * 1.1, 9);
    expect(raw(colordx('#3498db').darken(0.1, { ...oklch, relative: true })).l).toBeCloseTo(before.l * 0.9, 9);
  });

  it('clamps lightness to [0, 1]', () => {
    expect(raw(colordx('#3498db').lighten(5, oklch)).l).toBeCloseTo(1, 9);
    expect(raw(colordx('#3498db').darken(5, oklch)).l).toBeCloseTo(0, 9);
    expect(colordx('#3498db').lighten(5, oklch).mapSrgb().toHex()).toBe('#ffffff');
    expect(colordx('#3498db').darken(5, oklch).mapSrgb().toHex()).toBe('#000000');
  });

  it('defaults to 0.1 and differs from the HSL result', () => {
    expect(colordx('#3498db').lighten(undefined, oklch).toHex()).toBe(colordx('#3498db').lighten(0.1, oklch).toHex());
    expect(colordx('#3498db').lighten(0.1, oklch).toHex()).toBe('#58b8fd');
    expect(colordx('#3498db').lighten(0.1).toHex()).toBe('#5faee3');
  });

  it("leaves the HSL path untouched for { space: 'hsl' } and no space", () => {
    for (const hex of HEXES) {
      expect(colordx(hex).lighten(0.2, { space: 'hsl' }).toHex()).toBe(colordx(hex).lighten(0.2).toHex());
      expect(colordx(hex).saturate(0.2, { space: 'hsl', relative: true }).toHex()).toBe(
        colordx(hex).saturate(0.2, { relative: true }).toHex()
      );
      expect(colordx(hex).rotate(40, { space: 'hsl' }).toHex()).toBe(colordx(hex).rotate(40).toHex());
    }
  });
});

describe("saturate / desaturate with { space: 'oklch' }", () => {
  it('adds amount × 0.4 to chroma, the chroma CSS calls 100%, and keeps lightness and hue', () => {
    for (const hex of HEXES) {
      const before = raw(colordx(hex));
      const after = raw(colordx(hex).saturate(0.1, oklch));
      expect(after.c).toBeCloseTo(before.c + 0.04, 9);
      expect(after.l).toBeCloseTo(before.l, 9);
      expect(hueGap(after.h, before.h)).toBeLessThan(1e-6);
    }
    expect(colordx('#3498db').saturate(1, oklch).toOklchString()).toBe(
      colordx('oklch(0.65309 0.5347 242.68667)').toOklchString()
    );
  });

  it('multiplies chroma with relative: true', () => {
    const before = raw(colordx('#3498db'));
    expect(raw(colordx('#3498db').saturate(0.5, { ...oklch, relative: true })).c).toBeCloseTo(before.c * 1.5, 9);
    expect(raw(colordx('#3498db').desaturate(0.5, { ...oklch, relative: true })).c).toBeCloseTo(before.c * 0.5, 9);
  });

  it('stops at zero chroma', () => {
    expect(raw(colordx('#3498db').desaturate(1, oklch)).c).toBeCloseTo(0, 9);
    expect(raw(colordx('#3498db').desaturate(9, oklch)).c).toBeCloseTo(0, 9);
  });
});

describe("grayscale with { space: 'oklch' }", () => {
  it('drops chroma and keeps OKLCh lightness, unlike the HSL gray', () => {
    for (const hex of HEXES) {
      const gray = colordx(hex).grayscale(oklch);
      expect(raw(gray).c).toBeCloseTo(0, 9);
      expect(raw(gray).l).toBeCloseTo(raw(colordx(hex)).l, 9);
    }
    expect(colordx('#3498db').grayscale(oklch).toHex()).toBe('#909090');
    expect(colordx('#3498db').grayscale().toHex()).toBe('#888888');
  });
});

describe("rotate with { space: 'oklch' }", () => {
  it('shifts the OKLCh hue and keeps lightness and chroma', () => {
    for (const hex of HEXES) {
      const before = raw(colordx(hex));
      for (const deg of [30, 120, -90, 400]) {
        const after = raw(colordx(hex).rotate(deg, oklch));
        expect(after.l).toBeCloseTo(before.l, 9);
        expect(after.c).toBeCloseTo(before.c, 9);
        expect(hueGap(after.h, before.h + deg)).toBeLessThan(1e-6);
      }
    }
  });

  it('returns the same instance for a whole turn and leaves a gray gray', () => {
    const c = colordx('#3498db');
    expect(c.rotate(360, oklch)).toBe(c);
    expect(c.rotate(0, oklch)).toBe(c);
    expect(colordx('#808080').rotate(90, oklch).toHex()).toBe('#808080');
  });

  it('keeps a wide-gamut color wide-gamut', () => {
    expect(colordx('oklch(0.7 0.3 150)').rotate(30, oklch).toOklchString()).toBe('oklch(0.7 0.3 180)');
  });
});

describe("harmonies with { space: 'oklch' }", () => {
  it('rotates in OKLCh, so every member has the lightness and chroma of the base', () => {
    const base = raw(colordx('#ff0000'));
    const triad = colordx('#ff0000').harmonies('triadic', oklch);
    expect(triad).toHaveLength(3);
    triad.forEach((c, i) => {
      expect(raw(c).l).toBeCloseTo(base.l, 9);
      expect(raw(c).c).toBeCloseTo(base.c, 9);
      expect(hueGap(raw(c).h, base.h + i * 120)).toBeLessThan(1e-6);
    });
    expect(triad.map((c) => c.mapSrgb().toHex())).toEqual(['#ff0000', '#00a836', '#5577ff']);
  });

  it('stays HSL by default', () => {
    expect(colordx('#ff0000').harmonies('triadic').map((c) => c.toHex())).toEqual(['#ff0000', '#00ff00', '#0000ff']);
  });
});

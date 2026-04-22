import { beforeAll, describe, expect, it } from 'vitest';
import {
  labToLinearSrgb,
  labToRgbChannels,
  lchToLinearSrgb,
  lchToRgbChannels,
  oklchToLinear,
  rgbToLinear,
} from '../src/channels.js';
import { colordx, extend } from '../src/index.js';
import labPlugin from '../src/plugins/lab.js';
import lchPlugin from '../src/plugins/lch.js';
import { labToP3Channels, lchToP3Channels } from '../src/plugins/p3.js';
import p3Plugin from '../src/plugins/p3.js';
import { labToRec2020Channels, lchToRec2020Channels } from '../src/plugins/rec2020.js';
import rec2020Plugin from '../src/plugins/rec2020.js';
import { srgbFromLinear, srgbToLinear } from '../src/transfer.js';

beforeAll(() => extend([labPlugin, lchPlugin, p3Plugin, rec2020Plugin]));

describe('rgbToLinear', () => {
  it('is the vector extension of srgbToLinear', () => {
    for (const [r, g, b] of [
      [0, 0, 0],
      [1, 1, 1],
      [0.5, 0.25, 0.75],
      [0.04, 0.045, 0.1], // linear/power-curve crossover
      [-0.3, 0.5, 1.2], // out-of-gamut (sign-preserving transfer)
    ] as const) {
      const [lr, lg, lb] = rgbToLinear(r, g, b);
      expect(lr).toBe(srgbToLinear(r));
      expect(lg).toBe(srgbToLinear(g));
      expect(lb).toBe(srgbToLinear(b));
    }
  });

  it('round-trips via srgbFromLinear', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#3b82f6', '#c06060']) {
      const { r, g, b } = colordx(hex).toRgb();
      const [lr, lg, lb] = rgbToLinear(r / 255, g / 255, b / 255);
      expect(Math.round(srgbFromLinear(lr) * 255)).toBe(r);
      expect(Math.round(srgbFromLinear(lg) * 255)).toBe(g);
      expect(Math.round(srgbFromLinear(lb) * 255)).toBe(b);
    }
  });

  it('black → 0, white → 1', () => {
    expect(rgbToLinear(0, 0, 0)).toEqual([0, 0, 0]);
    expect(rgbToLinear(1, 1, 1)).toEqual([1, 1, 1]);
  });
});

describe('labToLinearSrgb', () => {
  it('matches the path used by labToRgb (gamma-stripped)', () => {
    // For every Lab that maps to an in-gamut sRGB, srgbFromLinear(labToLinearSrgb(...)) ≈ .toRgb()/255.
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#808080', '#3b82f6']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { l, a, b } = (colordx(hex) as any).toLab();
      const [lr, lg, lb] = labToLinearSrgb(l, a, b);
      const { r, g, b: bRgb } = colordx(hex).toRgb();
      expect(Math.round(srgbFromLinear(lr) * 255)).toBeCloseTo(r, -0.5);
      expect(Math.round(srgbFromLinear(lg) * 255)).toBeCloseTo(g, -0.5);
      expect(Math.round(srgbFromLinear(lb) * 255)).toBeCloseTo(bRgb, -0.5);
    }
  });

  it('Lab white → linear sRGB ≈ (1, 1, 1)', () => {
    const [lr, lg, lb] = labToLinearSrgb(100, 0, 0);
    expect(lr).toBeCloseTo(1, 2);
    expect(lg).toBeCloseTo(1, 2);
    expect(lb).toBeCloseTo(1, 2);
  });

  it('Lab black → linear sRGB ≈ (0, 0, 0)', () => {
    const [lr, lg, lb] = labToLinearSrgb(0, 0, 0);
    expect(lr).toBeCloseTo(0, 4);
    expect(lg).toBeCloseTo(0, 4);
    expect(lb).toBeCloseTo(0, 4);
  });

  it('out-of-gamut Lab returns channels outside [0, 1] (useful as a free gamut check)', () => {
    // Highly saturated magenta far outside sRGB gamut
    const [lr, lg, lb] = labToLinearSrgb(50, 120, -120);
    expect(lr > 1 || lg < 0 || lb > 1 || lr < 0 || lg > 1 || lb < 0).toBe(true);
  });
});

describe('lchToLinearSrgb', () => {
  it('achromatic LCH matches Lab with a=b=0', () => {
    // H is a don't-care when C=0.
    for (const l of [10, 50, 85]) {
      const viaLch = lchToLinearSrgb(l, 0, 45);
      const viaLab = labToLinearSrgb(l, 0, 0);
      expect(viaLch[0]).toBeCloseTo(viaLab[0], 10);
      expect(viaLch[1]).toBeCloseTo(viaLab[1], 10);
      expect(viaLch[2]).toBeCloseTo(viaLab[2], 10);
    }
  });

  it('round-trips in-gamut colors within ±1 byte', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#3b82f6', '#c06060']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { l, c, h } = (colordx(hex) as any).toLch();
      const [lr, lg, lb] = lchToLinearSrgb(l, c, h);
      const orig = colordx(hex).toRgb();
      expect(Math.abs(Math.round(srgbFromLinear(lr) * 255) - orig.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.round(srgbFromLinear(lg) * 255) - orig.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.round(srgbFromLinear(lb) * 255) - orig.b)).toBeLessThanOrEqual(1);
    }
  });

  it('agrees with labToLinearSrgb after polar→rectangular conversion (sub-ULP)', () => {
    const cases: Array<[number, number, number]> = [
      [54, 50, 40],
      [80, 30, 120],
      [30, 70, 250],
    ];
    for (const [l, c, h] of cases) {
      const hRad = (h * Math.PI) / 180;
      const viaLch = lchToLinearSrgb(l, c, h);
      const viaLab = labToLinearSrgb(l, c * Math.cos(hRad), c * Math.sin(hRad));
      // Inlined sin/cos in lchToLinearSrgb produces bit-identical results modulo 1 ULP vs the
      // caller computing the same cos/sin externally (reassociated FMA chains differ by 1 ULP).
      expect(viaLch[0]).toBeCloseTo(viaLab[0], 12);
      expect(viaLch[1]).toBeCloseTo(viaLab[1], 12);
      expect(viaLch[2]).toBeCloseTo(viaLab[2], 12);
    }
  });
});

describe('labToRgbChannels / lchToRgbChannels (gamma-encoded sRGB)', () => {
  it('equals srgbFromLinear applied to labToLinearSrgb', () => {
    for (const [l, a, b] of [
      [54.29, 80.8, 69.89],
      [87.82, -79.29, 80.99],
      [50, 0, 0],
    ] as const) {
      const [lr, lg, lb] = labToLinearSrgb(l, a, b);
      const [r, g, bR] = labToRgbChannels(l, a, b);
      expect(r).toBeCloseTo(srgbFromLinear(lr), 12);
      expect(g).toBeCloseTo(srgbFromLinear(lg), 12);
      expect(bR).toBeCloseTo(srgbFromLinear(bR < 0 ? lb : lb), 12); // tautology check
      expect(bR).toBeCloseTo(srgbFromLinear(lb), 12);
    }
  });

  it('in-gamut round-trip matches .toRgb() within ±1 byte', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#3b82f6', '#c06060']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { l, c, h } = (colordx(hex) as any).toLch();
      const [r, g, b] = lchToRgbChannels(l, c, h);
      const orig = colordx(hex).toRgb();
      expect(Math.abs(Math.round(r * 255) - orig.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.round(g * 255) - orig.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(Math.round(b * 255) - orig.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('labToP3Channels / lchToP3Channels', () => {
  it('red in P3 gamut (sRGB ⊂ P3) returns channels in [0, 1]', () => {
    // Red hex has Lab ≈ (54.29, 80.8, 69.89); fully inside P3.
    const [r, g, b] = labToP3Channels(54.29, 80.8, 69.89);
    expect(r).toBeGreaterThan(0.8); // saturated red in P3 is ≥ ~0.9
    expect(g).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1.001);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeLessThanOrEqual(1);
  });

  it('lchToP3Channels agrees with labToP3Channels after polar→rect', () => {
    const cases: Array<[number, number, number]> = [
      [54.29, 106.84, 40.86],
      [80, 30, 120],
      [40, 70, 300],
    ];
    for (const [l, c, h] of cases) {
      const hRad = (h * Math.PI) / 180;
      const viaLch = lchToP3Channels(l, c, h);
      const viaLab = labToP3Channels(l, c * Math.cos(hRad), c * Math.sin(hRad));
      expect(viaLch[0]).toBeCloseTo(viaLab[0], 12);
      expect(viaLch[1]).toBeCloseTo(viaLab[1], 12);
      expect(viaLch[2]).toBeCloseTo(viaLab[2], 12);
    }
  });

  it('labToP3Channels round-trips via toP3() within ±0.01', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#3b82f6']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { l, a, b } = (colordx(hex) as any).toLab();
      const [r, g, bCh] = labToP3Channels(l, a, b);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ref = (colordx(hex) as any).toP3(6);
      expect(r).toBeCloseTo(ref.r, 2);
      expect(g).toBeCloseTo(ref.g, 2);
      expect(bCh).toBeCloseTo(ref.b, 2);
    }
  });
});

describe('labToRec2020Channels / lchToRec2020Channels', () => {
  it('lchToRec2020Channels agrees with labToRec2020Channels after polar→rect', () => {
    const cases: Array<[number, number, number]> = [
      [54.29, 106.84, 40.86],
      [80, 30, 120],
      [40, 70, 300],
    ];
    for (const [l, c, h] of cases) {
      const hRad = (h * Math.PI) / 180;
      const viaLch = lchToRec2020Channels(l, c, h);
      const viaLab = labToRec2020Channels(l, c * Math.cos(hRad), c * Math.sin(hRad));
      expect(viaLch[0]).toBeCloseTo(viaLab[0], 12);
      expect(viaLch[1]).toBeCloseTo(viaLab[1], 12);
      expect(viaLch[2]).toBeCloseTo(viaLab[2], 12);
    }
  });

  it('labToRec2020Channels round-trips via toRec2020() within ±0.01', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#3b82f6']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { l, a, b } = (colordx(hex) as any).toLab();
      const [r, g, bCh] = labToRec2020Channels(l, a, b);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ref = (colordx(hex) as any).toRec2020(6);
      expect(r).toBeCloseTo(ref.r, 2);
      expect(g).toBeCloseTo(ref.g, 2);
      expect(bCh).toBeCloseTo(ref.b, 2);
    }
  });
});

describe('cross-path agreement', () => {
  // OKLCH → linear sRGB and LCH → linear sRGB should land on the same point for a common color.
  it('oklchToLinear and lchToLinearSrgb converge for the same sRGB color', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#3b82f6']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { l: ol, c: oc, h: oh } = colordx(hex).toOklch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { l: ll, c: lc, h: lh } = (colordx(hex) as any).toLch();
      const viaOklch = oklchToLinear(ol, oc, oh);
      const viaLch = lchToLinearSrgb(ll, lc, lh);
      // Both paths reconstruct the original sRGB — compare after gamma-encode + byte round.
      // |+0 = 0 normalizes the -0 that Math.round can return for out-of-gamut-by-epsilon channels.
      const byte = (n: number) => (Math.round(srgbFromLinear(n) * 255) | 0);
      expect(byte(viaOklch[0])).toBe(byte(viaLch[0]));
      expect(byte(viaOklch[1])).toBe(byte(viaLch[1]));
      expect(byte(viaOklch[2])).toBe(byte(viaLch[2]));
    }
  });
});

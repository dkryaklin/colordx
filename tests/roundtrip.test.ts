import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hslToRgb, rgbToHsl } from '../src/colorModels/hsl.js';
import { hsvToRgb, rgbToHsv } from '../src/colorModels/hsv.js';
import { hwbToRgb, rgbToHwb } from '../src/colorModels/hwb.js';
import { labToRgb, rgbToLab } from '../src/colorModels/lab.js';
import { lchToRgb, rgbToLch } from '../src/colorModels/lch.js';
import { linearSrgbToOklab, oklabToLinear, oklabToRgb, rgbToOklab } from '../src/colorModels/oklab.js';
import { oklchToRgb, rgbToOklch } from '../src/colorModels/oklch.js';
import { p3ToRgb, rgbToP3 } from '../src/colorModels/p3.js';
import { rec2020ToRgb, rgbToRec2020 } from '../src/colorModels/rec2020.js';
import { rgbToXyz, xyzToRgb } from '../src/colorModels/xyz.js';
import { colordx } from '../src/index.js';

const N = 2000;

const randomRgb = () => ({
  r: Math.round(Math.random() * 255),
  g: Math.round(Math.random() * 255),
  b: Math.round(Math.random() * 255),
  alpha: Math.round(Math.random() * 1000) / 1000,
});

const edgeRgb = [
  { r: 0,   g: 0,   b: 0,   alpha: 1 },    // black
  { r: 255, g: 255, b: 255, alpha: 1 },     // white
  { r: 255, g: 0,   b: 0,   alpha: 1 },     // pure red
  { r: 0,   g: 255, b: 0,   alpha: 1 },     // pure green
  { r: 0,   g: 0,   b: 255, alpha: 1 },     // pure blue
  { r: 128, g: 128, b: 128, alpha: 1 },     // mid grey
  { r: 0,   g: 0,   b: 0,   alpha: 0 },     // transparent
  { r: 255, g: 255, b: 255, alpha: 0.5 },   // semi-transparent white
];

const randomCases = Array.from({ length: N }, randomRgb);

const check = (back: { r: number; g: number; b: number; alpha: number }, orig: { r: number; g: number; b: number; alpha: number }) => {
  expect(back.r).toBeCloseTo(orig.r, 0);
  expect(back.g).toBeCloseTo(orig.g, 0);
  expect(back.b).toBeCloseTo(orig.b, 0);
  expect(back.alpha).toBeCloseTo(orig.alpha, 2);
};

const spaces = [
  ['hsl',     (c: typeof edgeRgb[0]) => hslToRgb(rgbToHsl(c))],
  ['hsv',     (c: typeof edgeRgb[0]) => hsvToRgb(rgbToHsv(c))],
  ['hwb',     (c: typeof edgeRgb[0]) => hwbToRgb(rgbToHwb(c))],
  ['oklab',   (c: typeof edgeRgb[0]) => oklabToRgb(rgbToOklab(c))],
  ['oklch',   (c: typeof edgeRgb[0]) => oklchToRgb(rgbToOklch(c))],
  ['lab',     (c: typeof edgeRgb[0]) => labToRgb(rgbToLab(c))],
  ['lch',     (c: typeof edgeRgb[0]) => lchToRgb(rgbToLch(c))],
  ['xyz',     (c: typeof edgeRgb[0]) => xyzToRgb(rgbToXyz(c))],
  ['p3',      (c: typeof edgeRgb[0]) => p3ToRgb(rgbToP3(c))],
  ['rec2020', (c: typeof edgeRgb[0]) => rec2020ToRgb(rgbToRec2020(c))],
] as const;

const arbRgb = fc.record({
  r: fc.integer({ min: 0, max: 255 }),
  g: fc.integer({ min: 0, max: 255 }),
  b: fc.integer({ min: 0, max: 255 }),
  alpha: fc.float({ min: 0, max: 1, noNaN: true }),
});

describe('round-trip: rgb → X → rgb (random)', () => {
  for (const [name, fn] of spaces) {
    it(name, () => { for (const c of randomCases) check(fn(c), c); });
  }
});

describe('round-trip: rgb → X → rgb (edge cases)', () => {
  for (const [name, fn] of spaces) {
    it(name, () => { for (const c of edgeRgb) check(fn(c), c); });
  }
});

describe('round-trip: rgb → X → rgb (property-based)', () => {
  for (const [name, fn] of spaces) {
    it(name, () => {
      fc.assert(fc.property(arbRgb, (rgb) => {
        const back = fn(rgb);
        return (
          Math.abs(back.r - rgb.r) < 1 &&
          Math.abs(back.g - rgb.g) < 1 &&
          Math.abs(back.b - rgb.b) < 1 &&
          Math.abs(back.alpha - rgb.alpha) < 0.01
        );
      }));
    });
  }
});

// The OKLab matrices are float64 inverses of each other, so an oklch() string prints back
// unchanged — Ottosson's 10-digit published values drifted the last digit on about a third of them.
describe('round-trip: OKLab ↔ linear sRGB is exact', () => {
  it('oklch() strings print back unchanged, and raw values stay within float error', () => {
    for (const s of ['oklch(0.2358 0.00869 44.04325)', 'oklch(0.07933 0.34911 268.37297)', 'oklch(0.7 0.3 150)']) {
      expect(colordx(s).toOklchString()).toBe(s);
    }
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99999 }),
        fc.integer({ min: 1, max: 40000 }),
        fc.integer({ min: 0, max: 35999999 }),
        (l, c, h) => {
          // The stored color is gamma-encoded RGB. Far out of gamut, one LMS component can land near 0,
          // where the cube root magnifies float error (oklch(0.16823 0.38975 225.53749) is one), so the
          // worst case over 2M random samples and a fine grid is 5e-6 in L and C and 8e-4° in hue.
          // The bounds are ten times that; the old 10-digit matrices drifted by up to 1.6e-4.
          const { l: L, c: C, h: H } = colordx(`oklch(${l / 1e5} ${c / 1e5} ${h / 1e5})`).toOklch(12);
          expect(Math.abs(L - l / 1e5)).toBeLessThan(5e-5);
          expect(Math.abs(C - c / 1e5)).toBeLessThan(5e-5);
          if (c >= 1000) expect(Math.abs(((H - h / 1e5 + 540) % 360) - 180)).toBeLessThan(1e-2);
        }
      ),
      { numRuns: 2000 }
    );
  });

  it('white is exactly L = 1, a = b = 0 up to float noise', () => {
    const [l, a, b] = linearSrgbToOklab(1, 1, 1);
    expect(l).toBeCloseTo(1, 15);
    expect(a).toBeCloseTo(0, 15);
    expect(b).toBeCloseTo(0, 15);
    for (const v of oklabToLinear(0.5, 0.1, -0.1)) expect(Number.isFinite(v)).toBe(true);
  });
});

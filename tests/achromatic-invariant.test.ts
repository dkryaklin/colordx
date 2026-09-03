/**
 * Achromatic in ⇒ achromatic out, for every producer and manipulator.
 *
 * Two regressions of the same shape slipped past producer-specific tests: OKLab greys reading
 * back with a hue, then hsl(316, 63%, 100%) reading back as hsl(120 100% 100%) because hslToRgb
 * left 254.99999999999997 on two channels. Matrix-based producers (Lab, LCH, mixOklab, display-p3
 * …) can never be bit-exact, so rgbToHsl/rgbToHsv treat a spread ≤ ACHROMATIC_EPS as grey.
 * `exact` producers must additionally leave r === g === b in the raw channels.
 */
import { describe, expect, it } from 'vitest';
import { rgbToHslRaw } from '../src/colorModels/hsl.js';
import { ACHROMATIC_EPS } from '../src/helpers.js';
import { Colordx, colordx, extend } from '../src/index.js';
import a98 from '../src/plugins/a98rgb.js';
import cmyk from '../src/plugins/cmyk.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import mix from '../src/plugins/mix.js';
import p3 from '../src/plugins/p3.js';
import prophoto from '../src/plugins/prophoto.js';
import rec2020 from '../src/plugins/rec2020.js';
import srgbLinear from '../src/plugins/srgb-linear.js';

extend([a98, cmyk, hsv, hwb, lab, lch, mix, p3, prophoto, rec2020, srgbLinear]);

const F = [0, 0.05, 0.25, 0.5, 0.75, 0.95, 1]; // lightness / grey level, 0–1
const H = [0, 37, 120, 200, 316, 359.9]; // hue that must be ignored
const S = [0, 30, 63, 100]; // saturation that must be ignored at l=0 / l=100

type Make = (f: number, h: number, s: number) => Colordx;
const cases: [name: string, make: Make, exact: boolean][] = [
  ['hsl object, l=0', (_f, h, s) => colordx({ h, s, l: 0 }), true],
  ['hsl object, l=100', (_f, h, s) => colordx({ h, s, l: 100 }), true],
  ['hsl object, s=0', (f, h) => colordx({ h, s: 0, l: f * 100 }), true],
  ['hsl string, legacy, l=100', (_f, h, s) => colordx(`hsl(${h}, ${s}%, 100%)`), true],
  ['hsl string, modern, s=0', (f, h) => colordx(`hsl(${h} 0% ${f * 100}%)`), true],
  ['hsv object, v=0', (_f, h, s) => colordx({ h, s, v: 0 }), true],
  ['hsv object, s=0', (f, h) => colordx({ h, s: 0, v: f * 100 }), true],
  ['hwb, w+b=100', (f, h) => colordx({ h, w: f * 100, b: 100 - f * 100 }), true],
  ['hwb, w+b>100', (_f, h, s) => colordx({ h, w: 50 + s, b: 50 + s }), true],
  ['device-cmyk string', (f) => colordx(`device-cmyk(0 0 0 ${f})`), true],
  ['oklab object', (f) => colordx({ l: f, a: 0, b: 0 }), true],
  ['oklch object', (f, h) => colordx({ l: f, c: 0, h }), true],
  ['oklch string, none hue', (f) => colordx(`oklch(${f} 0 none)`), true],
  ['toGamutSrgb of oklch c=0', (f, h) => Colordx.toGamutSrgb(`oklch(${f} 0 ${h})`), true],
  ['lab string', (f) => colordx(`lab(${f * 100} 0 0)`), false],
  ['lch string', (f, h) => colordx(`lch(${f * 100} 0 ${h})`), false],
  ['display-p3 string', (f) => colordx(`color(display-p3 ${f} ${f} ${f})`), false],
  ['rec2020 string', (f) => colordx(`color(rec2020 ${f} ${f} ${f})`), false],
  ['a98-rgb string', (f) => colordx(`color(a98-rgb ${f} ${f} ${f})`), false],
  ['prophoto-rgb string', (f) => colordx(`color(prophoto-rgb ${f} ${f} ${f})`), false],
  ['srgb-linear string', (f) => colordx(`color(srgb-linear ${f} ${f} ${f})`), true],
  ['grayscale()', (f, h, s) => colordx({ h, s, l: f * 100 }).grayscale(), true],
  ['desaturate(1)', (f, h, s) => colordx({ h, s, l: f * 100 }).desaturate(1), true],
  ['lighten(1)', (f, h, s) => colordx({ h, s, l: f * 100 }).lighten(1), true],
  ['darken(1)', (f, h, s) => colordx({ h, s, l: f * 100 }).darken(1), true],
  ['invert() of grey', (f) => colordx({ h: 0, s: 0, l: f * 100 }).invert(), true],
  ['mix() of greys', (f) => colordx('#000').mix('#fff', f), true],
  ['mixOklab() of greys', (f) => colordx('#000').mixOklab('#fff', f), false],
  ['mixLab() of greys', (f) => colordx('#000').mixLab('#fff', f), false],
];

describe('achromatic input reads back achromatic', () => {
  for (const [name, make, exact] of cases) {
    it(name, () => {
      for (const f of F) {
        for (const h of H) {
          for (const s of S) {
            const c = make(f, h, s);
            const label = `${name} f=${f} h=${h} s=${s} → ${c.toHslString()}`;
            const { r, g, b } = c._rawRgb();
            if (exact) expect([r, g, b], label).toEqual([r, r, r]);
            else expect(Math.max(r, g, b) - Math.min(r, g, b), label).toBeLessThanOrEqual(255 * ACHROMATIC_EPS);
            const hsl = c.toHsl();
            expect([hsl.h, hsl.s], label).toEqual([0, 0]);
            const hsvc = c.toHsv();
            expect([hsvc.h, hsvc.s], label).toEqual([0, 0]);
            expect(c.toHwb().h, label).toBe(0);
            expect(c.hue(), label).toBe(0);
          }
        }
      }
    });
  }

  it('the threshold does not touch representable colours: a 16-bit step of blue is still chromatic', () => {
    // hsl(240, 0.002%, 50%) → spread 2e-5 on the 0–1 scale, about 1.3 steps of 16-bit (1/65535)
    const c = colordx({ h: 240, s: 0.002, l: 50 });
    const { r, g, b } = c._rawRgb();
    expect((Math.max(r, g, b) - Math.min(r, g, b)) / 255).toBeGreaterThan(1 / 65535);
    expect(1 / 65535).toBeGreaterThan(ACHROMATIC_EPS * 10);
    expect(c.toHsl().h).toBe(240);
    expect(rgbToHslRaw(c._rawRgb()).s).toBeGreaterThan(0); // toHsl() rounds s to 2 decimals, so read the raw value
  });
});

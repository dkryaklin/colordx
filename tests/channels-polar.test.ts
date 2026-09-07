import { describe, expect, it } from 'vitest';
import { hslToRgb, rgbToHslRaw } from '../src/colorModels/hsl.js';
import { hsvToRgb, rgbToHsvRaw } from '../src/colorModels/hsv.js';
import { ACHROMATIC_EPS } from '../src/helpers.js';
import {
  colordx,
  extend,
  hslToRgbChannels,
  hslToRgbChannelsInto,
  rgbToHslChannels,
  rgbToHslChannelsInto,
} from '../src/index.js';
import hsv, {
  hsvToRgbChannels,
  hsvToRgbChannelsInto,
  rgbToHsvChannels,
  rgbToHsvChannelsInto,
} from '../src/plugins/hsv.js';

extend([hsv]);

// The polar channel functions duplicate the math of the object converters on purpose: routing the
// object path through a `*Into` call costs a Float64Array hop (~2 ns, 14% on lighten()) and lets the
// library's own array pollute the *Into function's type feedback, which measured 8× slower on a
// user's render loop. This file is what keeps the two bodies from drifting: every comparison against
// the object API is bit-exact (`toBe`), not approximate.

let seed = 0x9e3779b9;
const rand = () => {
  seed = (seed ^ (seed << 13)) >>> 0;
  seed = (seed ^ (seed >>> 17)) >>> 0;
  seed = (seed ^ (seed << 5)) >>> 0;
  return seed / 0xffffffff;
};

// Byte-scale sweep: every 8-bit sector boundary (0, 255) plus a coarse interior grid, then random
// fractional channels (what lighten()/mix() store) so the parity is not limited to integer input.
const rgbSamples = (): Array<[number, number, number]> => {
  const out: Array<[number, number, number]> = [];
  const grid = [0, 1, 51, 102, 127, 128, 153, 204, 254, 255];
  for (const r of grid) for (const g of grid) for (const b of grid) out.push([r, g, b]);
  for (let i = 0; i < 2000; i++) out.push([rand() * 255, rand() * 255, rand() * 255]);
  for (let i = 0; i < 200; i++) {
    const v = rand() * 255;
    out.push([v, v, v], [v, v, v + rand() * 1e-4]); // greys and near-greys straddling ACHROMATIC_EPS
  }
  return out;
};

const polarSamples = (): Array<[number, number, number]> => {
  const out: Array<[number, number, number]> = [];
  for (let h = 0; h < 360; h += 7.5)
    for (const s of [0, 25, 50, 100]) for (const x of [0, 10, 50, 90, 100]) out.push([h, s, x]);
  for (let i = 0; i < 2000; i++) out.push([rand() * 360, rand() * 100, rand() * 100]);
  return out;
};

describe('rgbToHslChannels / rgbToHsvChannels — values', () => {
  it('reports the CSS Color 4 scale: h in degrees, s and l/v in 0–100', () => {
    expect(rgbToHslChannels(1, 0, 0)).toEqual([0, 100, 50]);
    expect(rgbToHslChannels(0, 1, 0)).toEqual([120, 100, 50]);
    expect(rgbToHslChannels(0, 0, 1)).toEqual([240, 100, 50]);
    expect(rgbToHslChannels(1, 1, 0)).toEqual([60, 100, 50]);
    expect(rgbToHsvChannels(1, 0, 0)).toEqual([0, 100, 100]);
    expect(rgbToHsvChannels(0, 1, 0)).toEqual([120, 100, 100]);
    expect(rgbToHsvChannels(0, 0, 1)).toEqual([240, 100, 100]);
    expect(rgbToHsvChannels(0, 1, 1)).toEqual([180, 100, 100]);
  });

  it('greys are achromatic: h = 0, s = 0, with l / v carrying the level', () => {
    expect(rgbToHslChannels(0, 0, 0)).toEqual([0, 0, 0]);
    expect(rgbToHslChannels(1, 1, 1)).toEqual([0, 0, 100]);
    expect(rgbToHslChannels(0.5, 0.5, 0.5)).toEqual([0, 0, 50]);
    expect(rgbToHsvChannels(0, 0, 0)).toEqual([0, 0, 0]);
    expect(rgbToHsvChannels(1, 1, 1)).toEqual([0, 0, 100]);
    expect(rgbToHsvChannels(0.5, 0.5, 0.5)).toEqual([0, 0, 50]);
  });

  it('uses ACHROMATIC_EPS as the grey threshold, like toHsl() / toHsv()', () => {
    const below = 0.5 + ACHROMATIC_EPS / 2;
    const above = 0.5 + ACHROMATIC_EPS * 2;
    expect(rgbToHslChannels(0.5, 0.5, below).slice(0, 2)).toEqual([0, 0]);
    expect(rgbToHsvChannels(0.5, 0.5, below).slice(0, 2)).toEqual([0, 0]);
    expect(rgbToHslChannels(0.5, 0.5, above)[1]).toBeGreaterThan(0);
    expect(rgbToHsvChannels(0.5, 0.5, above)[1]).toBeGreaterThan(0);
    expect(rgbToHslChannels(0.5, 0.5, above)[0]).toBe(240);
  });

  it('never reports h = 360, even when the sector math lands on it exactly', () => {
    // g a hair below b with max = r: (g - b) / d + 6 rounds to 6 → h * 360 = 360 before the wrap.
    expect(rgbToHslChannels(1, 0, 1e-17)[0]).toBe(0);
    expect(rgbToHsvChannels(1, 0, 1e-17)[0]).toBe(0);
    for (const [r, g, b] of rgbSamples()) {
      const hl = rgbToHslChannels(r / 255, g / 255, b / 255)[0];
      const hv = rgbToHsvChannels(r / 255, g / 255, b / 255)[0];
      expect(hl).toBeGreaterThanOrEqual(0);
      expect(hl).toBeLessThan(360);
      expect(hv).toBeGreaterThanOrEqual(0);
      expect(hv).toBeLessThan(360);
    }
  });

  it('does not clip: out-of-cube input is reported as-is (callers clip wide-gamut colors first)', () => {
    // v above 100 and s beyond the cube — the same "unclamped channels" contract as the other
    // channel functions, so a gamut check can still be made on the result.
    expect(rgbToHsvChannels(1.2, 0, 0)[2]).toBeCloseTo(120, 12);
    expect(rgbToHslChannels(1.2, 0, 0)[2]).toBeCloseTo(60, 12);
  });
});

describe('hslToRgbChannels / hsvToRgbChannels — values', () => {
  it('maps the primaries and greys', () => {
    expect(hslToRgbChannels(0, 100, 50)).toEqual([1, 0, 0]);
    expect(hslToRgbChannels(120, 100, 50)).toEqual([0, 1, 0]);
    expect(hslToRgbChannels(240, 100, 50)).toEqual([0, 0, 1]);
    expect(hslToRgbChannels(0, 0, 100)).toEqual([1, 1, 1]); // l = 100 is exactly white (q must not round to 0.999…)
    expect(hslToRgbChannels(0, 0, 0)).toEqual([0, 0, 0]);
    expect(hslToRgbChannels(123, 0, 50)).toEqual([0.5, 0.5, 0.5]);
    expect(hsvToRgbChannels(0, 100, 100)).toEqual([1, 0, 0]);
    expect(hsvToRgbChannels(120, 100, 100)).toEqual([0, 1, 0]);
    expect(hsvToRgbChannels(240, 100, 100)).toEqual([0, 0, 1]);
    expect(hsvToRgbChannels(0, 0, 100)).toEqual([1, 1, 1]);
    expect(hsvToRgbChannels(123, 0, 50)).toEqual([0.5, 0.5, 0.5]);
  });

  it('wraps any hue into [0, 360) — negative, ≥ 360, and multiples of 360 — bit-exactly', () => {
    expect(hslToRgbChannels(-30, 50, 50)).toEqual(hslToRgbChannels(330, 50, 50));
    expect(hslToRgbChannels(390, 50, 50)).toEqual(hslToRgbChannels(30, 50, 50));
    expect(hslToRgbChannels(720, 100, 50)).toEqual([1, 0, 0]);
    expect(hslToRgbChannels(360, 100, 50)).toEqual([1, 0, 0]);
    expect(hsvToRgbChannels(-30, 50, 50)).toEqual(hsvToRgbChannels(330, 50, 50));
    expect(hsvToRgbChannels(390, 50, 50)).toEqual(hsvToRgbChannels(30, 50, 50));
    expect(hsvToRgbChannels(720, 100, 100)).toEqual([1, 0, 0]);
    expect(hsvToRgbChannels(360, 100, 100)).toEqual([1, 0, 0]);
    // A hue gradient stepping across 360 must not stutter at the seam.
    const before = hsvToRgbChannels(359.5, 100, 100);
    const after = hsvToRgbChannels(360.5, 100, 100);
    expect(Math.abs(before[1] - after[1])).toBeLessThan(0.01);
    expect(Math.abs(before[2] - after[2])).toBeLessThan(0.01);
  });

  it('hits every one of the six HSV sectors', () => {
    const seen = new Set<string>();
    for (let h = 0; h < 360; h += 30)
      seen.add(
        hsvToRgbChannels(h + 15, 100, 100)
          .map((c) => c.toFixed(1))
          .join(',')
      );
    expect(seen.size).toBe(12);
    expect(hsvToRgbChannels(30, 100, 100)).toEqual([1, 0.5, 0]);
    expect(hsvToRgbChannels(90, 100, 100)).toEqual([0.5, 1, 0]);
    expect(hsvToRgbChannels(150, 100, 100)).toEqual([0, 1, 0.5]);
    expect(hsvToRgbChannels(210, 100, 100)).toEqual([0, 0.5, 1]);
    expect(hsvToRgbChannels(270, 100, 100)).toEqual([0.5, 0, 1]);
    expect(hsvToRgbChannels(330, 100, 100)).toEqual([1, 0, 0.5]);
  });

  it('does not clamp: out-of-range s / l / v propagate like every other channel function', () => {
    const [r] = hslToRgbChannels(0, 150, 50);
    expect(r).toBeGreaterThan(1);
    const [, , b] = hsvToRgbChannels(0, 100, 120);
    expect(b).toBe(0);
    expect(hsvToRgbChannels(0, 100, 120)[0]).toBeCloseTo(1.2, 12);
  });
});

describe('parity with the object API (bit-exact)', () => {
  it('rgbToHslChannels(r/255, g/255, b/255) reproduces rgbToHslRaw exactly', () => {
    for (const [r, g, b] of rgbSamples()) {
      const raw = rgbToHslRaw({ r, g, b, alpha: 1 });
      const want: [number, number, number] = [raw.h, raw.s, raw.l];
      const got = rgbToHslChannels(r / 255, g / 255, b / 255);
      expect(got[0]).toBe(want[0]);
      expect(got[1]).toBe(want[1]);
      expect(got[2]).toBe(want[2]);
    }
  });

  it('rgbToHsvChannels(r/255, g/255, b/255) reproduces rgbToHsvRaw exactly', () => {
    for (const [r, g, b] of rgbSamples()) {
      const raw = rgbToHsvRaw({ r, g, b, alpha: 1 });
      const want: [number, number, number] = [raw.h, raw.s, raw.v];
      const got = rgbToHsvChannels(r / 255, g / 255, b / 255);
      expect(got[0]).toBe(want[0]);
      expect(got[1]).toBe(want[1]);
      expect(got[2]).toBe(want[2]);
    }
  });

  it('hslToRgbChannels × 255 reproduces hslToRgb exactly', () => {
    for (const [h, s, l] of polarSamples()) {
      const want = hslToRgb({ h, s, l, alpha: 1 });
      const [r, g, b] = hslToRgbChannels(h, s, l);
      expect(r * 255).toBe(want.r);
      expect(g * 255).toBe(want.g);
      expect(b * 255).toBe(want.b);
    }
  });

  it('hsvToRgbChannels × 255 reproduces hsvToRgb exactly', () => {
    for (const [h, s, v] of polarSamples()) {
      const want = hsvToRgb({ h, s, v, alpha: 1 });
      const [r, g, b] = hsvToRgbChannels(h, s, v);
      expect(r * 255).toBe(want.r);
      expect(g * 255).toBe(want.g);
      expect(b * 255).toBe(want.b);
    }
  });

  it('agrees with colordx(...).toHsl() / .toHsv() at every precision', () => {
    const round = (v: number, p: number) => Math.round(v * 10 ** p) / 10 ** p;
    for (const [r, g, b] of rgbSamples()) {
      const hex = colordx({ r, g, b }).toHex();
      const { r: br, g: bg, b: bb } = colordx(hex).toRgb();
      const [hlH, hlS, hlL] = rgbToHslChannels(br / 255, bg / 255, bb / 255);
      const [hvH, hvS, hvV] = rgbToHsvChannels(br / 255, bg / 255, bb / 255);
      for (const p of [0, 2, 6]) {
        const hsl = colordx(hex).toHsl(p);
        const hsvObj = colordx(hex).toHsv(p);
        expect(hsl.s).toBe(round(hlS, p));
        expect(hsl.l).toBe(round(hlL, p));
        expect(hsvObj.s).toBe(round(hvS, p));
        expect(hsvObj.v).toBe(round(hvV, p));
        // toHsl() folds a hue that rounds up to 360 back to 0; the channel function is unrounded.
        const rh = round(hlH, p);
        expect(hsl.h).toBe(rh >= 360 ? 0 : rh);
        const rv = round(hvH, p);
        expect(hsvObj.h).toBe(rv >= 360 ? 0 : rv);
      }
    }
  });

  it('a hue-wheel row rendered with hsvToRgbChannelsInto matches colordx({ h, s, v }).toRgb() byte for byte', () => {
    const buf = new Float64Array(3);
    const row = new Uint8ClampedArray(360 * 4);
    for (let x = 0; x < 360; x++) {
      hsvToRgbChannelsInto(buf, x, 100, 100);
      row[x * 4] = Math.round(buf[0]! * 255);
      row[x * 4 + 1] = Math.round(buf[1]! * 255);
      row[x * 4 + 2] = Math.round(buf[2]! * 255);
      row[x * 4 + 3] = 255;
    }
    for (let x = 0; x < 360; x++) {
      const { r, g, b } = colordx({ h: x, s: 100, v: 100 }).toRgb();
      expect([row[x * 4], row[x * 4 + 1], row[x * 4 + 2]]).toEqual([r, g, b]);
    }
  });

  it('a lightness plane rendered with hslToRgbChannelsInto matches colordx({ h, s, l }).toRgb()', () => {
    const buf = new Float64Array(3);
    for (let s = 0; s <= 100; s += 10) {
      for (let l = 0; l <= 100; l += 5) {
        hslToRgbChannelsInto(buf, 204, s, l);
        const { r, g, b } = colordx({ h: 204, s, l }).toRgb();
        expect([Math.round(buf[0]! * 255), Math.round(buf[1]! * 255), Math.round(buf[2]! * 255)]).toEqual([r, g, b]);
      }
    }
  });
});

describe('round trips', () => {
  const out = new Float64Array(3);

  it('rgb → hsl → rgb and rgb → hsv → rgb reproduce the input to 1e-12 (greys to ACHROMATIC_EPS)', () => {
    for (const [r8, g8, b8] of rgbSamples()) {
      const r = r8 / 255,
        g = g8 / 255,
        b = b8 / 255;
      // Channels within ACHROMATIC_EPS of each other are deliberately read as one grey, so a
      // near-grey round-trips to within the epsilon; everything else is exact to FP noise.
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      const tol = spread > ACHROMATIC_EPS ? 1e-12 : ACHROMATIC_EPS;
      rgbToHslChannelsInto(out, r, g, b);
      hslToRgbChannelsInto(out, out[0]!, out[1]!, out[2]!);
      expect(Math.abs(out[0]! - r)).toBeLessThan(tol);
      expect(Math.abs(out[1]! - g)).toBeLessThan(tol);
      expect(Math.abs(out[2]! - b)).toBeLessThan(tol);
      rgbToHsvChannelsInto(out, r, g, b);
      hsvToRgbChannelsInto(out, out[0]!, out[1]!, out[2]!);
      expect(Math.abs(out[0]! - r)).toBeLessThan(tol);
      expect(Math.abs(out[1]! - g)).toBeLessThan(tol);
      expect(Math.abs(out[2]! - b)).toBeLessThan(tol);
    }
  });

  it('hsl → rgb → hsl and hsv → rgb → hsv reproduce chromatic input to 1e-9', () => {
    for (const [h, s, x] of polarSamples()) {
      if (s < 1 || x < 1 || x > 99) continue; // hue is undefined on greys, black and white
      hslToRgbChannelsInto(out, h, s, x);
      rgbToHslChannelsInto(out, out[0]!, out[1]!, out[2]!);
      expect(Math.abs(out[0]! - h)).toBeLessThan(1e-9);
      expect(Math.abs(out[1]! - s)).toBeLessThan(1e-9);
      expect(Math.abs(out[2]! - x)).toBeLessThan(1e-9);
      hsvToRgbChannelsInto(out, h, s, x);
      rgbToHsvChannelsInto(out, out[0]!, out[1]!, out[2]!);
      expect(Math.abs(out[0]! - h)).toBeLessThan(1e-9);
      expect(Math.abs(out[1]! - s)).toBeLessThan(1e-9);
      expect(Math.abs(out[2]! - x)).toBeLessThan(1e-9);
    }
  });
});

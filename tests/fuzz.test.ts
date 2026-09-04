/**
 * Fuzz tests: 10k deterministic random colors exercising core + all plugins.
 *
 * Properties checked per color:
 *  - every method returns a value in the expected range / type
 *  - every string output round-trips back to ±1 RGB and ±0.01 alpha
 *  - every Colordx-returning method produces a valid color
 *
 * Invariants checked across formats and input paths (the "fuzz: invariants" blocks):
 *  - every sRGB-bounded formatter describes the color toHex() prints, wide-gamut input included
 *  - every hue is in [0, 360) at every precision
 *  - mix() is symmetric on non-integer channels
 *  - the gamut helpers read an input exactly like colordx() does
 *  - no rounded output carries -0; non-finite or absurd input never reaches a formatter
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { Colordx, colordx, extend, inGamutSrgb } from '../src/index.js';
import { srgbToLinear } from '../src/transfer.js';
import p3, { inGamutP3 } from '../src/plugins/p3.js';
import rec2020, { inGamutRec2020 } from '../src/plugins/rec2020.js';
import a11y from '../src/plugins/a11y.js';
import cmyk from '../src/plugins/cmyk.js';
import harmonies from '../src/plugins/harmonies.js';
import hsv from '../src/plugins/hsv.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import minify from '../src/plugins/minify.js';
import mix from '../src/plugins/mix.js';
import hwb from '../src/plugins/hwb.js';
import names from '../src/plugins/names.js';

beforeAll(() => {
  extend([a11y, cmyk, harmonies, hsv, hwb, lab, lch, minify, mix, names, p3, rec2020]);
});

// Deterministic LCG — results are reproducible across runs
const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
};

const rand = lcg(42);
const N = 10_000;

const colors = Array.from({ length: N }, () => ({
  r: Math.floor(rand() * 256),
  g: Math.floor(rand() * 256),
  b: Math.floor(rand() * 256),
  alpha: Math.round(rand() * 1000) / 1000, // 3dp, covers 0.000–1.000 including extremes
}));


const rgbClose = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) =>
  Math.abs(a.r - b.r) <= 1 && Math.abs(a.g - b.g) <= 1 && Math.abs(a.b - b.b) <= 1;

const alphaClose = (a: number, b: number) => Math.abs(a - b) <= 0.01;


describe('fuzz: core — toRgb/toHex round-trip', () => {
  it('toHex round-trips r/g/b within ±1', () => {
    for (const c of colors) {
      if (c.alpha !== 1) continue; // toHex is opaque-only
      const rt = colordx(colordx(c).toHex()).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
    }
  });

  it('toRgbString round-trips within ±1 rgb and ±0.01 alpha', () => {
    for (const c of colors) {
      const str = colordx(c).toRgbString();
      const rt = colordx(str).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });
});

describe('fuzz: core — HSL string round-trip', () => {
  it('toHslString round-trips within ±1 rgb and ±0.01 alpha', () => {
    for (const c of colors) {
      const str = colordx(c).toHslString();
      const rt = colordx(str).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });
});

describe('fuzz: core — HWB string round-trip', () => {
  it('toHwbString round-trips within ±3 rgb and ±0.01 alpha', () => {
    // HWB string uses 0dp precision by default (0-100 scale).
    // 1% rounding × 2.55 ≈ 3, so ±3 is the theoretical max drift per channel.
    for (const c of colors) {
      const str = colordx(c).toHwbString();
      const rt = colordx(str).toRgb();
      expect(Math.abs(rt.r - c.r)).toBeLessThanOrEqual(3);
      expect(Math.abs(rt.g - c.g)).toBeLessThanOrEqual(3);
      expect(Math.abs(rt.b - c.b)).toBeLessThanOrEqual(3);
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });
});

describe('fuzz: core — OKLab string round-trip', () => {
  it('toOklabString round-trips within ±1 rgb and ±0.01 alpha', () => {
    for (const c of colors) {
      const str = colordx(c).toOklabString();
      const rt = colordx(str).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });
});

describe('fuzz: core — OKLch string round-trip', () => {
  it('toOklchString round-trips within ±1 rgb and ±0.01 alpha', () => {
    for (const c of colors) {
      const str = colordx(c).toOklchString();
      const rt = colordx(str).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });
});


describe('fuzz: core — getters are in range', () => {
  it('brightness ∈ [0, 1]', () => {
    for (const c of colors) {
      const v = colordx(c).brightness();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('luminance ∈ [0, 1]', () => {
    for (const c of colors) {
      const v = colordx(c).luminance();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('hue ∈ [0, 360)', () => {
    for (const c of colors) {
      const v = colordx(c).hue();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(360);
    }
  });

  it('lightness ∈ [0, 1]', () => {
    for (const c of colors) {
      const v = colordx(c).lightness();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('chroma ∈ [0, 0.5]', () => {
    for (const c of colors) {
      const v = colordx(c).chroma();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0.5);
    }
  });

  it('contrast vs white ∈ [1, 21]', () => {
    for (const c of colors) {
      const v = colordx(c).contrast();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(21);
    }
  });
});


describe('fuzz: core — manipulators return valid colors', () => {
  it('lighten / darken', () => {
    for (const c of colors) {
      expect(colordx(c).lighten().isValid()).toBe(true);
      expect(colordx(c).darken().isValid()).toBe(true);
    }
  });

  it('saturate / desaturate', () => {
    for (const c of colors) {
      expect(colordx(c).saturate().isValid()).toBe(true);
      expect(colordx(c).desaturate().isValid()).toBe(true);
    }
  });

  it('invert', () => {
    for (const c of colors) {
      expect(colordx(c).invert().isValid()).toBe(true);
    }
  });

  it('rotate', () => {
    for (const c of colors) {
      expect(colordx(c).rotate(45).isValid()).toBe(true);
    }
  });

  it('grayscale', () => {
    for (const c of colors) {
      const g = colordx(c).grayscale().toRgb();
      expect(g.r).toBe(g.g);
      expect(g.g).toBe(g.b);
    }
  });
});


describe('fuzz: gamut — sRGB colors are always in-gamut', () => {
  it('inGamutSrgb is true for all generated sRGB colors', () => {
    for (const c of colors) {
      expect(inGamutSrgb(c)).toBe(true);
    }
  });

  it('toGamutSrgb returns a valid color', () => {
    for (const c of colors) {
      expect(Colordx.toGamutSrgb(c).isValid()).toBe(true);
    }
  });

  it('toGamutP3 returns a valid color', () => {
    for (const c of colors) {
      expect(Colordx.toGamutP3(c).isValid()).toBe(true);
    }
  });

  it('toGamutRec2020 returns a valid color', () => {
    for (const c of colors) {
      expect(Colordx.toGamutRec2020(c).isValid()).toBe(true);
    }
  });

  it('sRGB colors are always in P3 and Rec.2020 gamut', () => {
    for (const c of colors) {
      expect(inGamutP3(c)).toBe(true);
      expect(inGamutRec2020(c)).toBe(true);
    }
  });
});


describe('fuzz: lab plugin — toLab string round-trip', () => {
  it('round-trips within ±1 rgb and ±0.01 alpha', () => {
    for (const c of colors) {
      const obj = (colordx(c) as any).toLab();
      const rt = colordx({ ...obj, alpha: c.alpha }).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
    }
  });
});

describe('fuzz: lch plugin — toLch string round-trip', () => {
  it('toLchString round-trips within ±1 rgb', () => {
    for (const c of colors) {
      const str = (colordx(c) as any).toLchString();
      const rt = colordx(str).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });
});

describe('fuzz: cmyk plugin — toCmyk string round-trip', () => {
  it('toCmykString round-trips within ±1 rgb and ±0.01 alpha', () => {
    for (const c of colors) {
      const str = (colordx(c) as any).toCmykString();
      const rt = colordx(str).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });
});


describe('fuzz: p3 plugin — toP3String round-trip', () => {
  it('round-trips within ±1 rgb and ±0.01 alpha', () => {
    for (const c of colors) {
      const str = (colordx(c) as any).toP3String();
      const rt = colordx(str).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });
});

describe('fuzz: rec2020 plugin — toRec2020String round-trip', () => {
  it('round-trips within ±1 rgb and ±0.01 alpha', () => {
    for (const c of colors) {
      const str = (colordx(c) as any).toRec2020String();
      const rt = colordx(str).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });
});


describe('fuzz: mix plugin', () => {
  it('tints / shades / tones return valid colors', () => {
    for (const c of colors) {
      for (const color of (colordx(c) as any).tints(3)) expect(color.isValid()).toBe(true);
      for (const color of (colordx(c) as any).shades(3)) expect(color.isValid()).toBe(true);
      for (const color of (colordx(c) as any).tones(3)) expect(color.isValid()).toBe(true);
    }
  });

  it('palette(5) returns 5 valid colors', () => {
    // Only run on a 1k subset — palette is relatively expensive
    for (const c of colors.slice(0, 1000)) {
      const palette = (colordx(c) as any).palette(5);
      expect(palette).toHaveLength(5);
      for (const p of palette) expect(p.isValid()).toBe(true);
    }
  });
});


describe('fuzz: harmonies plugin', () => {
  const types = ['complementary', 'analogous', 'triadic', 'tetradic', 'split-complementary'] as const;
  const expectedCount = { complementary: 2, analogous: 3, triadic: 3, tetradic: 4, 'split-complementary': 3 };

  for (const type of types) {
    it(`${type} returns ${expectedCount[type]} valid colors`, () => {
      for (const c of colors.slice(0, 1000)) {
        const result = (colordx(c) as any).harmonies(type);
        expect(result).toHaveLength(expectedCount[type]);
        for (const h of result) expect(h.isValid()).toBe(true);
      }
    });
  }
});


describe('fuzz: delta plugin', () => {
  it('delta vs white is a non-negative number', () => {
    for (const c of colors) {
      const d = (colordx(c) as any).delta();
      expect(typeof d).toBe('number');
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });

  it('delta of identical color is 0', () => {
    for (const c of colors.slice(0, 1000)) {
      expect((colordx(c) as any).delta(c)).toBeCloseTo(0, 5);
    }
  });
});


describe('fuzz: a11y plugin', () => {
  it('isReadable returns a boolean', () => {
    for (const c of colors) {
      expect(typeof colordx(c).isReadable()).toBe('boolean');
    }
  });

  it('apcaContrast returns a number', () => {
    for (const c of colors) {
      const v = (colordx(c) as any).apcaContrast();
      expect(typeof v).toBe('number');
    }
  });

  it('minReadable returns a valid color', () => {
    for (const c of colors.slice(0, 1000)) {
      expect((colordx(c) as any).minReadable().isValid()).toBe(true);
    }
  });
});


describe('fuzz: minify plugin', () => {
  it('output is always valid', () => {
    for (const c of colors) {
      expect(colordx((colordx(c) as any).minify()).isValid()).toBe(true);
    }
  });

  it('round-trips r/g/b within ±1', () => {
    for (const c of colors) {
      const rt = colordx((colordx(c) as any).minify()).toRgb();
      expect(rgbClose(rt, c)).toBe(true);
    }
  });

  it('alpha round-trips within ±0.01', () => {
    for (const c of colors) {
      const rt = colordx((colordx(c) as any).minify()).toRgb();
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });

  it('alphaHex alpha round-trips within ±0.01', () => {
    for (const c of colors) {
      const rt = colordx((colordx(c) as any).minify({ alphaHex: true })).toRgb();
      expect(alphaClose(rt.alpha, c.alpha)).toBe(true);
    }
  });
});


// ── Cross-format invariants ──────────────────────────────────────────────────
//
// The blocks above start from sRGB bytes and check one format at a time. The bugs that
// slipped past them lived between formats (toHex vs toHslString), between input paths
// (colordx() vs the gamut helpers) or on inputs nobody generated (wide-gamut, fractional,
// non-finite). These blocks generate those inputs and assert the relationships.

const wideRand = lcg(7);
const WIDE_N = 3000;
const between = (lo: number, hi: number) => lo + wideRand() * (hi - lo);
const fix = (n: number, d: number) => Number(n.toFixed(d));

// Wide-gamut inputs in every form the gamut helpers read directly plus the plugin forms.
// Chroma runs well past the sRGB boundary, so a large share of these is out of gamut.
type Wide = { input: string | Record<string, unknown>; label: string };
const wide: Wide[] = Array.from({ length: WIDE_N }, (_, i): Wide => {
  const l = fix(between(0, 1), 4);
  const c = fix(between(0, 0.45), 4);
  const h = fix(between(0, 360), 2);
  const alpha = fix(between(0, 1), 3);
  const a = fix(c * Math.cos((h * Math.PI) / 180), 4);
  const b = fix(c * Math.sin((h * Math.PI) / 180), 4);
  switch (i % 8) {
    case 0:
      return { input: `oklch(${l} ${c} ${h})`, label: 'oklch string' };
    case 1:
      return { input: `oklch(${l} ${c} ${h} / ${alpha})`, label: 'oklch string + alpha' };
    case 2:
      return { input: { l, c, h }, label: 'oklch object (no alpha)' };
    case 3:
      return { input: { l, a, b, alpha }, label: 'oklab object' };
    case 4:
      return { input: `oklab(${l} ${a} ${b})`, label: 'oklab string' };
    case 5:
      return { input: `lch(${fix(l * 100, 2)} ${fix(c * 400, 2)} ${h})`, label: 'lch string' };
    case 6:
      return { input: `lab(${fix(l * 100, 2)} ${fix(a * 400, 2)} ${fix(b * 400, 2)} / ${alpha})`, label: 'lab string' };
    default:
      return {
        input: `color(display-p3 ${fix(between(-0.2, 1.2), 4)} ${fix(between(-0.2, 1.2), 4)} ${fix(between(-0.2, 1.2), 4)})`,
        label: 'display-p3 string',
      };
  }
});

const hueRange = (h: number, ctx: string) => {
  expect(h, ctx).toBeGreaterThanOrEqual(0);
  expect(h, ctx).toBeLessThan(360);
};

describe('fuzz: invariants — sRGB-bounded formatters describe the color toHex() prints', () => {
  it('HSL / HSV / HWB / CMYK of a wide-gamut color equal those of its clipped color', () => {
    let outOfGamut = 0;
    for (const { input, label } of wide) {
      const c = colordx(input as never) as any;
      const clipped = c.clampSrgb();
      if (clipped !== c) outOfGamut++;
      expect(c.toHsl(4), label).toEqual(clipped.toHsl(4));
      expect(c.toHsv(4), label).toEqual(clipped.toHsv(4));
      expect(c.toHwb(4), label).toEqual(clipped.toHwb(4));
      expect(c.toCmyk(4), label).toEqual(clipped.toCmyk(4));
      expect(c.brightness(), label).toBe(clipped.brightness());
      expect(c.hue(), label).toBe(clipped.hue());
    }
    expect(outOfGamut).toBeGreaterThan(WIDE_N / 4); // the generator really leaves sRGB
  });

  it('toHslString / toHsvString / toHwbString(2) round-trip to the bytes toHex() prints', () => {
    for (const { input, label } of wide) {
      const c = colordx(input as never) as any;
      const bytes = c.toRgb();
      for (const str of [c.toHslString(4), c.toHsvString(4), c.toHwbString(2), c.toCmykString(4)]) {
        expect(rgbClose(colordx(str).toRgb(), bytes), `${label}: ${str}`).toBe(true);
      }
    }
  });

  it('HSL manipulators with a zero amount are identity on the displayed color', () => {
    for (const { input, label } of wide) {
      const c = colordx(input as never);
      // ±1: a clipped channel can sit on a .5 boundary, where the HSL round trip is a coin toss.
      const bytes = c.toRgb();
      for (const m of [c.lighten(0), c.saturate(0), c.rotate(0), c.hue(c.hue()), c.invert().invert()]) {
        expect(rgbClose(m.toRgb(), bytes), label).toBe(true);
        expect(m.alpha(), label).toBe(bytes.alpha);
      }
    }
  });

  it('wide-gamut formatters still see the unclamped color', () => {
    for (const { input, label } of wide) {
      const c = colordx(input as never);
      const { r, g, b } = c._rawRgb();
      const back = colordx(c.toOklchString());
      // An imaginary lab()/lch() input can have OKLab L outside [0, 1]; the string reports it, but
      // parsing clamps L (CSS Color 4), so only in-range L is expected to round-trip.
      const L = c.toOklch().l;
      if (L >= 0 && L <= 1) expect(rgbClose(back.toRgb(), c.toRgb()), label).toBe(true);
      // Clearly outside sRGB — twice the helper's 5e-4 linear tolerance past the edge (near black a
      // whole byte is only 3e-4 linear): the 5-dp OKLCh string must still say so.
      const lin = [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)];
      if (L >= 0 && L <= 1 && lin.some((v) => v < -1e-3 || v > 1 + 1e-3)) {
        expect(inGamutSrgb(c.toOklchString()), label).toBe(false);
        expect(back.clampSrgb(), label).not.toBe(back);
      }
    }
  });
});

describe('fuzz: invariants — every hue is in [0, 360) at every precision', () => {
  it('toHsl / toHsv / toHwb / toLch / toOklch / hue()', () => {
    const inputs = [...colors.slice(0, 2000), ...wide.map((w) => w.input)];
    for (const input of inputs) {
      const c = colordx(input as never) as any;
      hueRange(c.hue(), 'hue()');
      for (let p = 0; p <= 5; p++) {
        hueRange(c.toHsl(p).h, `toHsl(${p})`);
        hueRange(c.toHsv(p).h, `toHsv(${p})`);
        hueRange(c.toHwb(p).h, `toHwb(${p})`);
        hueRange(c.toLch(p).h, `toLch(${p})`);
        hueRange(c.toOklch(p).h, `toOklch(${p})`);
      }
    }
  });

  it('the rounding band near 360 is actually exercised', () => {
    // Colors whose raw hue sits within half a unit of 360 at 0 dp: the wrap must fire, not round up.
    let hits = 0;
    for (let g = 0; g < 16; g++)
      for (let b = 1; b < 16; b++) {
        const c = colordx({ r: 255, g, b }) as any;
        if (c.toHsl(4).h > 359.5) {
          hits++;
          expect(c.toHsl(0).h).toBe(0);
          expect(c.toHwb().h).toBe(0);
          expect(c.toHsv(0).h).toBe(0);
        }
      }
    expect(hits).toBeGreaterThan(0);
  });
});

describe('fuzz: invariants — mix() is symmetric', () => {
  // HSL objects with fractional channels: the unrounded RGB is non-integer, which is where
  // rounding one side and not the other used to show.
  const fractional = Array.from({ length: 4000 }, () => ({
    h: between(0, 360),
    s: between(0, 100),
    l: between(0, 100),
    alpha: fix(between(0, 1), 3),
  }));

  it('a.mix(b, t) equals b.mix(a, 1 − t)', () => {
    for (let i = 0; i + 1 < fractional.length; i += 2) {
      const a = colordx(fractional[i]!) as any;
      const b = colordx(fractional[i + 1]!) as any;
      const t = between(0, 1);
      expect(a.mix(b, t).toHex8()).toBe(b.mix(a, 1 - t).toHex8());
    }
  });

  it('mix at 0 and 1 are the endpoints', () => {
    for (let i = 0; i + 1 < fractional.length; i += 2) {
      const a = colordx(fractional[i]!) as any;
      const b = colordx(fractional[i + 1]!) as any;
      expect(a.mix(b, 0).toHex8()).toBe(a.toHex8());
      expect(a.mix(b, 1).toHex8()).toBe(b.toHex8());
    }
  });
});

describe('fuzz: invariants — gamut helpers read an input exactly like colordx()', () => {
  it('toGamutSrgb keeps the alpha colordx() parses, with or without an alpha field', () => {
    for (const { input, label } of wide) {
      expect(Colordx.toGamutSrgb(input as never).alpha(), label).toBe(colordx(input as never).alpha());
      expect(Colordx.toGamutP3(input as never).alpha(), label).toBe(colordx(input as never).alpha());
    }
  });

  it('toGamutSrgb(input) equals colordx(input).mapSrgb()', () => {
    for (const { input, label } of wide) {
      expect(Colordx.toGamutSrgb(input as never).toHex8(), label).toBe(colordx(input as never).mapSrgb().toHex8());
    }
  });

  it('inGamutSrgb agrees with the stored channels', () => {
    for (const { input, label } of wide) {
      const { r, g, b } = colordx(input as never)._rawRgb();
      const lin = [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)];
      // The helper tolerates 5e-4 in linear light (rounding noise from 4-dp OKLCh); a hair of
      // slack on each side keeps the gamma round trip from deciding a boundary case.
      const EPS = 5e-4;
      const inside = lin.every((v) => v >= -EPS + 1e-9 && v <= 1 + EPS - 1e-9);
      const outside = lin.some((v) => v < -EPS - 1e-9 || v > 1 + EPS + 1e-9);
      const inGamut = inGamutSrgb(input as never);
      if (inside) expect(inGamut, label).toBe(true);
      if (outside) expect(inGamut, label).toBe(false);
    }
  });

  it('L outside [0, 1] clamps identically on both paths; objects with L > 1 are rejected on both', () => {
    for (let i = 0; i < 500; i++) {
      const c = fix(between(0, 0.4), 4);
      const h = fix(between(0, 360), 2);
      const hi = fix(between(1, 3), 3);
      const lo = fix(between(-3, 0), 3);
      expect(colordx(`oklch(${hi} ${c} ${h})`).toHex8()).toBe(colordx(`oklch(1 ${c} ${h})`).toHex8());
      expect(colordx(`oklch(${lo} ${c} ${h})`).toHex8()).toBe(colordx(`oklch(0 ${c} ${h})`).toHex8());
      expect(Colordx.toGamutSrgb(`oklch(${hi} ${c} ${h})`).toHex8()).toBe(Colordx.toGamutSrgb(`oklch(1 ${c} ${h})`).toHex8());
      expect(inGamutSrgb(`oklch(${lo} ${c} ${h})`)).toBe(inGamutSrgb(`oklch(0 ${c} ${h})`));
      expect(colordx({ l: lo, c, h }).toHex8()).toBe(colordx({ l: 0, c, h }).toHex8());
      expect(colordx({ l: hi, c, h }).isValid()).toBe(false);
      expect(Colordx.toGamutSrgb({ l: hi, c, h }).isValid()).toBe(false);
      expect(inGamutSrgb({ l: hi, c, h })).toBe(true); // not a wide-gamut color: passes through
    }
  });
});

describe('fuzz: invariants — no rounded output carries a signed zero', () => {
  const isNegZero = (v: unknown) => Object.is(v, -0);
  it('object outputs of sRGB and wide-gamut colors', () => {
    const inputs = [...colors.slice(0, 2000), ...wide.map((w) => w.input)];
    for (const input of inputs) {
      const c = colordx(input as never) as any;
      for (const obj of [c.toRgb(), c.toHsl(), c.toHsv(), c.toHwb(), c.toOklab(), c.toOklch(), c.toLab(), c.toLch(), c.toXyz(), c.toXyzD65(), c.toCmyk(), c.toP3(), c.toRec2020()]) {
        for (const [k, v] of Object.entries(obj)) expect(isNegZero(v), `${k} of ${JSON.stringify(input)}`).toBe(false);
      }
    }
  });
});

describe('fuzz: invariants — hostile input never reaches a formatter', () => {
  const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/;
  const big = '1' + '0'.repeat(400); // Number() → Infinity, but passes every NUM regex
  const bads = [NaN, Infinity, -Infinity, 1e308, -1e308];

  const objectShapes: Record<string, unknown>[] = [
    { r: 128, g: 64, b: 32 },
    { h: 200, s: 50, l: 50 },
    { h: 200, s: 50, v: 50 },
    { h: 200, w: 20, b: 20 },
    { l: 0.5, a: 0.1, b: -0.1 },
    { l: 0.5, c: 0.1, h: 200 },
    { l: 50, a: 20, b: -20, colorSpace: 'lab' },
    { l: 50, c: 30, h: 200, colorSpace: 'lch' },
    { x: 40, y: 20, z: 10 },
    { x: 40, y: 20, z: 10, colorSpace: 'xyz-d65' },
    { c: 10, m: 20, y: 30, k: 40 },
    { r: 0.5, g: 0.2, b: 0.1, colorSpace: 'display-p3' },
    { r: 0.5, g: 0.2, b: 0.1, colorSpace: 'rec2020' },
  ];
  const stringShapes = [
    'rgb(_ _ _)',
    'rgb(_ _ _ / _)',
    'hsl(_ _% _%)',
    'hsv(_ _% _%)',
    'hwb(_ _% _%)',
    'oklch(_ _ _)',
    'oklch(_ _ _ / _)',
    'oklab(_ _ _)',
    'lab(_ _ _)',
    'lch(_ _ _)',
    'color(display-p3 _ _ _)',
    'color(rec2020 _ _ _)',
    'color(xyz _ _ _)',
    'color(srgb _ _ _)',
    'device-cmyk(_ _ _ _)',
  ];

  const hostile: unknown[] = [];
  for (const shape of objectShapes)
    for (const key of Object.keys(shape))
      if (key !== 'colorSpace')
        for (const bad of bads) {
          hostile.push({ ...shape, [key]: bad });
          hostile.push({ ...shape, alpha: bad });
        }
  for (const shape of stringShapes) {
    const slots = shape.split('_').length - 1;
    for (let s = 0; s < slots; s++)
      for (const v of [big, `-${big}`]) {
        let k = 0;
        hostile.push(shape.replace(/_/g, () => (k++ === s ? v : '0.5')));
      }
  }

  const wellFormed = (c: any, ctx: string) => {
    expect(c.toHex(), ctx).toMatch(HEX);
    expect(c.toHex8(), ctx).toMatch(HEX);
    const { r, g, b, alpha } = c.toRgb();
    for (const v of [r, g, b]) {
      expect(Number.isInteger(v), ctx).toBe(true);
      expect(v, ctx).toBeGreaterThanOrEqual(0);
      expect(v, ctx).toBeLessThanOrEqual(255);
    }
    expect(alpha, ctx).toBeGreaterThanOrEqual(0);
    expect(alpha, ctx).toBeLessThanOrEqual(1);
    expect(colordx(c.toRgbString()).isValid(), ctx).toBe(true);
    for (const obj of [c.toHsl(), c.toHsv(), c.toHwb(), c.toOklab(), c.toOklch(), c.toLab(), c.toLch(), c.toCmyk()]) {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'number') expect(Number.isFinite(v), `${ctx} → ${k}`).toBe(true);
      }
    }
  };

  it('parses to a well-formed color or is invalid; either way every output is well-formed', () => {
    expect(hostile.length).toBeGreaterThan(300);
    for (const input of hostile) {
      const ctx = JSON.stringify(input).slice(0, 80);
      const c = colordx(input as never) as any;
      expect(typeof c.isValid(), ctx).toBe('boolean');
      wellFormed(c, ctx);
      wellFormed(c.mapSrgb(), `${ctx} mapSrgb`);
      wellFormed(Colordx.toGamutSrgb(input as never), `${ctx} toGamutSrgb`);
      expect(typeof inGamutSrgb(input as never), ctx).toBe('boolean');
    }
  });

  it('manipulator arguments', () => {
    for (const c of colors.slice(0, 200)) {
      const x = colordx(c) as any;
      for (const bad of bads) {
        const ctx = `${x.toHex8()} arg ${bad}`;
        wellFormed(x.lighten(bad), `${ctx} lighten`);
        wellFormed(x.saturate(bad), `${ctx} saturate`);
        wellFormed(x.rotate(bad), `${ctx} rotate`);
        wellFormed(x.hue(bad), `${ctx} hue`);
        wellFormed(x.alpha(bad), `${ctx} alpha`);
        wellFormed(x.lightness(bad), `${ctx} lightness`);
        wellFormed(x.chroma(bad), `${ctx} chroma`);
        wellFormed(x.mix('#fff', bad), `${ctx} mix`);
        wellFormed(x.mixOklab('#fff', bad), `${ctx} mixOklab`);
      }
    }
  });
});

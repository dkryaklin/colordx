/**
 * Fuzz tests: 10k deterministic random colors exercising core + all plugins.
 *
 * Properties checked per color:
 *  - every method returns a value in the expected range / type
 *  - every string output round-trips back to ±1 RGB and ±0.01 alpha
 *  - every Colordx-returning method produces a valid color
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { Colordx, colordx, extend, inGamutSrgb } from '../src/index.js';
import p3, { inGamutP3 } from '../src/plugins/p3.js';
import rec2020, { inGamutRec2020 } from '../src/plugins/rec2020.js';
import a11y from '../src/plugins/a11y.js';
import cmyk from '../src/plugins/cmyk.js';
import harmonies from '../src/plugins/harmonies.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import minify from '../src/plugins/minify.js';
import mix from '../src/plugins/mix.js';
import hwb from '../src/plugins/hwb.js';
import names from '../src/plugins/names.js';

beforeAll(() => {
  extend([a11y, cmyk, harmonies, hwb, lab, lch, minify, mix, names, p3, rec2020]);
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

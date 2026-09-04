import { describe, expect, it } from 'vitest';
import { Colordx, colordx, extend, inGamutSrgb, toHexByte } from '../src/index.js';
import cmyk from '../src/plugins/cmyk.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import mix from '../src/plugins/mix.js';
import p3, { inGamutP3 } from '../src/plugins/p3.js';

extend([cmyk, hsv, hwb, lab, lch, mix, p3]);

// Cross-cutting alignment rules: every formatter agrees with toHex() on what color it describes,
// every hue lands in [0, 360), every parser applies the same clamping, and garbage input degrades
// to a defined color instead of printing NaN/undefined.

describe('gamut helpers accept the same OKLab/OKLCh objects the parser does', () => {
  it('OKLCh object without alpha keeps alpha 1 through toGamutSrgb', () => {
    const c = Colordx.toGamutSrgb({ l: 0.5, c: 0.3, h: 30 });
    expect(c.alpha()).toBe(1);
    expect(c.toHex()).toBe(Colordx.toGamutSrgb({ l: 0.5, c: 0.3, h: 30, alpha: 1 }).toHex());
    expect(c.toHex()).toHaveLength(7);
  });
  it('OKLCh object without alpha keeps alpha 1 through toGamutP3', () => {
    expect(Colordx.toGamutP3({ l: 0.5, c: 0.3, h: 30 }).alpha()).toBe(1);
  });
  it('OKLab object without alpha is read directly (not via the parser round-trip)', () => {
    expect(Colordx.toGamutSrgb({ l: 0.5, a: 0.3, b: 0.1 }).alpha()).toBe(1);
    expect(inGamutSrgb({ l: 0.5, a: 0.3, b: 0.1 })).toBe(false);
    expect(inGamutP3({ l: 0.5, c: 0.3, h: 30 })).toBe(false);
  });
  it('object with L > 1 is not OKLab for the gamut helpers either (parser rejects it)', () => {
    expect(colordx({ l: 50, a: 0, b: 0, alpha: 1 }).isValid()).toBe(false);
    expect(inGamutSrgb({ l: 50, a: 0, b: 0, alpha: 1 })).toBe(true);
    expect(inGamutSrgb({ l: 50, a: 0, b: 0 })).toBe(true);
    expect(Colordx.toGamutSrgb({ l: 50, c: 0, h: 0 }).isValid()).toBe(false);
  });
  it('string L is clamped to [0, 1] for gamut checks like it is for parsing', () => {
    expect(inGamutSrgb('oklch(1.5 0 0)')).toBe(true);
    expect(Colordx.toGamutSrgb('oklch(1.5 0 0)').toHex()).toBe('#ffffff');
    expect(inGamutSrgb('oklab(-1 0 0)')).toBe(true);
  });
});

describe('OKLab / OKLCh lightness is clamped to [0, 1] at parse time (CSS Color 4)', () => {
  it('string L above 1 is white, below 0 is black', () => {
    expect(colordx('oklch(1.5 0 0)').toOklchString()).toBe('oklch(1 0 none)');
    expect(colordx('oklab(150% 0 0)').toHex()).toBe('#ffffff');
    expect(colordx('oklch(-0.5 0 0)').toHex()).toBe('#000000');
    expect(colordx('oklab(-1 0 0)').toOklab().l).toBe(0);
  });
  it('matches how lab()/lch() already clamp L', () => {
    expect(colordx('oklch(2 0 0)').toHex()).toBe(colordx('lch(200 0 0)').toHex());
  });
  it('negative object L clamps to 0; L above 1 is still rejected as unbranded CIE Lab', () => {
    expect(colordx({ l: -0.5, a: 0, b: 0 }).toOklab().l).toBe(0);
    expect(colordx({ l: -0.5, c: 0.1, h: 30 }).toOklch().l).toBe(0);
    expect(colordx({ l: 1.5, a: 0, b: 0 }).isValid()).toBe(false);
    expect(colordx({ l: 1.5, c: 0, h: 0 }).isValid()).toBe(false);
  });
  it('chroma is unaffected — out-of-gamut chroma still survives to toOklchString', () => {
    expect(colordx('oklch(0.5 0.4 180)').toOklchString()).toBe('oklch(0.5 0.4 180)');
  });
});

describe('rounded outputs never carry a signed zero', () => {
  it('L of a black with chroma, a/b of a grey', () => {
    expect(Object.is(colordx('oklch(0 0.1 30)').toOklch().l, -0)).toBe(false);
    expect(Object.is(colordx('oklch(0 0.1 30)').toOklab().l, -0)).toBe(false);
    for (let v = 0; v < 256; v++) {
      const { a, b } = colordx({ r: v, g: v, b: v }).toOklab();
      expect(Object.is(a, -0)).toBe(false);
      expect(Object.is(b, -0)).toBe(false);
    }
    expect(Object.is(colordx('#808080').toLab().a, -0)).toBe(false);
  });
});

describe('hue output stays in [0, 360) after rounding', () => {
  // Hues that sit within half a unit of 360 at the given precision used to print as 360.
  it('toHwb() at the default 0 dp', () => {
    expect(colordx('#ff0001').toHwb().h).toBe(0);
    expect(colordx('#ff0001').toHwbString()).toBe('hwb(0 0% 0%)');
  });
  it('toLch() at 2 dp', () => {
    expect(colordx('#300718').toLch().h).toBe(0);
    expect(colordx('#300718').toLchString()).toBe('lch(7.82 22.2 0)');
  });
  it('toOklch(2)', () => {
    // #300718-style colors sit just below 360°; the slab around them must never print 360.
    let hit = 0;
    let bad = 0;
    for (let r = 0x20; r < 0x60; r++)
      for (let g = 0; g < 0x14; g++)
        for (let b = 0x10; b < 0x30; b++) {
          const h = colordx({ r, g, b }).toOklch(2).h;
          if (h < 0 || h >= 360) bad++;
          if (h === 0 && g > 0) hit++;
        }
    expect(bad).toBe(0);
    expect(hit).toBeGreaterThan(0); // the wrap actually fires somewhere in this slab
  });
  it('every formatter on a full-cube sample', () => {
    for (let i = 0; i < 4000; i++) {
      const c = colordx({ r: (i * 7919) % 256, g: (i * 104729) % 256, b: (i * 1299709) % 256 });
      for (const h of [c.toHsl(0).h, c.toHsv(0).h, c.toHwb().h, c.toLch(0).h, c.toOklch(1).h, c.hue()]) {
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
      }
    }
  });
});

describe('mix() is symmetric', () => {
  it('a.mix(b, t) equals b.mix(a, 1 − t) for non-integer channels', () => {
    const a = colordx('hsl(0 0% 50%)'); // r = 127.5 unrounded
    const b = colordx('#010101');
    expect(a.mix(b, 0.5).toHex()).toBe(b.mix(a, 0.5).toHex());
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 2000; i++) {
      const x = colordx({ h: rnd() * 360, s: rnd() * 100, l: rnd() * 100 });
      const y = colordx({ h: rnd() * 360, s: rnd() * 100, l: rnd() * 100 });
      const t = rnd();
      expect(x.mix(y, t).toHex()).toBe(y.mix(x, 1 - t).toHex());
    }
  });
  it('documented outputs are unchanged', () => {
    expect(colordx('#000000').mix('#ffffff').toHex()).toBe('#808080');
    expect(colordx('#ff0000').tints(5).map((c) => c.toHex())).toEqual(['#ff0000', '#ff4040', '#ff8080', '#ffbfbf', '#ffffff']);
    expect(colordx('#ff0000').tones(3).map((c) => c.toHex())).toEqual(['#ff0000', '#c04040', '#808080']);
  });
});

describe('sRGB-bounded models read the clipped color, like toHex()', () => {
  // Stored unclamped as roughly (-172, 303, -21); toHex() clips to #00ff00.
  const wide = colordx('oklch(0.95 0.4 150)');
  it('toHsl / toHsv / toHwb / toCmyk describe the same color toHex() prints', () => {
    expect(wide.toHex()).toBe('#00ff00');
    expect(wide.toHslString()).toBe('hsl(120 100% 50%)');
    expect(colordx(wide.toHslString()).toHex()).toBe(wide.toHex());
    expect(wide.toHsv()).toEqual({ h: 120, s: 100, v: 100, alpha: 1 });
    expect(wide.toHwb()).toEqual({ h: 120, w: 0, b: 0, alpha: 1 });
    expect(wide.toCmyk()).toEqual({ c: 100, m: 0, y: 100, k: 0, alpha: 1 });
  });
  it('brightness / isLight agree with what is displayed', () => {
    expect(wide.brightness()).toBe(0.59);
    expect(wide.isLight()).toBe(true);
  });
  it('HSL manipulators with a zero amount are identity on the displayed color', () => {
    expect(wide.lighten(0).toHex()).toBe('#00ff00');
    expect(wide.saturate(0).toHex()).toBe('#00ff00');
    expect(wide.rotate(0).toHex()).toBe('#00ff00');
    expect(wide.hue()).toBe(120);
    expect(wide.grayscale().toHex()).toBe('#808080');
    expect(wide.invert().toHex()).toBe('#ff00ff');
    expect(wide.invert()._rawRgb()).toEqual({ r: 255, g: 0, b: 255, alpha: 1 });
  });
  it('wide-gamut models still see the unclamped color', () => {
    const { l, c, h } = wide.toOklch();
    expect(l).toBe(0.95);
    expect(c).toBe(0.4);
    expect(h).toBeCloseTo(150, 4);
    expect(wide.toP3().g).toBeGreaterThan(1);
  });
  it('in-gamut colors take the allocation-free path', () => {
    const c = colordx('#3d7a9f');
    expect(c._srgbRgb()).toBe(c._rawRgb());
  });
});

describe('non-finite input degrades to a defined color, never NaN/undefined output', () => {
  const big = '1' + '0'.repeat(400); // Number() → Infinity
  it('toHexByte(NaN) is "00"', () => expect(toHexByte(NaN)).toBe('00'));
  it('an infinite hue reads as 0°', () => {
    expect(colordx({ h: Infinity, s: 100, v: 100 }).toHex()).toBe('#ff0000');
    expect(colordx({ h: Infinity, s: 100, l: 50 }).toHex()).toBe('#ff0000');
    expect(colordx({ h: -Infinity, w: 0, b: 0 }).toHex()).toBe('#ff0000');
    expect(colordx(`hsv(${big} 100% 100%)`).toHex()).toBe('#ff0000');
    expect(colordx(`hsl(${big} 100% 50%)`).toHex()).toBe('#ff0000');
    expect(colordx(`oklch(0.5 0.1 ${big})`).toHex()).toBe(colordx('oklch(0.5 0.1 0)').toHex());
    expect(colordx('#f00').hue(Infinity).toHex()).toBe('#ff0000');
  });
  it('infinite Lab/LCH/OKLab channels still print a well-formed hex', () => {
    for (const s of [`lch(50 ${big} 0)`, `lab(50 ${big} 0)`, `lab(50 ${big} ${big})`, `oklab(0.5 ${big} 0)`]) {
      expect(colordx(s).toHex()).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(colordx({ l: 0.5, c: Infinity, h: 0 }).toHex()).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('NaN amounts on manipulators clamp to the low bound', () => {
    expect(colordx('#f00').lighten(NaN).toHex()).toBe('#000000');
    expect(colordx('#f00').lightness(NaN).toHex()).toMatch(/^#[0-9a-f]{6}$/);
    expect(colordx('#f00').chroma(NaN).toHex()).toMatch(/^#[0-9a-f]{6}$/);
    expect(colordx('#f00').alpha(NaN).alpha()).toBe(0);
    expect(colordx('#f00').rotate(NaN).toHex()).toBe('#ff0000');
  });
  it('unbranded XYZ objects read NaN as 0 like every other object parser', () => {
    expect(colordx({ x: NaN, y: 0, z: 0 }).isValid()).toBe(true);
    expect(colordx({ x: NaN, y: 0, z: 0 }).toHex()).toBe(colordx({ x: 0, y: 0, z: 0 }).toHex());
    expect(colordx({ x: NaN, y: 0, z: 0, colorSpace: 'xyz-d65' as const }).isValid()).toBe(true);
  });
});

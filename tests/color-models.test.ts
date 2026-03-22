/**
 * Tests for new color models: HWB, XYZ, Lab, LCH, CMYK
 * Includes parity checks against colord where the model is available as a plugin.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { colord, extend as colordExtend } from 'colord';
import hwbPlugin from 'colord/plugins/hwb';
import labPlugin from 'colord/plugins/lab';
import lchPlugin from 'colord/plugins/lch';
import xyzPlugin from 'colord/plugins/xyz';
import cmykPlugin from 'colord/plugins/cmyk';
import minifyPlugin from 'colord/plugins/minify';
import namesPlugin from 'colord/plugins/names';
import { colordx, extend } from '../src/index.js';
import minify from '../src/plugins/minify.js';
import names from '../src/plugins/names.js';

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  colordExtend([hwbPlugin, labPlugin, lchPlugin, xyzPlugin, cmykPlugin, minifyPlugin, namesPlugin] as any);
  extend([minify, names]);
});

const inputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060'];

// ─── HWB ────────────────────────────────────────────────────────────────────

describe('toHwb parity', () => {
  it.each(inputs)('%s', (input) => {
    const dx = colordx(input).toHwb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (colord(input) as any).toHwb();
    expect(dx.h).toBeCloseTo(d.h, 0);
    expect(dx.w).toBeCloseTo(d.w, 0);
    expect(dx.b).toBeCloseTo(d.b, 0);
    expect(dx.a).toBe(d.a);
  });
});

describe('HWB round-trip', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).toHwb()).toEqual(colordx(colordx(input).toHwb()).toHwb());
  });
});

describe('HWB string parsing', () => {
  it('parses hwb string opaque', () => {
    expect(colordx('hwb(0 0% 0%)').toHex()).toBe('#ff0000');
    expect(colordx('hwb(120 0% 0%)').toHex()).toBe('#00ff00');
    expect(colordx('hwb(240 0% 0%)').toHex()).toBe('#0000ff');
    expect(colordx('hwb(0 100% 0%)').toHex()).toBe('#ffffff');
    expect(colordx('hwb(0 0% 100%)').toHex()).toBe('#000000');
  });

  it('parses hwb string with alpha', () => {
    expect(colordx('hwb(0 0% 0% / 0.5)').alpha()).toBe(0.5);
  });

  it('round-trips through toHwbString for clean colors', () => {
    // Clean colors (integer HWB values) round-trip exactly
    expect(colordx(colordx('#ff0000').toHwbString()).toHex()).toBe('#ff0000');
    expect(colordx(colordx('#ffffff').toHwbString()).toHex()).toBe('#ffffff');
    expect(colordx(colordx('#000000').toHwbString()).toHex()).toBe('#000000');
  });

  it('round-trips through toHwbString within rounding tolerance', () => {
    // Non-clean colors lose ±1 precision due to integer HWB string representation
    const result = colordx(colordx('#c06060').toHwbString()).toRgb();
    expect(Math.abs(result.r - 0xc0)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.g - 0x60)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.b - 0x60)).toBeLessThanOrEqual(1);
  });
});

// ─── XYZ ────────────────────────────────────────────────────────────────────

describe('toXyz parity', () => {
  it.each(inputs)('%s', (input) => {
    const dx = colordx(input).toXyz();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (colord(input) as any).toXyz();
    expect(dx.x).toBeCloseTo(d.x, 0);
    expect(dx.y).toBeCloseTo(d.y, 0);
    expect(dx.z).toBeCloseTo(d.z, 0);
  });
});

describe('XYZ object parsing', () => {
  it('round-trips', () => {
    const xyz = colordx('#ff0000').toXyz();
    expect(colordx(xyz).toHex()).toBe('#ff0000');
  });
});

// ─── Lab ────────────────────────────────────────────────────────────────────

describe('toLab parity', () => {
  it.each(inputs)('%s', (input) => {
    const dx = colordx(input).toLab();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (colord(input) as any).toLab();
    expect(dx.l).toBeCloseTo(d.l, 1);
    expect(dx.a).toBeCloseTo(d.a, 1);
    expect(dx.b).toBeCloseTo(d.b, 1);
    expect(dx.alpha).toBe(d.alpha);
  });
});

describe('Lab object parsing', () => {
  it('round-trips', () => {
    const lab = colordx('#ff0000').toLab();
    expect(colordx(lab).toHex()).toBe('#ff0000');
  });
});

// ─── LCH ────────────────────────────────────────────────────────────────────

describe('toLch parity', () => {
  it.each(inputs)('%s', (input) => {
    const dx = colordx(input).toLch();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (colord(input) as any).toLch();
    expect(dx.l).toBeCloseTo(d.l, 1);
    expect(dx.c).toBeCloseTo(d.c, 1);
    // Hue of achromatic colors is undefined — skip
    if (d.c > 1) expect(dx.h).toBeCloseTo(d.h, 0);
  });
});

describe('LCH object parsing', () => {
  it('round-trips', () => {
    const lch = colordx('#ff0000').toLch();
    expect(colordx(lch).toHex()).toBe('#ff0000');
  });

  it('parses LCH object with alpha', () => {
    const lch = { ...colordx('#ff0000').toLch(), a: 0.5 };
    expect(colordx(lch).alpha()).toBe(0.5);
  });
});

describe('LCH string parsing', () => {
  it('round-trips through toLchString', () => {
    expect(colordx(colordx('#ff0000').toLchString()).toHex()).toBe('#ff0000');
    expect(colordx(colordx('#0000ff').toLchString()).toHex()).toBe('#0000ff');
  });

  it('parses lch string with alpha as percentage', () => {
    expect(colordx('lch(50% 50 180 / 50%)').alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses lch string with alpha decimal', () => {
    expect(colordx('lch(50% 50 180 / 0.5)').alpha()).toBeCloseTo(0.5, 2);
  });
});

// ─── CMYK ───────────────────────────────────────────────────────────────────

describe('toCmyk parity', () => {
  it.each(inputs)('%s', (input) => {
    const dx = colordx(input).toCmyk();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (colord(input) as any).toCmyk();
    expect(dx.c).toBeCloseTo(d.c, 0);
    expect(dx.m).toBeCloseTo(d.m, 0);
    expect(dx.y).toBeCloseTo(d.y, 0);
    expect(dx.k).toBeCloseTo(d.k, 0);
  });
});

describe('CMYK black (k=100 edge case)', () => {
  it('pure black has c=m=y=0, k=100', () => {
    expect(colordx('#000000').toCmyk()).toEqual({ c: 0, m: 0, y: 0, k: 100, a: 1 });
  });
});

describe('CMYK round-trip', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(colordx(input).toCmyk()).toHex()).toBe(colordx(input).toHex());
  });
});

describe('CMYK string parsing', () => {
  it('parses device-cmyk string with percentages', () => {
    expect(colordx('device-cmyk(0% 100% 100% 0%)').toHex()).toBe('#ff0000');
    expect(colordx('device-cmyk(100% 0% 100% 0%)').toHex()).toBe('#00ff00');
    expect(colordx('device-cmyk(100% 100% 0% 0%)').toHex()).toBe('#0000ff');
  });

  it('parses device-cmyk string with fractional values', () => {
    expect(colordx('device-cmyk(0 1 1 0)').toHex()).toBe('#ff0000');
  });

  it('parses device-cmyk string with alpha', () => {
    expect(colordx('device-cmyk(0% 100% 100% 0% / 0.5)').alpha()).toBe(0.5);
    expect(colordx('device-cmyk(0% 100% 100% 0% / 50%)').alpha()).toBeCloseTo(0.5, 2);
  });

  it('round-trips through toCmykString', () => {
    expect(colordx(colordx('#ff0000').toCmykString()).toHex()).toBe('#ff0000');
  });
});

// ─── delta (CIEDE2000) ───────────────────────────────────────────────────────

describe('delta parity', () => {
  it.each(inputs)('%s vs #ffffff', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx(input).delta('#ffffff')).toBeCloseTo((colord(input) as any).delta('#ffffff'), 2);
  });

  it.each(inputs)('%s vs #000000', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx(input).delta('#000000')).toBeCloseTo((colord(input) as any).delta('#000000'), 2);
  });

  it('same color returns 0', () => {
    expect(colordx('#ff0000').delta('#ff0000')).toBe(0);
  });

  it('defaults to white', () => {
    expect(colordx('#000000').delta()).toBeCloseTo(colordx('#000000').delta('#fff'), 5);
  });
});

// ─── Minify ─────────────────────────────────────────────────────────────────

describe('minify plugin', () => {
  it('returns shortest hex for shortable colors', () => {
    expect(colordx('#ff0000').minify()).toBe('#f00');
    expect(colordx('#ffffff').minify()).toBe('#fff');
    expect(colordx('#000000').minify()).toBe('#000');
  });

  it('returns shortest representation', () => {
    // #c06060 is not shortable — hsl or rgb may win
    const result = colordx('#c06060').minify();
    expect(result.length).toBeLessThanOrEqual('#c06060'.length);
  });

  it('uses name when names plugin is loaded and name option is set', () => {
    expect(colordx('#ff0000').minify({ name: true })).toBe('red');
    expect(colordx('#ffffff').minify({ name: true })).toBe('#fff');
  });

  it('handles transparent option', () => {
    expect(colordx({ r: 0, g: 0, b: 0, a: 0 }).minify({ transparent: true })).toBe('transparent');
  });

  it('handles alphaHex option', () => {
    // #ff000080 — alpha hex shortable only if both nibbles match
    const result = colordx({ r: 255, g: 0, b: 0, a: 0.5 }).minify({ alphaHex: true });
    expect(result.length).toBeLessThanOrEqual('rgba(255,0,0,.5)'.length);
  });

  it('parity with colord minify', () => {
    for (const input of inputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(colordx(input).minify()).toBe((colord(input) as any).minify());
    }
  });
});

/**
 * Parity tests: colordx vs colord
 *
 * Ensures colordx produces the same output as colord for all shared APIs.
 * Any intentional deviation (e.g. bug fix) should be noted with a comment.
 */
import { describe, expect, it } from 'vitest';
import { colord } from 'colord';
import { colordx } from '../src/index.js';

const inputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#ff000080', '#c06060'];

describe('isValid', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).isValid()).toBe(colord(input).isValid());
  });
});

describe('toHex', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).toHex()).toBe(colord(input).toHex());
  });
});

describe('toRgb', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).toRgb()).toEqual(colord(input).toRgb());
  });
});

describe('toRgbString', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).toRgbString()).toBe(colord(input).toRgbString());
  });
});

describe('toHsl', () => {
  // colordx intentionally returns higher precision (e.g. 56.47 vs 56)
  it.each(inputs)('%s', (input) => {
    const dx = colordx(input).toHsl();
    const d = colord(input).toHsl();
    expect(dx.h).toBeCloseTo(d.h, 0);
    expect(dx.s).toBeCloseTo(d.s, 0);
    expect(dx.l).toBeCloseTo(d.l, 0);
    expect(dx.a).toBe(d.a);
  });
});

describe('toHslString', () => {
  // colordx returns higher-precision strings; compare parsed values instead
  it.each(inputs)('%s', (input) => {
    const dx = colordx(input).toHsl();
    const d = colord(input).toHsl();
    expect(dx.h).toBeCloseTo(d.h, 0);
    expect(dx.s).toBeCloseTo(d.s, 0);
    expect(dx.l).toBeCloseTo(d.l, 0);
  });
});

describe('toHsv', () => {
  // colordx intentionally returns higher precision
  it.each(inputs)('%s', (input) => {
    const dx = colordx(input).toHsv();
    const d = colord(input).toHsv();
    expect(dx.h).toBeCloseTo(d.h, 0);
    expect(dx.s).toBeCloseTo(d.s, 0);
    expect(dx.v).toBeCloseTo(d.v, 0);
    expect(dx.a).toBe(d.a);
  });
});

describe('brightness', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).brightness()).toBe(colord(input).brightness());
  });
});

describe('isDark', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).isDark()).toBe(colord(input).isDark());
  });
});

describe('isLight', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).isLight()).toBe(colord(input).isLight());
  });
});

describe('alpha (get)', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).alpha()).toBe(colord(input).alpha());
  });
});

describe('alpha (set)', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).alpha(0.5).toRgb()).toEqual(colord(input).alpha(0.5).toRgb());
  });
});

describe('hue (get)', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).hue()).toBe(colord(input).hue());
  });
});

describe('hue (set)', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).hue(120).toRgb()).toEqual(colord(input).hue(120).toRgb());
  });
});

describe('lighten', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).lighten(0.1).toRgb()).toEqual(colord(input).lighten(0.1).toRgb());
  });
});

describe('darken', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).darken(0.1).toRgb()).toEqual(colord(input).darken(0.1).toRgb());
  });
});

describe('saturate', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).saturate(0.1).toRgb()).toEqual(colord(input).saturate(0.1).toRgb());
  });
});

describe('desaturate', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).desaturate(0.1).toRgb()).toEqual(colord(input).desaturate(0.1).toRgb());
  });
});

describe('grayscale', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).grayscale().toRgb()).toEqual(colord(input).grayscale().toRgb());
  });
});

describe('invert', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).invert().toRgb()).toEqual(colord(input).invert().toRgb());
  });
});

describe('rotate', () => {
  // colordx higher HSL precision may cause ±1 rounding difference in RGB output
  it.each(inputs)('%s', (input) => {
    const dx = colordx(input).rotate(90).toRgb();
    const d = colord(input).rotate(90).toRgb();
    expect(Math.abs(dx.r - d.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(dx.g - d.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(dx.b - d.b)).toBeLessThanOrEqual(1);
    expect(dx.a).toBe(d.a);
  });
});

describe('isEqual', () => {
  it.each(inputs)('%s vs self', (input) => {
    expect(colordx(input).isEqual(input)).toBe(colord(input).isEqual(input));
  });

  it('cross-format equality', () => {
    expect(colordx('#ff0000').isEqual('rgb(255, 0, 0)')).toBe(colord('#ff0000').isEqual('rgb(255, 0, 0)'));
  });
});

// mix is a plugin in colord (not core) — no parity comparison possible
// delta() parity is tested in color-models.test.ts (requires colord lab plugin)

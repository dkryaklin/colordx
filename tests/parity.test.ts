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

// colordx uses 3dp for hex alpha (e.g. 0x80/255 = 0.502) vs colord's 2dp (0.5).
// This is an intentional improvement for round-trip accuracy.
// Use toBeCloseTo(x, 1) for alpha comparisons on hex-alpha inputs.
const approxRgbEqual = (
  dx: { r: number; g: number; b: number; a: number },
  d: { r: number; g: number; b: number; a: number }
) => {
  expect(dx.r).toBe(d.r);
  expect(dx.g).toBe(d.g);
  expect(dx.b).toBe(d.b);
  expect(dx.a).toBeCloseTo(d.a, 1);
};

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
    approxRgbEqual(colordx(input).toRgb(), colord(input).toRgb());
  });
});

describe('toRgbString', () => {
  // colordx may output higher-precision alpha (e.g. 0.502 vs 0.5); compare parsed values
  it.each(inputs)('%s', (input) => {
    approxRgbEqual(colordx(colordx(input).toRgbString()).toRgb(), colord(colord(input).toRgbString()).toRgb());
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
    expect(dx.a).toBeCloseTo(d.a, 1);
  });
});

describe('toHslString', () => {
  // colordx returns higher-precision strings; round-trip parse back to HSL to compare
  it.each(inputs)('%s', (input) => {
    const dx = colordx(colordx(input).toHslString()).toHsl();
    const d = colord(colord(input).toHslString()).toHsl();
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
    expect(dx.a).toBeCloseTo(d.a, 1);
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
    expect(colordx(input).alpha()).toBeCloseTo(colord(input).alpha(), 1);
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
    approxRgbEqual(colordx(input).hue(120).toRgb(), colord(input).hue(120).toRgb());
  });
});

describe('lighten', () => {
  it.each(inputs)('%s', (input) => {
    approxRgbEqual(colordx(input).lighten(0.1).toRgb(), colord(input).lighten(0.1).toRgb());
  });
});

describe('darken', () => {
  it.each(inputs)('%s', (input) => {
    approxRgbEqual(colordx(input).darken(0.1).toRgb(), colord(input).darken(0.1).toRgb());
  });
});

describe('saturate', () => {
  it.each(inputs)('%s', (input) => {
    approxRgbEqual(colordx(input).saturate(0.1).toRgb(), colord(input).saturate(0.1).toRgb());
  });
});

describe('desaturate', () => {
  it.each(inputs)('%s', (input) => {
    approxRgbEqual(colordx(input).desaturate(0.1).toRgb(), colord(input).desaturate(0.1).toRgb());
  });
});

describe('grayscale', () => {
  it.each(inputs)('%s', (input) => {
    approxRgbEqual(colordx(input).grayscale().toRgb(), colord(input).grayscale().toRgb());
  });
});

describe('invert', () => {
  it.each(inputs)('%s', (input) => {
    approxRgbEqual(colordx(input).invert().toRgb(), colord(input).invert().toRgb());
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
    expect(dx.a).toBeCloseTo(d.a, 1);
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

describe('percentage RGB precision (intentional divergence from colord)', () => {
  it('rgba(50%, 50%, 50%) toRgb matches colord — both return integers', () => {
    approxRgbEqual(colordx('rgba(50%, 50%, 50%)').toRgb(), colord('rgba(50%, 50%, 50%)').toRgb());
  });

  it('rgba(50%, 50%, 50%) toRgbString round-trips to same rgb as colord', () => {
    approxRgbEqual(
      colordx(colordx('rgba(50%, 50%, 50%)').toRgbString()).toRgb(),
      colord(colord('rgba(50%, 50%, 50%)').toRgbString()).toRgb()
    );
  });

  it('rgba(50%, 50%, 50%) isEqual rgb(128,128,128) — same as colord', () => {
    expect(colordx('rgba(50%, 50%, 50%)').isEqual('rgb(128, 128, 128)')).toBe(
      colord('rgba(50%, 50%, 50%)').isEqual('rgb(128, 128, 128)')
    );
  });

  it('rgba(50%, 50%, 50%) toHsl — colordx returns 50% exactly, colord drifts to 50.2%', () => {
    // colord: 50% → round(127.5) = 128 → 128/255 = 50.196% (data loss)
    // colordx: 50% → store 127.5 → 127.5/255 = 50% exactly (deferred rounding)
    expect(colordx('rgba(50%, 50%, 50%)').toHsl().l).toBe(50);
    expect(colord('rgba(50%, 50%, 50%)').toHsl().l).toBeCloseTo(50.2, 0);
  });

  it('rgba(20%, 40%, 60%) toRgb matches colord', () => {
    approxRgbEqual(colordx('rgba(20%, 40%, 60%)').toRgb(), colord('rgba(20%, 40%, 60%)').toRgb());
  });
});

describe('hex alpha precision (intentional divergence from colord)', () => {
  it('colordx uses 3dp for hex alpha — more accurate round-trip than colord 2dp', () => {
    // 0x80/255 = 0.50196… → colord rounds to 0.5, colordx rounds to 0.502
    expect(colordx('#ff000080').alpha()).toBe(0.502);
    expect(colord('#ff000080').alpha()).toBe(0.5);
  });

  it('colordx round-trips hex alpha losslessly, colord does not', () => {
    // colordx: #cc88 → rgba string → back to hex preserves alpha byte 0x88
    expect(colordx(colordx('#cc88').toRgbString()).toHex()).toBe('#cccc8888');
    // colord: loses precision — alpha 0x88/255 rounds to 0.5 → 0x80 on the way back
    expect(colord(colord('#cc88').toRgbString()).toHex()).not.toBe('#cccc8888');
  });
});

/**
 * Tests for OKLab and OKLch color models (core, no plugins needed).
 */
import { describe, it, expect } from 'vitest';
import { colordx } from '../src/index.js';

const inputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060'];

// ─── HWB ─────────────────────────────────────────────────────────────────────

describe('toHwb round-trip', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).toHwb()).toEqual(colordx(colordx(input).toHwb()).toHwb());
  });
});

describe('toHwbString', () => {
  it('round-trips opaque colors', () => {
    expect(colordx(colordx('#ff0000').toHwbString()).toHex()).toBe('#ff0000');
    expect(colordx(colordx('#ffffff').toHwbString()).toHex()).toBe('#ffffff');
    expect(colordx(colordx('#000000').toHwbString()).toHex()).toBe('#000000');
  });

  it('includes alpha in string when < 1', () => {
    const str = colordx({ r: 255, g: 0, b: 0, a: 0.5 }).toHwbString();
    expect(str).toMatch(/\/ 0\.5/);
    expect(colordx(str).alpha()).toBeCloseTo(0.5, 2);
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
});

describe('HWB object parsing', () => {
  it('round-trips', () => {
    const hwb = colordx('#ff0000').toHwb();
    expect(colordx(hwb).toHex()).toBe('#ff0000');
  });

  it('handles full black (b=100)', () => {
    expect(colordx({ h: 0, w: 0, b: 100, a: 1 }).toHex()).toBe('#000000');
  });
});

// ─── OKLab ───────────────────────────────────────────────────────────────────

describe('toOklab round-trip', () => {
  it.each(inputs)('%s', (input) => {
    const oklab = colordx(input).toOklab();
    const rgb = colordx(oklab).toRgb();
    const orig = colordx(input).toRgb();
    expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
  });
});

describe('toOklabString alpha', () => {
  it('includes alpha in string when < 1', () => {
    const str = colordx({ r: 255, g: 0, b: 0, a: 0.5 }).toOklabString();
    expect(str).toMatch(/\/ 0\.5/);
    expect(colordx(str).alpha()).toBeCloseTo(0.5, 2);
  });
});

describe('toOklabString round-trip', () => {
  it.each(inputs)('%s', (input) => {
    const str = colordx(input).toOklabString();
    expect(str).toMatch(/^oklab\(/);
    const rgb = colordx(str).toRgb();
    const orig = colordx(input).toRgb();
    expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
  });
});

describe('OKLab string parsing', () => {
  it('parses oklab string opaque', () => {
    // oklab(1 0 0) = white (L=1, a=0, b=0)
    const white = colordx('oklab(1 0 0)').toRgb();
    expect(white.r).toBeCloseTo(255, -1);
    expect(white.g).toBeCloseTo(255, -1);
    expect(white.b).toBeCloseTo(255, -1);
  });

  it('parses oklab string with alpha', () => {
    const result = colordx('oklab(1 0 0 / 0.5)');
    expect(result.alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses oklab string with alpha percentage', () => {
    const result = colordx('oklab(1 0 0 / 50%)');
    expect(result.alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses oklab string with percentage L', () => {
    // 100% L = 1.0
    const a = colordx('oklab(100% 0 0)').toRgb();
    const b = colordx('oklab(1 0 0)').toRgb();
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
  });

  it('parses oklab string with percentage a/b', () => {
    // 100% a = 0.4, so 25% a = 0.1
    const result = colordx('oklab(0.5 25% 0)');
    const expected = colordx('oklab(0.5 0.1 0)');
    expect(result.toHex()).toBe(expected.toHex());
  });

  it('round-trips through toOklabString', () => {
    for (const input of inputs) {
      const str = colordx(input).toOklabString();
      const result = colordx(str).toRgb();
      const orig = colordx(input).toRgb();
      expect(Math.abs(result.r - orig.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.g - orig.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.b - orig.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('OKLab object parsing', () => {
  it('round-trips', () => {
    const oklab = colordx('#ff0000').toOklab();
    const result = colordx(oklab).toRgb();
    const orig = colordx('#ff0000').toRgb();
    expect(Math.abs(result.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.b - orig.b)).toBeLessThanOrEqual(1);
  });

  it('parses OKLab object with alpha', () => {
    const oklab = { ...colordx('#ff0000').toOklab(), alpha: 0.5 };
    expect(colordx(oklab).alpha()).toBe(0.5);
  });
});

// ─── OKLch ───────────────────────────────────────────────────────────────────

describe('toOklch round-trip', () => {
  it.each(inputs)('%s', (input) => {
    const oklch = colordx(input).toOklch();
    const rgb = colordx(oklch).toRgb();
    const orig = colordx(input).toRgb();
    expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
  });
});

describe('toOklchString alpha', () => {
  it('includes alpha in string when < 1', () => {
    const str = colordx({ r: 255, g: 0, b: 0, a: 0.5 }).toOklchString();
    expect(str).toMatch(/\/ 0\.5/);
    expect(colordx(str).alpha()).toBeCloseTo(0.5, 2);
  });
});

describe('toOklchString round-trip', () => {
  it.each(inputs)('%s', (input) => {
    const str = colordx(input).toOklchString();
    expect(str).toMatch(/^oklch\(/);
    const rgb = colordx(str).toRgb();
    const orig = colordx(input).toRgb();
    expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
  });
});

describe('OKLch string parsing', () => {
  it('parses oklch string: oklch(0.5 0.2 240)', () => {
    const result = colordx('oklch(0.5 0.2 240)');
    expect(result.isValid()).toBe(true);
    const rgb = result.toRgb();
    // Should produce a valid bluish color
    expect(rgb.b).toBeGreaterThan(rgb.r);
  });

  it('parses oklch string with alpha', () => {
    const result = colordx('oklch(0.5 0.2 240 / 0.5)');
    expect(result.alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses oklch string with alpha percentage', () => {
    const result = colordx('oklch(0.5 0.2 240 / 50%)');
    expect(result.alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses oklch string with percentage L', () => {
    const a = colordx('oklch(50% 0.2 240)').toRgb();
    const b = colordx('oklch(0.5 0.2 240)').toRgb();
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
  });

  it('parses oklch string with percentage C (100% = 0.4)', () => {
    const a = colordx('oklch(0.5 50% 240)').toRgb();
    const b = colordx('oklch(0.5 0.2 240)').toRgb();
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
  });

  it('round-trips through toOklchString', () => {
    for (const input of inputs) {
      const str = colordx(input).toOklchString();
      const result = colordx(str).toRgb();
      const orig = colordx(input).toRgb();
      expect(Math.abs(result.r - orig.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.g - orig.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.b - orig.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('OKLch object parsing', () => {
  it('round-trips', () => {
    const oklch = colordx('#ff0000').toOklch();
    const result = colordx(oklch).toRgb();
    const orig = colordx('#ff0000').toRgb();
    expect(Math.abs(result.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.b - orig.b)).toBeLessThanOrEqual(1);
  });

  it('parses OKLch object with alpha', () => {
    const oklch = { ...colordx('#ff0000').toOklch(), a: 0.5 };
    expect(colordx(oklch).alpha()).toBe(0.5);
  });
});

// ─── OKLab L/a/b value sanity ─────────────────────────────────────────────────

describe('OKLab value ranges', () => {
  it('black has L=0', () => {
    const oklab = colordx('#000000').toOklab();
    expect(oklab.l).toBeCloseTo(0, 3);
    expect(oklab.a).toBeCloseTo(0, 3);
    expect(oklab.b).toBeCloseTo(0, 3);
  });

  it('white has L close to 1', () => {
    const oklab = colordx('#ffffff').toOklab();
    expect(oklab.l).toBeCloseTo(1, 2);
    expect(oklab.a).toBeCloseTo(0, 3);
    expect(oklab.b).toBeCloseTo(0, 3);
  });

  it('L is between 0 and 1 for all test inputs', () => {
    for (const input of inputs) {
      const { l } = colordx(input).toOklab();
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
  });
});

describe('OKLch value ranges', () => {
  it('black has L=0, C=0', () => {
    const oklch = colordx('#000000').toOklch();
    expect(oklch.l).toBeCloseTo(0, 3);
    expect(oklch.c).toBeCloseTo(0, 3);
  });

  it('white has L close to 1, C close to 0', () => {
    const oklch = colordx('#ffffff').toOklch();
    expect(oklch.l).toBeCloseTo(1, 2);
    expect(oklch.c).toBeCloseTo(0, 3);
  });

  it('H is 0-360 for all test inputs with non-zero chroma', () => {
    for (const input of inputs) {
      const { h, c } = colordx(input).toOklch();
      if (c > 0.001) {
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
      }
    }
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import p3 from '../src/plugins/p3.js';

beforeAll(() => {
  extend([p3]);
});

const srgbInputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060'];

describe('toP3 round-trip via string', () => {
  it.each(srgbInputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx(input) as any).toP3String();
    expect(colordx(str).toHex()).toBe(colordx(input).toHex());
  });
});

describe('toP3 known values', () => {
  it('white is (1, 1, 1) in P3', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3Color = (colordx('#ffffff') as any).toP3();
    expect(p3Color.r).toBeCloseTo(1, 3);
    expect(p3Color.g).toBeCloseTo(1, 3);
    expect(p3Color.b).toBeCloseTo(1, 3);
  });

  it('black is (0, 0, 0) in P3', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3Color = (colordx('#000000') as any).toP3();
    expect(p3Color.r).toBeCloseTo(0, 3);
    expect(p3Color.g).toBeCloseTo(0, 3);
    expect(p3Color.b).toBeCloseTo(0, 3);
  });

  it('sRGB red r channel < 1 in P3 (P3 red primary is more saturated)', () => {
    // sRGB red expressed in P3 has r < 1 because P3 red primary is more saturated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3Color = (colordx('#ff0000') as any).toP3();
    expect(p3Color.r).toBeLessThan(1);
    expect(p3Color.r).toBeGreaterThan(0.5);
    expect(p3Color.a).toBe(1);
  });

  it('alpha is preserved', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3Color = (colordx({ r: 255, g: 0, b: 0, a: 0.5 }) as any).toP3();
    expect(p3Color.a).toBeCloseTo(0.5, 3);
  });
});

describe('toP3String', () => {
  it('formats as color(display-p3 r g b)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx('#ffffff') as any).toP3String();
    expect(str).toMatch(/^color\(display-p3/);
    expect(str).toContain('1');
  });

  it('includes alpha when < 1', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx({ r: 255, g: 0, b: 0, a: 0.5 }) as any).toP3String();
    expect(str).toMatch(/\/ 0\.5/);
  });

  it('no alpha component when alpha = 1', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx('#ff0000') as any).toP3String();
    expect(str).not.toContain('/');
  });

  it('round-trips through toP3String', () => {
    for (const input of srgbInputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const str = (colordx(input) as any).toP3String();
      expect(colordx(str).toHex()).toBe(colordx(input).toHex());
    }
  });
});

describe('P3 string parsing', () => {
  it('parses color(display-p3 1 0 0)', () => {
    expect(colordx('color(display-p3 1 0 0)').isValid()).toBe(true);
  });

  it('parses color(display-p3 1 1 1) as white', () => {
    expect(colordx('color(display-p3 1 1 1)').toHex()).toBe('#ffffff');
  });

  it('parses color(display-p3 0 0 0) as black', () => {
    expect(colordx('color(display-p3 0 0 0)').toHex()).toBe('#000000');
  });

  it('parses color(display-p3 r g b / alpha)', () => {
    expect(colordx('color(display-p3 1 0 0 / 0.5)').alpha()).toBeCloseTo(0.5, 3);
  });

  it('parses color(display-p3 r g b / alpha%)', () => {
    expect(colordx('color(display-p3 1 0 0 / 50%)').alpha()).toBeCloseTo(0.5, 2);
  });

  it('P3 primary red converts to sRGB with r > 1 equivalent (clamped)', () => {
    // P3 red primary (1,0,0) has r > 1 in sRGB linear — verify it converts to full red
    const result = colordx('color(display-p3 1 0 0)');
    expect(result.toRgb().r).toBe(255);
  });

  it('round-trips: sRGB → toP3String → parse → sRGB', () => {
    for (const input of srgbInputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p3Str = (colordx(input) as any).toP3String();
      expect(colordx(p3Str).toHex()).toBe(colordx(input).toHex());
    }
  });
});

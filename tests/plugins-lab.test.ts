import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import cmyk from '../src/plugins/cmyk.js';
import delta from '../src/plugins/delta.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';

beforeAll(() => {
  extend([lab, lch, cmyk, delta]);
});

const inputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060'];

describe('toLab round-trip', () => {
  it.each(inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lab = (colordx(input) as any).toLab();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (colordx(lab) as any).toHex();
    expect(result).toBe(colordx(input).toHex());
  });
});

describe('toXyz round-trip', () => {
  it.each(inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xyz = (colordx(input) as any).toXyz();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (colordx(xyz) as any).toHex();
    expect(result).toBe(colordx(input).toHex());
  });
});

describe('toLch round-trip', () => {
  it.each(inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lch = (colordx(input) as any).toLch();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (colordx(lch) as any).toHex();
    expect(result).toBe(colordx(input).toHex());
  });
});

describe('LCH string parsing', () => {
  it('round-trips through toLchString', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx((colordx('#ff0000') as any).toLchString()).toHex()).toBe('#ff0000');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx((colordx('#0000ff') as any).toLchString()).toHex()).toBe('#0000ff');
  });

  it('parses lch string with alpha as percentage', () => {
    expect(colordx('lch(50% 50 180 / 50%)').alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses lch string with alpha decimal', () => {
    expect(colordx('lch(50% 50 180 / 0.5)').alpha()).toBeCloseTo(0.5, 2);
  });
});

describe('toCmyk round-trip', () => {
  it.each(inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx((colordx(input) as any).toCmyk()).toHex()).toBe(colordx(input).toHex());
  });
});

describe('CMYK black (k=100 edge case)', () => {
  it('pure black has c=m=y=0, k=100', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#000000') as any).toCmyk()).toEqual({ c: 0, m: 0, y: 0, k: 100, a: 1 });
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx((colordx('#ff0000') as any).toCmykString()).toHex()).toBe('#ff0000');
  });
});

describe('delta', () => {
  it('same color returns 0', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#ff0000') as any).delta('#ff0000')).toBe(0);
  });

  it('defaults to white', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = colordx('#000000') as any;
    expect(d.delta()).toBeCloseTo(d.delta('#fff'), 5);
  });

  it('black vs white is max distance', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#000000') as any).delta('#ffffff')).toBeGreaterThan(0.9);
  });

  it('different colors have non-zero delta', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#ff0000') as any).delta('#0000ff')).toBeGreaterThan(0);
  });
});

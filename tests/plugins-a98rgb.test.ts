import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend, getFormat } from '../src/index.js';
import a98 from '../src/plugins/a98rgb.js';

beforeAll(() => {
  extend([a98]);
});

const srgbInputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060'];

describe('toA98 round-trip via string', () => {
  it.each(srgbInputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx(input) as any).toA98String();
    expect(colordx(str).toHex()).toBe(colordx(input).toHex());
  });
});

describe('toA98 known values', () => {
  it('white is (1, 1, 1) in A98', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (colordx('#ffffff') as any).toA98();
    expect(a.r).toBe(1);
    expect(a.g).toBe(1);
    expect(a.b).toBe(1);
  });

  it('black is (0, 0, 0) in A98', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (colordx('#000000') as any).toA98();
    expect(a.r).toBe(0);
    expect(a.g).toBe(0);
    expect(a.b).toBe(0);
  });

  it('sRGB red r channel < 1 in A98 (A98 red primary is more saturated)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (colordx('#ff0000') as any).toA98();
    expect(a.r).toBeLessThan(1);
    expect(a.r).toBeGreaterThan(0.5);
    expect(a.alpha).toBe(1);
  });

  it('A98 green channel passes through: sRGB green g channel is exactly 1 in A98', () => {
    // The sRGB→A98 matrix leaves the green channel unchanged (g row is identity). The red and
    // blue channels still pick up a green component (sRGB green is inside A98's wider green).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (colordx('#00ff00') as any).toA98();
    expect(a.g).toBe(1);
    expect(a.r).toBeGreaterThan(0);
    expect(a.r).toBeLessThan(1);
  });

  it('alpha is preserved', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).toA98();
    expect(a.alpha).toBe(0.5);
  });
});

describe('toA98String', () => {
  it('formats as color(a98-rgb r g b)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx('#ffffff') as any).toA98String();
    expect(str).toMatch(/^color\(a98-rgb/);
  });

  it('includes alpha when < 1', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).toA98String();
    expect(str).toMatch(/\/ 0\.5/);
  });

  it('no alpha component when alpha = 1', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx('#ff0000') as any).toA98String();
    expect(str).not.toContain('/');
  });
});

describe('A98 string parsing', () => {
  it('parses color(a98-rgb 1 1 1) as white', () => {
    expect(colordx('color(a98-rgb 1 1 1)').toHex()).toBe('#ffffff');
  });

  it('parses color(a98-rgb 0 0 0) as black', () => {
    expect(colordx('color(a98-rgb 0 0 0)').toHex()).toBe('#000000');
  });

  it('parses color(a98-rgb r g b / alpha)', () => {
    expect(colordx('color(a98-rgb 1 0 0 / 0.5)').alpha()).toBe(0.5);
  });

  it('parses color(a98-rgb r g b / alpha%)', () => {
    expect(colordx('color(a98-rgb 1 0 0 / 50%)').alpha()).toBe(0.5);
  });

  it('A98 primary red converts to sRGB with clamped full red', () => {
    const result = colordx('color(a98-rgb 1 0 0)');
    expect(result.toRgb().r).toBe(255);
  });

  it('A98 green (0 1 0) maps to full green in sRGB', () => {
    expect(colordx('color(a98-rgb 0 1 0)').toRgb().g).toBe(255);
  });

  it('round-trips: sRGB → toA98String → parse → sRGB', () => {
    for (const input of srgbInputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const str = (colordx(input) as any).toA98String();
      expect(colordx(str).toHex()).toBe(colordx(input).toHex());
    }
  });
});

const extendedA98Inputs = ['#ff8800', '#8800ff', '#00ffff', '#ff00ff', '#808080', '#3b82f6'];

describe('toA98: extended round-trips', () => {
  it.each(extendedA98Inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx(input) as any).toA98String();
    expect(colordx(str).toHex()).toBe(colordx(input).toHex());
  });
});

describe('toA98: channel value properties', () => {
  it('mid-gray maps to equal r=g=b in A98', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = (colordx('#808080') as any).toA98();
    expect(Math.abs(a.r - a.g)).toBeLessThan(0.01);
    expect(Math.abs(a.g - a.b)).toBeLessThan(0.01);
  });

  it('fractional A98 values are valid', () => {
    expect(colordx('color(a98-rgb 0.5 0.5 0.5)').isValid()).toBe(true);
  });
});

describe('A98 object parsing', () => {
  it('parses { r, g, b, colorSpace: "a98-rgb" }', () => {
    expect(colordx({ r: 1, g: 1, b: 1, alpha: 1, colorSpace: 'a98-rgb' } as any).isValid()).toBe(true);
  });

  it('white A98 object → #ffffff', () => {
    expect(colordx({ r: 1, g: 1, b: 1, alpha: 1, colorSpace: 'a98-rgb' } as any).toHex()).toBe('#ffffff');
  });

  it('alpha is preserved from A98 object', () => {
    expect(colordx({ r: 1, g: 0, b: 0, alpha: 0.5, colorSpace: 'a98-rgb' } as any).alpha()).toBe(0.5);
  });

  it('defaults alpha to 1 when omitted', () => {
    expect(colordx({ r: 1, g: 1, b: 1, colorSpace: 'a98-rgb' } as any).alpha()).toBe(1);
  });

  it('getFormat returns "a98-rgb" for A98 object', () => {
    expect(getFormat({ r: 1, g: 0, b: 0, alpha: 1, colorSpace: 'a98-rgb' } as any)).toBe('a98-rgb');
  });

  it('plain { r, g, b } without colorSpace still parses as sRGB', () => {
    expect(getFormat({ r: 255, g: 0, b: 0, alpha: 1 })).toBe('rgb');
  });

  it('round-trip: toA98() object → parse back → same hex', () => {
    for (const input of srgbInputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = (colordx(input) as any).toA98();
      expect(colordx(a).toHex()).toBe(colordx(input).toHex());
    }
  });
});

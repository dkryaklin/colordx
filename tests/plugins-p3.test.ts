import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend, getFormat } from '../src/index.js';
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
    expect(p3Color.alpha).toBe(1);
  });

  it('alpha is preserved', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3Color = (colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).toP3();
    expect(p3Color.alpha).toBeCloseTo(0.5, 3);
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
    const str = (colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).toP3String();
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

const extendedP3Inputs = ['#ff8800', '#8800ff', '#00ffff', '#ff00ff', '#808080', '#3b82f6'];

describe('toP3: extended round-trips', () => {
  it.each(extendedP3Inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx(input) as any).toP3String();
    expect(colordx(str).toHex()).toBe(colordx(input).toHex());
  });
});

describe('toP3: channel value properties', () => {
  it('sRGB green r channel is less than sRGB red r channel in P3', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3Green = (colordx('#00ff00') as any).toP3();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3Red = (colordx('#ff0000') as any).toP3();
    // Green-dominant color should have much lower r than a red-dominant color
    expect(p3Green.r).toBeLessThan(p3Red.r);
  });

  it('sRGB blue b channel is less than 1 in P3', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3 = (colordx('#0000ff') as any).toP3();
    expect(p3.b).toBeLessThan(1);
    expect(p3.b).toBeGreaterThan(0.5);
  });

  it('mid-gray maps to equal r=g=b in P3', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p3 = (colordx('#808080') as any).toP3();
    expect(Math.abs(p3.r - p3.g)).toBeLessThan(0.01);
    expect(Math.abs(p3.g - p3.b)).toBeLessThan(0.01);
  });

  it('alpha 0 in P3 is fully transparent', () => {
    expect(colordx('color(display-p3 1 0 0 / 0)').alpha()).toBe(0);
  });

  it('alpha 1 in P3 is fully opaque', () => {
    expect(colordx('color(display-p3 1 0 0 / 1)').alpha()).toBe(1);
  });

  it('P3 green (0 1 0) maps to full green in sRGB', () => {
    expect(colordx('color(display-p3 0 1 0)').toRgb().g).toBe(255);
  });

  it('P3 blue (0 0 1) maps to full blue in sRGB', () => {
    expect(colordx('color(display-p3 0 0 1)').toRgb().b).toBe(255);
  });
});

describe('toP3String: format verification', () => {
  it('opaque color string has no slash', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx('#3b82f6') as any).toP3String();
    expect(str).not.toContain('/');
    expect(str).toMatch(/^color\(display-p3 /);
  });

  it('semi-transparent color string has slash and alpha', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx({ r: 100, g: 150, b: 200, alpha: 0.7 }) as any).toP3String();
    expect(str).toContain('/ 0.7');
  });

  it('P3 (0.5 0.5 0.5) is a valid parseable color', () => {
    expect(colordx('color(display-p3 0.5 0.5 0.5)').isValid()).toBe(true);
  });
});

describe('P3 object parsing', () => {
  it('parses { r, g, b, colorSpace: "display-p3" }', () => {
    expect(colordx({ r: 1, g: 1, b: 1, alpha: 1, colorSpace: 'display-p3' } as any).isValid()).toBe(true);
  });

  it('white P3 object → #ffffff', () => {
    expect(colordx({ r: 1, g: 1, b: 1, alpha: 1, colorSpace: 'display-p3' } as any).toHex()).toBe('#ffffff');
  });

  it('black P3 object → #000000', () => {
    expect(colordx({ r: 0, g: 0, b: 0, alpha: 1, colorSpace: 'display-p3' } as any).toHex()).toBe('#000000');
  });

  it('alpha is preserved from P3 object', () => {
    expect(colordx({ r: 1, g: 0, b: 0, alpha: 0.5, colorSpace: 'display-p3' } as any).alpha()).toBeCloseTo(0.5, 3);
  });

  it('defaults alpha to 1 when omitted', () => {
    expect(colordx({ r: 1, g: 1, b: 1, colorSpace: 'display-p3' } as any).alpha()).toBe(1);
  });

  it('getFormat returns "p3" for P3 object', () => {
    expect(getFormat({ r: 1, g: 0, b: 0, alpha: 1, colorSpace: 'display-p3' } as any)).toBe('p3');
  });

  it('plain { r, g, b } without colorSpace still parses as sRGB', () => {
    expect(getFormat({ r: 255, g: 0, b: 0, alpha: 1 })).toBe('rgb');
  });

  it('round-trip: toP3() object → parse back → same hex', () => {
    for (const input of srgbInputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p3Color = (colordx(input) as any).toP3();
      expect(colordx(p3Color).toHex()).toBe(colordx(input).toHex());
    }
  });
});

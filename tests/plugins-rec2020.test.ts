import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend, getFormat } from '../src/index.js';
import rec2020 from '../src/plugins/rec2020.js';

beforeAll(() => {
  extend([rec2020]);
});

const srgbInputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060'];

describe('toRec2020 round-trip via string', () => {
  it.each(srgbInputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx(input) as any).toRec2020String();
    expect(colordx(str).toHex()).toBe(colordx(input).toHex());
  });
});

describe('toRec2020 known values', () => {
  it('white is (1, 1, 1) in Rec.2020', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (colordx('#ffffff') as any).toRec2020();
    expect(rec.r).toBe(1);
    expect(rec.g).toBe(1);
    expect(rec.b).toBe(1);
  });

  it('black is (0, 0, 0) in Rec.2020', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (colordx('#000000') as any).toRec2020();
    expect(rec.r).toBe(0);
    expect(rec.g).toBe(0);
    expect(rec.b).toBe(0);
  });

  it('sRGB red r channel < 1 in Rec.2020 (Rec.2020 red primary is more saturated)', () => {
    // Rec.2020 red primary is far more saturated than sRGB red
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (colordx('#ff0000') as any).toRec2020();
    expect(rec.r).toBeLessThan(1);
    expect(rec.r).toBeGreaterThan(0.5);
    expect(rec.alpha).toBe(1);
  });

  it('alpha is preserved', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).toRec2020();
    expect(rec.alpha).toBe(0.5);
  });
});

describe('toRec2020String', () => {
  it('formats as color(rec2020 r g b)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx('#ffffff') as any).toRec2020String();
    expect(str).toMatch(/^color\(rec2020/);
  });

  it('includes alpha when < 1', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).toRec2020String();
    expect(str).toMatch(/\/ 0\.5/);
  });

  it('no alpha component when alpha = 1', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx('#ff0000') as any).toRec2020String();
    expect(str).not.toContain('/');
  });

  it('round-trips through toRec2020String', () => {
    for (const input of srgbInputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const str = (colordx(input) as any).toRec2020String();
      expect(colordx(str).toHex()).toBe(colordx(input).toHex());
    }
  });
});

describe('Rec.2020 string parsing', () => {
  it('parses color(rec2020 1 1 1) as white', () => {
    expect(colordx('color(rec2020 1 1 1)').toHex()).toBe('#ffffff');
  });

  it('parses color(rec2020 0 0 0) as black', () => {
    expect(colordx('color(rec2020 0 0 0)').toHex()).toBe('#000000');
  });

  it('parses color(rec2020 r g b / alpha)', () => {
    expect(colordx('color(rec2020 1 0 0 / 0.5)').alpha()).toBe(0.5);
  });

  it('parses color(rec2020 r g b / alpha%)', () => {
    expect(colordx('color(rec2020 1 0 0 / 50%)').alpha()).toBe(0.5);
  });

  it('Rec.2020 primary red converts to sRGB with clamped full red', () => {
    // Rec.2020 red primary (1,0,0) has r > 1 in linear sRGB — verify it converts to max red
    const result = colordx('color(rec2020 1 0 0)');
    expect(result.toRgb().r).toBe(255);
  });

  it('round-trips: sRGB → toRec2020String → parse → sRGB', () => {
    for (const input of srgbInputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const str = (colordx(input) as any).toRec2020String();
      expect(colordx(str).toHex()).toBe(colordx(input).toHex());
    }
  });
});

const extendedRec2020Inputs = ['#ff8800', '#8800ff', '#00ffff', '#ff00ff', '#808080', '#3b82f6'];

describe('toRec2020: extended round-trips', () => {
  it.each(extendedRec2020Inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx(input) as any).toRec2020String();
    expect(colordx(str).toHex()).toBe(colordx(input).toHex());
  });
});

describe('toRec2020: channel value properties', () => {
  it('sRGB red r channel is less than 1 in Rec.2020', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (colordx('#ff0000') as any).toRec2020();
    expect(rec.r).toBeLessThan(1);
    expect(rec.r).toBeGreaterThan(0.5);
  });

  it('mid-gray maps to equal r=g=b in Rec.2020', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = (colordx('#808080') as any).toRec2020();
    expect(Math.abs(rec.r - rec.g)).toBeLessThan(0.01);
    expect(Math.abs(rec.g - rec.b)).toBeLessThan(0.01);
  });

  it('alpha 0 in Rec.2020 is fully transparent', () => {
    expect(colordx('color(rec2020 1 0 0 / 0)').alpha()).toBe(0);
  });

  it('alpha 1 in Rec.2020 is fully opaque', () => {
    expect(colordx('color(rec2020 1 0 0 / 1)').alpha()).toBe(1);
  });

  it('percentage alpha parses correctly', () => {
    expect(colordx('color(rec2020 1 0 0 / 75%)').alpha()).toBe(0.75);
  });

  it('Rec.2020 green (0 1 0) maps to full green in sRGB', () => {
    expect(colordx('color(rec2020 0 1 0)').toRgb().g).toBe(255);
  });

  it('fractional Rec.2020 values are valid', () => {
    expect(colordx('color(rec2020 0.5 0.5 0.5)').isValid()).toBe(true);
  });
});

describe('toRec2020String: format verification', () => {
  it('opaque color string has no slash', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx('#3b82f6') as any).toRec2020String();
    expect(str).not.toContain('/');
    expect(str).toMatch(/^color\(rec2020 /);
  });

  it('semi-transparent color string includes alpha with slash', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx({ r: 100, g: 150, b: 200, alpha: 0.7 }) as any).toRec2020String();
    expect(str).toContain('/ 0.7');
  });
});

describe('Rec.2020 object parsing', () => {
  it('parses { r, g, b, colorSpace: "rec2020" }', () => {
    expect(colordx({ r: 1, g: 1, b: 1, alpha: 1, colorSpace: 'rec2020' } as any).isValid()).toBe(true);
  });

  it('white Rec.2020 object → #ffffff', () => {
    expect(colordx({ r: 1, g: 1, b: 1, alpha: 1, colorSpace: 'rec2020' } as any).toHex()).toBe('#ffffff');
  });

  it('black Rec.2020 object → #000000', () => {
    expect(colordx({ r: 0, g: 0, b: 0, alpha: 1, colorSpace: 'rec2020' } as any).toHex()).toBe('#000000');
  });

  it('alpha is preserved from Rec.2020 object', () => {
    expect(colordx({ r: 1, g: 0, b: 0, alpha: 0.5, colorSpace: 'rec2020' } as any).alpha()).toBe(0.5);
  });

  it('defaults alpha to 1 when omitted', () => {
    expect(colordx({ r: 1, g: 1, b: 1, colorSpace: 'rec2020' } as any).alpha()).toBe(1);
  });

  it('getFormat returns "rec2020" for Rec.2020 object', () => {
    expect(getFormat({ r: 1, g: 0, b: 0, alpha: 1, colorSpace: 'rec2020' } as any)).toBe('rec2020');
  });

  it('plain { r, g, b } without colorSpace still parses as sRGB', () => {
    expect(getFormat({ r: 255, g: 0, b: 0, alpha: 1 })).toBe('rgb');
  });

  it('round-trip: toRec2020() object → parse back → same hex', () => {
    for (const input of srgbInputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = (colordx(input) as any).toRec2020();
      expect(colordx(rec).toHex()).toBe(colordx(input).toHex());
    }
  });
});

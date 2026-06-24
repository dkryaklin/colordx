import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend, getFormat } from '../src/index.js';
import prophoto from '../src/plugins/prophoto.js';

beforeAll(() => {
  extend([prophoto]);
});

const srgbInputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060'];

describe('toProphoto round-trip via string', () => {
  it.each(srgbInputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx(input) as any).toProphotoString();
    expect(colordx(str).toHex()).toBe(colordx(input).toHex());
  });
});

describe('toProphoto known values', () => {
  it('white is (1, 1, 1) in ProPhoto', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (colordx('#ffffff') as any).toProphoto();
    expect(p.r).toBe(1);
    expect(p.g).toBe(1);
    expect(p.b).toBe(1);
  });

  it('black is (0, 0, 0) in ProPhoto', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (colordx('#000000') as any).toProphoto();
    expect(p.r).toBe(0);
    expect(p.g).toBe(0);
    expect(p.b).toBe(0);
  });

  it('sRGB red is well inside ProPhoto (r < 1, r is the dominant channel)', () => {
    // ProPhoto is very wide; sRGB red sits far inside it, so the red channel is < 1
    // and carries meaningful green/blue components (unlike a primary-aligned space).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (colordx('#ff0000') as any).toProphoto();
    expect(p.r).toBeLessThan(1);
    expect(p.r).toBeGreaterThan(0.5);
    expect(p.r).toBeGreaterThan(p.g);
    expect(p.r).toBeGreaterThan(p.b);
    expect(p.alpha).toBe(1);
  });

  it('alpha is preserved', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).toProphoto();
    expect(p.alpha).toBe(0.5);
  });
});

describe('toProphotoString', () => {
  it('formats as color(prophoto-rgb r g b)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx('#ffffff') as any).toProphotoString();
    expect(str).toMatch(/^color\(prophoto-rgb/);
  });

  it('includes alpha when < 1', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).toProphotoString();
    expect(str).toMatch(/\/ 0\.5/);
  });

  it('no alpha component when alpha = 1', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx('#ff0000') as any).toProphotoString();
    expect(str).not.toContain('/');
  });
});

describe('ProPhoto string parsing', () => {
  it('parses color(prophoto-rgb 1 1 1) as white', () => {
    expect(colordx('color(prophoto-rgb 1 1 1)').toHex()).toBe('#ffffff');
  });

  it('parses color(prophoto-rgb 0 0 0) as black', () => {
    expect(colordx('color(prophoto-rgb 0 0 0)').toHex()).toBe('#000000');
  });

  it('parses color(prophoto-rgb r g b / alpha)', () => {
    expect(colordx('color(prophoto-rgb 1 0 0 / 0.5)').alpha()).toBe(0.5);
  });

  it('parses color(prophoto-rgb r g b / alpha%)', () => {
    expect(colordx('color(prophoto-rgb 1 0 0 / 50%)').alpha()).toBe(0.5);
  });

  it('ProPhoto primary red converts to sRGB with clamped full red', () => {
    // ProPhoto red primary (1,0,0) is far outside sRGB — r > 1 in linear sRGB → clamps to 255.
    const result = colordx('color(prophoto-rgb 1 0 0)');
    expect(result.toRgb().r).toBe(255);
  });

  it('round-trips: sRGB → toProphotoString → parse → sRGB', () => {
    for (const input of srgbInputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const str = (colordx(input) as any).toProphotoString();
      expect(colordx(str).toHex()).toBe(colordx(input).toHex());
    }
  });
});

const extendedProphotoInputs = ['#ff8800', '#8800ff', '#00ffff', '#ff00ff', '#808080', '#3b82f6'];

describe('toProphoto: extended round-trips', () => {
  it.each(extendedProphotoInputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx(input) as any).toProphotoString();
    expect(colordx(str).toHex()).toBe(colordx(input).toHex());
  });
});

describe('toProphoto: channel value properties', () => {
  it('mid-gray maps to equal r=g=b in ProPhoto', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (colordx('#808080') as any).toProphoto();
    expect(Math.abs(p.r - p.g)).toBeLessThan(0.01);
    expect(Math.abs(p.g - p.b)).toBeLessThan(0.01);
  });

  it('fractional ProPhoto values are valid', () => {
    expect(colordx('color(prophoto-rgb 0.5 0.5 0.5)').isValid()).toBe(true);
  });
});

describe('ProPhoto object parsing', () => {
  it('parses { r, g, b, colorSpace: "prophoto-rgb" }', () => {
    expect(colordx({ r: 1, g: 1, b: 1, alpha: 1, colorSpace: 'prophoto-rgb' } as any).isValid()).toBe(true);
  });

  it('white ProPhoto object → #ffffff', () => {
    expect(colordx({ r: 1, g: 1, b: 1, alpha: 1, colorSpace: 'prophoto-rgb' } as any).toHex()).toBe('#ffffff');
  });

  it('alpha is preserved from ProPhoto object', () => {
    expect(colordx({ r: 1, g: 0, b: 0, alpha: 0.5, colorSpace: 'prophoto-rgb' } as any).alpha()).toBe(0.5);
  });

  it('defaults alpha to 1 when omitted', () => {
    expect(colordx({ r: 1, g: 1, b: 1, colorSpace: 'prophoto-rgb' } as any).alpha()).toBe(1);
  });

  it('getFormat returns "prophoto-rgb" for ProPhoto object', () => {
    expect(getFormat({ r: 1, g: 0, b: 0, alpha: 1, colorSpace: 'prophoto-rgb' } as any)).toBe('prophoto-rgb');
  });

  it('round-trip: toProphoto() object → parse back → same hex', () => {
    for (const input of srgbInputs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (colordx(input) as any).toProphoto();
      expect(colordx(p).toHex()).toBe(colordx(input).toHex());
    }
  });
});

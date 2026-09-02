import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend, getFormat, inGamutSrgb } from '../src/index.js';
import srgbLinear from '../src/plugins/srgb-linear.js';

beforeAll(() => {
  extend([srgbLinear]);
});

/* eslint-disable @typescript-eslint/no-explicit-any */

const srgbInputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060', '#3b82f6', '#010203'];

describe('toSrgbLinear round-trip via string', () => {
  it.each(srgbInputs)('%s', (input) => {
    const str = (colordx(input) as any).toSrgbLinearString();
    expect(colordx(str).toHex()).toBe(input);
  });
});

describe('toSrgbLinear known values', () => {
  it('primaries and white map to 0/1', () => {
    expect((colordx('#ff0000') as any).toSrgbLinear()).toEqual({
      r: 1,
      g: 0,
      b: 0,
      alpha: 1,
      colorSpace: 'srgb-linear',
    });
    expect((colordx('#ffffff') as any).toSrgbLinear()).toEqual({
      r: 1,
      g: 1,
      b: 1,
      alpha: 1,
      colorSpace: 'srgb-linear',
    });
  });

  it('mid gray decodes through the sRGB curve', () => {
    const c = (colordx('#808080') as any).toSrgbLinear();
    expect(c.r).toBeCloseTo(0.21586, 5);
    expect(c.g).toBe(c.r);
    expect(c.b).toBe(c.r);
  });

  it('precision argument is honored', () => {
    expect((colordx('#3b82f6') as any).toSrgbLinear(4)).toEqual({
      r: 0.0437,
      g: 0.2232,
      b: 0.9216,
      alpha: 1,
      colorSpace: 'srgb-linear',
    });
  });

  it('alpha is preserved', () => {
    expect((colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).toSrgbLinear().alpha).toBe(0.5);
  });

  it('wide-gamut input keeps channels outside [0, 1]', () => {
    const c = (colordx('oklch(0.7 0.3 150)') as any).toSrgbLinear();
    expect(c.r).toBeLessThan(0);
    expect(c.g).toBeGreaterThan(0);
  });
});

describe('toSrgbLinearString', () => {
  it('formats as color(srgb-linear r g b)', () => {
    expect((colordx('#3b82f6') as any).toSrgbLinearString()).toBe('color(srgb-linear 0.04374 0.22323 0.92158)');
  });

  it('includes alpha when < 1', () => {
    expect((colordx('#ff000080') as any).toSrgbLinearString()).toBe('color(srgb-linear 1 0 0 / 0.502)');
  });
});

describe('parse color(srgb-linear …)', () => {
  it.each([
    ['color(srgb-linear 1 0 0)', '#ff0000'],
    ['color(srgb-linear 100% 0% 0%)', '#ff0000'],
    ['color(srgb-linear 0.21586 0.21586 0.21586)', '#808080'],
    ['color(srgb-linear 1 none 0)', '#ff0000'],
    ['color(srgb-linear 1 0 0 / 0.5)', '#ff000080'],
    ['color(srgb-linear 1 0 0 / 50%)', '#ff000080'],
    ['COLOR(SRGB-LINEAR 1 0 0)', '#ff0000'],
    ['  color( srgb-linear  1   0   0 )  ', '#ff0000'],
  ])('%s → %s', (input, hex) => {
    expect(colordx(input).toHex()).toBe(hex);
  });

  it('out-of-gamut values parse and clip on sRGB output', () => {
    const c = colordx('color(srgb-linear 1.2 -0.1 0)');
    expect(c.isValid()).toBe(true);
    expect(c.toHex()).toBe('#ff0000');
    expect((c as any).toSrgbLinear()).toMatchObject({ r: 1.2, g: -0.1, b: 0 });
  });

  it.each([
    'color(srgb-linear 1 0)',
    'color(srgb-linear 1, 0, 0)',
    'color(srgb-linear 1 0 0 0.5)',
    'color(srgb-linear 1 0 0)x',
    'color(srgb-linear 1e2 0 0)',
    'color(srgb-linear1 0 0)',
    'color(srgblinear 1 0 0)',
  ])('rejects %s', (input) => {
    expect(colordx(input).isValid()).toBe(false);
  });
});

describe('parse srgb-linear object', () => {
  it('uses the colorSpace discriminant', () => {
    expect(colordx({ r: 0.5, g: 0, b: 0, colorSpace: 'srgb-linear' } as any).toHex()).toBe('#bc0000');
    expect(colordx({ r: 1, g: 0, b: 0, alpha: 0.5, colorSpace: 'srgb-linear' } as any).toHex()).toBe('#ff000080');
  });

  it('plain { r, g, b } stays 0–255 sRGB', () => {
    expect(colordx({ r: 0.5, g: 0, b: 0 }).toHex()).toBe('#010000');
  });

  it('rejects non-numeric channels', () => {
    expect(colordx({ r: '1', g: 0, b: 0, colorSpace: 'srgb-linear' } as any).isValid()).toBe(false);
  });
});

describe('getFormat', () => {
  it('reports srgb-linear for string and object', () => {
    expect(getFormat('color(srgb-linear 1 0 0)')).toBe('srgb-linear');
    expect(getFormat({ r: 1, g: 0, b: 0, colorSpace: 'srgb-linear' } as any)).toBe('srgb-linear');
  });
});

describe('inGamutSrgb', () => {
  it('checks linear channels against [0, 1]', () => {
    expect(inGamutSrgb('color(srgb-linear 1 0 0)')).toBe(true);
    expect(inGamutSrgb('color(srgb-linear 1.2 0 0)')).toBe(false);
    expect(inGamutSrgb('color(srgb-linear 100% 0% -1%)')).toBe(false);
    expect(inGamutSrgb({ r: 1, g: 1, b: 1, alpha: 1, colorSpace: 'srgb-linear' } as any)).toBe(true);
    expect(inGamutSrgb({ r: 0, g: -0.1, b: 0, alpha: 1, colorSpace: 'srgb-linear' } as any)).toBe(false);
  });
});

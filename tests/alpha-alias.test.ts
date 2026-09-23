import { beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { Colordx, colordx, extend, getFormat, inGamutSrgb } from '../src/index.js';
import a98rgb from '../src/plugins/a98rgb.js';
import cmyk from '../src/plugins/cmyk.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import p3, { inGamutP3 } from '../src/plugins/p3.js';
import prophoto from '../src/plugins/prophoto.js';
import rec2020 from '../src/plugins/rec2020.js';
import srgbLinear from '../src/plugins/srgb-linear.js';
import type { HslColorInput, LabColorInput, OklabColorInput, RgbColorInput } from '../src/index.js';

beforeAll(() => extend([hsv, hwb, lab, lch, cmyk, p3, rec2020, a98rgb, prophoto, srgbLinear]));

const ALIASED: ReadonlyArray<[string, Record<string, unknown>]> = [
  ['rgb', { r: 255, g: 0, b: 0 }],
  ['hsl', { h: 0, s: 100, l: 50 }],
  ['hsv', { h: 0, s: 100, v: 100 }],
  ['hwb', { h: 0, w: 0, b: 0 }],
  ['cmyk', { c: 0, m: 100, y: 100, k: 0 }],
  ['oklch', { l: 0.6, c: 0.1, h: 30 }],
  ['lch', { l: 50, c: 30, h: 30, colorSpace: 'lch' }],
  ['xyz', { x: 20, y: 20, z: 20 }],
  ['xyz-d65', { x: 20, y: 20, z: 20, colorSpace: 'xyz-d65' }],
  ['p3', { r: 1, g: 0, b: 0, colorSpace: 'display-p3' }],
  ['rec2020', { r: 1, g: 0, b: 0, colorSpace: 'rec2020' }],
  ['a98', { r: 1, g: 0, b: 0, colorSpace: 'a98-rgb' }],
  ['prophoto', { r: 1, g: 0, b: 0, colorSpace: 'prophoto-rgb' }],
  ['srgb-linear', { r: 1, g: 0, b: 0, colorSpace: 'srgb-linear' }],
];

describe('`a` as an alias for `alpha` on object input', () => {
  it.each(ALIASED)('%s: `a` reads as alpha', (_, channels) => {
    const aliased = colordx({ ...channels, a: 0.5 } as never);
    expect(aliased.isValid()).toBe(true);
    expect(aliased.alpha()).toBe(0.5);
    expect(aliased.toHex8()).toBe(colordx({ ...channels, alpha: 0.5 } as never).toHex8());
  });

  it.each(ALIASED)('%s: `alpha` wins when both are present', (_, channels) => {
    expect(colordx({ ...channels, a: 0.2, alpha: 0.8 } as never).alpha()).toBe(0.8);
  });

  it.each(ALIASED)('%s: alpha still defaults to 1', (_, channels) => {
    expect(colordx(channels as never).alpha()).toBe(1);
  });

  it.each(ALIASED)('%s: `a` is clamped, rounded and type-checked like alpha', (_, channels) => {
    expect(colordx({ ...channels, a: 2 } as never).alpha()).toBe(1);
    expect(colordx({ ...channels, a: -1 } as never).alpha()).toBe(0);
    expect(colordx({ ...channels, a: 1 / 255 } as never).alpha()).toBe(0.004);
    expect(colordx({ ...channels, a: '0.5' } as never).isValid()).toBe(false);
  });

  it('matches the colord object shapes', () => {
    expect(colordx({ r: 255, g: 0, b: 0, a: 0.5 }).toHex()).toBe('#ff000080');
    expect(colordx({ h: 0, s: 100, l: 50, a: 0.5 }).toHex()).toBe('#ff000080');
    expect(colordx({ h: 0, s: 100, v: 100, a: 0.5 }).toHex()).toBe('#ff000080');
  });

  it('keeps the detected format', () => {
    expect(getFormat({ r: 255, g: 0, b: 0, a: 0.5 })).toBe('rgb');
    expect(getFormat({ h: 0, s: 100, l: 50, a: 0.5 })).toBe('hsl');
    expect(getFormat({ l: 0.6, c: 0.1, h: 30, a: 0.5 })).toBe('oklch');
  });

  it('`a` stays a channel in OKLab and Lab', () => {
    expect(colordx({ l: 0.5, a: 0.1, b: 0.1 }).toHex()).toBe('#a14203');
    expect(colordx({ l: 0.5, a: 0.1, b: 0.1 }).alpha()).toBe(1);
    expect(colordx({ l: 0.5, a: 0.1, b: 0.1, alpha: 0.5 }).alpha()).toBe(0.5);
    const cie = colordx({ l: 50, a: 20, b: 20, colorSpace: 'lab' });
    expect(cie.isValid()).toBe(true);
    expect(cie.alpha()).toBe(1);
  });

  it('routes every `l`-keyed object to the same parser as before', () => {
    expect(colordx({ l: 0.6, c: 0.1, h: 30 }).toHex()).toBe(colordx('oklch(0.6 0.1 30)').toHex());
    expect(colordx({ h: 120, s: 50, l: 50 }).toHex()).toBe(colordx('hsl(120 50% 50%)').toHex());
    expect(colordx({ l: 0.5, a: 0.1, b: 0.1, c: 0.1 } as never).isValid()).toBe(false);
    expect(colordx({ l: 0.5, a: 0.1, b: 0.1, h: 30 } as never).isValid()).toBe(false);
    expect(colordx({ l: 0.5, a: 0.1 } as never).isValid()).toBe(false);
  });

  it('gamut helpers read the alias on OKLCH objects', () => {
    const wide = { l: 0.7, c: 0.35, h: 140, a: 0.5 };
    expect(inGamutSrgb(wide)).toBe(false);
    expect(inGamutSrgb({ l: 0.7, c: 0.05, h: 140, a: 0.5 })).toBe(true);
    expect(inGamutP3({ l: 0.7, c: 0.05, h: 140, a: 0.5 })).toBe(true);
    const mapped = Colordx.toGamutSrgb(wide);
    expect(mapped.alpha()).toBe(0.5);
    expect(mapped.toHex8()).toBe(Colordx.toGamutSrgb({ l: 0.7, c: 0.35, h: 140, alpha: 0.5 }).toHex8());
  });

  it('is typed on every input shape except Lab and OKLab', () => {
    expectTypeOf<RgbColorInput['a']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<HslColorInput['a']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<OklabColorInput['a']>().toEqualTypeOf<number>();
    expectTypeOf<LabColorInput['a']>().toEqualTypeOf<number>();
  });
});

describe('`a: null` is invalid, exactly like `alpha: null`', () => {
  it.each([
    { r: 1, g: 2, b: 3, a: null },
    { h: 0, s: 50, l: 50, a: null },
    { l: 0.5, c: 0.1, h: 30, a: null },
  ])('%o', (input) => {
    expect(colordx(input as never).isValid()).toBe(false);
    expect(colordx({ ...input, a: undefined, alpha: null } as never).isValid()).toBe(false);
  });
  it('a missing or undefined `a` still defaults to 1', () => {
    expect(colordx({ r: 1, g: 2, b: 3, a: undefined } as never).alpha()).toBe(1);
  });
});


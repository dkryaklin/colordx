import { describe, expect, it } from 'vitest';
import * as fn from '../src/fn.js';
import { colordx, extend } from '../src/index.js';
import names from '../src/plugins/names.js';

const INPUTS = [
  '#f00',
  '#ff000080',
  'rgb(10 20 30 / 0.5)',
  'rgba(10, 20, 30, 0.5)',
  'color(srgb 1 0.5 0)',
  'hsl(120 50% 50%)',
  'oklch(0.7 0.35 140)',
  'oklab(0.5 0.1 0.1 / 30%)',
  'transparent',
  { r: 1, g: 2, b: 3, a: 0.5 },
  { h: 10, s: 20, l: 30 },
  { l: 0.5, a: 0.1, b: 0.1 },
  { l: 0.6, c: 0.1, h: 30, alpha: 0.1 + 0.2 },
] as const;

describe('@colordx/core/fn', () => {
  it.each(INPUTS)('parse(%j) returns what colordx() stores', (input) => {
    expect(fn.parse(input)).toEqual(colordx(input)._rawRgb());
  });

  it('parse returns null for anything that is not a color', () => {
    for (const bad of ['nope', '', 'ff0000', 42, null, undefined, [], {}, { r: 1 }]) {
      expect(fn.parse(bad as never)).toBeNull();
    }
  });

  it('parse rounds alpha to 3 decimals and returns a fresh object', () => {
    expect(fn.parse({ l: 0.6, c: 0.1, h: 30, alpha: 0.1 + 0.2 })!.alpha).toBe(0.3);
    expect(fn.parse('oklab(0.5 0 0 / 0.123456)')!.alpha).toBe(0.123);
    const a = fn.parse('transparent')!;
    a.r = 99;
    expect(fn.parse('transparent')).toEqual({ r: 0, g: 0, b: 0, alpha: 0 });
  });

  it('parse keeps wide-gamut channels unclamped', () => {
    const rgb = fn.parse('oklch(0.7 0.35 140)')!;
    expect(Math.min(rgb.r, rgb.g, rgb.b)).toBeLessThan(0);
    expect(fn.rgbToHex(rgb)).toBe(colordx('oklch(0.7 0.35 140)').toHex());
  });

  it('parse sees parsers registered through extend()', () => {
    extend([names]);
    expect(fn.parse('rebeccapurple')).toEqual({ r: 102, g: 51, b: 153, alpha: 1 });
  });

  it('formats hex', () => {
    expect(fn.rgbToHex({ r: 255, g: 0, b: 0, alpha: 1 })).toBe('#ff0000');
    expect(fn.rgbToHex({ r: 255, g: 0, b: 0, alpha: 0.5 })).toBe('#ff000080');
    expect(fn.rgbToHex8({ r: 255, g: 0, b: 0, alpha: 1 })).toBe('#ff0000ff');
  });

  it('converters agree with the class', () => {
    const rgb = fn.parseHex('#3b82f6')!;
    const c = colordx('#3b82f6');
    expect(fn.rgbToHsl(rgb)).toEqual(c.toHsl());
    expect(fn.rgbToHex(fn.hslToRgb(fn.rgbToHsl(rgb)))).toBe('#3b82f6');
    expect(fn.rgbToHex(fn.hsvToRgb(fn.rgbToHsv(rgb)))).toBe('#3b82f6');
    expect(fn.rgbToHex(fn.hwbToRgb(fn.rgbToHwb(rgb)))).toBe('#3b82f6');
    expect(fn.rgbToHex(fn.oklabToRgb(fn.rgbToOklab(rgb)))).toBe('#3b82f6');
    expect(fn.rgbToHex(fn.oklchToRgb(fn.rgbToOklch(rgb)))).toBe('#3b82f6');
    expect(fn.rgbToOklch(rgb).l).toBeCloseTo(c.toOklch().l, 5);
  });

  it('converters return a new object on every call', () => {
    const red = fn.rgbToHsl({ r: 255, g: 0, b: 0, alpha: 1 });
    const blue = fn.rgbToHsl({ r: 0, g: 0, b: 255, alpha: 1 });
    expect(red).not.toBe(blue);
    expect(red.h).toBe(0);
    const redV = fn.rgbToHsv({ r: 255, g: 0, b: 0, alpha: 1 });
    fn.rgbToHsv({ r: 0, g: 0, b: 255, alpha: 1 });
    expect(redV.h).toBe(0);
  });

  it('single-format parsers accept their format and reject the rest', () => {
    const cases: [fn.ColorParser, unknown, string][] = [
      [fn.parseHex, '#0f0', '#00ff00'],
      [fn.parseRgbString, 'rgb(0 255 0)', '#00ff00'],
      [fn.parseRgbObject, { r: 0, g: 255, b: 0 }, '#00ff00'],
      [fn.parseSrgbColorString, 'color(srgb 0 1 0)', '#00ff00'],
      [fn.parseHslString, 'hsl(120 100% 50%)', '#00ff00'],
      [fn.parseHslObject, { h: 120, s: 100, l: 50 }, '#00ff00'],
      [fn.parseHsvString, 'hsv(120 100% 100%)', '#00ff00'],
      [fn.parseHsvObject, { h: 120, s: 100, v: 100 }, '#00ff00'],
      [fn.parseHwbString, 'hwb(120 0% 0%)', '#00ff00'],
      [fn.parseHwbObject, { h: 120, w: 0, b: 0 }, '#00ff00'],
      [fn.parseOklabString, 'oklab(1 0 0)', '#ffffff'],
      [fn.parseOklabObject, { l: 1, a: 0, b: 0 }, '#ffffff'],
      [fn.parseOklchString, 'oklch(1 0 0)', '#ffffff'],
      [fn.parseOklchObject, { l: 1, c: 0, h: 0 }, '#ffffff'],
      [fn.parseNameString, 'Lime', '#00ff00'],
    ];
    for (const [parser, input, hex] of cases) {
      expect(fn.rgbToHex(parser(input)!)).toBe(hex);
      expect(parser('not a color')).toBeNull();
      expect(parser({ x: 1 })).toBeNull();
      expect(parser(null)).toBeNull();
    }
  });

  it('parsers compose into a custom parse', () => {
    const parsers = [fn.parseHex, fn.parseRgbObject, fn.parseHsvObject, fn.parseNameString];
    const parse = (input: unknown) => {
      for (const p of parsers) {
        const rgb = p(input);
        if (rgb) return rgb;
      }
      return null;
    };
    expect(parse('#f00')).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
    expect(parse('red')).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
    expect(parse({ h: 0, s: 100, v: 100, a: 0.5 })).toEqual({ r: 255, g: 0, b: 0, alpha: 0.5 });
    expect(parse('oklch(0.5 0.1 30)')).toBeNull();
  });

  it('exposes the CSS names table', () => {
    expect(fn.NAMES.rebeccapurple).toBe('#663399');
  });
});

describe('fn — raw OKLab / OKLCh objects of white parse back', () => {
  // White converts to L = 1.0000000000000002; the "L > 1 is an unbranded CIE value" guard must not
  // reject float noise.
  const white = { r: 255, g: 255, b: 255, alpha: 1 };
  it('rgbToOklab → parseOklabObject', () => expect(fn.parseOklabObject(fn.rgbToOklab(white))).not.toBeNull());
  it('rgbToOklch → parseOklchObject', () => expect(fn.parseOklchObject(fn.rgbToOklch(white))).not.toBeNull());
  it('a CIE-sized L is still rejected', () => expect(fn.parseOklabObject({ l: 50, a: 10, b: 10 })).toBeNull());
});

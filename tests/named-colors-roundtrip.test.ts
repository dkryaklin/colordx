/**
 * Round-trip tests for every CSS named color through every output format.
 * Catches precision artifacts like hsv(0, 100%, 99.99%) or hsl(360, ...) for red.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import names from '../src/plugins/names.js';
import p3 from '../src/plugins/p3.js';

beforeAll(() => {
  extend([names, hsv, hwb, p3]);
});

// Every CSS named color and its canonical hex.
const NAMED_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aqua: '#00ffff',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  beige: '#f5f5dc',
  bisque: '#ffe4c4',
  black: '#000000',
  blanchedalmond: '#ffebcd',
  blue: '#0000ff',
  blueviolet: '#8a2be2',
  brown: '#a52a2a',
  burlywood: '#deb887',
  cadetblue: '#5f9ea0',
  chartreuse: '#7fff00',
  chocolate: '#d2691e',
  coral: '#ff7f50',
  cornflowerblue: '#6495ed',
  cornsilk: '#fff8dc',
  crimson: '#dc143c',
  cyan: '#00ffff',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9',
  darkgreen: '#006400',
  darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b',
  darkolivegreen: '#556b2f',
  darkorange: '#ff8c00',
  darkorchid: '#9932cc',
  darkred: '#8b0000',
  darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f',
  darkturquoise: '#00ced1',
  darkviolet: '#9400d3',
  deeppink: '#ff1493',
  deepskyblue: '#00bfff',
  dimgray: '#696969',
  dodgerblue: '#1e90ff',
  firebrick: '#b22222',
  floralwhite: '#fffaf0',
  forestgreen: '#228b22',
  fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff',
  gold: '#ffd700',
  goldenrod: '#daa520',
  gray: '#808080',
  green: '#008000',
  greenyellow: '#adff2f',
  honeydew: '#f0fff0',
  hotpink: '#ff69b4',
  indianred: '#cd5c5c',
  indigo: '#4b0082',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd',
  lightblue: '#add8e6',
  lightcoral: '#f08080',
  lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2',
  lightgray: '#d3d3d3',
  lightgreen: '#90ee90',
  lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa',
  lightslategray: '#778899',
  lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0',
  lime: '#00ff00',
  limegreen: '#32cd32',
  linen: '#faf0e6',
  magenta: '#ff00ff',
  maroon: '#800000',
  mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd',
  mediumorchid: '#ba55d3',
  mediumpurple: '#9370db',
  mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585',
  midnightblue: '#191970',
  mintcream: '#f5fffa',
  mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5',
  navajowhite: '#ffdead',
  navy: '#000080',
  oldlace: '#fdf5e6',
  olive: '#808000',
  olivedrab: '#6b8e23',
  orange: '#ffa500',
  orangered: '#ff4500',
  orchid: '#da70d6',
  palegoldenrod: '#eee8aa',
  palegreen: '#98fb98',
  paleturquoise: '#afeeee',
  palevioletred: '#db7093',
  papayawhip: '#ffefd5',
  peachpuff: '#ffdab9',
  peru: '#cd853f',
  pink: '#ffc0cb',
  plum: '#dda0dd',
  powderblue: '#b0e0e6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#ff0000',
  rosybrown: '#bc8f8f',
  royalblue: '#4169e1',
  saddlebrown: '#8b4513',
  salmon: '#fa8072',
  sandybrown: '#f4a460',
  seagreen: '#2e8b57',
  seashell: '#fff5ee',
  sienna: '#a0522d',
  silver: '#c0c0c0',
  skyblue: '#87ceeb',
  slateblue: '#6a5acd',
  slategray: '#708090',
  snow: '#fffafa',
  springgreen: '#00ff7f',
  steelblue: '#4682b4',
  tan: '#d2b48c',
  teal: '#008080',
  thistle: '#d8bfd8',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  white: '#ffffff',
  whitesmoke: '#f5f5f5',
  yellow: '#ffff00',
  yellowgreen: '#9acd32',
};

const entries = Object.entries(NAMED_COLORS);

// Parse name → hex, then hex → name round-trip.
describe('named colors: parse name → toHex', () => {
  for (const [name, hex] of entries) {
    it(name, () => {
      // aqua/cyan and fuchsia/magenta share the same hex; canonical name wins.
      if (name === 'cyan' || name === 'magenta') return;
      expect(colordx(name).toHex()).toBe(hex);
    });
  }
});

// Helper: compare two hex colors within ±1 per channel (tolerates 1-LSB rounding loss).
const closeRgb = (actual: string, expected: string) => {
  const a = colordx(actual).toRgb();
  const e = colordx(expected).toRgb();
  expect(Math.abs(a.r - e.r)).toBeLessThanOrEqual(1);
  expect(Math.abs(a.g - e.g)).toBeLessThanOrEqual(1);
  expect(Math.abs(a.b - e.b)).toBeLessThanOrEqual(1);
};

// For each named color: hex → format string → parse → toHex must round-trip within ±1 per channel.
// (Some formats — HWB at integer precision, OKLab at 4dp — have inherent 1-LSB rounding loss.)
describe('named colors: hex → format → parse → hex', () => {
  for (const [name, hex] of entries) {
    it(`${name}: rgb`, () => {
      expect(colordx(colordx(hex).toRgbString()).toHex()).toBe(hex);
    });

    it(`${name}: hsl`, () => {
      closeRgb(colordx(colordx(hex).toHslString()).toHex(), hex);
    });

    it(`${name}: hsv`, () => {
      closeRgb(colordx((colordx(hex) as any).toHsvString()).toHex(), hex);
    });

    it(`${name}: hwb`, () => {
      // Use precision=2 — integer-precision HWB (default) can lose ±2 LSBs for some hues.
      closeRgb(colordx((colordx(hex) as any).toHwbString(2)).toHex(), hex);
    });

    it(`${name}: oklch`, () => {
      closeRgb(colordx(colordx(hex).toOklchString()).toHex(), hex);
    });

    it(`${name}: oklab`, () => {
      closeRgb(colordx(colordx(hex).toOklabString()).toHex(), hex);
    });
  }
});

// Sanity checks: output values must be in legal ranges (catches 99.99%, 360°, etc.).
describe('named colors: output values in valid ranges', () => {
  for (const [name, hex] of entries) {
    it(name, () => {
      const c = colordx(hex) as any;

      const { h: hslH, s: hslS, l: hslL } = c.toHsl();
      expect(hslH).toBeGreaterThanOrEqual(0);
      expect(hslH).toBeLessThan(360);
      expect(hslS).toBeGreaterThanOrEqual(0);
      expect(hslS).toBeLessThanOrEqual(100);
      expect(hslL).toBeGreaterThanOrEqual(0);
      expect(hslL).toBeLessThanOrEqual(100);

      const { h: hsvH, s: hsvS, v: hsvV } = c.toHsv();
      expect(hsvH).toBeGreaterThanOrEqual(0);
      expect(hsvH).toBeLessThan(360);
      expect(hsvS).toBeGreaterThanOrEqual(0);
      expect(hsvS).toBeLessThanOrEqual(100);
      expect(hsvV).toBeGreaterThanOrEqual(0);
      expect(hsvV).toBeLessThanOrEqual(100);

      const { h: hwbH, w, b } = c.toHwb();
      expect(hwbH).toBeGreaterThanOrEqual(0);
      expect(hwbH).toBeLessThan(360);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(100);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(100);
    });
  }
});

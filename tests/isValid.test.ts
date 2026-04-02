// isValid() with all plugins loaded — verifies every supported color format is recognised.
import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import cmyk from '../src/plugins/cmyk.js';
import harmonies from '../src/plugins/harmonies.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import mix from '../src/plugins/mix.js';
import names from '../src/plugins/names.js';
import p3 from '../src/plugins/p3.js';
import rec2020 from '../src/plugins/rec2020.js';

beforeAll(() => extend([a11y, cmyk, harmonies, hsv, hwb, lab, lch, mix, names, p3, rec2020]));

const valid: [string, unknown][] = [
  // Base formats (no plugin needed)
  ['hex 3',        '#f00'],
  ['hex 4',        '#f00f'],
  ['hex 6',        '#ff0000'],
  ['hex 8',        '#ff000080'],
  ['rgb string',   'rgb(255, 0, 0)'],
  ['rgba string',  'rgba(255, 0, 0, 0.5)'],
  ['rgb modern',   'rgb(255 0 0 / 50%)'],
  ['hsl string',   'hsl(0, 100%, 50%)'],
  ['hsl modern',   'hsl(0 100% 50% / 0.5)'],
  ['oklch string', 'oklch(0.7 0.2 180)'],
  ['oklab string', 'oklab(0.7 0.1 -0.1)'],
  ['named color',  'red'],
  ['transparent',  'transparent'],
  ['rgb object',   { r: 255, g: 0, b: 0 }],
  ['hsl object',   { h: 0, s: 100, l: 50 }],
  ['oklch object', { l: 0.5, c: 0.2, h: 180 }],
  ['oklab object', { l: 0.5, a: 0.1, b: -0.1 }],
  // Plugin formats
  ['lab string',      'lab(54.29% 80.8 69.89)'],
  ['lab object',      { l: 54, a: 80, b: 69, colorSpace: 'lab' }],
  ['lch string',      'lch(54.29% 106.84 40.85)'],
  ['lch object',      { l: 54, c: 106, h: 40, colorSpace: 'lch' }],
  ['p3 string',       'color(display-p3 1 0 0)'],
  ['p3 object',       { r: 1, g: 0, b: 0, colorSpace: 'display-p3' }],
  ['rec2020 string',  'color(rec2020 1 0 0)'],
  ['rec2020 object',  { r: 1, g: 0, b: 0, colorSpace: 'rec2020' }],
  ['hsv object',      { h: 0, s: 100, v: 100 }],
  ['hwb object',      { h: 0, w: 0, b: 0 }],
  ['cmyk string',     'device-cmyk(0% 100% 100% 0%)'],
];

const invalid: [string, unknown][] = [
  ['empty string',     ''],
  ['garbage string',   'notacolor'],
  ['5-char hex',       '#fffff'],
  ['7-char hex',       '#1234567'],
  ['number',           42],
  ['null',             null],
  ['undefined',        undefined],
  ['array',            [255, 0, 0]],
  ['partial rgb obj',  { r: 255, g: 0 }],
  ['oklch L > 1',      { l: 50, c: 0.2, h: 180 }],
  ['oklab L > 1',      { l: 50, a: 0.1, b: -0.1 }],
];

describe('isValid — valid colors', () => {
  it.each(valid)('%s', (_label, input) => {
    expect(colordx(input as any).isValid()).toBe(true);
  });
});

describe('isValid — invalid colors', () => {
  it.each(invalid)('%s', (_label, input) => {
    expect(colordx(input as any).isValid()).toBe(false);
  });
});

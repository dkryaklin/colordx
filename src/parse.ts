import { parseHex } from './colorModels/hex.js';
import { parseHslObject, parseHslString } from './colorModels/hsl.js';
import { parseHsvObject } from './colorModels/hsv.js';
import { parseHwbObject, parseHwbString } from './colorModels/hwb.js';
import { parseOklabObject, parseOklabString } from './colorModels/oklab.js';
import { parseOklchObject, parseOklchString } from './colorModels/oklch.js';
import { parseRgbObject, parseRgbString } from './colorModels/rgb.js';
import type { AnyColor, ColorFormat, ColorParser, RgbColor } from './types.js';

const stringFormatParsers: [ColorParser, ColorFormat][] = [
  [parseHex, 'hex'],
  [parseRgbString, 'rgb'],
  [parseHslString, 'hsl'],
  [parseHwbString, 'hwb'],
  [parseOklchString, 'lch'],
  [parseOklabString, 'lab'],
];

const objectFormatParsers: [ColorParser, ColorFormat][] = [
  [parseRgbObject, 'rgb'],
  [parseHslObject, 'hsl'],
  [parseHsvObject, 'hsv'],
  [parseHwbObject, 'hwb'],
  [parseOklabObject, 'lab'],
  [parseOklchObject, 'lch'],
];

const builtinStringParsers: ColorParser[] = stringFormatParsers.map(([p]) => p);
const builtinObjectParsers: ColorParser[] = objectFormatParsers.map(([p]) => p);

export const defaultParsers: ColorParser[] = [...builtinStringParsers, ...builtinObjectParsers];
export const parsers: ColorParser[] = [...defaultParsers];
export const pluginFormatParsers: [ColorParser, ColorFormat][] = [];

export const parse = (input: AnyColor): RgbColor | null => {
  if (input === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const builtins = typeof input === 'string' ? builtinStringParsers : builtinObjectParsers;
  for (const parser of builtins) {
    const result = parser(input);
    if (result) return result;
  }
  for (let i = defaultParsers.length; i < parsers.length; i++) {
    const result = parsers[i]!(input);
    if (result) return result;
  }
  return null;
};

export const getFormat = (input: AnyColor): ColorFormat | undefined => {
  if (input === 'transparent') return 'name';
  const typed = typeof input === 'string' ? stringFormatParsers : objectFormatParsers;
  for (const [parser, format] of typed) {
    if (parser(input)) return format;
  }
  for (const [parser, format] of pluginFormatParsers) {
    if (parser(input)) return format;
  }
  return undefined;
};

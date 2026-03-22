import { parseHex } from './colorModels/hex.js';
import { parseHslObject, parseHslString } from './colorModels/hsl.js';
import { parseHsvObject } from './colorModels/hsv.js';
import { parseRgbObject, parseRgbString } from './colorModels/rgb.js';
import type { AnyColor, ColorParser, RgbColor } from './types.js';

export const defaultParsers: ColorParser[] = [
  parseHex,
  parseRgbString,
  parseHslString,
  parseRgbObject,
  parseHslObject,
  parseHsvObject,
];

export const parsers: ColorParser[] = [...defaultParsers];

export const parse = (input: AnyColor): RgbColor | null => {
  for (const parser of parsers) {
    const result = parser(input);
    if (result) return result;
  }
  return null;
};

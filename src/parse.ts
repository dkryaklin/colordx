import { parseCmykObject, parseCmykString } from './colorModels/cmyk.js';
import { parseHex } from './colorModels/hex.js';
import { parseHslObject, parseHslString } from './colorModels/hsl.js';
import { parseHsvObject } from './colorModels/hsv.js';
import { parseHwbObject, parseHwbString } from './colorModels/hwb.js';
import { parseLabObject } from './colorModels/lab.js';
import { parseLchObject, parseLchString } from './colorModels/lch.js';
import { parseRgbObject, parseRgbString } from './colorModels/rgb.js';
import { parseXyzObject } from './colorModels/xyz.js';
import type { AnyColor, ColorParser, RgbColor } from './types.js';

export const defaultParsers: ColorParser[] = [
  parseHex,
  parseRgbString,
  parseHslString,
  parseHwbString,
  parseLchString,
  parseCmykString,
  parseRgbObject,
  parseHslObject,
  parseHsvObject,
  parseHwbObject,
  parseXyzObject,
  parseLabObject,
  parseLchObject,
  parseCmykObject,
];

export const parsers: ColorParser[] = [...defaultParsers];

export const parse = (input: AnyColor): RgbColor | null => {
  for (const parser of parsers) {
    const result = parser(input);
    if (result) return result;
  }
  return null;
};

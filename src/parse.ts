import { parseCmykObject, parseCmykString } from './colorModels/cmyk.js';
import { parseHex } from './colorModels/hex.js';
import { parseHslObject, parseHslString } from './colorModels/hsl.js';
import { parseHsvObject } from './colorModels/hsv.js';
import { parseHwbObject, parseHwbString } from './colorModels/hwb.js';
import { parseLabObject } from './colorModels/lab.js';
import { parseLchObject, parseLchString } from './colorModels/lch.js';
import { parseRgbObject, parseRgbString } from './colorModels/rgb.js';
import { parseXyzObject } from './colorModels/xyz.js';
import type { AnyColor, ColorFormat, ColorParser, RgbColor } from './types.js';

const formatParsers: [ColorParser, ColorFormat][] = [
  [parseHex, 'hex'],
  [parseRgbString, 'rgb'],
  [parseHslString, 'hsl'],
  [parseHwbString, 'hwb'],
  [parseLchString, 'lch'],
  [parseCmykString, 'cmyk'],
  [parseRgbObject, 'rgb'],
  [parseHslObject, 'hsl'],
  [parseHsvObject, 'hsv'],
  [parseHwbObject, 'hwb'],
  [parseXyzObject, 'xyz'],
  [parseLabObject, 'lab'],
  [parseLchObject, 'lch'],
  [parseCmykObject, 'cmyk'],
];

export const defaultParsers: ColorParser[] = formatParsers.map(([parser]) => parser);

export const parsers: ColorParser[] = [...defaultParsers];

export const parse = (input: AnyColor): RgbColor | null => {
  for (const parser of parsers) {
    const result = parser(input);
    if (result) return result;
  }
  return null;
};

export const getFormat = (input: AnyColor): ColorFormat | undefined => {
  for (const [parser, format] of formatParsers) {
    if (parser(input)) return format;
  }
  // Check parsers added by plugins (format unknown)
  for (let i = defaultParsers.length; i < parsers.length; i++) {
    if (parsers[i]!(input)) return 'name';
  }
  return undefined;
};

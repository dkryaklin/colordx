import { round3 } from './helpers.js';
import { parse as parseAny } from './parse.js';
import type { AnyColor, RgbColor } from './types.js';

export const parse = (input: AnyColor): RgbColor | null => {
  const rgb = parseAny(input);
  if (rgb) rgb.alpha = round3(rgb.alpha);
  return rgb;
};

export { parseHex, rgbToHex, rgbToHex8 } from './colorModels/hex.js';
export { parseRgbObject, parseRgbString, parseSrgbColorString } from './colorModels/rgb.js';
export { hslToRgb, parseHslObject, parseHslString, rgbToHsl } from './colorModels/hsl.js';
export { hsvToRgb, parseHsvObject, parseHsvString, rgbToHsv } from './colorModels/hsv.js';
export { hwbToRgb, parseHwbObject, parseHwbString, rgbToHwb } from './colorModels/hwb.js';
export { oklabToRgb, parseOklabObject, parseOklabString, rgbToOklab } from './colorModels/oklab.js';
export { oklchToRgb, parseOklchObject, parseOklchString, rgbToOklch } from './colorModels/oklch.js';
export { NAMES, parseNameString } from './plugins/names.js';
export type { AnyColor, ColorParser, HslColor, HsvColor, HwbColor, OklabColor, OklchColor, RgbColor } from './types.js';

import { alphaAlias, clamp, hasBrand, isAnyNumber, isObject, normalizeHue, round, sanitize } from '../helpers.js';
import { SC, scanFunc } from '../scan.js';
import type { HwbColor, RgbColor } from '../types.js';
import { hslChannel } from './hsl.js';
import { rgbToHsvRaw } from './hsv.js';

export const clampHwb = (hwb: HwbColor): HwbColor => {
  let w = clamp(hwb.w, 0, Infinity);
  let b = clamp(hwb.b, 0, Infinity);
  if (w === Infinity || b === Infinity) {
    w = w === Infinity ? 100 : 0;
    b = b === Infinity ? 100 : 0;
  }
  const sum = w + b;
  return {
    h: normalizeHue(hwb.h),
    w: sum > 100 ? (w / sum) * 100 : w,
    b: sum > 100 ? (b / sum) * 100 : b,
    alpha: clamp(round(hwb.alpha, 3), 0, 1),
  };
};

export const rgbToHwb = (rgb: RgbColor): HwbColor => {
  const { h } = rgbToHsvRaw(rgb);
  return clampHwb({
    h,
    w: (Math.min(rgb.r, rgb.g, rgb.b) / 255) * 100,
    b: 100 - (Math.max(rgb.r, rgb.g, rgb.b) / 255) * 100,
    alpha: rgb.alpha,
  });
};

export const hwbToRgb = ({ h, w, b, alpha }: HwbColor): RgbColor => {
  const scale = 100 - w - b;
  const hue = normalizeHue(h);
  return {
    r: (((hslChannel(0, hue, 50, 50) * scale) / 100 + w) * 255) / 100,
    g: (((hslChannel(8, hue, 50, 50) * scale) / 100 + w) * 255) / 100,
    b: (((hslChannel(4, hue, 50, 50) * scale) / 100 + w) * 255) / 100,
    alpha,
  };
};

export const parseHwbObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!('h' in input && 'w' in input && 'b' in input)) return null;
  if (hasBrand(input)) return null;
  const { h, w, b, alpha = alphaAlias(input) } = input as { h: unknown; w: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(h) || !isAnyNumber(w) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return hwbToRgb(clampHwb({ h: sanitize(h), w: sanitize(w), b: sanitize(b), alpha: sanitize(alpha) }));
};

export const parseHwbString = (input: unknown): RgbColor | null =>
  typeof input === 'string' && scanFunc(input, 'hwb(', 0)
    ? hwbToRgb(clampHwb({ h: SC[0]!, w: SC[1]!, b: SC[2]!, alpha: SC[3]! }))
    : null;
parseHwbObject.inputKind = 'object' as const;
parseHwbString.inputKind = 'string' as const;

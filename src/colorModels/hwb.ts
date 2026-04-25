import {
  ANGLE_UNITS,
  NUM_OR_NONE,
  clamp,
  hasKeys,
  isAnyNumber,
  isObject,
  normalizeHue,
  parseNum,
  round,
  sanitize,
} from '../helpers.js';
import type { HwbColor, RgbColor } from '../types.js';
import { hsvToRgb, rgbToHsvRaw } from './hsv.js';

export const clampHwb = (hwb: HwbColor): HwbColor => {
  // Infinity upper bound = reject negatives only; proportional normalization handles w+b > 100 below.
  const w = clamp(hwb.w, 0, Infinity);
  const b = clamp(hwb.b, 0, Infinity);
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

// Precondition: w + b must be ≤ 100. Call clampHwb first — direct use with unnormalized values
// produces negative saturation and incorrect output.
export const hwbToRgb = ({ h, w, b, alpha }: HwbColor): RgbColor => {
  const s = b === 100 ? 0 : 100 - (w / (100 - b)) * 100;
  return hsvToRgb({ h, s, v: 100 - b, alpha });
};

export const parseHwbObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['h', 'w', 'b'])) return null;
  const { h, w, b, alpha = 1 } = input as { h: unknown; w: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(h) || !isAnyNumber(w) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return hwbToRgb(clampHwb({ h: sanitize(h), w: sanitize(w), b: sanitize(b), alpha: sanitize(alpha) }));
};

const HWB_RE = new RegExp(
  `^hwb\\(\\s*(?<h>${NUM_OR_NONE})(?<hu>deg|rad|grad|turn)?\\s+` +
    `(?<w>${NUM_OR_NONE})(?<wp>%?)\\s+(?<b>${NUM_OR_NONE})(?<bp>%?)` +
    `\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseHwbString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = HWB_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const unit = g.hu?.toLowerCase() ?? 'deg';
  const h = parseNum(g.h!) * (ANGLE_UNITS[unit] ?? 1);
  const w = parseNum(g.w!);
  const b = parseNum(g.b!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return hwbToRgb(clampHwb({ h, w, b, alpha }));
};

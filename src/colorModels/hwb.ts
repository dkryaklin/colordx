import { ANGLE_UNITS, clamp, hasKeys, isAnyNumber, isObject, normalizeHue, round, sanitize } from '../helpers.js';
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

export const roundHwb = (hwb: HwbColor): HwbColor => ({
  h: round(hwb.h),
  w: round(hwb.w),
  b: round(hwb.b),
  alpha: round(hwb.alpha, 3),
});

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

const HWB_RE =
  /^hwb\(\s*([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s+([+-]?\d*\.?\d+)%\s+([+-]?\d*\.?\d+)%\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseHwbString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = HWB_RE.exec(input.trim());
  if (!m) return null;
  const unit = m[2]?.toLowerCase() ?? 'deg';
  const h = Number(m[1]) * (ANGLE_UNITS[unit] ?? 1);
  const alpha = m[5] === undefined ? 1 : Number(m[5]) / (m[6] ? 100 : 1);
  return hwbToRgb(clampHwb({ h, w: Number(m[3]), b: Number(m[4]), alpha }));
};

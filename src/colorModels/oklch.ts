import { alphaAlias, clamp, hasBrand, isAnyNumber, isObject, normalizeHue, sanitize } from '../helpers.js';
import { SC, scanFunc, scanPctMask } from '../scan.js';
import type { OklabColor, OklchColor, RgbColor } from '../types.js';
import { oklabToRgb, oklabToRgbUnclamped, rgbToOklab } from './oklab.js';

const oklchToOklab = ({ l, c, h, alpha }: OklchColor): OklabColor => ({
  l,
  a: c * Math.cos((h * Math.PI) / 180),
  b: c * Math.sin((h * Math.PI) / 180),
  alpha,
});

export const OKLCH_ACHROMATIC = 0.000004;

export const rgbToOklch = (rgb: RgbColor): OklchColor => {
  const { l: ol, a: oa, b: ob, alpha } = rgbToOklab(rgb);
  const C = Math.sqrt(oa * oa + ob * ob);
  const H = (Math.atan2(ob, oa) * 180) / Math.PI;
  return { l: ol, c: C, h: C < OKLCH_ACHROMATIC ? 0 : normalizeHue(H), alpha };
};

export const oklchToRgb = (oklch: OklchColor): RgbColor => oklabToRgb(oklchToOklab(oklch));

export const parseOklchObjectRaw = (input: unknown): OklabColor | null => {
  if (!isObject(input)) return null;
  if (hasBrand(input)) return null;
  if (!('l' in input && 'c' in input && 'h' in input)) return null;
  if ('r' in input) return null;
  const { l, c, h, alpha = alphaAlias(input) } = input as { l: unknown; c: unknown; h: unknown; alpha?: unknown };
  if (!isAnyNumber(l) || !isAnyNumber(c) || !isAnyNumber(h) || !isAnyNumber(alpha)) return null;
  if (sanitize(l) > 1 + 1e-9) return null;
  return oklchToOklab({
    l: clamp(sanitize(l), 0, 1),
    c: Math.max(0, sanitize(c)),
    h: normalizeHue(sanitize(h)),
    alpha: clamp(sanitize(alpha), 0, 1),
  });
};

export const parseOklchObject = (input: unknown): RgbColor | null => {
  const lab = parseOklchObjectRaw(input);
  return lab && oklabToRgbUnclamped(lab);
};

export const parseOklchStringRaw = (input: unknown): OklabColor | null => {
  if (typeof input !== 'string' || !scanFunc(input, 'oklch(', 2)) return null;
  const m = scanPctMask();
  return oklchToOklab({
    l: clamp(m & 1 ? SC[0]! / 100 : SC[0]!, 0, 1),
    c: Math.max(0, m & 2 ? SC[1]! * 0.004 : SC[1]!),
    h: normalizeHue(SC[2]!),
    alpha: clamp(SC[3]!, 0, 1),
  });
};

export const parseOklchString = (input: unknown): RgbColor | null => {
  const lab = parseOklchStringRaw(input);
  return lab && oklabToRgbUnclamped(lab);
};

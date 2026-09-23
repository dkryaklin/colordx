import { alphaAlias, clamp, isAnyNumber, isObject, normalizeHue, sanitize } from '../helpers.js';
import { SC, scanFunc, scanPctMask } from '../scan.js';
import type { OklabColor, OklchColor, RgbColor } from '../types.js';
import { oklabToRgb, oklabToRgbUnclamped, rgbToOklab } from './oklab.js';

const oklchToOklab = ({ l, c, h, alpha }: OklchColor): OklabColor => ({
  l,
  a: c * Math.cos((h * Math.PI) / 180),
  b: c * Math.sin((h * Math.PI) / 180),
  alpha,
});

/** Below this OKLCH chroma the hue is powerless and reported as 0 (or `none` in strings). */
export const OKLCH_ACHROMATIC = 0.000004;

export const rgbToOklch = (rgb: RgbColor): OklchColor => {
  const { l: ol, a: oa, b: ob, alpha } = rgbToOklab(rgb);
  const C = Math.sqrt(oa * oa + ob * ob);
  const H = (Math.atan2(ob, oa) * 180) / Math.PI;
  // Achromatic threshold on OKLCH scale (0–~0.4): proportionally equivalent to LCH's 0.0015 threshold.
  return { l: ol, c: C, h: C < OKLCH_ACHROMATIC ? 0 : normalizeHue(H), alpha };
};

export const oklchToRgb = (oklch: OklchColor): RgbColor => oklabToRgb(oklchToOklab(oklch));

export const parseOklchObjectRaw = (input: unknown): OklabColor | null => {
  if (!isObject(input)) return null;
  // Objects with colorSpace: 'lch' are CIE LCH, not OKLCH — let parseLchObject handle them.
  if ((input as { colorSpace?: unknown }).colorSpace === 'lch') return null;
  if (!('l' in input && 'c' in input && 'h' in input)) return null;
  if ('r' in input) return null;
  const { l, c, h, alpha = alphaAlias(input) } = input as { l: unknown; c: unknown; h: unknown; alpha?: unknown };
  if (!isAnyNumber(l) || !isAnyNumber(c) || !isAnyNumber(h) || !isAnyNumber(alpha)) return null;
  // OKLCH L is [0, 1]; an object above that is a CIE LCH value passed without the colorSpace
  // brand, so reject it rather than clamp it to white. Negative L clamps to 0 like the string form.
  // The 1e-9 margin admits float noise: white converts to L = 1.0000000000000002.
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
  // CSS Color 4: L outside [0, 1] and negative C are clamped at parsed-value time.
  return oklchToOklab({
    l: clamp(m & 1 ? SC[0]! / 100 : SC[0]!, 0, 1), // 100% = 1
    c: Math.max(0, m & 2 ? SC[1]! * 0.004 : SC[1]!), // 100% = 0.4
    h: normalizeHue(SC[2]!),
    alpha: clamp(SC[3]!, 0, 1),
  });
};

export const parseOklchString = (input: unknown): RgbColor | null => {
  const lab = parseOklchStringRaw(input);
  return lab && oklabToRgbUnclamped(lab);
};

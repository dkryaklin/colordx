import { ANGLE_UNITS, clamp, hasKeys, isAnyNumber, isObject, normalizeHue, sanitize } from '../helpers.js';
import type { OklabColor, OklchColor, RgbColor } from '../types.js';
import { oklabToRgb, rgbToOklab } from './oklab.js';

const oklchToOklab = ({ l, c, h, alpha }: OklchColor): OklabColor => ({
  l,
  a: c * Math.cos((h * Math.PI) / 180),
  b: c * Math.sin((h * Math.PI) / 180),
  alpha,
});

export const rgbToOklch = (rgb: RgbColor): OklchColor => {
  const { l: ol, a: oa, b: ob, alpha } = rgbToOklab(rgb);
  const C = Math.sqrt(oa * oa + ob * ob);
  const H = (Math.atan2(ob, oa) * 180) / Math.PI;
  // Achromatic threshold on OKLCH scale (0–~0.4): proportionally equivalent to LCH's 0.0015 threshold.
  return { l: ol, c: C, h: C < 0.000004 ? 0 : normalizeHue(H), alpha };
};

export const oklchToRgb = (oklch: OklchColor): RgbColor => oklabToRgb(oklchToOklab(oklch));

export const parseOklchObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  // Objects with colorSpace: 'lch' are CIE LCH, not OKLCH — let parseLchObject handle them.
  if ((input as { colorSpace?: unknown }).colorSpace === 'lch') return null;
  if (!hasKeys(input, ['l', 'c', 'h'])) return null;
  const { l, c, h, alpha = 1 } = input as { l: unknown; c: unknown; h: unknown; alpha?: unknown };
  if (!isAnyNumber(l) || !isAnyNumber(c) || !isAnyNumber(h) || !isAnyNumber(alpha)) return null;
  if (sanitize(l) > 1) return null; // OKLCH L is always [0, 1]; reject CIE LCH values passed without colorSpace branding
  return oklchToRgb({
    l: sanitize(l),
    c: Math.max(0, sanitize(c)),
    h: normalizeHue(sanitize(h)),
    alpha: clamp(sanitize(alpha), 0, 1),
  });
};

const OKLCH_RE =
  /^oklch\(\s*(none|[+-]?\d*\.?\d+)(%?)\s+(none|[+-]?\d*\.?\d+)(%?)\s+(none|[+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*(?:\/\s*(none|[+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

const val = (v: string): number => (v.toLowerCase() === 'none' ? 0 : Number(v));

export const parseOklchString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = OKLCH_RE.exec(input.trim());
  if (!m) return null;
  const L = m[2] ? val(m[1]!) / 100 : val(m[1]!);
  const C = Math.max(0, m[4] ? val(m[3]!) * 0.004 : val(m[3]!)); // CSS Color 4: 100% = 0.4, so 1% = 0.004
  const unit = m[6]?.toLowerCase() ?? 'deg';
  const H = val(m[5]!) * (ANGLE_UNITS[unit] ?? 1);
  const alpha = m[7] === undefined ? 1 : val(m[7]) / (m[8] ? 100 : 1);
  return oklchToRgb({
    l: L,
    c: C,
    h: normalizeHue(H),
    alpha: clamp(alpha, 0, 1),
  });
};

import { ANGLE_UNITS, clamp, hasKeys, isNumeric, isObject } from '../helpers.js';
import type { OklabColor, OklchColor, RgbColor } from '../types.js';
import { oklabToRgb, rgbToOklab } from './oklab.js';

const oklabToOklch = ({ l, a, b, alpha }: OklabColor): OklchColor => {
  const C = Math.sqrt(a ** 2 + b ** 2);
  const H = (Math.atan2(b, a) * 180) / Math.PI;
  return {
    l,
    c: C,
    h: ((H % 360) + 360) % 360,
    a: alpha,
  };
};

const oklchToOklab = ({ l, c, h, a }: OklchColor): OklabColor => ({
  l,
  a: c * Math.cos((h * Math.PI) / 180),
  b: c * Math.sin((h * Math.PI) / 180),
  alpha: a,
});

export const rgbToOklch = (rgb: RgbColor): OklchColor => oklabToOklch(rgbToOklab(rgb));

export const oklchToRgb = (oklch: OklchColor): RgbColor => oklabToRgb(oklchToOklab(oklch));

export const parseOklchObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['l', 'c', 'h'])) return null;
  const { l, c, h, a = 1 } = input as { l: unknown; c: unknown; h: unknown; a?: unknown };
  if (!isNumeric(l as number) || !isNumeric(c as number) || !isNumeric(h as number) || !isNumeric(a as number))
    return null;
  // Distinguish OklchColor (l in 0-1) from LchColor (l in 0-100): if l > 1 treat as Lch
  if ((l as number) > 1) return null;
  return oklchToRgb({
    l: l as number,
    c: c as number,
    h: ((Number(h) % 360) + 360) % 360,
    a: clamp(a as number, 0, 1),
  });
};

const OKLCH_RE =
  /^oklch\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseOklchString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = OKLCH_RE.exec(input);
  if (!m) return null;
  const L = m[2] ? Number(m[1]) / 100 : Number(m[1]);
  const C = m[4] ? Number(m[3]) * 0.004 : Number(m[3]);
  const unit = m[6]?.toLowerCase() ?? 'deg';
  const H = Number(m[5]) * (ANGLE_UNITS[unit] ?? 1);
  const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
  return oklchToRgb({
    l: L,
    c: C,
    h: ((H % 360) + 360) % 360,
    a: clamp(alpha, 0, 1),
  });
};

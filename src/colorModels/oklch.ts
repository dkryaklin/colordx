import { ANGLE_UNITS, clamp, hasKeys, isNumeric, isObject, normalizeHue } from '../helpers.js';
import type { OklabColor, OklchColor, RgbColor } from '../types.js';
import { oklabToRgb, toLinear } from './oklab.js';

const oklchToOklab = ({ l, c, h, a }: OklchColor): OklabColor => ({
  l,
  a: c * Math.cos((h * Math.PI) / 180),
  b: c * Math.sin((h * Math.PI) / 180),
  alpha: a,
});

export const rgbToOklch = ({ r, g, b, a }: RgbColor): OklchColor => {
  const lr = toLinear(r),
    lg = toLinear(g),
    lb = toLinear(b);
  const lv = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const mv = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const sv = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(lv),
    m_ = Math.cbrt(mv),
    s_ = Math.cbrt(sv);
  const oa = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const ob = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const ol = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const C = Math.sqrt(oa * oa + ob * ob);
  const H = (Math.atan2(ob, oa) * 180) / Math.PI;
  return { l: ol, c: C, h: C < 0.0001 ? 0 : normalizeHue(H), a };
};

export const oklchToRgb = (oklch: OklchColor): RgbColor => oklabToRgb(oklchToOklab(oklch));

export const parseOklchObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['l', 'c', 'h'])) return null;
  const { l, c, h, a = 1 } = input as { l: unknown; c: unknown; h: unknown; a?: unknown };
  if (!isNumeric(l as number) || !isNumeric(c as number) || !isNumeric(h as number) || !isNumeric(a as number))
    return null;
  if ((l as number) > 1) return null;
  return oklchToRgb({
    l: l as number,
    c: c as number,
    h: normalizeHue(Number(h)),
    a: clamp(a as number, 0, 1),
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
  const C = m[4] ? val(m[3]!) * 0.004 : val(m[3]!);
  const unit = m[6]?.toLowerCase() ?? 'deg';
  const H = val(m[5]!) * (ANGLE_UNITS[unit] ?? 1);
  const alpha = m[7] === undefined ? 1 : val(m[7]) / (m[8] ? 100 : 1);
  return oklchToRgb({
    l: L,
    c: C,
    h: normalizeHue(H),
    a: clamp(alpha, 0, 1),
  });
};

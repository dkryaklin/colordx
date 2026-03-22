import { ANGLE_UNITS, clamp, hasKeys, isNumeric, isObject, normalizeHue, round } from '../helpers.js';
import type { LchColor, RgbColor } from '../types.js';
import { labToRgb, rgbToLab } from './lab.js';

const clampLch = (lch: LchColor): LchColor => ({
  l: clamp(lch.l, 0, 100),
  c: lch.c,
  h: normalizeHue(lch.h),
  a: clamp(lch.a, 0, 1),
});

export const rgbToLch = (rgb: RgbColor): LchColor => {
  const lab = rgbToLab(rgb);
  const h = (Math.atan2(lab.b, lab.a) / Math.PI) * 180;
  return {
    l: lab.l,
    c: round(Math.sqrt(lab.a ** 2 + lab.b ** 2), 2),
    h: round(h < 0 ? h + 360 : h, 2),
    a: lab.alpha,
  };
};

export const lchToRgb = ({ l, c, h, a }: LchColor): RgbColor =>
  labToRgb({
    l,
    a: c * Math.cos((h * Math.PI) / 180),
    b: c * Math.sin((h * Math.PI) / 180),
    alpha: a,
  });

export const parseLchObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['l', 'c', 'h'])) return null;
  const { l, c, h, a = 1 } = input;
  if (!isNumeric(l) || !isNumeric(c) || !isNumeric(h) || !isNumeric(a as number)) return null;
  return lchToRgb(clampLch({ l: Number(l), c: Number(c), h: Number(h), a: Number(a) }));
};

const LCH_RE =
  /^lch\(\s*([+-]?\d*\.?\d+)%\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseLchString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = LCH_RE.exec(input);
  if (!m) return null;
  const unit = m[4]?.toLowerCase() ?? 'deg';
  const h = Number(m[3]) * (ANGLE_UNITS[unit] ?? 1);
  const a = m[5] === undefined ? 1 : Number(m[5]) / (m[6] ? 100 : 1);
  return lchToRgb(clampLch({ l: Number(m[1]), c: Number(m[2]), h, a }));
};

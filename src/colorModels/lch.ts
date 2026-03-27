import { ANGLE_UNITS, clamp, hasKeys, isAnyNumber, isObject, normalizeHue, round, sanitize } from '../helpers.js';
import type { LchColor, RgbColor } from '../types.js';
import { labToRgb, rgbToLab } from './lab.js';

const clampLch = (lch: Omit<LchColor, 'colorSpace'>): LchColor => ({
  l: clamp(lch.l, 0, 100),
  c: Math.max(0, lch.c),
  h: normalizeHue(lch.h),
  alpha: clamp(lch.alpha, 0, 1),
  colorSpace: 'lch',
});

export const rgbToLch = (rgb: RgbColor): LchColor => {
  const lab = rgbToLab(rgb);
  const c = round(Math.sqrt(lab.a ** 2 + lab.b ** 2), 2);
  const h = (Math.atan2(lab.b, lab.a) / Math.PI) * 180;
  return {
    l: lab.l,
    c,
    // Achromatic threshold on LCH scale (0–~150): below this chroma the hue is numerically unstable.
    h: c < 0.0015 ? 0 : round(h < 0 ? h + 360 : h, 2),
    alpha: lab.alpha,
    colorSpace: 'lch',
  };
};

export const lchToRgb = ({ l, c, h, alpha }: LchColor): RgbColor =>
  labToRgb({
    l,
    a: c * Math.cos((h * Math.PI) / 180),
    b: c * Math.sin((h * Math.PI) / 180),
    alpha,
    colorSpace: 'lab',
  });

export const parseLchObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'lch') return null;
  if (!hasKeys(input, ['l', 'c', 'h'])) return null;
  const { l, c, h, alpha = 1 } = input as { l: unknown; c: unknown; h: unknown; alpha?: unknown };
  if (!isAnyNumber(l) || !isAnyNumber(c) || !isAnyNumber(h) || !isAnyNumber(alpha)) return null;
  return lchToRgb(
    clampLch({
      l: sanitize(l),
      c: sanitize(c),
      h: sanitize(h),
      alpha: sanitize(alpha),
    })
  );
};

const LCH_RE =
  /^lch\(\s*([+-]?\d*\.?\d+)%\s+([+-]?\d*\.?\d+)\s+(none|[+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseLchString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = LCH_RE.exec(input.trim());
  if (!m) return null;
  const unit = m[4]?.toLowerCase() ?? 'deg';
  const h = m[3]!.toLowerCase() === 'none' ? 0 : Number(m[3]) * (ANGLE_UNITS[unit] ?? 1);
  const alpha = m[5] === undefined ? 1 : Number(m[5]) / (m[6] ? 100 : 1);
  return lchToRgb(clampLch({ l: Number(m[1]), c: Number(m[2]), h, alpha }));
};

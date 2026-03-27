import { clamp, hasKeys, isAnyNumber, isObject, round, sanitize } from '../helpers.js';
import type { CmykColor, RgbColor } from '../types.js';
import { clampRgb } from './rgb.js';

const clampCmyk = (cmyk: CmykColor): CmykColor => ({
  c: clamp(cmyk.c, 0, 100),
  m: clamp(cmyk.m, 0, 100),
  y: clamp(cmyk.y, 0, 100),
  k: clamp(cmyk.k, 0, 100),
  alpha: clamp(cmyk.alpha, 0, 1),
});

export const rgbToCmyk = ({ r, g, b, alpha }: RgbColor): CmykColor => {
  const k = 1 - Math.max(r / 255, g / 255, b / 255);
  if (k === 1) return { c: 0, m: 0, y: 0, k: round(100 * k), alpha };
  const c = (1 - r / 255 - k) / (1 - k);
  const m = (1 - g / 255 - k) / (1 - k);
  const y = (1 - b / 255 - k) / (1 - k);
  return {
    c: round(100 * c, 2),
    m: round(100 * m, 2),
    y: round(100 * y, 2),
    k: round(100 * k, 2),
    alpha,
  };
};

export const cmykToRgb = ({ c, m, y, k, alpha }: CmykColor): RgbColor =>
  clampRgb({
    r: 255 * (1 - c / 100) * (1 - k / 100),
    g: 255 * (1 - m / 100) * (1 - k / 100),
    b: 255 * (1 - y / 100) * (1 - k / 100),
    alpha,
  });

export const parseCmykObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['c', 'm', 'y', 'k'])) return null;
  const { c, m, y, k, alpha = 1 } = input as { c: unknown; m: unknown; y: unknown; k: unknown; alpha?: unknown };
  if (!isAnyNumber(c) || !isAnyNumber(m) || !isAnyNumber(y) || !isAnyNumber(k) || !isAnyNumber(alpha)) return null;
  return cmykToRgb(
    clampCmyk({
      c: sanitize(c),
      m: sanitize(m),
      y: sanitize(y),
      k: sanitize(k),
      alpha: sanitize(alpha),
    })
  );
};

const CMYK_RE =
  /^device-cmyk\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseCmykString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = CMYK_RE.exec(input.trim());
  if (!m) return null;
  const toPercent = (val: string, pct: string) => Number(val) * (pct ? 1 : 100);
  return cmykToRgb(
    clampCmyk({
      c: toPercent(m[1]!, m[2]!),
      m: toPercent(m[3]!, m[4]!),
      y: toPercent(m[5]!, m[6]!),
      k: toPercent(m[7]!, m[8]!),
      alpha: m[9] === undefined ? 1 : Number(m[9]) / (m[10] ? 100 : 1),
    })
  );
};

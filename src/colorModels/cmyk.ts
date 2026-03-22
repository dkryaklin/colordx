import { clamp, hasKeys, isNumeric, isObject, round } from '../helpers.js';
import type { CmykColor, RgbColor } from '../types.js';

const clampCmyk = (cmyk: CmykColor): CmykColor => ({
  c: clamp(cmyk.c, 0, 100),
  m: clamp(cmyk.m, 0, 100),
  y: clamp(cmyk.y, 0, 100),
  k: clamp(cmyk.k, 0, 100),
  a: clamp(cmyk.a, 0, 1),
});

export const rgbToCmyk = ({ r, g, b, a }: RgbColor): CmykColor => {
  const k = 1 - Math.max(r / 255, g / 255, b / 255);
  if (k === 1) return { c: 0, m: 0, y: 0, k: round(100 * k), a };
  const c = (1 - r / 255 - k) / (1 - k);
  const m = (1 - g / 255 - k) / (1 - k);
  const y = (1 - b / 255 - k) / (1 - k);
  return {
    c: round(100 * (isNaN(c) ? 0 : c), 2),
    m: round(100 * (isNaN(m) ? 0 : m), 2),
    y: round(100 * (isNaN(y) ? 0 : y), 2),
    k: round(100 * k, 2),
    a,
  };
};

export const cmykToRgb = ({ c, m, y, k, a }: CmykColor): RgbColor => ({
  r: round(255 * (1 - c / 100) * (1 - k / 100)),
  g: round(255 * (1 - m / 100) * (1 - k / 100)),
  b: round(255 * (1 - y / 100) * (1 - k / 100)),
  a,
});

export const parseCmykObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['c', 'm', 'y', 'k'])) return null;
  const { c, m, y, k, a = 1 } = input;
  if (!isNumeric(c) || !isNumeric(m) || !isNumeric(y) || !isNumeric(k) || !isNumeric(a as number)) return null;
  return cmykToRgb(clampCmyk({ c: Number(c), m: Number(m), y: Number(y), k: Number(k), a: Number(a) }));
};

const CMYK_RE =
  /^device-cmyk\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseCmykString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = CMYK_RE.exec(input);
  if (!m) return null;
  const toPercent = (val: string, pct: string) => Number(val) * (pct ? 1 : 100);
  return cmykToRgb(
    clampCmyk({
      c: toPercent(m[1]!, m[2]!),
      m: toPercent(m[3]!, m[4]!),
      y: toPercent(m[5]!, m[6]!),
      k: toPercent(m[7]!, m[8]!),
      a: m[9] === undefined ? 1 : Number(m[9]) / (m[10] ? 100 : 1),
    })
  );
};

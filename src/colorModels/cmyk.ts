import { alphaAlias, clamp, hasBrand, isAnyNumber, isObject, round, sanitize } from '../helpers.js';
import { SC, scanFunc, scanPctMask } from '../scan.js';
import type { CmykColor, RgbColor } from '../types.js';
import { clampRgb } from './rgb.js';

const clampCmyk = (cmyk: CmykColor): CmykColor => ({
  c: clamp(cmyk.c, 0, 100),
  m: clamp(cmyk.m, 0, 100),
  y: clamp(cmyk.y, 0, 100),
  k: clamp(cmyk.k, 0, 100),
  alpha: clamp(cmyk.alpha, 0, 1),
});

export const rgbToCmykRaw = ({ r, g, b, alpha }: RgbColor): CmykColor => {
  const k = 1 - Math.max(r / 255, g / 255, b / 255);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100, alpha };
  return {
    c: ((1 - r / 255 - k) / (1 - k)) * 100,
    m: ((1 - g / 255 - k) / (1 - k)) * 100,
    y: ((1 - b / 255 - k) / (1 - k)) * 100,
    k: k * 100,
    alpha,
  };
};

export const rgbToCmyk = (rgb: RgbColor): CmykColor => {
  const { c, m, y, k, alpha } = rgbToCmykRaw(rgb);
  return { c: round(c, 2), m: round(m, 2), y: round(y, 2), k: round(k, 2), alpha };
};

const cmykToRgb = ({ c, m, y, k, alpha }: CmykColor): RgbColor =>
  clampRgb({
    r: 255 * (1 - c / 100) * (1 - k / 100),
    g: 255 * (1 - m / 100) * (1 - k / 100),
    b: 255 * (1 - y / 100) * (1 - k / 100),
    alpha,
  });

export const parseCmykObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!('c' in input && 'm' in input && 'y' in input && 'k' in input)) return null;
  if (hasBrand(input)) return null;
  const {
    c,
    m,
    y,
    k,
    alpha = alphaAlias(input),
  } = input as { c: unknown; m: unknown; y: unknown; k: unknown; alpha?: unknown };
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

export const parseCmykString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string' || !scanFunc(input, 'device-cmyk(', -1, 4)) return null;
  // Numbers are treated as 0-1 fractions, percentages as 0-100; normalize both to the internal 0-100 range.
  const m = scanPctMask();
  const p = (c: number) => SC[c]! * (m & (1 << c) ? 1 : 100);
  return cmykToRgb(clampCmyk({ c: p(0), m: p(1), y: p(2), k: p(3), alpha: SC[4]! }));
};

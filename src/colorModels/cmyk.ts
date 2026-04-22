import { NUM_OR_NONE, clamp, hasKeys, isAnyNumber, isObject, parseNum, round, sanitize } from '../helpers.js';
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

const CMYK_RE = new RegExp(
  `^device-cmyk\\(\\s*(?<c>${NUM_OR_NONE})(?<cp>%?)\\s+(?<m>${NUM_OR_NONE})(?<mp>%?)` +
    `\\s+(?<y>${NUM_OR_NONE})(?<yp>%?)\\s+(?<k>${NUM_OR_NONE})(?<kp>%?)` +
    `\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseCmykString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = CMYK_RE.exec(input.trim())?.groups;
  if (!g) return null;
  // Numbers are treated as 0-1 fractions, percentages as 0-100; normalize both to the internal 0-100 range.
  const toPercent = (v: string, pct: string) => parseNum(v) * (pct ? 1 : 100);
  return cmykToRgb(
    clampCmyk({
      c: toPercent(g.c!, g.cp!),
      m: toPercent(g.m!, g.mp!),
      y: toPercent(g.y!, g.yp!),
      k: toPercent(g.k!, g.kp!),
      alpha: g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1),
    })
  );
};

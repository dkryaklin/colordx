import { ANGLE_UNITS, clamp, hasKeys, isAnyNumber, isObject, normalizeHue, round, sanitize } from '../helpers.js';
import type { HslColor, RgbColor } from '../types.js';

export const clampHsl = (hsl: HslColor): HslColor => ({
  h: normalizeHue(hsl.h),
  s: clamp(hsl.s, 0, 100),
  l: clamp(hsl.l, 0, 100),
  alpha: clamp(round(hsl.alpha, 3), 0, 1),
});

// Shared write buffer for rgbToHslRaw — callers must destructure immediately, never store the reference.
const _hslBuf: HslColor = { h: 0, s: 0, l: 0, alpha: 0 };

export const rgbToHslRaw = ({ r, g, b, alpha }: RgbColor): HslColor => {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0,
    s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      case bn:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }

  const hDeg = h * 360;
  _hslBuf.h = hDeg >= 0 && hDeg < 360 ? hDeg : ((hDeg % 360) + 360) % 360;
  _hslBuf.s = clamp(s * 100, 0, 100);
  _hslBuf.l = clamp(l * 100, 0, 100);
  _hslBuf.alpha = clamp(round(alpha, 3), 0, 1);
  return _hslBuf;
};

export const rgbToHsl = (rgb: RgbColor): HslColor => {
  const { h, s, l, alpha } = rgbToHslRaw(rgb);
  const hr = round(h, 2);
  // round() can push a value just below 360 to 360.00 due to floating-point; clamp back to 0.
  return { h: hr >= 360 ? 0 : hr, s: round(s, 2), l: round(l, 2), alpha };
};

const _hueToRgb = (p: number, q: number, t: number): number => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

export const hslToRgb = ({ h, s, l, alpha }: HslColor): RgbColor => {
  const sn = s / 100,
    ln = l / 100;
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue = (((h % 360) + 360) % 360) / 360;
  return {
    r: _hueToRgb(p, q, hue + 1 / 3) * 255,
    g: _hueToRgb(p, q, hue) * 255,
    b: _hueToRgb(p, q, hue - 1 / 3) * 255,
    alpha,
  };
};

export const parseHslObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['h', 's', 'l'])) return null;
  const { h, s, l, alpha = 1 } = input as { h: unknown; s: unknown; l: unknown; alpha?: unknown };
  if (!isAnyNumber(h) || !isAnyNumber(s) || !isAnyNumber(l) || !isAnyNumber(alpha)) return null;
  return hslToRgb(clampHsl({ h: sanitize(h), s: sanitize(s), l: sanitize(l), alpha: sanitize(alpha) }));
};

const N = '[+-]?\\d*\\.?\\d+';
const HSL_RE = new RegExp(
  `^hsla?\\(\\s*(${N})(deg|rad|grad|turn)?\\s*(?:` +
    `,\\s*(${N})%\\s*,\\s*(${N})%(?:\\s*,\\s*(${N})(%?)?\\s*)?` +
    `|` +
    `\\s+(${N})(%?)\\s+(${N})(%?)(?:\\s*/\\s*(${N})(%?)?\\s*)?` +
    `)\\)$`,
  'i'
);

export const parseHslString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = HSL_RE.exec(input.trim());
  if (!m) return null;
  const unit = m[2]?.toLowerCase() ?? 'deg';
  const h = Number(m[1]) * (ANGLE_UNITS[unit] ?? 1);
  const s = Number(m[3] ?? m[7]);
  const l = Number(m[4] ?? m[9]);
  const rawA = m[5] ?? m[11];
  const isPercent = !!(m[6] ?? m[12]);
  const alpha = rawA === undefined ? 1 : Number(rawA) / (isPercent ? 100 : 1);
  return hslToRgb(clampHsl({ h, s, l, alpha }));
};

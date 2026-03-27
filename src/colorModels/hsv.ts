import { ANGLE_UNITS, clamp, hasKeys, isAnyNumber, isObject, normalizeHue, round, sanitize } from '../helpers.js';
import type { HsvColor, RgbColor } from '../types.js';
import { clampRgb } from './rgb.js';

export const clampHsv = (hsv: HsvColor): HsvColor => ({
  h: normalizeHue(hsv.h),
  s: clamp(hsv.s, 0, 100),
  v: clamp(hsv.v, 0, 100),
  alpha: clamp(round(hsv.alpha, 3), 0, 1),
});

// Shared write buffer for rgbToHsvRaw — callers must destructure immediately, never store the reference.
const _hsvBuf: HsvColor = { h: 0, s: 0, v: 0, alpha: 0 };

export const rgbToHsvRaw = ({ r, g, b, alpha }: RgbColor): HsvColor => {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;

  if (max !== min) {
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
  _hsvBuf.h = hDeg >= 0 && hDeg < 360 ? hDeg : ((hDeg % 360) + 360) % 360;
  _hsvBuf.s = clamp(s * 100, 0, 100);
  _hsvBuf.v = clamp(max * 100, 0, 100);
  _hsvBuf.alpha = clamp(round(alpha, 3), 0, 1);
  return _hsvBuf;
};

export const rgbToHsv = (rgb: RgbColor): HsvColor => {
  const { h, s, v, alpha } = rgbToHsvRaw(rgb);
  const hr = round(h, 2);
  // round() can push a value just below 360 to 360.00 due to floating-point; clamp back to 0.
  return { h: hr >= 360 ? 0 : hr, s: round(s, 2), v: round(v, 2), alpha };
};

const _RGB = [0, 0, 0] as [number, number, number];

export const hsvToRgb = ({ h, s, v, alpha }: HsvColor): RgbColor => {
  const sn = s / 100,
    vn = v / 100;
  const i = Math.floor((h / 60) % 6);
  const f = h / 60 - Math.floor(h / 60);
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);

  switch (i) {
    case 0:
      _RGB[0] = vn;
      _RGB[1] = t;
      _RGB[2] = p;
      break;
    case 1:
      _RGB[0] = q;
      _RGB[1] = vn;
      _RGB[2] = p;
      break;
    case 2:
      _RGB[0] = p;
      _RGB[1] = vn;
      _RGB[2] = t;
      break;
    case 3:
      _RGB[0] = p;
      _RGB[1] = q;
      _RGB[2] = vn;
      break;
    case 4:
      _RGB[0] = t;
      _RGB[1] = p;
      _RGB[2] = vn;
      break;
    default: // case 5 — not an error handler; i is always 0–5 for h in [0, 360)
      _RGB[0] = vn;
      _RGB[1] = p;
      _RGB[2] = q;
      break;
  }

  return clampRgb({ r: _RGB[0] * 255, g: _RGB[1] * 255, b: _RGB[2] * 255, alpha });
};

const N = '[+-]?\\d*\\.?\\d+';
// HSV/HSVA is a non-standard, library-defined syntax (not part of any CSS spec).
// Format mirrors HSL for consistency: hsv(h, s%, v%) / hsv(h s% v% / alpha).
const HSV_RE = new RegExp(
  `^hsva?\\(\\s*(${N})(deg|rad|grad|turn)?\\s*(?:` +
    `,\\s*(${N})%\\s*,\\s*(${N})%(?:\\s*,\\s*(${N})(%?)?\\s*)?` +
    `|` +
    `\\s+(${N})(%?)\\s+(${N})(%?)(?:\\s*/\\s*(${N})(%?)?\\s*)?` +
    `)\\)$`,
  'i'
);

export const parseHsvString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = HSV_RE.exec(input.trim());
  if (!m) return null;
  const unit = m[2]?.toLowerCase() ?? 'deg';
  const h = Number(m[1]) * (ANGLE_UNITS[unit] ?? 1);
  const s = Number(m[3] ?? m[7]);
  const v = Number(m[4] ?? m[9]);
  const rawA = m[5] ?? m[11];
  const isPercent = !!(m[6] ?? m[12]);
  const alpha = rawA === undefined ? 1 : Number(rawA) / (isPercent ? 100 : 1);
  return hsvToRgb(clampHsv({ h, s, v, alpha }));
};

export const parseHsvObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['h', 's', 'v'])) return null;
  const { h, s, v, alpha = 1 } = input as { h: unknown; s: unknown; v: unknown; alpha?: unknown };
  if (!isAnyNumber(h) || !isAnyNumber(s) || !isAnyNumber(v) || !isAnyNumber(alpha)) return null;
  return hsvToRgb(clampHsv({ h: sanitize(h), s: sanitize(s), v: sanitize(v), alpha: sanitize(alpha) }));
};

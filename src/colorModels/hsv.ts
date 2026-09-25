import { ACHROMATIC_EPS, alphaAlias, clamp, hasBrand, isObject, normalizeHue, round } from '../helpers.js';
import { SC, scanHsx } from '../scan.js';
import type { HsvColor, RgbColor } from '../types.js';
import { clampRgb } from './rgb.js';

const clampHsv = (hsv: HsvColor): HsvColor => ({
  h: normalizeHue(hsv.h),
  s: clamp(hsv.s, 0, 100),
  v: clamp(hsv.v, 0, 100),
  alpha: clamp(round(hsv.alpha, 3), 0, 1),
});

/** Gamma sRGB in 0–1 → HSV (h in [0, 360), s and v in 0–100), written into `out`. Clip wide-gamut input first. */
export const rgbToHsvChannelsInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const d = max - min;
  let h = 0,
    s = 0;

  if (d > ACHROMATIC_EPS) {
    s = d / max;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const hDeg = h * 360;
  out[0] = hDeg >= 0 && hDeg < 360 ? hDeg : ((hDeg % 360) + 360) % 360;
  out[1] = s * 100;
  out[2] = max * 100;
};

/** Allocating sibling of `rgbToHsvChannelsInto` — returns `[h, s, v]`. */
export const rgbToHsvChannels = (r: number, g: number, b: number): [number, number, number] => {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const d = max - min;
  let h = 0,
    s = 0;

  if (d > ACHROMATIC_EPS) {
    s = d / max;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const hDeg = h * 360;
  return [hDeg >= 0 && hDeg < 360 ? hDeg : ((hDeg % 360) + 360) % 360, s * 100, max * 100];
};

const _hsvBuf: HsvColor = { h: 0, s: 0, v: 0, alpha: 0 };

export const rgbToHsvRaw = ({ r, g, b, alpha }: RgbColor): HsvColor => {
  let rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  let max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  if (max > 1 || min < 0) {
    rn = clamp(rn, 0, 1);
    gn = clamp(gn, 0, 1);
    bn = clamp(bn, 0, 1);
    max = Math.max(rn, gn, bn);
    min = Math.min(rn, gn, bn);
  }
  const d = max - min;
  let h = 0,
    s = 0;

  if (d > ACHROMATIC_EPS) {
    s = d / max;
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
  return { h: hr >= 360 ? 0 : hr, s: round(s, 2), v: round(v, 2), alpha };
};

/** HSV (h in degrees, s and v in 0–100) → unclamped gamma sRGB in 0–1, written into `out`. */
export const hsvToRgbChannelsInto = (out: Float64Array | number[], h: number, s: number, v: number): void => {
  const sn = s / 100,
    vn = v / 100;
  const hh = normalizeHue(h) / 60;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);

  switch (i) {
    case 0:
      out[0] = vn;
      out[1] = t;
      out[2] = p;
      break;
    case 1:
      out[0] = q;
      out[1] = vn;
      out[2] = p;
      break;
    case 2:
      out[0] = p;
      out[1] = vn;
      out[2] = t;
      break;
    case 3:
      out[0] = p;
      out[1] = q;
      out[2] = vn;
      break;
    case 4:
      out[0] = t;
      out[1] = p;
      out[2] = vn;
      break;
    default:
      out[0] = vn;
      out[1] = p;
      out[2] = q;
      break;
  }
};

/** Allocating sibling of `hsvToRgbChannelsInto` — returns `[r, g, b]`. */
export const hsvToRgbChannels = (h: number, s: number, v: number): [number, number, number] => {
  const sn = s / 100,
    vn = v / 100;
  const hh = normalizeHue(h) / 60;
  const i = Math.floor(hh);
  const f = hh - i;
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);

  switch (i) {
    case 0:
      return [vn, t, p];
    case 1:
      return [q, vn, p];
    case 2:
      return [p, vn, t];
    case 3:
      return [p, q, vn];
    case 4:
      return [t, p, vn];
    default:
      return [vn, p, q];
  }
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
    default:
      _RGB[0] = vn;
      _RGB[1] = p;
      _RGB[2] = q;
      break;
  }

  return clampRgb({ r: _RGB[0] * 255, g: _RGB[1] * 255, b: _RGB[2] * 255, alpha });
};

export const parseHsvString = (input: unknown): RgbColor | null =>
  typeof input === 'string' && scanHsx(input, 118)
    ? hsvToRgb(clampHsv({ h: SC[0]!, s: SC[1]!, v: SC[2]!, alpha: SC[3]! }))
    : null;

const parseHsvBody = (input: unknown): RgbColor | null => {
  if (hasBrand(input)) return null;
  const { h, s, v, alpha = alphaAlias(input) } = input as { h: unknown; s: unknown; v: unknown; alpha?: unknown };
  if (typeof h !== 'number' || typeof s !== 'number' || typeof v !== 'number' || typeof alpha !== 'number') return null;
  return hsvToRgb({
    h: normalizeHue(h === h ? h : 0),
    s: s > 100 ? 100 : s > 0 ? s : 0,
    v: v > 100 ? 100 : v > 0 ? v : 0,
    alpha: alpha > 1 ? 1 : alpha > 0 ? Math.round(alpha * 1000) / 1000 : 0,
  });
};

export const parseHsvObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!('h' in input && 's' in input && 'v' in input)) return null;
  return parseHsvBody(input);
};

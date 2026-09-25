import { ACHROMATIC_EPS, alphaAlias, clamp, hasBrand, isObject, normalizeHue, round } from '../helpers.js';
import { SC, scanHsx } from '../scan.js';
import type { HslColor, RgbColor } from '../types.js';

const clampHsl = (hsl: HslColor): HslColor => ({
  h: normalizeHue(hsl.h),
  s: clamp(hsl.s, 0, 100),
  l: clamp(hsl.l, 0, 100),
  alpha: clamp(round(hsl.alpha, 3), 0, 1),
});

/** Gamma sRGB in 0–1 → HSL (h in [0, 360), s and l in 0–100), written into `out`. Clip wide-gamut input first. */
export const rgbToHslChannelsInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0,
    s = 0;

  if (d > ACHROMATIC_EPS) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const hDeg = h * 360;
  out[0] = hDeg >= 0 && hDeg < 360 ? hDeg : ((hDeg % 360) + 360) % 360;
  out[1] = s * 100;
  out[2] = l * 100;
};

/** Allocating sibling of `rgbToHslChannelsInto` — returns `[h, s, l]`. */
export const rgbToHslChannels = (r: number, g: number, b: number): [number, number, number] => {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0,
    s = 0;

  if (d > ACHROMATIC_EPS) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const hDeg = h * 360;
  return [hDeg >= 0 && hDeg < 360 ? hDeg : ((hDeg % 360) + 360) % 360, s * 100, l * 100];
};

const _hslBuf: HslColor = { h: 0, s: 0, l: 0, alpha: 0 };

export const rgbToHslRaw = ({ r, g, b, alpha }: RgbColor): HslColor => {
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
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0,
    s = 0;

  if (d > ACHROMATIC_EPS) {
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
  return { h: hr >= 360 ? 0 : hr, s: round(s, 2), l: round(l, 2), alpha };
};

export const hslChannel = (n: number, h: number, l: number, a: number): number => {
  const k = (n + h / 30) % 12;
  const m = k - 3 < 9 - k ? k - 3 : 9 - k;
  return l - a * (m > 1 ? 1 : m < -1 ? -1 : m);
};

/** HSL (h in degrees, s and l in 0–100) → unclamped gamma sRGB in 0–1, written into `out`. */
export const hslToRgbChannelsInto = (out: Float64Array | number[], h: number, s: number, l: number): void => {
  const a = (s * (l < 100 - l ? l : 100 - l)) / 100;
  const hue = normalizeHue(h);
  out[0] = hslChannel(0, hue, l, a) / 100;
  out[1] = hslChannel(8, hue, l, a) / 100;
  out[2] = hslChannel(4, hue, l, a) / 100;
};

/** Allocating sibling of `hslToRgbChannelsInto` — returns `[r, g, b]`. */
export const hslToRgbChannels = (h: number, s: number, l: number): [number, number, number] => {
  const a = (s * (l < 100 - l ? l : 100 - l)) / 100;
  const hue = normalizeHue(h);
  return [hslChannel(0, hue, l, a) / 100, hslChannel(8, hue, l, a) / 100, hslChannel(4, hue, l, a) / 100];
};

export const hslToRgb = ({ h, s, l, alpha }: HslColor): RgbColor => {
  const a = (s * (l < 100 - l ? l : 100 - l)) / 100;
  const hue = normalizeHue(h);
  return {
    r: (hslChannel(0, hue, l, a) * 255) / 100,
    g: (hslChannel(8, hue, l, a) * 255) / 100,
    b: (hslChannel(4, hue, l, a) * 255) / 100,
    alpha,
  };
};

export const parseHslBody = (input: unknown): RgbColor | null => {
  if (hasBrand(input)) return null;
  const { h, s, l, alpha = alphaAlias(input) } = input as { h: unknown; s: unknown; l: unknown; alpha?: unknown };
  if (typeof h !== 'number' || typeof s !== 'number' || typeof l !== 'number' || typeof alpha !== 'number') return null;
  return hslToRgb({
    h: normalizeHue(h === h ? h : 0),
    s: s > 100 ? 100 : s > 0 ? s : 0,
    l: l > 100 ? 100 : l > 0 ? l : 0,
    alpha: alpha > 1 ? 1 : alpha > 0 ? Math.round(alpha * 1000) / 1000 : 0,
  });
};

export const parseHslObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!('h' in input && 's' in input && 'l' in input)) return null;
  return parseHslBody(input);
};

export const parseHslString = (input: unknown): RgbColor | null =>
  typeof input === 'string' && scanHsx(input, 108)
    ? hslToRgb(clampHsl({ h: SC[0]!, s: SC[1]!, l: SC[2]!, alpha: SC[3]! }))
    : null;

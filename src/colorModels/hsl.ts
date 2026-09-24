import { ACHROMATIC_EPS, alphaAlias, clamp, hasBrand, isObject, normalizeHue, round } from '../helpers.js';
import { SC, scanHsx } from '../scan.js';
import type { HslColor, RgbColor } from '../types.js';

const clampHsl = (hsl: HslColor): HslColor => ({
  h: normalizeHue(hsl.h),
  s: clamp(hsl.s, 0, 100),
  l: clamp(hsl.l, 0, 100),
  alpha: clamp(round(hsl.alpha, 3), 0, 1),
});

// The channel functions below, their allocating siblings and the object converters (rgbToHslRaw /
// hslToRgb) deliberately keep separate bodies — see the note in hsv.ts. tests/channels-polar.test.ts
// and tests/channels-into.test.ts pin them to each other bit-for-bit, except hslToRgb, which scales
// percent to bytes as `v · 255 / 100` (exact half bytes) and so matches the channels × 255 to 2 ULP.

/**
 * Gamma-encoded sRGB (0–1) → HSL channels. Writes `[h, s, l]` into `out`: h in degrees [0, 360),
 * s and l in 0–100 — the CSS Color 4 scale `toHsl()` reports. Achromatic input (channels within
 * ACHROMATIC_EPS) reports h = 0, s = 0. No clipping or validation: HSL is defined on the sRGB
 * cube, so clip wide-gamut input first. For byte-scale RGB pass `r / 255, g / 255, b / 255`.
 */
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

  // With g a hair below b, (g - b) / d + 6 rounds to exactly 6 and h * 360 lands on 360; wrap to 0.
  const hDeg = h * 360;
  out[0] = hDeg >= 0 && hDeg < 360 ? hDeg : ((hDeg % 360) + 360) % 360;
  out[1] = s * 100;
  out[2] = l * 100;
};

/** Allocating sibling of `rgbToHslChannelsInto` — returns `[h, s, l]`. Own body: see the note above. */
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

// Shared write buffer for rgbToHslRaw — callers must destructure immediately, never store the reference.
const _hslBuf: HslColor = { h: 0, s: 0, l: 0, alpha: 0 };

export const rgbToHslRaw = ({ r, g, b, alpha }: RgbColor): HslColor => {
  let rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  let max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  if (max > 1 || min < 0) {
    // HSL is defined on the sRGB cube. A wide-gamut color stored outside it is clipped first —
    // the color toHex() prints — so toHsl() and the HSL-based manipulators never describe a
    // different color than hex does. Two comparisons on the in-gamut path, nothing more.
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
  // round() can push a value just below 360 to 360.00 due to floating-point; clamp back to 0.
  return { h: hr >= 360 ? 0 : hr, s: round(s, 2), l: round(l, 2), alpha };
};

/**
 * One channel of the CSS Color 4 hslToRgb sample code, in percent: n = 0 (red), 8 (green),
 * 4 (blue), h in [0, 360), l in 0–100, a = s · min(l, 100 − l) / 100. Returns the channel in
 * 0–100. Percent keeps integer inputs exact where the textbook hue-sector formula on 0–1 values
 * drifts: hsl(60 100% 25%) has red = 50%, which that formula computed as 49.999999999999983% and
 * printed as #7f8000 instead of olive #808000. Byte callers scale by 255 / 100 rather than
 * dividing first: 90 · 255 / 100 is exactly 229.5, 0.9 · 255 is 229.49999999999997. At l = 100,
 * a = 0, so white is exact too.
 */
export const hslChannel = (n: number, h: number, l: number, a: number): number => {
  const k = (n + h / 30) % 12;
  const m = k - 3 < 9 - k ? k - 3 : 9 - k;
  return l - a * (m > 1 ? 1 : m < -1 ? -1 : m);
};

/**
 * HSL channels → gamma-encoded sRGB (0–1). Writes `[r, g, b]` into `out`.
 * h in degrees (any value — wrapped into [0, 360)), s and l in 0–100. Output is in [0, 1] for
 * in-range s/l; nothing is clamped, so out-of-range s/l propagate like every other channel function.
 */
export const hslToRgbChannelsInto = (out: Float64Array | number[], h: number, s: number, l: number): void => {
  const a = (s * (l < 100 - l ? l : 100 - l)) / 100;
  const hue = normalizeHue(h);
  out[0] = hslChannel(0, hue, l, a) / 100;
  out[1] = hslChannel(8, hue, l, a) / 100;
  out[2] = hslChannel(4, hue, l, a) / 100;
};

/** Allocating sibling of `hslToRgbChannelsInto` — returns `[r, g, b]`. Own body: see the note above. */
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
  // `{ colorSpace: 'okhsl', h, s, l }` is Okhsl (the okhsl plugin), not HSL, and any other brand is
  // a different space too.
  if (hasBrand(input)) return null;
  const { h, s, l, alpha = alphaAlias(input) } = input as { h: unknown; s: unknown; l: unknown; alpha?: unknown };
  if (typeof h !== 'number' || typeof s !== 'number' || typeof l !== 'number' || typeof alpha !== 'number') return null;
  // comparison clamps: NaN falls to the low bound, matching sanitize()+clamp()
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

// Legacy comma form requires `%` on s/l and disallows `none`. Modern space form
// allows optional `%` and the CSS Color 4 `none` keyword on any channel.
export const parseHslString = (input: unknown): RgbColor | null =>
  typeof input === 'string' && scanHsx(input, 108)
    ? hslToRgb(clampHsl({ h: SC[0]!, s: SC[1]!, l: SC[2]!, alpha: SC[3]! }))
    : null;

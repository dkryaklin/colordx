import { ACHROMATIC_EPS, ANGLE_UNITS, alphaAlias, clamp, isObject, normalizeHue, round } from '../helpers.js';
import { scanChannel, scanNone, scanPct, scanPos, skipWs } from '../scan.js';
import type { HslColor, RgbColor } from '../types.js';

const clampHsl = (hsl: HslColor): HslColor => ({
  h: normalizeHue(hsl.h),
  s: clamp(hsl.s, 0, 100),
  l: clamp(hsl.l, 0, 100),
  alpha: clamp(round(hsl.alpha, 3), 0, 1),
});

// The channel functions below, their allocating siblings and the object converters (rgbToHslRaw /
// hslToRgb) deliberately keep separate bodies — see the note in hsv.ts. tests/channels-polar.test.ts
// and tests/channels-into.test.ts pin them to each other bit-for-bit.

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

const _hueToRgb = (p: number, q: number, t: number): number => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

/**
 * HSL channels → gamma-encoded sRGB (0–1). Writes `[r, g, b]` into `out`.
 * h in degrees (any value — wrapped into [0, 360)), s and l in 0–100. Output is in [0, 1] for
 * in-range s/l; nothing is clamped, so out-of-range s/l propagate like every other channel function.
 */
export const hslToRgbChannelsInto = (out: Float64Array | number[], h: number, s: number, l: number): void => {
  const sn = s / 100,
    ln = l / 100;
  // `ln + sn * (1 - ln)` rather than `ln + sn - ln * sn`: the latter rounds `1 + sn` before
  // subtracting, so l=100 gives q=0.9999999999999999 and rgbToHsl reads white as chromatic.
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn * (1 - ln);
  const p = 2 * ln - q;
  const hue = normalizeHue(h) / 360;
  out[0] = _hueToRgb(p, q, hue + 1 / 3);
  out[1] = _hueToRgb(p, q, hue);
  out[2] = _hueToRgb(p, q, hue - 1 / 3);
};

/** Allocating sibling of `hslToRgbChannelsInto` — returns `[r, g, b]`. Own body: see the note above. */
export const hslToRgbChannels = (h: number, s: number, l: number): [number, number, number] => {
  const sn = s / 100,
    ln = l / 100;
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn * (1 - ln);
  const p = 2 * ln - q;
  const hue = normalizeHue(h) / 360;
  return [_hueToRgb(p, q, hue + 1 / 3), _hueToRgb(p, q, hue), _hueToRgb(p, q, hue - 1 / 3)];
};

export const hslToRgb = ({ h, s, l, alpha }: HslColor): RgbColor => {
  const sn = s / 100,
    ln = l / 100;
  // `ln + sn * (1 - ln)` rather than `ln + sn - ln * sn`: the latter rounds `1 + sn` before
  // subtracting, so l=100 gives q=0.9999999999999999 and rgbToHsl reads white as chromatic.
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn * (1 - ln);
  const p = 2 * ln - q;
  const hue = normalizeHue(h) / 360;
  return {
    r: _hueToRgb(p, q, hue + 1 / 3) * 255,
    g: _hueToRgb(p, q, hue) * 255,
    b: _hueToRgb(p, q, hue - 1 / 3) * 255,
    alpha,
  };
};

export const parseHslBody = (input: unknown): RgbColor | null => {
  // `{ colorSpace: 'okhsl', h, s, l }` is Okhsl (the okhsl plugin), not HSL — same shape, different space.
  if ((input as { colorSpace?: unknown }).colorSpace === 'okhsl') return null;
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
export const parseHslString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const str = input;
  const n = str.length;
  let i = skipWs(str, 0, n);

  if ((str.charCodeAt(i) | 32) !== 104) return null;
  if ((str.charCodeAt(i + 1) | 32) !== 115) return null;
  if ((str.charCodeAt(i + 2) | 32) !== 108) return null;
  i += 3;
  if ((str.charCodeAt(i) | 32) === 97) i++;
  if (str.charCodeAt(i) !== 40) return null;
  i = skipWs(str, i + 1, n);

  let h = scanChannel(str, i, n);
  if (h !== h || scanPct()) return null;
  const hNone = scanNone();
  i = scanPos();
  let u = i;
  while (u < n && (str.charCodeAt(u) | 32) >= 97 && (str.charCodeAt(u) | 32) <= 122) u++;
  if (u > i) {
    const factor = ANGLE_UNITS[str.slice(i, u).toLowerCase()];
    if (typeof factor !== 'number') return null;
    h *= factor;
    i = u;
  }

  let j = skipWs(str, i, n);
  const comma = str.charCodeAt(j) === 44;
  if (comma) {
    if (hNone) return null;
    j = skipWs(str, j + 1, n);
  } else if (j === i) return null;

  const s = scanChannel(str, j, n);
  if (s !== s || (comma && (!scanPct() || scanNone()))) return null;
  j = scanPos();

  let k = skipWs(str, j, n);
  if (comma) {
    if (str.charCodeAt(k) !== 44) return null;
    k = skipWs(str, k + 1, n);
  } else if (k === j) return null;

  const l = scanChannel(str, k, n);
  if (l !== l || (comma && (!scanPct() || scanNone()))) return null;
  k = scanPos();

  let m = skipWs(str, k, n);
  let alpha = 1;
  if (str.charCodeAt(m) === (comma ? 44 : 47)) {
    m = skipWs(str, m + 1, n);
    const a = scanChannel(str, m, n);
    if (a !== a || (comma && scanNone())) return null;
    alpha = scanPct() ? a / 100 : a;
    m = skipWs(str, scanPos(), n);
  }
  if (str.charCodeAt(m) !== 41) return null;
  if (skipWs(str, m + 1, n) !== n) return null;

  return hslToRgb(clampHsl({ h, s, l, alpha }));
};

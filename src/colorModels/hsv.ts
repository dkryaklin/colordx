import {
  ACHROMATIC_EPS,
  ANGLE_UNITS,
  NUM,
  NUM_OR_NONE,
  clamp,
  isObject,
  normalizeHue,
  parseNum,
  round,
} from '../helpers.js';
import type { HsvColor, RgbColor } from '../types.js';
import { clampRgb } from './rgb.js';

const clampHsv = (hsv: HsvColor): HsvColor => ({
  h: normalizeHue(hsv.h),
  s: clamp(hsv.s, 0, 100),
  v: clamp(hsv.v, 0, 100),
  alpha: clamp(round(hsv.alpha, 3), 0, 1),
});

// The channel functions below, their allocating siblings and the object converters (rgbToHsvRaw /
// hsvToRgb) deliberately keep separate bodies. Routing either through a `*Into` call costs a buffer
// hop (~2 ns) and, worse, feeds the *Into function a second `out` map from inside the library: once
// V8 has seen both a plain array and a caller's Float64Array, a user's render loop over that function
// measured 8× slower (3.3 → 25 ms per 1024² frame). So each *Into only ever sees the caller's buffer.
// tests/channels-polar.test.ts and tests/channels-into.test.ts pin the bodies to each other bit-for-bit.

/**
 * Gamma-encoded sRGB (0–1) → HSV channels. Writes `[h, s, v]` into `out`: h in degrees [0, 360),
 * s and v in 0–100 — the scale `toHsv()` reports. Achromatic input (channels within ACHROMATIC_EPS)
 * reports h = 0, s = 0. No clipping or validation: HSV is defined on the sRGB cube, so clip
 * wide-gamut input first. For byte-scale RGB pass `r / 255, g / 255, b / 255`.
 */
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

  // With g a hair below b, (g - b) / d + 6 rounds to exactly 6 and h * 360 lands on 360; wrap to 0.
  const hDeg = h * 360;
  out[0] = hDeg >= 0 && hDeg < 360 ? hDeg : ((hDeg % 360) + 360) % 360;
  out[1] = s * 100;
  out[2] = max * 100;
};

/** Allocating sibling of `rgbToHsvChannelsInto` — returns `[h, s, v]`. Own body: see the note above. */
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

// Shared write buffer for rgbToHsvRaw — callers must destructure immediately, never store the reference.
const _hsvBuf: HsvColor = { h: 0, s: 0, v: 0, alpha: 0 };

export const rgbToHsvRaw = ({ r, g, b, alpha }: RgbColor): HsvColor => {
  let rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  let max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  if (max > 1 || min < 0) {
    // Same rule as rgbToHslRaw: HSV lives on the sRGB cube, so clip a wide-gamut color first.
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
  // round() can push a value just below 360 to 360.00 due to floating-point; clamp back to 0.
  return { h: hr >= 360 ? 0 : hr, s: round(s, 2), v: round(v, 2), alpha };
};

/**
 * HSV channels → gamma-encoded sRGB (0–1). Writes `[r, g, b]` into `out`.
 * h in degrees (any value — wrapped into [0, 360)), s and v in 0–100. Output is in [0, 1] for
 * in-range s/v; nothing is clamped, so out-of-range s/v propagate like every other channel function.
 */
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
    default: // case 5 — not an error handler; i is always 0–5 for a normalized hue
      out[0] = vn;
      out[1] = p;
      out[2] = q;
      break;
  }
};

/** Allocating sibling of `hsvToRgbChannelsInto` — returns `[r, g, b]`. Own body: see the note above. */
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
    default: // case 5 — not an error handler; i is always 0–5 for a normalized hue
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
    default: // case 5 — not an error handler; i is always 0–5 for h in [0, 360)
      _RGB[0] = vn;
      _RGB[1] = p;
      _RGB[2] = q;
      break;
  }

  return clampRgb({ r: _RGB[0] * 255, g: _RGB[1] * 255, b: _RGB[2] * 255, alpha });
};

// HSV/HSVA is a non-standard, library-defined syntax (not part of any CSS spec).
// Format mirrors HSL for consistency. Legacy comma form kept for back-compat input;
// modern space form supports optional `%` and the CSS Color 4 `none` keyword.
// Named groups: `_c` = comma/legacy branch, `_s` = space/modern branch.
const HSV_RE = new RegExp(
  `^hsva?\\(\\s*(?<h>${NUM_OR_NONE})(?<hu>deg|rad|grad|turn)?\\s*(?:` +
    `,\\s*(?<s_c>${NUM})%\\s*,\\s*(?<v_c>${NUM})%` +
    `(?:\\s*,\\s*(?<al_c>${NUM})(?<alp_c>%?)?\\s*)?` +
    `|` +
    `\\s+(?<s_s>${NUM_OR_NONE})(?<sp_s>%?)\\s+(?<v_s>${NUM_OR_NONE})(?<vp_s>%?)` +
    `(?:\\s*/\\s*(?<al_s>${NUM_OR_NONE})(?<alp_s>%?)?\\s*)?` +
    `)\\)$`,
  'i'
);

export const parseHsvString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = HSV_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const isComma = g.s_c !== undefined;
  if (isComma && /^none$/i.test(g.h!)) return null;
  const unit = g.hu?.toLowerCase() ?? 'deg';
  const h = parseNum(g.h!) * (ANGLE_UNITS[unit] ?? 1);
  const s = parseNum((g.s_c ?? g.s_s)!);
  const v = parseNum((g.v_c ?? g.v_s)!);
  const rawA = g.al_c ?? g.al_s;
  if (isComma && rawA !== undefined && /^none$/i.test(rawA)) return null;
  const isPercent = !!(g.alp_c ?? g.alp_s);
  const alpha = rawA === undefined ? 1 : parseNum(rawA) / (isPercent ? 100 : 1);
  return hsvToRgb(clampHsv({ h, s, v, alpha }));
};

const parseHsvBody = (input: unknown): RgbColor | null => {
  const { h, s, v, alpha = 1 } = input as { h: unknown; s: unknown; v: unknown; alpha?: unknown };
  if (typeof h !== 'number' || typeof s !== 'number' || typeof v !== 'number' || typeof alpha !== 'number') return null;
  // comparison clamps: NaN falls to the low bound, matching sanitize()+clamp()
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
parseHsvObject.inputKind = 'object' as const;
parseHsvString.inputKind = 'string' as const;

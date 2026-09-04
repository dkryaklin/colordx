import {
  ACHROMATIC_EPS,
  ANGLE_UNITS,
  NUM,
  NUM_OR_NONE,
  clamp,
  isNone,
  isObject,
  normalizeHue,
  parseNum,
  round,
} from '../helpers.js';
import type { HslColor, RgbColor } from '../types.js';

const clampHsl = (hsl: HslColor): HslColor => ({
  h: normalizeHue(hsl.h),
  s: clamp(hsl.s, 0, 100),
  l: clamp(hsl.l, 0, 100),
  alpha: clamp(round(hsl.alpha, 3), 0, 1),
});

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
  const { h, s, l, alpha = 1 } = input as { h: unknown; s: unknown; l: unknown; alpha?: unknown };
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
// Named groups: `_c` = comma/legacy branch, `_s` = space/modern branch.
const HSL_RE = new RegExp(
  `^hsla?\\(\\s*(${NUM_OR_NONE})(deg|rad|grad|turn)?\\s*(?:` +
    `,\\s*(${NUM})%\\s*,\\s*(${NUM})%` +
    `(?:\\s*,\\s*(${NUM})(%?)?\\s*)?` +
    `|` +
    `\\s+(${NUM_OR_NONE})(%?)\\s+(${NUM_OR_NONE})(%?)` +
    `(?:\\s*/\\s*(${NUM_OR_NONE})(%?)?\\s*)?` +
    `)\\)$`,
  'i'
);

export const parseHslString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = HSL_RE.exec(input.trim());
  if (!m) return null;
  // 1:h 2:unit | comma 3:s 4:l 5:al 6:alp | space 7:s 8:sp 9:l 10:lp 11:al 12:alp
  const isComma = m[3] !== undefined;
  const hRaw = m[1]!;
  if (isComma && isNone(hRaw)) return null; // legacy syntax has no `none`
  const unit = m[2];
  const h = parseNum(hRaw) * (unit === undefined ? 1 : (ANGLE_UNITS[unit.toLowerCase()] ?? 1));
  const s = parseNum((isComma ? m[3] : m[7])!);
  const l = parseNum((isComma ? m[4] : m[9])!);
  const rawA = isComma ? m[5] : m[11];
  const isPercent = !!(isComma ? m[6] : m[12]);
  if (isComma && rawA !== undefined && isNone(rawA)) return null;
  const alpha = rawA === undefined ? 1 : parseNum(rawA) / (isPercent ? 100 : 1);
  return hslToRgb(clampHsl({ h, s, l, alpha }));
};

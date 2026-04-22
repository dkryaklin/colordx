import {
  ANGLE_UNITS,
  NUM,
  NUM_OR_NONE,
  clamp,
  hasKeys,
  isAnyNumber,
  isObject,
  normalizeHue,
  parseNum,
  round,
  sanitize,
} from '../helpers.js';
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

// Legacy comma form requires `%` on s/l and disallows `none`. Modern space form
// allows optional `%` and the CSS Color 4 `none` keyword on any channel.
// Named groups: `_c` = comma/legacy branch, `_s` = space/modern branch.
const HSL_RE = new RegExp(
  `^hsla?\\(\\s*(?<h>${NUM_OR_NONE})(?<hu>deg|rad|grad|turn)?\\s*(?:` +
    `,\\s*(?<s_c>${NUM})%\\s*,\\s*(?<l_c>${NUM})%` +
    `(?:\\s*,\\s*(?<al_c>${NUM})(?<alp_c>%?)?\\s*)?` +
    `|` +
    `\\s+(?<s_s>${NUM_OR_NONE})(?<sp_s>%?)\\s+(?<l_s>${NUM_OR_NONE})(?<lp_s>%?)` +
    `(?:\\s*/\\s*(?<al_s>${NUM_OR_NONE})(?<alp_s>%?)?\\s*)?` +
    `)\\)$`,
  'i'
);

export const parseHslString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = HSL_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const isComma = g.s_c !== undefined;
  if (isComma && /^none$/i.test(g.h!)) return null; // legacy syntax has no `none`
  const unit = g.hu?.toLowerCase() ?? 'deg';
  const h = parseNum(g.h!) * (ANGLE_UNITS[unit] ?? 1);
  const s = parseNum((g.s_c ?? g.s_s)!);
  const l = parseNum((g.l_c ?? g.l_s)!);
  const rawA = g.al_c ?? g.al_s;
  const isPercent = !!(g.alp_c ?? g.alp_s);
  if (isComma && rawA !== undefined && /^none$/i.test(rawA)) return null;
  const alpha = rawA === undefined ? 1 : parseNum(rawA) / (isPercent ? 100 : 1);
  return hslToRgb(clampHsl({ h, s, l, alpha }));
};

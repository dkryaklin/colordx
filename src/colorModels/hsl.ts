import { ANGLE_UNITS, clamp, hasKeys, isNumeric, isObject, normalizeHue, round } from '../helpers.js';
import type { HslColor, RgbColor } from '../types.js';
import { clampRgb } from './rgb.js';

export const clampHsl = (hsl: HslColor): HslColor => ({
  h: normalizeHue(hsl.h),
  s: clamp(hsl.s, 0, 100),
  l: clamp(hsl.l, 0, 100),
  a: clamp(round(hsl.a, 3), 0, 1),
});

export const rgbToHslRaw = ({ r, g, b, a }: RgbColor): HslColor => {
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

  return clampHsl({ h: h * 360, s: s * 100, l: l * 100, a });
};

export const rgbToHsl = (rgb: RgbColor): HslColor => {
  const { h, s, l, a } = rgbToHslRaw(rgb);
  return { h: round(h, 2), s: round(s, 2), l: round(l, 2), a };
};

export const hslToRgb = ({ h, s, l, a }: HslColor): RgbColor => {
  const sn = s / 100,
    ln = l / 100;
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue = h / 360;

  const hueToRgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return clampRgb({
    r: hueToRgb(hue + 1 / 3) * 255,
    g: hueToRgb(hue) * 255,
    b: hueToRgb(hue - 1 / 3) * 255,
    a,
  });
};

export const parseHslObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['h', 's', 'l'])) return null;
  const { h, s, l, a = 1 } = input;
  if (!isNumeric(h) || !isNumeric(s) || !isNumeric(l) || !isNumeric(a as number)) return null;
  return hslToRgb(clampHsl({ h: h, s: s, l: l, a: a as number }));
};

// Matches both legacy comma syntax: hsl(0, 0%, 0%) / hsla(0, 0%, 0%, 0.5)
// and modern space syntax: hsl(0 0% 0%) / hsl(0 0% 0% / 0.5)
// CSS Color 4: in modern space syntax, s and l may be bare numbers (0-100) without %
const N = '[+-]?\\d*\\.?\\d+';
const HSL_RE = new RegExp(
  `^hsla?\\(\\s*(${N})(deg|rad|grad|turn)?\\s*(?:` +
    // legacy comma branch: % required for s and l
    `,\\s*(${N})%\\s*,\\s*(${N})%(?:\\s*,\\s*(${N})(%?)?\\s*)?` +
    `|` +
    // modern space branch: % optional for s and l
    `\\s+(${N})(%?)\\s+(${N})(%?)(?:\\s*/\\s*(${N})(%?)?\\s*)?` +
    `)\\)$`,
  'i'
);

export const parseHslString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = HSL_RE.exec(input);
  if (!m) return null;
  const unit = m[2]?.toLowerCase() ?? 'deg';
  const h = Number(m[1]) * (ANGLE_UNITS[unit] ?? 1);
  // comma branch: m[3]=s m[4]=l m[5]=a m[6]=a%
  // space branch:  m[7]=s m[8]=s% m[9]=l m[10]=l% m[11]=a m[12]=a%
  const s = Number(m[3] ?? m[7]);
  const l = Number(m[4] ?? m[9]);
  const rawA = m[5] ?? m[11];
  const isPercent = !!(m[6] ?? m[12]);
  const a = rawA === undefined ? 1 : Number(rawA) / (isPercent ? 100 : 1);
  return hslToRgb(clampHsl({ h, s, l, a }));
};

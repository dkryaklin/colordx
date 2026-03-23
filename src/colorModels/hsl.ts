import { clamp, hasKeys, isNumeric, isObject, normalizeHue, round } from '../helpers.js';
import type { HslColor, RgbColor } from '../types.js';

export const clampHsl = (hsl: HslColor): HslColor => ({
  h: normalizeHue(hsl.h),
  s: clamp(hsl.s, 0, 100),
  l: clamp(hsl.l, 0, 100),
  a: clamp(round(hsl.a, 2), 0, 1),
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

  return {
    r: round(hueToRgb(hue + 1 / 3) * 255),
    g: round(hueToRgb(hue) * 255),
    b: round(hueToRgb(hue - 1 / 3) * 255),
    a,
  };
};

export const parseHslObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['h', 's', 'l'])) return null;
  const { h, s, l, a = 1 } = input;
  if (!isNumeric(h) || !isNumeric(s) || !isNumeric(l) || !isNumeric(a as number)) return null;
  return hslToRgb(clampHsl({ h: h, s: s, l: l, a: a as number }));
};

export const parseHslString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const match = input.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (!match) return null;
  return hslToRgb(
    clampHsl({
      h: parseFloat(match[1]!),
      s: parseFloat(match[2]!),
      l: parseFloat(match[3]!),
      a: match[4] !== undefined ? parseFloat(match[4]) : 1,
    })
  );
};

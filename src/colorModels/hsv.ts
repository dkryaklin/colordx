import { clamp, hasKeys, isNumeric, isObject, normalizeHue, round } from '../helpers.js';
import type { HsvColor, RgbColor } from '../types.js';

export const clampHsv = (hsv: HsvColor): HsvColor => ({
  h: normalizeHue(hsv.h),
  s: clamp(hsv.s, 0, 100),
  v: clamp(hsv.v, 0, 100),
  a: clamp(round(hsv.a, 3), 0, 1),
});

export const rgbToHsv = ({ r, g, b, a }: RgbColor): HsvColor => {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const d = max - min;
  const v = max;
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

  return clampHsv({ h: round(h * 360, 2), s: round(s * 100, 2), v: round(v * 100, 2), a });
};

export const hsvToRgb = ({ h, s, v, a }: HsvColor): RgbColor => {
  const sn = s / 100,
    vn = v / 100;
  const i = Math.floor((h / 60) % 6);
  const f = h / 60 - Math.floor(h / 60);
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);

  const [r, g, b] = [
    [vn, q, p, p, t, vn],
    [t, vn, vn, q, p, p],
    [p, p, t, vn, vn, q],
  ].map((channel) => round(channel[i]! * 255));

  return { r: r!, g: g!, b: b!, a };
};

export const parseHsvObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['h', 's', 'v'])) return null;
  const { h, s, v, a = 1 } = input;
  if (!isNumeric(h) || !isNumeric(s) || !isNumeric(v) || !isNumeric(a as number)) return null;
  return hsvToRgb(clampHsv({ h: h, s: s, v: v, a: a as number }));
};

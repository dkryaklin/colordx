import { clamp, hasKeys, isNumeric, isObject, round } from '../helpers.js';
import type { RgbColor, XyzColor } from '../types.js';
import { clampRgb } from './rgb.js';

// D50 white point
const WX = 96.422,
  WY = 100,
  WZ = 82.521;

const toLinear = (c: number): number => {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (c: number): number => 255 * (c > 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c);

export const rgbToXyz = ({ r, g, b, a }: RgbColor): XyzColor => {
  const lr = toLinear(r),
    lg = toLinear(g),
    lb = toLinear(b);
  // sRGB → XYZ D65
  const xd65 = 100 * (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb);
  const yd65 = 100 * (0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb);
  const zd65 = 100 * (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb);
  // D65 → D50 (Bradford)
  return {
    x: clamp(1.0478112 * xd65 + 0.0228866 * yd65 - 0.050127 * zd65, 0, WX),
    y: clamp(0.0295424 * xd65 + 0.9904844 * yd65 - 0.0170491 * zd65, 0, WY),
    z: clamp(-0.0092345 * xd65 + 0.0150436 * yd65 + 0.7521316 * zd65, 0, WZ),
    a: clamp(round(a, 3), 0, 1),
  };
};

export const xyzToRgb = ({ x, y, z, a }: XyzColor): RgbColor => {
  // D50 → D65 (Bradford inverse)
  const xd65 = 0.9555766 * x - 0.0230393 * y + 0.0631636 * z;
  const yd65 = -0.0282895 * x + 1.0099416 * y + 0.0210077 * z;
  const zd65 = 0.0122982 * x - 0.020483 * y + 1.3299098 * z;
  return clampRgb({
    r: fromLinear(0.032404542 * xd65 - 0.015371385 * yd65 - 0.004985314 * zd65),
    g: fromLinear(-0.00969266 * xd65 + 0.018760108 * yd65 + 0.00041556 * zd65),
    b: fromLinear(0.000556434 * xd65 - 0.002040259 * yd65 + 0.010572252 * zd65),
    a,
  });
};

export const parseXyzObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['x', 'y', 'z'])) return null;
  const { x, y, z, a = 1 } = input;
  if (!isNumeric(x) || !isNumeric(y) || !isNumeric(z) || !isNumeric(a as number)) return null;
  return xyzToRgb({
    x: clamp(Number(x), 0, WX),
    y: clamp(Number(y), 0, WY),
    z: clamp(Number(z), 0, WZ),
    a: clamp(Number(a), 0, 1),
  });
};

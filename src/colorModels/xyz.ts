import { clamp, hasKeys, isNumeric, isObject, round } from '../helpers.js';
import type { RgbColor, XyzColor } from '../types.js';
import { clampRgb } from './rgb.js';

// D50 white point (CSS Color 4: xy = 0.3457/0.3585)
const WX = 96.42956752983539,
  WY = 100,
  WZ = 82.51046025104603;

const toLinear = (c: number): number => {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (c: number): number => 255 * (c > 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c);

export const rgbToXyz = ({ r, g, b, a }: RgbColor): XyzColor => {
  const lr = toLinear(r),
    lg = toLinear(g),
    lb = toLinear(b);
  // sRGB → XYZ D65 (CSS Color 4 exact rational fractions)
  const xd65 = 100 * (0.41239079926595951 * lr + 0.35758433938387796 * lg + 0.18048078840183429 * lb);
  const yd65 = 100 * (0.21263900587151036 * lr + 0.71516867876775592 * lg + 0.072192315360733714 * lb);
  const zd65 = 100 * (0.019330818715591849 * lr + 0.11919477979462599 * lg + 0.95053215224966059 * lb);
  // D65 → D50 (Bradford, CSS Color 4)
  return {
    x: clamp(1.0479297925449969 * xd65 + 0.022946870601609652 * yd65 - 0.05019226628920524 * zd65, 0, WX),
    y: clamp(0.02962780877005599 * xd65 + 0.9904344267538799 * yd65 - 0.017073799063418826 * zd65, 0, WY),
    z: clamp(-0.009243040646204504 * xd65 + 0.015055191490298152 * yd65 + 0.7518742814281371 * zd65, 0, WZ),
    a: clamp(round(a, 3), 0, 1),
  };
};

export const xyzToRgb = ({ x, y, z, a }: XyzColor): RgbColor => {
  // D50 → D65 (Bradford inverse, CSS Color 4)
  const xd65 = 0.955473421488075 * x - 0.02309845494876471 * y + 0.06325924320057072 * z;
  const yd65 = -0.0283697093338637 * x + 1.0099953980813041 * y + 0.021041441191917323 * z;
  const zd65 = 0.012314014864481998 * x - 0.020507649298898964 * y + 1.330365926242124 * z;
  return clampRgb({
    r: fromLinear(0.032409699419045213 * xd65 - 0.015373831775700935 * yd65 - 0.0049861076029300327 * zd65),
    g: fromLinear(-0.0096924363628087984 * xd65 + 0.018759675015077206 * yd65 + 0.00041555057407175612 * zd65),
    b: fromLinear(0.00055630079696993608 * xd65 - 0.0020397695888897657 * yd65 + 0.010569715142428786 * zd65),
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

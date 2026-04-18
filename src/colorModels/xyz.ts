import { clamp, hasKeys, isNumber, isObject, round } from '../helpers.js';
import { srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { RgbColor, XyzColor } from '../types.js';
import { clampRgb } from './rgb.js';

// D50 white point (CSS Color 4: xy = 0.3457/0.3585)
export const D50_WX = 96.42956752983539;
export const D50_WY = 100;
export const D50_WZ = 82.51046025104603;

export const rgbToXyz = ({ r, g, b, alpha }: RgbColor): XyzColor => {
  const lr = srgbToLinear(r / 255),
    lg = srgbToLinear(g / 255),
    lb = srgbToLinear(b / 255);
  // sRGB → XYZ D65 (CSS Color 4 exact rational fractions)
  const xd65 = 100 * (0.41239079926595951 * lr + 0.35758433938387796 * lg + 0.18048078840183429 * lb);
  const yd65 = 100 * (0.21263900587151036 * lr + 0.71516867876775592 * lg + 0.072192315360733714 * lb);
  const zd65 = 100 * (0.019330818715591849 * lr + 0.11919477979462599 * lg + 0.95053215224966059 * lb);
  // D65 → D50 (Bradford, CSS Color 4)
  return {
    x: 1.0479297925449969 * xd65 + 0.022946870601609652 * yd65 - 0.05019226628920524 * zd65,
    y: 0.02962780877005599 * xd65 + 0.9904344267538799 * yd65 - 0.017073799063418826 * zd65,
    z: -0.009243040646204504 * xd65 + 0.015055191490298152 * yd65 + 0.7518742814281371 * zd65,
    alpha: clamp(round(alpha, 3), 0, 1),
  };
};

// Bradford D50→D65 and XYZ(D65)→linear sRGB matrices (CSS Color 4).
// Shared between the allocating and *Into variants to keep coefficients in one place.
const B_XR = 0.955473421488075,
  B_XG = -0.02309845494876471,
  B_XB = 0.06325924320057072;
const B_YR = -0.0283697093338637,
  B_YG = 1.0099953980813041,
  B_YB = 0.021041441191917323;
const B_ZR = 0.012314014864481998,
  B_ZG = -0.020507649298898964,
  B_ZB = 1.330365926242124;
const X_RX = 0.032409699419045213,
  X_RY = -0.015373831775700935,
  X_RZ = -0.0049861076029300327;
const X_GX = -0.0096924363628087984,
  X_GY = 0.018759675015077206,
  X_GZ = 0.00041555057407175612;
const X_BX = 0.00055630079696993608,
  X_BY = -0.0020397695888897657,
  X_BZ = 0.010569715142428786;

/** Zero-allocation sibling of xyzD50ToLinearSrgb — writes [lr, lg, lb] into `out`. */
export const xyzD50ToLinearSrgbInto = (out: Float64Array | number[], x: number, y: number, z: number): void => {
  const xd65 = B_XR * x + B_XG * y + B_XB * z;
  const yd65 = B_YR * x + B_YG * y + B_YB * z;
  const zd65 = B_ZR * x + B_ZG * y + B_ZB * z;
  out[0] = X_RX * xd65 + X_RY * yd65 + X_RZ * zd65;
  out[1] = X_GX * xd65 + X_GY * yd65 + X_GZ * zd65;
  out[2] = X_BX * xd65 + X_BY * yd65 + X_BZ * zd65;
};

/** XYZ D50 → linear sRGB (no gamma, no clamping). x/y/z are in 0–100 scale. */
export const xyzD50ToLinearSrgb = (x: number, y: number, z: number): [number, number, number] => {
  const xd65 = B_XR * x + B_XG * y + B_XB * z;
  const yd65 = B_YR * x + B_YG * y + B_YB * z;
  const zd65 = B_ZR * x + B_ZG * y + B_ZB * z;
  return [
    X_RX * xd65 + X_RY * yd65 + X_RZ * zd65,
    X_GX * xd65 + X_GY * yd65 + X_GZ * zd65,
    X_BX * xd65 + X_BY * yd65 + X_BZ * zd65,
  ];
};

export const xyzToRgb = ({ x, y, z, alpha }: XyzColor): RgbColor => {
  const [lr, lg, lb] = xyzD50ToLinearSrgb(x, y, z);
  return clampRgb({
    r: srgbFromLinear(lr) * 255,
    g: srgbFromLinear(lg) * 255,
    b: srgbFromLinear(lb) * 255,
    alpha,
  });
};

/** Unclamped XYZ D50 → gamma-encoded sRGB. Channels may exceed [0, 255] for out-of-sRGB-gamut colors. */
const xyzToRgbUnclamped = ({ x, y, z, alpha }: XyzColor): RgbColor => {
  const [lr, lg, lb] = xyzD50ToLinearSrgb(x, y, z);
  return {
    r: srgbFromLinear(lr) * 255,
    g: srgbFromLinear(lg) * 255,
    b: srgbFromLinear(lb) * 255,
    alpha,
  };
};

export const parseXyzObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['x', 'y', 'z'])) return null;
  const { x, y, z, alpha = 1 } = input as { x: unknown; y: unknown; z: unknown; alpha?: unknown };
  if (!isNumber(x) || !isNumber(y) || !isNumber(z) || !isNumber(alpha)) return null;
  return xyzToRgbUnclamped({
    x,
    y,
    z,
    alpha: clamp(alpha, 0, 1),
  });
};

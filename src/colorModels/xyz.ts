import { NUM_OR_NONE, clamp, hasKeys, isAnyNumber, isNumber, isObject, parseNum, round, sanitize } from '../helpers.js';
import { srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { RgbColor, XyzColor, XyzD65Color } from '../types.js';
import { clampRgb } from './rgb.js';

// D50 white point (CSS Color 4: xy = 0.3457/0.3585)
export const D50_WX = 96.42956752983539;
export const D50_WY = 100;
export const D50_WZ = 82.51046025104603;

// ── CSS Color 4 exact rational matrices ─────────────────────────────────────
// sRGB linear → XYZ D65 (xyz in 0–1; callers scale to 0–100 by multiplying).
const S_XR = 0.41239079926595951,
  S_XG = 0.35758433938387796,
  S_XB = 0.18048078840183429;
const S_YR = 0.21263900587151036,
  S_YG = 0.71516867876775592,
  S_YB = 0.072192315360733714;
const S_ZR = 0.019330818715591849,
  S_ZG = 0.11919477979462599,
  S_ZB = 0.95053215224966059;

// XYZ D65 (0–100 scale) → sRGB linear (0–1). Equals the CSS inverse matrix ÷100.
const X_RX = 0.032409699419045213,
  X_RY = -0.015373831775700935,
  X_RZ = -0.0049861076029300327;
const X_GX = -0.0096924363628087984,
  X_GY = 0.018759675015077206,
  X_GZ = 0.00041555057407175612;
const X_BX = 0.00055630079696993608,
  X_BY = -0.0020397695888897657,
  X_BZ = 0.010569715142428786;

// Bradford D65 → D50 (CSS Color 4)
const D65_TO_D50_XX = 1.0479297925449969,
  D65_TO_D50_XY = 0.022946870601609652,
  D65_TO_D50_XZ = -0.05019226628920524;
const D65_TO_D50_YX = 0.02962780877005599,
  D65_TO_D50_YY = 0.9904344267538799,
  D65_TO_D50_YZ = -0.017073799063418826;
const D65_TO_D50_ZX = -0.009243040646204504,
  D65_TO_D50_ZY = 0.015055191490298152,
  D65_TO_D50_ZZ = 0.7518742814281371;

// Bradford D50 → D65 (CSS Color 4, inverse of above)
const D50_TO_D65_XX = 0.955473421488075,
  D50_TO_D65_XY = -0.02309845494876471,
  D50_TO_D65_XZ = 0.06325924320057072;
const D50_TO_D65_YX = -0.0283697093338637,
  D50_TO_D65_YY = 1.0099953980813041,
  D50_TO_D65_YZ = 0.021041441191917323;
const D50_TO_D65_ZX = 0.012314014864481998,
  D50_TO_D65_ZY = -0.020507649298898964,
  D50_TO_D65_ZZ = 1.330365926242124;

// ── RGB ↔ XYZ D65 ───────────────────────────────────────────────────────────

/** sRGB (0–255) → XYZ D65 (0–100, screen-native, no Bradford adaptation). */
export const rgbToXyzD65 = ({ r, g, b, alpha }: RgbColor): XyzD65Color => {
  const lr = srgbToLinear(r / 255),
    lg = srgbToLinear(g / 255),
    lb = srgbToLinear(b / 255);
  return {
    x: 100 * (S_XR * lr + S_XG * lg + S_XB * lb),
    y: 100 * (S_YR * lr + S_YG * lg + S_YB * lb),
    z: 100 * (S_ZR * lr + S_ZG * lg + S_ZB * lb),
    alpha: clamp(round(alpha, 3), 0, 1),
    colorSpace: 'xyz-d65' as const,
  };
};

/** XYZ D65 (0–100) → linear sRGB (0–1, unclamped). */
export const xyzD65ToLinearSrgb = (x: number, y: number, z: number): [number, number, number] => [
  X_RX * x + X_RY * y + X_RZ * z,
  X_GX * x + X_GY * y + X_GZ * z,
  X_BX * x + X_BY * y + X_BZ * z,
];

const xyzD65ToRgbUnclamped = ({ x, y, z, alpha }: XyzD65Color): RgbColor => {
  const [lr, lg, lb] = xyzD65ToLinearSrgb(x, y, z);
  return {
    r: srgbFromLinear(lr) * 255,
    g: srgbFromLinear(lg) * 255,
    b: srgbFromLinear(lb) * 255,
    alpha,
  };
};

// ── RGB ↔ XYZ D50 ───────────────────────────────────────────────────────────

export const rgbToXyz = ({ r, g, b, alpha }: RgbColor): XyzColor => {
  const lr = srgbToLinear(r / 255),
    lg = srgbToLinear(g / 255),
    lb = srgbToLinear(b / 255);
  const xd65 = 100 * (S_XR * lr + S_XG * lg + S_XB * lb);
  const yd65 = 100 * (S_YR * lr + S_YG * lg + S_YB * lb);
  const zd65 = 100 * (S_ZR * lr + S_ZG * lg + S_ZB * lb);
  return {
    x: D65_TO_D50_XX * xd65 + D65_TO_D50_XY * yd65 + D65_TO_D50_XZ * zd65,
    y: D65_TO_D50_YX * xd65 + D65_TO_D50_YY * yd65 + D65_TO_D50_YZ * zd65,
    z: D65_TO_D50_ZX * xd65 + D65_TO_D50_ZY * yd65 + D65_TO_D50_ZZ * zd65,
    alpha: clamp(round(alpha, 3), 0, 1),
  };
};

/** Zero-allocation sibling of xyzD50ToLinearSrgb — writes [lr, lg, lb] into `out`. */
export const xyzD50ToLinearSrgbInto = (out: Float64Array | number[], x: number, y: number, z: number): void => {
  const xd65 = D50_TO_D65_XX * x + D50_TO_D65_XY * y + D50_TO_D65_XZ * z;
  const yd65 = D50_TO_D65_YX * x + D50_TO_D65_YY * y + D50_TO_D65_YZ * z;
  const zd65 = D50_TO_D65_ZX * x + D50_TO_D65_ZY * y + D50_TO_D65_ZZ * z;
  out[0] = X_RX * xd65 + X_RY * yd65 + X_RZ * zd65;
  out[1] = X_GX * xd65 + X_GY * yd65 + X_GZ * zd65;
  out[2] = X_BX * xd65 + X_BY * yd65 + X_BZ * zd65;
};

/** XYZ D50 → linear sRGB (no gamma, no clamping). x/y/z are in 0–100 scale. */
export const xyzD50ToLinearSrgb = (x: number, y: number, z: number): [number, number, number] => {
  const xd65 = D50_TO_D65_XX * x + D50_TO_D65_XY * y + D50_TO_D65_XZ * z;
  const yd65 = D50_TO_D65_YX * x + D50_TO_D65_YY * y + D50_TO_D65_YZ * z;
  const zd65 = D50_TO_D65_ZX * x + D50_TO_D65_ZY * y + D50_TO_D65_ZZ * z;
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

// ── Parsers ─────────────────────────────────────────────────────────────────

export const parseXyzObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  // Reject D65-discriminated objects — parseXyzD65Object owns those.
  if ((input as { colorSpace?: unknown }).colorSpace === 'xyz-d65') return null;
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

export const parseXyzD65Object = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'xyz-d65') return null;
  if (!hasKeys(input, ['x', 'y', 'z'])) return null;
  const { x, y, z, alpha = 1 } = input as { x: unknown; y: unknown; z: unknown; alpha?: unknown };
  if (!isAnyNumber(x) || !isAnyNumber(y) || !isAnyNumber(z) || !isAnyNumber(alpha)) return null;
  return xyzD65ToRgbUnclamped({
    x: sanitize(x),
    y: sanitize(y),
    z: sanitize(z),
    alpha: clamp(sanitize(alpha), 0, 1),
    colorSpace: 'xyz-d65',
  });
};

// CSS Color 4: color(xyz-d65 x y z / alpha). Channels accept number|percentage|none.
// The library uses a 0–100 XYZ scale (to match the existing XyzColor convention); percent is
// treated as the same scale for symmetry with the emitted string (100% = 100).
const XYZ_D65_RE = new RegExp(
  `^color\\(\\s*xyz-d65\\s+(?<x>${NUM_OR_NONE})(?<xp>%?)\\s+(?<y>${NUM_OR_NONE})(?<yp>%?)` +
    `\\s+(?<z>${NUM_OR_NONE})(?<zp>%?)\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

const XYZ_D50_RE = new RegExp(
  `^color\\(\\s*xyz-d50\\s+(?<x>${NUM_OR_NONE})(?<xp>%?)\\s+(?<y>${NUM_OR_NONE})(?<yp>%?)` +
    `\\s+(?<z>${NUM_OR_NONE})(?<zp>%?)\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseXyzD65String = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = XYZ_D65_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const x = parseNum(g.x!);
  const y = parseNum(g.y!);
  const z = parseNum(g.z!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return xyzD65ToRgbUnclamped({
    x,
    y,
    z,
    alpha: clamp(alpha, 0, 1),
    colorSpace: 'xyz-d65',
  });
};

export const parseXyzD50String = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = XYZ_D50_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const x = parseNum(g.x!);
  const y = parseNum(g.y!);
  const z = parseNum(g.z!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return xyzToRgbUnclamped({
    x,
    y,
    z,
    alpha: clamp(alpha, 0, 1),
  });
};

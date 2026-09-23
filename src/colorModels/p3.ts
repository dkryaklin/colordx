import { alphaAlias, clamp, isAnyNumber, isObject, round, sanitize } from '../helpers.js';
import { SC, scanColorRgb } from '../scan.js';
import { byteToLinear, linearToStoredRgb, srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { P3Color, RgbColor } from '../types.js';
import { oklabToLinear, oklabToLinearInto } from './oklab.js';
import { clampRgb } from './rgb.js';

// Linear sRGB ↔ Linear Display-P3 (D65, CSS Color 4): XYZ_to_lin_P3 · lin_sRGB_to_XYZ at full
// float64 precision. The forward matrix has zero blue-output coefficients on the r/g rows —
// sRGB and P3 share a blue primary, so this is correct per spec, not a bug.
// Shared between the allocating and *Into variants.
const SP3_RR = 0.8224619687143623,
  SP3_RG = 0.17753803128563772;
const SP3_GR = 0.03319419885096158,
  SP3_GG = 0.9668058011490382;
const SP3_BR = 0.017082630721120033,
  SP3_BG = 0.07239744066396347,
  SP3_BB = 0.9105199286149166;
const P3S_RR = 1.2249401762805598,
  P3S_RG = -0.22494017628055996;
const P3S_GR = -0.042056954709688163,
  P3S_GG = 1.0420569547096881;
const P3S_BR = -0.019637554590334432,
  P3S_BG = -0.078636045550631889,
  P3S_BB = 1.0982736001409663;

/** Zero-allocation sibling of srgbLinearToP3Linear — writes into `out`. Safe when out === input arg. */
export const srgbLinearToP3LinearInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = SP3_RR * r + SP3_RG * g;
  out[1] = SP3_GR * r + SP3_GG * g;
  out[2] = SP3_BR * r + SP3_BG * g + SP3_BB * b;
};

export const srgbLinearToP3Linear = (r: number, g: number, b: number): [number, number, number] => [
  SP3_RR * r + SP3_RG * g,
  SP3_GR * r + SP3_GG * g,
  SP3_BR * r + SP3_BG * g + SP3_BB * b,
];

/** Zero-allocation sibling of linearP3ToSrgb — writes into `out`. */
export const linearP3ToSrgbInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = P3S_RR * r + P3S_RG * g;
  out[1] = P3S_GR * r + P3S_GG * g;
  out[2] = P3S_BR * r + P3S_BG * g + P3S_BB * b;
};

export const linearP3ToSrgb = (r: number, g: number, b: number): [number, number, number] => [
  P3S_RR * r + P3S_RG * g,
  P3S_GR * r + P3S_GG * g,
  P3S_BR * r + P3S_BG * g + P3S_BB * b,
];

// No clamping on output: P3 is wide-gamut, sRGB values can legitimately sit outside [0,1] in P3 space.
// p3ToRgb clips back to sRGB gamut on the way out.
export const rgbToP3Raw = ({ r, g, b, alpha }: RgbColor): P3Color => {
  const [p3r, p3g, p3b] = srgbLinearToP3Linear(byteToLinear(r), byteToLinear(g), byteToLinear(b));
  return {
    r: srgbFromLinear(p3r),
    g: srgbFromLinear(p3g),
    b: srgbFromLinear(p3b),
    alpha,
    colorSpace: 'display-p3',
  };
};

export const rgbToP3 = (rgb: RgbColor): P3Color => {
  const { r, g, b, alpha } = rgbToP3Raw(rgb);
  return { r: round(r, 4), g: round(g, 4), b: round(b, 4), alpha, colorSpace: 'display-p3' };
};

export const p3ToRgb = ({ r, g, b, alpha }: P3Color): RgbColor => {
  const [sr, sg, sb] = linearP3ToSrgb(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  return clampRgb({
    r: srgbFromLinear(clamp(sr, 0, 1)) * 255,
    g: srgbFromLinear(clamp(sg, 0, 1)) * 255,
    b: srgbFromLinear(clamp(sb, 0, 1)) * 255,
    alpha,
  });
};

/** Unclamped P3 → gamma-encoded sRGB. Channels may exceed [0, 255] for out-of-sRGB-gamut colors. */
const p3ToRgbUnclamped = ({ r, g, b, alpha }: P3Color): RgbColor => {
  const [sr, sg, sb] = linearP3ToSrgb(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  return linearToStoredRgb(sr, sg, sb, alpha);
};

export const parseP3Object = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'display-p3') return null;
  if (!('r' in input && 'g' in input && 'b' in input)) return null;
  const { r, g, b, alpha = alphaAlias(input) } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(r) || !isAnyNumber(g) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return p3ToRgbUnclamped({
    r: sanitize(r),
    g: sanitize(g),
    b: sanitize(b),
    alpha: clamp(sanitize(alpha), 0, 1),
    colorSpace: 'display-p3',
  });
};

// CSS Color 4: color(display-p3 r g b / alpha). Channels accept number|percentage|none; 100% = 1.
export const parseP3String = (input: unknown): RgbColor | null =>
  scanColorRgb(input, 'color(display-p3 ')
    ? p3ToRgbUnclamped({ r: SC[0]!, g: SC[1]!, b: SC[2]!, alpha: SC[3]!, colorSpace: 'display-p3' })
    : null;

/** Unclamped linear Display-P3 channels from OKLab values. */
export const oklabToLinearP3 = (l: number, a: number, b: number): [number, number, number] =>
  srgbLinearToP3Linear(...oklabToLinear(l, a, b));

/** Zero-allocation sibling of oklabToLinearP3 — writes [pr, pg, pb] into `out`. */
export const oklabToLinearP3Into = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  oklabToLinearInto(out, l, a, b);
  srgbLinearToP3LinearInto(out, out[0]!, out[1]!, out[2]!);
};

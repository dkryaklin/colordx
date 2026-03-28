import { clamp, hasKeys, isAnyNumber, isObject, round, sanitize } from '../helpers.js';
import { srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { P3Color, RgbColor } from '../types.js';
import { oklabToLinear } from './oklab.js';
import { clampRgb } from './rgb.js';

// Linear sRGB → Linear Display-P3 (D65 white point for both, from CSS Color 4)
// The r and g rows have zero blue coefficients — this is correct per the spec, not a bug.
export const srgbLinearToP3Linear = (r: number, g: number, b: number): [number, number, number] => [
  0.8224619687 * r + 0.1775380313 * g,
  0.0331941989 * r + 0.9668058011 * g,
  0.0170826307 * r + 0.0723974407 * g + 0.9105199286 * b,
];

// Linear Display-P3 → Linear sRGB
export const linearP3ToSrgb = (r: number, g: number, b: number): [number, number, number] => [
  1.2249401762805598 * r - 0.22494017628055996 * g,
  -0.042056954709688163 * r + 1.0420569547096881 * g,
  -0.019637554590334432 * r - 0.078636045550631889 * g + 1.0982736001409663 * b,
];

// No clamping on output: P3 is wide-gamut, sRGB values can legitimately sit outside [0,1] in P3 space.
// p3ToRgb clips back to sRGB gamut on the way out.
export const rgbToP3 = ({ r, g, b, alpha }: RgbColor): P3Color => {
  const [p3r, p3g, p3b] = srgbLinearToP3Linear(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  return {
    r: round(srgbFromLinear(p3r), 4),
    g: round(srgbFromLinear(p3g), 4),
    b: round(srgbFromLinear(p3b), 4),
    alpha,
    colorSpace: 'display-p3',
  };
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

export const parseP3Object = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'display-p3') return null;
  if (!hasKeys(input, ['r', 'g', 'b'])) return null;
  const { r, g, b, alpha = 1 } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(r) || !isAnyNumber(g) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return p3ToRgb({
    r: sanitize(r),
    g: sanitize(g),
    b: sanitize(b),
    alpha: clamp(sanitize(alpha), 0, 1),
    colorSpace: 'display-p3',
  });
};

const P3_RE =
  /^color\(\s*display-p3\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseP3String = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = P3_RE.exec(input.trim());
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
  return p3ToRgb({
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    alpha: clamp(alpha, 0, 1),
    colorSpace: 'display-p3',
  });
};

/** Unclamped linear Display-P3 channels from OKLab values. */
export const oklabToLinearP3 = (l: number, a: number, b: number): [number, number, number] =>
  srgbLinearToP3Linear(...oklabToLinear(l, a, b));

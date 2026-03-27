import { clamp, round } from '../helpers.js';
import type { Rec2020Color, RgbColor } from '../types.js';
import { oklabToLinear } from './oklab.js';
import { clampRgb } from './rgb.js';

// Rec.2020 / BT.2020 transfer function
const REC2020_ALPHA = 1.09929682680944;
const REC2020_BETA = 0.018053968510807;

const toLinear = (c: number): number =>
  c < REC2020_BETA * 4.5 ? c / 4.5 : ((c + REC2020_ALPHA - 1) / REC2020_ALPHA) ** (1 / 0.45);

const fromLinear = (n: number): number =>
  n < REC2020_BETA ? 4.5 * n : REC2020_ALPHA * n ** 0.45 - (REC2020_ALPHA - 1);

// sRGB transfer function for decoding sRGB inputs
const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const srgbFromLinear = (n: number): number => (n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055);

// Linear sRGB → Linear Rec.2020 (D65, via XYZ, from CSS Color 4)
export const srgbLinearToRec2020Linear = (r: number, g: number, b: number): [number, number, number] => [
  0.6274038959 * r + 0.3292830384 * g + 0.0433130657 * b,
  0.0690972894 * r + 0.9195403951 * g + 0.0113623156 * b,
  0.0163914389 * r + 0.0880133079 * g + 0.8955952532 * b,
];

// Linear Rec.2020 → Linear sRGB
const linearRec2020ToSrgb = (r: number, g: number, b: number): [number, number, number] => [
  1.6604910021084345 * r - 0.58764113878854951 * g - 0.072849863319884883 * b,
  -0.12455047452159074 * r + 1.1328998971259603 * g - 0.0083494226043694768 * b,
  -0.018150763354905303 * r - 0.10057889800800739 * g + 1.1187296613629127 * b,
];

export const rgbToRec2020 = ({ r, g, b, a }: RgbColor): Rec2020Color => {
  const [rr, rg, rb] = srgbLinearToRec2020Linear(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  return {
    r: round(fromLinear(clamp(rr, 0, 1)), 4),
    g: round(fromLinear(clamp(rg, 0, 1)), 4),
    b: round(fromLinear(clamp(rb, 0, 1)), 4),
    a,
  };
};

export const rec2020ToRgb = ({ r, g, b, a }: Rec2020Color): RgbColor => {
  const [sr, sg, sb] = linearRec2020ToSrgb(toLinear(r), toLinear(g), toLinear(b));
  return clampRgb({
    r: srgbFromLinear(clamp(sr, 0, 1)) * 255,
    g: srgbFromLinear(clamp(sg, 0, 1)) * 255,
    b: srgbFromLinear(clamp(sb, 0, 1)) * 255,
    a,
  });
};

const REC2020_RE =
  /^color\(\s*rec2020\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseRec2020String = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = REC2020_RE.exec(input.trim());
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
  return rec2020ToRgb({ r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: clamp(alpha, 0, 1) });
};

/** Unclamped linear Rec.2020 channels from OKLab values. */
export const oklabToLinearRec2020 = (l: number, a: number, b: number): [number, number, number] =>
  srgbLinearToRec2020Linear(...oklabToLinear(l, a, b));

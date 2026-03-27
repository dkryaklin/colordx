import { clamp, round } from '../helpers.js';
import { rec2020FromLinear, rec2020ToLinear, srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { Rec2020Color, RgbColor } from '../types.js';
import { oklabToLinear } from './oklab.js';
import { clampRgb } from './rgb.js';

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

export const rgbToRec2020 = ({ r, g, b, alpha }: RgbColor): Rec2020Color => {
  const [rr, rg, rb] = srgbLinearToRec2020Linear(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  return {
    r: round(rec2020FromLinear(rr), 4),
    g: round(rec2020FromLinear(rg), 4),
    b: round(rec2020FromLinear(rb), 4),
    alpha,
    colorSpace: 'rec2020',
  };
};

export const rec2020ToRgb = ({ r, g, b, alpha }: Rec2020Color): RgbColor => {
  const [sr, sg, sb] = linearRec2020ToSrgb(rec2020ToLinear(r), rec2020ToLinear(g), rec2020ToLinear(b));
  return clampRgb({
    r: srgbFromLinear(clamp(sr, 0, 1)) * 255,
    g: srgbFromLinear(clamp(sg, 0, 1)) * 255,
    b: srgbFromLinear(clamp(sb, 0, 1)) * 255,
    alpha,
  });
};

const REC2020_RE =
  /^color\(\s*rec2020\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseRec2020String = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = REC2020_RE.exec(input.trim());
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
  return rec2020ToRgb({
    r: Number(m[1]),
    g: Number(m[2]),
    b: Number(m[3]),
    alpha: clamp(alpha, 0, 1),
    colorSpace: 'rec2020',
  });
};

/** Unclamped linear Rec.2020 channels from OKLab values. */
export const oklabToLinearRec2020 = (l: number, a: number, b: number): [number, number, number] =>
  srgbLinearToRec2020Linear(...oklabToLinear(l, a, b));

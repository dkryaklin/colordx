import { clamp, round } from '../helpers.js';
import type { P3Color, RgbColor } from '../types.js';
import { oklabToLinear } from './oklab.js';
import { clampRgb } from './rgb.js';

// Display-P3 uses the same transfer function as sRGB
const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (n: number): number => (n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055);

// Linear sRGB → Linear Display-P3 (D65 white point for both, from CSS Color 4)
const srgbToLinearP3 = (r: number, g: number, b: number): [number, number, number] => [
  0.8224621478 * r + 0.17753786 * g,
  0.03319831 * r + 0.96680169 * g,
  0.01708264 * r + 0.07239744 * g + 0.91051993 * b,
];

// Linear Display-P3 → Linear sRGB
const linearP3ToSrgb = (r: number, g: number, b: number): [number, number, number] => [
  1.22494018 * r - 0.22494018 * g,
  -0.04205695 * r + 1.04205695 * g,
  -0.01963755 * r - 0.07863605 * g + 1.0982737 * b,
];

export const rgbToP3 = ({ r, g, b, a }: RgbColor): P3Color => {
  const [p3r, p3g, p3b] = srgbToLinearP3(toLinear(r / 255), toLinear(g / 255), toLinear(b / 255));
  return { r: round(fromLinear(p3r), 4), g: round(fromLinear(p3g), 4), b: round(fromLinear(p3b), 4), a };
};

export const p3ToRgb = ({ r, g, b, a }: P3Color): RgbColor => {
  const [sr, sg, sb] = linearP3ToSrgb(toLinear(r), toLinear(g), toLinear(b));
  return clampRgb({
    r: fromLinear(clamp(sr, 0, 1)) * 255,
    g: fromLinear(clamp(sg, 0, 1)) * 255,
    b: fromLinear(clamp(sb, 0, 1)) * 255,
    a,
  });
};

const P3_RE =
  /^color\(\s*display-p3\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseP3String = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = P3_RE.exec(input.trim());
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
  return p3ToRgb({ r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: clamp(alpha, 0, 1) });
};

/** Unclamped linear Display-P3 channels from OKLab values. */
export const oklabToLinearP3 = (l: number, a: number, b: number): [number, number, number] =>
  srgbToLinearP3(...oklabToLinear(l, a, b));

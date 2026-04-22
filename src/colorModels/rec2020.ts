import { NUM_OR_NONE, clamp, hasKeys, isAnyNumber, isObject, parseNum, round, sanitize } from '../helpers.js';
import { rec2020FromLinear, rec2020ToLinear, srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { Rec2020Color, RgbColor } from '../types.js';
import { oklabToLinear, oklabToLinearInto } from './oklab.js';
import { clampRgb } from './rgb.js';

// Linear sRGB ↔ Linear Rec.2020 (D65 via XYZ, CSS Color 4).
// Shared between the allocating and *Into variants.
const SR2_RR = 0.6274038959,
  SR2_RG = 0.3292830384,
  SR2_RB = 0.0433130657;
const SR2_GR = 0.0690972894,
  SR2_GG = 0.9195403951,
  SR2_GB = 0.0113623156;
const SR2_BR = 0.0163914389,
  SR2_BG = 0.0880133079,
  SR2_BB = 0.8955952532;
const R2S_RR = 1.6604910021084345,
  R2S_RG = -0.58764113878854951,
  R2S_RB = -0.072849863319884883;
const R2S_GR = -0.12455047452159074,
  R2S_GG = 1.1328998971259603,
  R2S_GB = -0.0083494226043694768;
const R2S_BR = -0.018150763354905303,
  R2S_BG = -0.10057889800800739,
  R2S_BB = 1.1187296613629127;

/** Zero-allocation sibling of srgbLinearToRec2020Linear — writes into `out`. */
export const srgbLinearToRec2020LinearInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = SR2_RR * r + SR2_RG * g + SR2_RB * b;
  out[1] = SR2_GR * r + SR2_GG * g + SR2_GB * b;
  out[2] = SR2_BR * r + SR2_BG * g + SR2_BB * b;
};

export const srgbLinearToRec2020Linear = (r: number, g: number, b: number): [number, number, number] => [
  SR2_RR * r + SR2_RG * g + SR2_RB * b,
  SR2_GR * r + SR2_GG * g + SR2_GB * b,
  SR2_BR * r + SR2_BG * g + SR2_BB * b,
];

/** Zero-allocation sibling of linearRec2020ToSrgb — writes into `out`. */
export const linearRec2020ToSrgbInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = R2S_RR * r + R2S_RG * g + R2S_RB * b;
  out[1] = R2S_GR * r + R2S_GG * g + R2S_GB * b;
  out[2] = R2S_BR * r + R2S_BG * g + R2S_BB * b;
};

export const linearRec2020ToSrgb = (r: number, g: number, b: number): [number, number, number] => [
  R2S_RR * r + R2S_RG * g + R2S_RB * b,
  R2S_GR * r + R2S_GG * g + R2S_GB * b,
  R2S_BR * r + R2S_BG * g + R2S_BB * b,
];

export const rgbToRec2020Raw = ({ r, g, b, alpha }: RgbColor): Rec2020Color => {
  const [rr, rg, rb] = srgbLinearToRec2020Linear(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  return {
    r: rec2020FromLinear(rr),
    g: rec2020FromLinear(rg),
    b: rec2020FromLinear(rb),
    alpha,
    colorSpace: 'rec2020',
  };
};

export const rgbToRec2020 = (rgb: RgbColor): Rec2020Color => {
  const { r, g, b, alpha } = rgbToRec2020Raw(rgb);
  return { r: round(r, 4), g: round(g, 4), b: round(b, 4), alpha, colorSpace: 'rec2020' };
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

/** Unclamped Rec.2020 → gamma-encoded sRGB. Channels may exceed [0, 255] for out-of-sRGB-gamut colors. */
const rec2020ToRgbUnclamped = ({ r, g, b, alpha }: Rec2020Color): RgbColor => {
  const [sr, sg, sb] = linearRec2020ToSrgb(rec2020ToLinear(r), rec2020ToLinear(g), rec2020ToLinear(b));
  return {
    r: srgbFromLinear(sr) * 255,
    g: srgbFromLinear(sg) * 255,
    b: srgbFromLinear(sb) * 255,
    alpha,
  };
};

export const parseRec2020Object = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'rec2020') return null;
  if (!hasKeys(input, ['r', 'g', 'b'])) return null;
  const { r, g, b, alpha = 1 } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(r) || !isAnyNumber(g) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return rec2020ToRgbUnclamped({
    r: sanitize(r),
    g: sanitize(g),
    b: sanitize(b),
    alpha: clamp(sanitize(alpha), 0, 1),
    colorSpace: 'rec2020',
  });
};

// CSS Color 4: color(rec2020 r g b / alpha). Channels accept number|percentage|none; 100% = 1.
const REC2020_RE = new RegExp(
  `^color\\(\\s*rec2020\\s+(?<r>${NUM_OR_NONE})(?<rp>%?)\\s+(?<g>${NUM_OR_NONE})(?<gp>%?)` +
    `\\s+(?<b>${NUM_OR_NONE})(?<bp>%?)\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseRec2020String = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = REC2020_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const r = g.rp ? parseNum(g.r!) / 100 : parseNum(g.r!);
  const gc = g.gp ? parseNum(g.g!) / 100 : parseNum(g.g!);
  const b = g.bp ? parseNum(g.b!) / 100 : parseNum(g.b!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return rec2020ToRgbUnclamped({
    r,
    g: gc,
    b,
    alpha: clamp(alpha, 0, 1),
    colorSpace: 'rec2020',
  });
};

/** Unclamped linear Rec.2020 channels from OKLab values. */
export const oklabToLinearRec2020 = (l: number, a: number, b: number): [number, number, number] =>
  srgbLinearToRec2020Linear(...oklabToLinear(l, a, b));

/** Zero-allocation sibling of oklabToLinearRec2020 — writes [rr, rg, rb] into `out`. */
export const oklabToLinearRec2020Into = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  oklabToLinearInto(out, l, a, b);
  srgbLinearToRec2020LinearInto(out, out[0]!, out[1]!, out[2]!);
};

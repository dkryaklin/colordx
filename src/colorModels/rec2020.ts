import {
  NUM_OR_NONE,
  WS,
  alphaAlias,
  clamp,
  isAnyNumber,
  isObject,
  parseNum,
  round,
  sanitize,
  trimWs,
} from '../helpers.js';
import { byteToLinear, linearToStoredRgb, rec2020FromLinear, rec2020ToLinear, srgbFromLinear } from '../transfer.js';
import type { Rec2020Color, RgbColor } from '../types.js';
import { oklabToLinear, oklabToLinearInto } from './oklab.js';
import { clampRgb } from './rgb.js';

// Linear sRGB ↔ Linear Rec.2020 (D65 via XYZ, CSS Color 4): XYZ_to_lin_2020 · lin_sRGB_to_XYZ at
// full float64 precision.
// Shared between the allocating and *Into variants.
const SR2_RR = 0.627403895934699,
  SR2_RG = 0.3292830383778836,
  SR2_RB = 0.043313065687417246;
const SR2_GR = 0.06909728935823205,
  SR2_GG = 0.9195403950754587,
  SR2_GB = 0.011362315566309173;
const SR2_BR = 0.01639143887515028,
  SR2_BG = 0.08801330787722576,
  SR2_BB = 0.895595253247624;
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
  const [rr, rg, rb] = srgbLinearToRec2020Linear(byteToLinear(r), byteToLinear(g), byteToLinear(b));
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
  // 5 dp, like toRec2020(): the 2.4 gamma is steep near black, and 4 dp loses a byte there.
  return { r: round(r, 5), g: round(g, 5), b: round(b, 5), alpha, colorSpace: 'rec2020' };
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
  return linearToStoredRgb(sr, sg, sb, alpha);
};

export const parseRec2020Object = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'rec2020') return null;
  if (!('r' in input && 'g' in input && 'b' in input)) return null;
  const { r, g, b, alpha = alphaAlias(input) } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
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
  `^color\\(${WS}*rec2020${WS}+(?<r>${NUM_OR_NONE})(?<rp>%?)${WS}+(?<g>${NUM_OR_NONE})(?<gp>%?)` +
    `${WS}+(?<b>${NUM_OR_NONE})(?<bp>%?)${WS}*(?:/${WS}*(?<al>${NUM_OR_NONE})(?<alp>%?)${WS}*)?\\)$`,
  'i'
);

export const parseRec2020String = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = REC2020_RE.exec(trimWs(input))?.groups;
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

import { NUM_OR_NONE, clamp, hasKeys, isAnyNumber, isObject, parseNum, round, sanitize } from '../helpers.js';
import { prophotoFromLinear, prophotoToLinear, srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { ProPhotoColor, RgbColor } from '../types.js';
import { oklabToLinear, oklabToLinearInto } from './oklab.js';
import { clampRgb } from './rgb.js';

// Linear sRGB ↔ Linear ProPhoto (ROMM RGB, D50). Derived by composing the CSS Color 4
// prophoto↔XYZ-D50 matrices with the library's Bradford D65↔D50 and sRGB↔XYZ-D65 matrices,
// so the chromatic adaptation matches the existing Lab/XYZ pipeline. Verified against culori
// to <1.3e-7. Provenance / re-derivation: scripts/derive-wide-gamut-matrices.ts.
// Shared between the allocating and *Into variants.
const SPP_RR = 0.52927697762261172,
  SPP_RG = 0.330154501978493,
  SPP_RB = 0.14056852039889559;
const SPP_GR = 0.098365859540449255,
  SPP_GG = 0.87347071290696165,
  SPP_GB = 0.028163427552589011;
const SPP_BR = 0.016875340921386848,
  SPP_BG = 0.11765941425612084,
  SPP_BB = 0.86546524482249232;
const PPS_RR = 2.0343808495169959,
  PPS_RG = -0.7276357899341348,
  PPS_RB = -0.30674505958286158;
const PPS_GR = -0.22882573163305051,
  PPS_GG = 1.2317425411901051,
  PPS_GB = -0.0029168095570545408;
const PPS_BR = -0.008558828783917425,
  PPS_BG = -0.15326670213803723,
  PPS_BB = 1.1618255309219545;

/** Zero-allocation sibling of srgbLinearToProphotoLinear — writes into `out`. */
export const srgbLinearToProphotoLinearInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = SPP_RR * r + SPP_RG * g + SPP_RB * b;
  out[1] = SPP_GR * r + SPP_GG * g + SPP_GB * b;
  out[2] = SPP_BR * r + SPP_BG * g + SPP_BB * b;
};

export const srgbLinearToProphotoLinear = (r: number, g: number, b: number): [number, number, number] => [
  SPP_RR * r + SPP_RG * g + SPP_RB * b,
  SPP_GR * r + SPP_GG * g + SPP_GB * b,
  SPP_BR * r + SPP_BG * g + SPP_BB * b,
];

/** Zero-allocation sibling of linearProphotoToSrgb — writes into `out`. */
export const linearProphotoToSrgbInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = PPS_RR * r + PPS_RG * g + PPS_RB * b;
  out[1] = PPS_GR * r + PPS_GG * g + PPS_GB * b;
  out[2] = PPS_BR * r + PPS_BG * g + PPS_BB * b;
};

export const linearProphotoToSrgb = (r: number, g: number, b: number): [number, number, number] => [
  PPS_RR * r + PPS_RG * g + PPS_RB * b,
  PPS_GR * r + PPS_GG * g + PPS_GB * b,
  PPS_BR * r + PPS_BG * g + PPS_BB * b,
];

export const rgbToProphotoRaw = ({ r, g, b, alpha }: RgbColor): ProPhotoColor => {
  const [pr, pg, pb] = srgbLinearToProphotoLinear(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  return {
    r: prophotoFromLinear(pr),
    g: prophotoFromLinear(pg),
    b: prophotoFromLinear(pb),
    alpha,
    colorSpace: 'prophoto-rgb',
  };
};

export const rgbToProphoto = (rgb: RgbColor): ProPhotoColor => {
  const { r, g, b, alpha } = rgbToProphotoRaw(rgb);
  return { r: round(r, 4), g: round(g, 4), b: round(b, 4), alpha, colorSpace: 'prophoto-rgb' };
};

export const prophotoToRgb = ({ r, g, b, alpha }: ProPhotoColor): RgbColor => {
  const [sr, sg, sb] = linearProphotoToSrgb(prophotoToLinear(r), prophotoToLinear(g), prophotoToLinear(b));
  return clampRgb({
    r: srgbFromLinear(clamp(sr, 0, 1)) * 255,
    g: srgbFromLinear(clamp(sg, 0, 1)) * 255,
    b: srgbFromLinear(clamp(sb, 0, 1)) * 255,
    alpha,
  });
};

/** Unclamped ProPhoto → gamma-encoded sRGB. Channels may exceed [0, 255] for out-of-sRGB-gamut colors. */
const prophotoToRgbUnclamped = ({ r, g, b, alpha }: ProPhotoColor): RgbColor => {
  const [sr, sg, sb] = linearProphotoToSrgb(prophotoToLinear(r), prophotoToLinear(g), prophotoToLinear(b));
  return {
    r: srgbFromLinear(sr) * 255,
    g: srgbFromLinear(sg) * 255,
    b: srgbFromLinear(sb) * 255,
    alpha,
  };
};

export const parseProphotoObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'prophoto-rgb') return null;
  if (!hasKeys(input, ['r', 'g', 'b'])) return null;
  const { r, g, b, alpha = 1 } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(r) || !isAnyNumber(g) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return prophotoToRgbUnclamped({
    r: sanitize(r),
    g: sanitize(g),
    b: sanitize(b),
    alpha: clamp(sanitize(alpha), 0, 1),
    colorSpace: 'prophoto-rgb',
  });
};

// CSS Color 4: color(prophoto-rgb r g b / alpha). Channels accept number|percentage|none; 100% = 1.
const PROPHOTO_RE = new RegExp(
  `^color\\(\\s*prophoto-rgb\\s+(?<r>${NUM_OR_NONE})(?<rp>%?)\\s+(?<g>${NUM_OR_NONE})(?<gp>%?)` +
    `\\s+(?<b>${NUM_OR_NONE})(?<bp>%?)\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseProphotoString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = PROPHOTO_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const r = g.rp ? parseNum(g.r!) / 100 : parseNum(g.r!);
  const gc = g.gp ? parseNum(g.g!) / 100 : parseNum(g.g!);
  const b = g.bp ? parseNum(g.b!) / 100 : parseNum(g.b!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return prophotoToRgbUnclamped({
    r,
    g: gc,
    b,
    alpha: clamp(alpha, 0, 1),
    colorSpace: 'prophoto-rgb',
  });
};

/** Unclamped linear ProPhoto channels from OKLab values. */
export const oklabToLinearProphoto = (l: number, a: number, b: number): [number, number, number] =>
  srgbLinearToProphotoLinear(...oklabToLinear(l, a, b));

/** Zero-allocation sibling of oklabToLinearProphoto — writes [pr, pg, pb] into `out`. */
export const oklabToLinearProphotoInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  oklabToLinearInto(out, l, a, b);
  srgbLinearToProphotoLinearInto(out, out[0]!, out[1]!, out[2]!);
};

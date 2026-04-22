import { NUM_OR_NONE, clamp, hasKeys, isAnyNumber, isObject, parseNum, round, sanitize } from '../helpers.js';
import { srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { P3Color, RgbColor } from '../types.js';
import { oklabToLinear, oklabToLinearInto } from './oklab.js';
import { clampRgb } from './rgb.js';

// Linear sRGB ↔ Linear Display-P3 (D65, CSS Color 4). The forward matrix has zero
// blue-output coefficients on the r/g rows — correct per spec, not a bug.
// Shared between the allocating and *Into variants.
const SP3_RR = 0.8224619687,
  SP3_RG = 0.1775380313;
const SP3_GR = 0.0331941989,
  SP3_GG = 0.9668058011;
const SP3_BR = 0.0170826307,
  SP3_BG = 0.0723974407,
  SP3_BB = 0.9105199286;
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

/** Unclamped P3 → gamma-encoded sRGB. Channels may exceed [0, 255] for out-of-sRGB-gamut colors. */
const p3ToRgbUnclamped = ({ r, g, b, alpha }: P3Color): RgbColor => {
  const [sr, sg, sb] = linearP3ToSrgb(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  return {
    r: srgbFromLinear(sr) * 255,
    g: srgbFromLinear(sg) * 255,
    b: srgbFromLinear(sb) * 255,
    alpha,
  };
};

export const parseP3Object = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'display-p3') return null;
  if (!hasKeys(input, ['r', 'g', 'b'])) return null;
  const { r, g, b, alpha = 1 } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
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
const P3_RE = new RegExp(
  `^color\\(\\s*display-p3\\s+(?<r>${NUM_OR_NONE})(?<rp>%?)\\s+(?<g>${NUM_OR_NONE})(?<gp>%?)` +
    `\\s+(?<b>${NUM_OR_NONE})(?<bp>%?)\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseP3String = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = P3_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const r = g.rp ? parseNum(g.r!) / 100 : parseNum(g.r!);
  const gc = g.gp ? parseNum(g.g!) / 100 : parseNum(g.g!);
  const b = g.bp ? parseNum(g.b!) / 100 : parseNum(g.b!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return p3ToRgbUnclamped({
    r,
    g: gc,
    b,
    alpha: clamp(alpha, 0, 1),
    colorSpace: 'display-p3',
  });
};

/** Unclamped linear Display-P3 channels from OKLab values. */
export const oklabToLinearP3 = (l: number, a: number, b: number): [number, number, number] =>
  srgbLinearToP3Linear(...oklabToLinear(l, a, b));

/** Zero-allocation sibling of oklabToLinearP3 — writes [pr, pg, pb] into `out`. */
export const oklabToLinearP3Into = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  oklabToLinearInto(out, l, a, b);
  srgbLinearToP3LinearInto(out, out[0]!, out[1]!, out[2]!);
};

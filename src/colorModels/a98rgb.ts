import { NUM_OR_NONE, clamp, hasKeys, isAnyNumber, isObject, parseNum, round, sanitize } from '../helpers.js';
import { a98FromLinear, a98ToLinear, srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { A98Color, RgbColor } from '../types.js';
import { oklabToLinear, oklabToLinearInto } from './oklab.js';
import { clampRgb } from './rgb.js';

// Linear sRGB ↔ Linear A98 (Adobe RGB 1998, D65). Derived by composing the CSS Color 4
// a98↔XYZ matrices with the library's sRGB↔XYZ-D65 matrix; verified against culori to <1e-7.
// Provenance / re-derivation: scripts/derive-wide-gamut-matrices.ts.
// Adobe RGB shares sRGB's red and blue primaries and white point, which makes the matrix sparse:
// the green channel passes through unchanged (g row is identity) and there are no red↔blue
// cross-terms (r depends on r/g, b depends on g/b). The zeros are structural, not a bug.
// Shared between the allocating and *Into variants.
const SA9_RR = 0.71512560685562476,
  SA9_RG = 0.2848743931443754;
const SA9_BG = 0.04116194845011846,
  SA9_BB = 0.95883805154988155;
const A9S_RR = 1.3983557439607788,
  A9S_RG = -0.39835574396077827;
const A9S_BG = -0.042928989294473266,
  A9S_BB = 1.0429289892944733;

/** Zero-allocation sibling of srgbLinearToA98Linear — writes into `out`. Safe when out === input arg. */
export const srgbLinearToA98LinearInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = SA9_RR * r + SA9_RG * g;
  out[1] = g;
  out[2] = SA9_BG * g + SA9_BB * b;
};

export const srgbLinearToA98Linear = (r: number, g: number, b: number): [number, number, number] => [
  SA9_RR * r + SA9_RG * g,
  g,
  SA9_BG * g + SA9_BB * b,
];

/** Zero-allocation sibling of linearA98ToSrgb — writes into `out`. */
export const linearA98ToSrgbInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = A9S_RR * r + A9S_RG * g;
  out[1] = g;
  out[2] = A9S_BG * g + A9S_BB * b;
};

export const linearA98ToSrgb = (r: number, g: number, b: number): [number, number, number] => [
  A9S_RR * r + A9S_RG * g,
  g,
  A9S_BG * g + A9S_BB * b,
];

// No clamping on output: A98 is wide-gamut, sRGB values can legitimately sit outside [0,1] in A98 space.
// a98ToRgb clips back to sRGB gamut on the way out.
export const rgbToA98Raw = ({ r, g, b, alpha }: RgbColor): A98Color => {
  const [ar, ag, ab] = srgbLinearToA98Linear(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  return {
    r: a98FromLinear(ar),
    g: a98FromLinear(ag),
    b: a98FromLinear(ab),
    alpha,
    colorSpace: 'a98-rgb',
  };
};

export const rgbToA98 = (rgb: RgbColor): A98Color => {
  const { r, g, b, alpha } = rgbToA98Raw(rgb);
  return { r: round(r, 4), g: round(g, 4), b: round(b, 4), alpha, colorSpace: 'a98-rgb' };
};

export const a98ToRgb = ({ r, g, b, alpha }: A98Color): RgbColor => {
  const [sr, sg, sb] = linearA98ToSrgb(a98ToLinear(r), a98ToLinear(g), a98ToLinear(b));
  return clampRgb({
    r: srgbFromLinear(clamp(sr, 0, 1)) * 255,
    g: srgbFromLinear(clamp(sg, 0, 1)) * 255,
    b: srgbFromLinear(clamp(sb, 0, 1)) * 255,
    alpha,
  });
};

/** Unclamped A98 → gamma-encoded sRGB. Channels may exceed [0, 255] for out-of-sRGB-gamut colors. */
const a98ToRgbUnclamped = ({ r, g, b, alpha }: A98Color): RgbColor => {
  const [sr, sg, sb] = linearA98ToSrgb(a98ToLinear(r), a98ToLinear(g), a98ToLinear(b));
  return {
    r: srgbFromLinear(sr) * 255,
    g: srgbFromLinear(sg) * 255,
    b: srgbFromLinear(sb) * 255,
    alpha,
  };
};

export const parseA98Object = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'a98-rgb') return null;
  if (!hasKeys(input, ['r', 'g', 'b'])) return null;
  const { r, g, b, alpha = 1 } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(r) || !isAnyNumber(g) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return a98ToRgbUnclamped({
    r: sanitize(r),
    g: sanitize(g),
    b: sanitize(b),
    alpha: clamp(sanitize(alpha), 0, 1),
    colorSpace: 'a98-rgb',
  });
};

// CSS Color 4: color(a98-rgb r g b / alpha). Channels accept number|percentage|none; 100% = 1.
const A98_RE = new RegExp(
  `^color\\(\\s*a98-rgb\\s+(?<r>${NUM_OR_NONE})(?<rp>%?)\\s+(?<g>${NUM_OR_NONE})(?<gp>%?)` +
    `\\s+(?<b>${NUM_OR_NONE})(?<bp>%?)\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseA98String = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = A98_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const r = g.rp ? parseNum(g.r!) / 100 : parseNum(g.r!);
  const gc = g.gp ? parseNum(g.g!) / 100 : parseNum(g.g!);
  const b = g.bp ? parseNum(g.b!) / 100 : parseNum(g.b!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return a98ToRgbUnclamped({
    r,
    g: gc,
    b,
    alpha: clamp(alpha, 0, 1),
    colorSpace: 'a98-rgb',
  });
};

/** Unclamped linear A98 channels from OKLab values. */
export const oklabToLinearA98 = (l: number, a: number, b: number): [number, number, number] =>
  srgbLinearToA98Linear(...oklabToLinear(l, a, b));

/** Zero-allocation sibling of oklabToLinearA98 — writes [ar, ag, ab] into `out`. */
export const oklabToLinearA98Into = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  oklabToLinearInto(out, l, a, b);
  srgbLinearToA98LinearInto(out, out[0]!, out[1]!, out[2]!);
};

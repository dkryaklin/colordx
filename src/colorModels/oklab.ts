import { NUM_OR_NONE, clamp, hasKeys, isAnyNumber, isObject, parseNum, sanitize } from '../helpers.js';
import { srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { OklabColor, RgbColor } from '../types.js';
import { clampRgb } from './rgb.js';

// Björn Ottosson's OKLab matrix coefficients. Referenced by both the allocating
// and zero-alloc (*Into) variants so the math lives in one place.
// sRGB linear → LMS (cubed roots taken at M1 stage)
const M1_LR = 0.4122214708,
  M1_LG = 0.5363325363,
  M1_LB = 0.0514459929;
const M1_MR = 0.2119034982,
  M1_MG = 0.6806995451,
  M1_MB = 0.1073969566;
const M1_SR = 0.0883024619,
  M1_SG = 0.2817188376,
  M1_SB = 0.6299787005;
// LMS' → OKLab
const M2_L_L = 0.2104542553,
  M2_M_L = 0.793617785,
  M2_S_L = -0.0040720468;
const M2_L_A = 1.9779984951,
  M2_M_A = -2.428592205,
  M2_S_A = 0.4505937099;
const M2_L_B = 0.0259040371,
  M2_M_B = 0.7827717662,
  M2_S_B = -0.808675766;
// OKLab → LMS' (inverse of M2)
const M2I_A_L = 0.3963377774,
  M2I_B_L = 0.2158037573;
const M2I_A_M = -0.1055613458,
  M2I_B_M = -0.0638541728;
const M2I_A_S = -0.0894841775,
  M2I_B_S = -1.291485548;
// LMS → linear sRGB (inverse of M1)
const M1I_L_R = 4.0767416613,
  M1I_M_R = -3.3077115904,
  M1I_S_R = 0.2309699287;
const M1I_L_G = -1.2684380041,
  M1I_M_G = 2.6097574007,
  M1I_S_G = -0.3413193963;
const M1I_L_B = -0.0041960865,
  M1I_M_B = -0.7034186145,
  M1I_S_B = 1.7076147009;

/** Zero-allocation sibling of linearSrgbToOklab — writes [l, a, b] into `out`. */
export const linearSrgbToOklabInto = (out: Float64Array | number[], lr: number, lg: number, lb: number): void => {
  const lv = Math.cbrt(M1_LR * lr + M1_LG * lg + M1_LB * lb);
  const mv = Math.cbrt(M1_MR * lr + M1_MG * lg + M1_MB * lb);
  const sv = Math.cbrt(M1_SR * lr + M1_SG * lg + M1_SB * lb);
  out[0] = M2_L_L * lv + M2_M_L * mv + M2_S_L * sv;
  out[1] = M2_L_A * lv + M2_M_A * mv + M2_S_A * sv;
  out[2] = M2_L_B * lv + M2_M_B * mv + M2_S_B * sv;
};

/** Convert linear sRGB channels to OKLab (Björn Ottosson). No gamma, no clamping. */
export const linearSrgbToOklab = (lr: number, lg: number, lb: number): [number, number, number] => {
  const lv = Math.cbrt(M1_LR * lr + M1_LG * lg + M1_LB * lb);
  const mv = Math.cbrt(M1_MR * lr + M1_MG * lg + M1_MB * lb);
  const sv = Math.cbrt(M1_SR * lr + M1_SG * lg + M1_SB * lb);
  return [
    M2_L_L * lv + M2_M_L * mv + M2_S_L * sv,
    M2_L_A * lv + M2_M_A * mv + M2_S_A * sv,
    M2_L_B * lv + M2_M_B * mv + M2_S_B * sv,
  ];
};

export const rgbToOklab = ({ r, g, b, alpha }: RgbColor): OklabColor => {
  const [l, a, bv] = linearSrgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  return { l, a, b: bv, alpha };
};

/** Unclamped OKLab → gamma-encoded sRGB. Channels may exceed [0, 255] for out-of-sRGB-gamut colors. */
export const oklabToRgbUnclamped = ({ l, a, b, alpha }: OklabColor): RgbColor => {
  const [lr, lg, lb] = oklabToLinear(l, a, b);
  return {
    r: srgbFromLinear(lr) * 255,
    g: srgbFromLinear(lg) * 255,
    b: srgbFromLinear(lb) * 255,
    alpha,
  };
};

export const oklabToRgb = ({ l, a, b, alpha }: OklabColor): RgbColor => {
  if (a === 0 && b === 0) {
    const v = l ** 3;
    const srgb = srgbFromLinear(clamp(v, 0, 1)) * 255;
    return clampRgb({ r: srgb, g: srgb, b: srgb, alpha });
  }

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lv = l_ ** 3;
  const mv = m_ ** 3;
  const sv = s_ ** 3;

  const r = 4.0767416613 * lv - 3.3077115904 * mv + 0.2309699287 * sv;
  const g = -1.2684380041 * lv + 2.6097574007 * mv - 0.3413193963 * sv;
  const bv = -0.0041960865 * lv - 0.7034186145 * mv + 1.7076147009 * sv;

  return clampRgb({
    r: srgbFromLinear(clamp(r, 0, 1)) * 255,
    g: srgbFromLinear(clamp(g, 0, 1)) * 255,
    b: srgbFromLinear(clamp(bv, 0, 1)) * 255,
    alpha,
  });
};

/** Zero-allocation sibling of oklabToLinear — writes [lr, lg, lb] into `out`. */
export const oklabToLinearInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  // Achromatic short-circuit: M1⁻¹ rows sum to 1 mathematically, but floating-point
  // rounding leaves lr/lg/lb ~1 ULP apart, which gets amplified into a phantom hue
  // downstream in rgbToHslRaw. Explicitly return lv for all channels.
  if (a === 0 && b === 0) {
    const v = l ** 3;
    out[0] = v;
    out[1] = v;
    out[2] = v;
    return;
  }
  const l_ = l + M2I_A_L * a + M2I_B_L * b;
  const m_ = l + M2I_A_M * a + M2I_B_M * b;
  const s_ = l + M2I_A_S * a + M2I_B_S * b;
  const lv = l_ ** 3,
    mv = m_ ** 3,
    sv = s_ ** 3;
  out[0] = M1I_L_R * lv + M1I_M_R * mv + M1I_S_R * sv;
  out[1] = M1I_L_G * lv + M1I_M_G * mv + M1I_S_G * sv;
  out[2] = M1I_L_B * lv + M1I_M_B * mv + M1I_S_B * sv;
};

/** Unclamped linear sRGB channels from OKLab values. Channels may exceed [0, 1] for out-of-gamut colors. */
export const oklabToLinear = (l: number, a: number, b: number): [number, number, number] => {
  if (a === 0 && b === 0) {
    const v = l ** 3;
    return [v, v, v];
  }
  const l_ = l + M2I_A_L * a + M2I_B_L * b;
  const m_ = l + M2I_A_M * a + M2I_B_M * b;
  const s_ = l + M2I_A_S * a + M2I_B_S * b;
  const lv = l_ ** 3,
    mv = m_ ** 3,
    sv = s_ ** 3;
  return [
    M1I_L_R * lv + M1I_M_R * mv + M1I_S_R * sv,
    M1I_L_G * lv + M1I_M_G * mv + M1I_S_G * sv,
    M1I_L_B * lv + M1I_M_B * mv + M1I_S_B * sv,
  ];
};

export const parseOklabObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  // Objects with colorSpace: 'lab' are CIE Lab, not OKLab — let parseLabObject handle them.
  if ((input as { colorSpace?: unknown }).colorSpace === 'lab') return null;
  if (!hasKeys(input, ['l', 'a', 'b'])) return null;
  if ('r' in input || 'x' in input || 'c' in input || 'h' in input) return null;
  const { l, a, b, alpha = 1 } = input as { l: unknown; a: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(l) || !isAnyNumber(a) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  if (sanitize(l) > 1) return null; // OKLab L is always [0, 1]; reject CIE Lab values passed without colorSpace branding
  return oklabToRgbUnclamped({
    l: sanitize(l),
    a: sanitize(a),
    b: sanitize(b),
    alpha: clamp(sanitize(alpha), 0, 1),
  });
};

const OKLAB_RE = new RegExp(
  `^oklab\\(\\s*(?<l>${NUM_OR_NONE})(?<lp>%?)\\s+(?<a>${NUM_OR_NONE})(?<ap>%?)\\s+(?<b>${NUM_OR_NONE})(?<bp>%?)` +
    `\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseOklabString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = OKLAB_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const L = g.lp ? parseNum(g.l!) / 100 : parseNum(g.l!); // 100% = 1
  const a = g.ap ? parseNum(g.a!) * 0.004 : parseNum(g.a!); // 100% = 0.4
  const b = g.bp ? parseNum(g.b!) * 0.004 : parseNum(g.b!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return oklabToRgbUnclamped({ l: L, a, b, alpha: clamp(alpha, 0, 1) });
};

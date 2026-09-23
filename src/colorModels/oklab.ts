import { NUM_OR_NONE, WS, clamp, isAnyNumber, isObject, parseNum, sanitize, trimWs } from '../helpers.js';
import { linearToStoredRgb, srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { OklabColor, RgbColor } from '../types.js';
import { clampRgb } from './rgb.js';

// OKLab matrix coefficients, as CSS Color 4 defines them (conversions.js): M1 is XYZtoLMS composed
// with the spec's rational lin_sRGB_to_XYZ in float64, M2 and M2⁻¹ are LMStoOKLab / OKLabtoLMS,
// and M1⁻¹ is XYZ_to_lin_sRGB · LMStoXYZ. These are Ottosson's matrices recomputed at full
// precision so that each pair is a float64 inverse: his published 10-digit values are not, and
// OKLab → sRGB → OKLab drifted by up to 1.6e-4 with them. Referenced by both the allocating and
// zero-alloc (*Into) variants so the math lives in one place.
// sRGB linear → LMS (cubed roots taken at M1 stage)
export const M1_LR = 0.41222146947076305,
  M1_LG = 0.5363325372617348,
  M1_LB = 0.05144599326750221;
export const M1_MR = 0.21190349581782522,
  M1_MG = 0.6806995506452344,
  M1_MB = 0.10739695353694056;
export const M1_SR = 0.08830245919005643,
  M1_SG = 0.2817188391361215,
  M1_SB = 0.6299787016738222;
// LMS' → OKLab
export const M2_L_L = 0.210454268309314,
  M2_M_L = 0.7936177747023054,
  M2_S_L = -0.0040720430116193;
export const M2_L_A = 1.9779985324311684,
  M2_M_A = -2.42859224204858,
  M2_S_A = 0.450593709617411;
export const M2_L_B = 0.0259040424655478,
  M2_M_B = 0.7827717124575296,
  M2_S_B = -0.8086757549230774;
// OKLab → LMS' (inverse of M2)
export const M2I_A_L = 0.3963377773761749,
  M2I_B_L = 0.2158037573099136;
export const M2I_A_M = -0.1055613458156586,
  M2I_B_M = -0.0638541728258133;
export const M2I_A_S = -0.0894841775298119,
  M2I_B_S = -1.2914855480194092;
// LMS → linear sRGB (inverse of M1)
export const M1I_L_R = 4.076741636075957,
  M1I_M_R = -3.307711539258061,
  M1I_S_R = 0.23096990318210464;
export const M1I_L_G = -1.2684379732850313,
  M1I_M_G = 2.609757349287688,
  M1I_S_G = -0.3413193760026571;
export const M1I_L_B = -0.004196076138675536,
  M1I_M_B = -0.7034186179359361,
  M1I_S_B = 1.7076146940746113;

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
  return linearToStoredRgb(lr, lg, lb, alpha);
};

export const oklabToRgb = ({ l, a, b, alpha }: OklabColor): RgbColor => {
  const [r, g, bv] = oklabToLinear(l, a, b);
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
    const v = l * l * l;
    out[0] = v;
    out[1] = v;
    out[2] = v;
    return;
  }
  const l_ = l + M2I_A_L * a + M2I_B_L * b;
  const m_ = l + M2I_A_M * a + M2I_B_M * b;
  const s_ = l + M2I_A_S * a + M2I_B_S * b;
  const lv = l_ * l_ * l_,
    mv = m_ * m_ * m_,
    sv = s_ * s_ * s_;
  out[0] = M1I_L_R * lv + M1I_M_R * mv + M1I_S_R * sv;
  out[1] = M1I_L_G * lv + M1I_M_G * mv + M1I_S_G * sv;
  out[2] = M1I_L_B * lv + M1I_M_B * mv + M1I_S_B * sv;
};

/** Unclamped linear sRGB channels from OKLab values. Channels may exceed [0, 1] for out-of-gamut colors. */
export const oklabToLinear = (l: number, a: number, b: number): [number, number, number] => {
  if (a === 0 && b === 0) {
    const v = l * l * l;
    return [v, v, v];
  }
  const l_ = l + M2I_A_L * a + M2I_B_L * b;
  const m_ = l + M2I_A_M * a + M2I_B_M * b;
  const s_ = l + M2I_A_S * a + M2I_B_S * b;
  const lv = l_ * l_ * l_,
    mv = m_ * m_ * m_,
    sv = s_ * s_ * s_;
  return [
    M1I_L_R * lv + M1I_M_R * mv + M1I_S_R * sv,
    M1I_L_G * lv + M1I_M_G * mv + M1I_S_G * sv,
    M1I_L_B * lv + M1I_M_B * mv + M1I_S_B * sv,
  ];
};

export const parseOklabObjectRaw = (input: unknown): OklabColor | null => {
  if (!isObject(input)) return null;
  // Objects with colorSpace: 'lab' are CIE Lab, not OKLab — let parseLabObject handle them.
  if ((input as { colorSpace?: unknown }).colorSpace === 'lab') return null;
  if (!('l' in input && 'a' in input && 'b' in input)) return null;
  if ('r' in input || 'x' in input || 'c' in input || 'h' in input) return null;
  const { l, a, b, alpha = 1 } = input as { l: unknown; a: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(l) || !isAnyNumber(a) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  // OKLab L is [0, 1]; an object above that is a CIE Lab value passed without the colorSpace
  // brand, so reject it rather than clamp it to white. Negative L clamps to 0 like the string form.
  // The 1e-9 margin admits float noise: white converts to L = 1.0000000000000002.
  if (sanitize(l) > 1 + 1e-9) return null;
  return { l: clamp(sanitize(l), 0, 1), a: sanitize(a), b: sanitize(b), alpha: clamp(sanitize(alpha), 0, 1) };
};

export const parseOklabObject = (input: unknown): RgbColor | null => {
  const lab = parseOklabObjectRaw(input);
  return lab && oklabToRgbUnclamped(lab);
};

const OKLAB_RE = new RegExp(
  `^oklab\\(${WS}*(?<l>${NUM_OR_NONE})(?<lp>%?)${WS}+(?<a>${NUM_OR_NONE})(?<ap>%?)${WS}+(?<b>${NUM_OR_NONE})(?<bp>%?)` +
    `${WS}*(?:/${WS}*(?<al>${NUM_OR_NONE})(?<alp>%?)${WS}*)?\\)$`,
  'i'
);

export const parseOklabString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = OKLAB_RE.exec(trimWs(input))?.groups;
  if (!g) return null;
  // CSS Color 4: L outside [0, 1] is clamped at parsed-value time; a and b are unbounded.
  const L = clamp(g.lp ? parseNum(g.l!) / 100 : parseNum(g.l!), 0, 1); // 100% = 1
  const a = g.ap ? parseNum(g.a!) * 0.004 : parseNum(g.a!); // 100% = 0.4
  const b = g.bp ? parseNum(g.b!) * 0.004 : parseNum(g.b!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return oklabToRgbUnclamped({ l: L, a, b, alpha: clamp(alpha, 0, 1) });
};

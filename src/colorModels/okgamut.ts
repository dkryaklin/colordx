// Björn Ottosson's sRGB gamut geometry in OKLab, shared by Okhsl and Okhsv. Ported from the
// "sRGB gamut clipping" and "Okhsv and Okhsl" posts (https://bottosson.github.io/posts/, MIT).
// All of it is sRGB-specific: the max-saturation polynomial, the ST_mid fit and the Halley
// steps are fitted to the sRGB gamut, so none of this applies to P3 or Rec.2020.
//
// The helpers write into module-private Float64Array scratch (LAB, LIN, CUSP, CS) instead of
// returning tuples, so the per-pixel `*ChannelsInto` callers in okhsl.ts / okhsv.ts allocate
// nothing. The public `oklabToLinearInto` / `linearSrgbToOklabInto` are deliberately not
// reused here: a library-internal call would hand them a second buffer type and deoptimise a
// user's render loop (see the note in hsv.ts). Each scratch array is read back immediately by
// its caller and never escapes.
import {
  M1I_L_B,
  M1I_L_G,
  M1I_L_R,
  M1I_M_B,
  M1I_M_G,
  M1I_M_R,
  M1I_S_B,
  M1I_S_G,
  M1I_S_R,
  M1_LB,
  M1_LG,
  M1_LR,
  M1_MB,
  M1_MG,
  M1_MR,
  M1_SB,
  M1_SG,
  M1_SR,
  M2I_A_L,
  M2I_A_M,
  M2I_A_S,
  M2I_B_L,
  M2I_B_M,
  M2I_B_S,
  M2_L_A,
  M2_L_B,
  M2_L_L,
  M2_M_A,
  M2_M_B,
  M2_M_L,
  M2_S_A,
  M2_S_B,
  M2_S_L,
} from './oklab.js';

/** Scratch: OKLab [L, a, b] written by `linearToOklabScratch`. */
export const LAB = new Float64Array(3);
/** Scratch: linear sRGB [r, g, b] written by `oklabToLinearScratch`. */
export const LIN = new Float64Array(3);
/** Scratch: the gamut cusp [L_cusp, C_cusp] written by `findCusp`. */
export const CUSP = new Float64Array(2);
/** Scratch: Okhsl's [C_0, C_mid, C_max] written by `findCs`. */
export const CS = new Float64Array(3);

/** Linear sRGB → OKLab into LAB. Same expression as linearSrgbToOklab, so the results are bit-identical. */
export const linearToOklabScratch = (lr: number, lg: number, lb: number): void => {
  const lv = Math.cbrt(M1_LR * lr + M1_LG * lg + M1_LB * lb);
  const mv = Math.cbrt(M1_MR * lr + M1_MG * lg + M1_MB * lb);
  const sv = Math.cbrt(M1_SR * lr + M1_SG * lg + M1_SB * lb);
  LAB[0] = M2_L_L * lv + M2_M_L * mv + M2_S_L * sv;
  LAB[1] = M2_L_A * lv + M2_M_A * mv + M2_S_A * sv;
  LAB[2] = M2_L_B * lv + M2_M_B * mv + M2_S_B * sv;
};

/** OKLab → unclamped linear sRGB into LIN. Same expression as oklabToLinear, achromatic shortcut included. */
export const oklabToLinearScratch = (l: number, a: number, b: number): void => {
  // Same shortcut as oklabToLinear: the M1⁻¹ rows sum to 1 only to 10 digits, so a grey (s = 0 gives
  // an exact C = 0) would otherwise come out with channels ~1e-11 apart — a phantom hue downstream,
  // and an Okhsl grey that differs from the same Okhsv grey.
  if (a === 0 && b === 0) {
    const v = l * l * l;
    LIN[0] = v;
    LIN[1] = v;
    LIN[2] = v;
    return;
  }
  const l_ = l + M2I_A_L * a + M2I_B_L * b;
  const m_ = l + M2I_A_M * a + M2I_B_M * b;
  const s_ = l + M2I_A_S * a + M2I_B_S * b;
  const lv = l_ * l_ * l_,
    mv = m_ * m_ * m_,
    sv = s_ * s_ * s_;
  LIN[0] = M1I_L_R * lv + M1I_M_R * mv + M1I_S_R * sv;
  LIN[1] = M1I_L_G * lv + M1I_M_G * mv + M1I_S_G * sv;
  LIN[2] = M1I_L_B * lv + M1I_M_B * mv + M1I_S_B * sv;
};

// L_r lightness estimate. OKLab L is scale-free; the toe pins a reference white at Y = 1 so
// that L_r tracks CIELab L (equal at 50%: Y = 0.18419 vs 0.18406) — see the Okhsl post.
const K1 = 0.206;
const K2 = 0.03;
const K3 = (1 + K1) / (1 + K2);

/** OKLab L → L_r (the "toe"). toe(0) = 0, toe(1) = 1. */
export const toe = (x: number): number =>
  0.5 * (K3 * x - K1 + Math.sqrt((K3 * x - K1) * (K3 * x - K1) + 4 * K2 * K3 * x));

/** L_r → OKLab L. Exact inverse of `toe`. */
export const toeInv = (x: number): number => (x * x + K1 * x) / (K3 * (x + K2));

/**
 * Largest saturation S = C / L that stays inside sRGB for the hue direction (a_, b_), which must
 * be a unit vector. A per-sector polynomial fit plus one Halley step; the post quotes an error
 * under 1e-6 except for some blues, and Okhsl / Okhsv inherit that: the s = 1 ring is fuzzy by
 * up to ~1% (an in-gamut sRGB color can report s slightly above 1, and s = 1 exactly can land a
 * hair outside the gamut). That is the reference behaviour, reproduced here on purpose.
 * The wl / wm / ws weights are the row of the OKLab → linear-sRGB matrix for the channel that
 * hits zero first, as printed in the gamut clipping post (they differ from M1I_* in the 10th
 * digit; the Halley step converges to the same answer either way).
 */
const computeMaxSaturation = (a: number, b: number): number => {
  let k0: number, k1: number, k2: number, k3: number, k4: number, wl: number, wm: number, ws: number;

  if (-1.88170328 * a - 0.80936493 * b > 1) {
    // Red component goes below zero first
    k0 = 1.19086277;
    k1 = 1.76576728;
    k2 = 0.59662641;
    k3 = 0.75515197;
    k4 = 0.56771245;
    wl = 4.0767416621;
    wm = -3.3077115913;
    ws = 0.2309699292;
  } else if (1.81444104 * a - 1.19445276 * b > 1) {
    // Green component
    k0 = 0.73956515;
    k1 = -0.45954404;
    k2 = 0.08285427;
    k3 = 0.1254107;
    k4 = 0.14503204;
    wl = -1.2684380046;
    wm = 2.6097574011;
    ws = -0.3413193965;
  } else {
    // Blue component
    k0 = 1.35733652;
    k1 = -0.00915799;
    k2 = -1.1513021;
    k3 = -0.50559606;
    k4 = 0.00692167;
    wl = -0.0041960863;
    wm = -0.7034186147;
    ws = 1.707614701;
  }

  // Polynomial approximation, then one Halley step on f(S) = channel(L = 1, C = S) = 0.
  let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;

  const k_l = M2I_A_L * a + M2I_B_L * b;
  const k_m = M2I_A_M * a + M2I_B_M * b;
  const k_s = M2I_A_S * a + M2I_B_S * b;

  const l_ = 1 + S * k_l;
  const m_ = 1 + S * k_m;
  const s_ = 1 + S * k_s;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const l_dS = 3 * k_l * l_ * l_;
  const m_dS = 3 * k_m * m_ * m_;
  const s_dS = 3 * k_s * s_ * s_;

  const l_dS2 = 6 * k_l * k_l * l_;
  const m_dS2 = 6 * k_m * k_m * m_;
  const s_dS2 = 6 * k_s * k_s * s_;

  const f = wl * l + wm * m + ws * s;
  const f1 = wl * l_dS + wm * m_dS + ws * s_dS;
  const f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;

  S = S - (f * f1) / (f1 * f1 - 0.5 * f * f2);

  return S;
};

/**
 * The cusp of the sRGB gamut slice at hue direction (a_, b_): the most chromatic in-gamut color of
 * that hue, where the L = 1 max-saturation ray first hits a channel of 1. Writes [L_cusp, C_cusp]
 * into CUSP.
 */
export const findCusp = (a: number, b: number): void => {
  const S_cusp = computeMaxSaturation(a, b);
  oklabToLinearScratch(1, S_cusp * a, S_cusp * b);
  const L_cusp = Math.cbrt(1 / Math.max(LIN[0]!, LIN[1]!, LIN[2]!));
  CUSP[0] = L_cusp;
  CUSP[1] = L_cusp * S_cusp;
};

/**
 * Where the line L = L0 (1 − t) + t L1, C = t C1 leaves the sRGB gamut, as t. (a_, b_) must be a
 * unit vector and (cuspL, cuspC) the cusp for it. The lower half of the gamut slice is a
 * straight edge to black, so the intersection is exact; the upper half curves, so the triangle
 * intersection is refined with one Halley step per channel. The 10e5 sentinel discards a
 * channel whose Halley step points the wrong way.
 */
const findGamutIntersection = (
  a: number,
  b: number,
  L1: number,
  C1: number,
  L0: number,
  cuspL: number,
  cuspC: number
): number => {
  let t: number;
  if ((L1 - L0) * cuspC - (cuspL - L0) * C1 <= 0) {
    // Lower half
    t = (cuspC * L0) / (C1 * cuspL + cuspC * (L0 - L1));
  } else {
    // Upper half: intersect with the triangle first…
    t = (cuspC * (L0 - 1)) / (C1 * (cuspL - 1) + cuspC * (L0 - L1));

    // …then one Halley step on each channel.
    const dL = L1 - L0;
    const dC = C1;

    const k_l = M2I_A_L * a + M2I_B_L * b;
    const k_m = M2I_A_M * a + M2I_B_M * b;
    const k_s = M2I_A_S * a + M2I_B_S * b;

    const l_dt = dL + dC * k_l;
    const m_dt = dL + dC * k_m;
    const s_dt = dL + dC * k_s;

    const L = L0 * (1 - t) + t * L1;
    const C = t * C1;

    const l_ = L + C * k_l;
    const m_ = L + C * k_m;
    const s_ = L + C * k_s;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const ldt = 3 * l_dt * l_ * l_;
    const mdt = 3 * m_dt * m_ * m_;
    const sdt = 3 * s_dt * s_ * s_;

    const ldt2 = 6 * l_dt * l_dt * l_;
    const mdt2 = 6 * m_dt * m_dt * m_;
    const sdt2 = 6 * s_dt * s_dt * s_;

    const r = M1I_L_R * l + M1I_M_R * m + M1I_S_R * s - 1;
    const r1 = M1I_L_R * ldt + M1I_M_R * mdt + M1I_S_R * sdt;
    const r2 = M1I_L_R * ldt2 + M1I_M_R * mdt2 + M1I_S_R * sdt2;

    const u_r = r1 / (r1 * r1 - 0.5 * r * r2);
    let t_r = -r * u_r;

    const g = M1I_L_G * l + M1I_M_G * m + M1I_S_G * s - 1;
    const g1 = M1I_L_G * ldt + M1I_M_G * mdt + M1I_S_G * sdt;
    const g2 = M1I_L_G * ldt2 + M1I_M_G * mdt2 + M1I_S_G * sdt2;

    const u_g = g1 / (g1 * g1 - 0.5 * g * g2);
    let t_g = -g * u_g;

    const bb = M1I_L_B * l + M1I_M_B * m + M1I_S_B * s - 1;
    const b1 = M1I_L_B * ldt + M1I_M_B * mdt + M1I_S_B * sdt;
    const b2 = M1I_L_B * ldt2 + M1I_M_B * mdt2 + M1I_S_B * sdt2;

    const u_b = b1 / (b1 * b1 - 0.5 * bb * b2);
    let t_b = -bb * u_b;

    t_r = u_r >= 0 ? t_r : 10e5;
    t_g = u_g >= 0 ? t_g : 10e5;
    t_b = u_b >= 0 ? t_b : 10e5;

    t += Math.min(t_r, Math.min(t_g, t_b));
  }

  return t;
};

/**
 * Okhsl's three chroma scales at OKLab lightness L and hue direction (a_, b_), written into CS as
 * [C_0, C_mid, C_max]:
 *  - C_0 is hue-independent (a fixed S = 0.4, T = 0.8 triangle), so low saturations vary
 *    smoothly across hues;
 *  - C_mid follows a smooth polynomial fit of the cusp (ST_mid), rescaled by k so it sits
 *    inside the real gamut;
 *  - C_max is the true gamut edge at this L.
 * Only meaningful for 0 < L < 1: at either end C_max is 0 and k is 0 / 0.
 */
export const findCs = (L: number, a_: number, b_: number): void => {
  findCusp(a_, b_);
  const cuspL = CUSP[0]!,
    cuspC = CUSP[1]!;

  const C_max = findGamutIntersection(a_, b_, L, 1, L, cuspL, cuspC);
  const S_max = cuspC / cuspL;
  const T_max = cuspC / (1 - cuspL);

  // Smooth approximation of the cusp location (ST_mid), fitted so S_mid < S_max and T_mid < T_max.
  const S_mid =
    0.11516993 +
    1 /
      (7.4477897 +
        4.1590124 * b_ +
        a_ *
          (-2.19557347 +
            1.75198401 * b_ +
            a_ * (-2.13704948 - 10.02301043 * b_ + a_ * (-4.24894561 + 5.38770819 * b_ + 4.69891013 * a_))));

  const T_mid =
    0.11239642 +
    1 /
      (1.6132032 -
        0.68124379 * b_ +
        a_ *
          (0.40370612 +
            0.90148123 * b_ +
            a_ * (-0.27087943 + 0.6122399 * b_ + a_ * (0.00299215 - 0.45399568 * b_ - 0.14661872 * a_))));

  // Scale factor to compensate for the curved part of the gamut shape.
  const k = C_max / Math.min(L * S_max, (1 - L) * T_max);

  // Soft minimum instead of a sharp triangle, so chroma varies smoothly through the cusp.
  let C_a = L * S_mid;
  let C_b = (1 - L) * T_mid;
  const C_mid = 0.9 * k * Math.sqrt(Math.sqrt(1 / (1 / (C_a * C_a * C_a * C_a) + 1 / (C_b * C_b * C_b * C_b))));

  C_a = L * 0.4;
  C_b = (1 - L) * 0.8;
  const C_0 = Math.sqrt(1 / (1 / (C_a * C_a) + 1 / (C_b * C_b)));

  CS[0] = C_0;
  CS[1] = C_mid;
  CS[2] = C_max;
};

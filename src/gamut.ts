import { labToXyz } from './colorModels/lab.js';
import { linearSrgbToOklab, oklabToLinear } from './colorModels/oklab.js';
import { linearP3ToSrgb } from './colorModels/p3.js';
import { linearRec2020ToSrgb } from './colorModels/rec2020.js';
import { xyzD50ToLinearSrgb, xyzD65ToLinearSrgb } from './colorModels/xyz.js';
import { ANGLE_UNITS, clamp } from './helpers.js';
import { rec2020ToLinear, srgbToLinear } from './transfer.js';
import type {
  AnyColor,
  LabColor,
  LchColor,
  OklabColor,
  OklchColor,
  P3Color,
  Rec2020Color,
  XyzColor,
  XyzD65Color,
} from './types.js';

const OKLCH_RE =
  /^oklch\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

const OKLAB_RE =
  /^oklab\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

// CIE Lab/LCH strings. L is % or number (100% = 100). a/b are % or number (100% = 125).
// C is % or number (100% = 150). H accepts deg|rad|grad|turn.
const LAB_RE =
  /^lab\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

const LCH_RE =
  /^lch\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

// CSS Color 4 color() inputs for wide-gamut RGB and XYZ. Gamma-encoded RGB (P3/Rec.2020)
// take number-or-% channels (100% = 1); XYZ treats % as the library's 0–100 scale
// (matching parseXyzObject/parseXyzD65String so gamut checks agree with parsed output).
const P3_STR_RE =
  /^color\(\s*display-p3\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;
const REC2020_STR_RE =
  /^color\(\s*rec2020\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;
const XYZ_D50_STR_RE =
  /^color\(\s*xyz-d50\s+([+-]?\d*\.?\d+)%?\s+([+-]?\d*\.?\d+)%?\s+([+-]?\d*\.?\d+)%?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;
const XYZ_D65_STR_RE =
  /^color\(\s*xyz-d65\s+([+-]?\d*\.?\d+)%?\s+([+-]?\d*\.?\d+)%?\s+([+-]?\d*\.?\d+)%?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

/** CIE Lab (D50) → OKLab via XYZ D50 → linear sRGB → OKLab. No clamping. */
const labToOklab = (l: number, a: number, b: number): [number, number, number] => {
  const { x, y, z } = labToXyz({ l, a, b, alpha: 1, colorSpace: 'lab' });
  const [lr, lg, lb] = xyzD50ToLinearSrgb(x, y, z);
  return linearSrgbToOklab(lr, lg, lb);
};

/** Display-P3 (gamma-encoded, 0–1) → OKLab via linear P3 → linear sRGB → OKLab. No clamping. */
const p3ToOklab = (r: number, g: number, b: number): [number, number, number] => {
  const [sr, sg, sb] = linearP3ToSrgb(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  return linearSrgbToOklab(sr, sg, sb);
};

/** Rec.2020 (gamma-encoded, 0–1) → OKLab via linear Rec.2020 → linear sRGB → OKLab. No clamping. */
const rec2020ToOklab = (r: number, g: number, b: number): [number, number, number] => {
  const [sr, sg, sb] = linearRec2020ToSrgb(rec2020ToLinear(r), rec2020ToLinear(g), rec2020ToLinear(b));
  return linearSrgbToOklab(sr, sg, sb);
};

/** XYZ D50 (0–100 scale) → OKLab. No clamping. */
const xyzD50ToOklab = (x: number, y: number, z: number): [number, number, number] => {
  const [lr, lg, lb] = xyzD50ToLinearSrgb(x, y, z);
  return linearSrgbToOklab(lr, lg, lb);
};

/** XYZ D65 (0–100 scale) → OKLab. No clamping. */
const xyzD65ToOklab = (x: number, y: number, z: number): [number, number, number] => {
  const [lr, lg, lb] = xyzD65ToLinearSrgb(x, y, z);
  return linearSrgbToOklab(lr, lg, lb);
};

/**
 * Extract raw OKLab {l, a, b, alpha} without clamping.
 * Returns null for inputs that are already sRGB-bounded (hex, rgb, hsl, hsv, hwb, etc.).
 */
const getRawOklab = (input: AnyColor): { l: number; a: number; b: number; alpha: number } | null => {
  if (typeof input === 'object' && input !== null) {
    const obj = input as unknown as Record<string, unknown>;
    // OklabColor: l/a/b present, no 'lab' colorSpace brand
    if ('l' in obj && 'a' in obj && 'b' in obj && obj.colorSpace !== 'lab' && !('c' in obj) && !('r' in obj)) {
      const c = input as OklabColor;
      if (
        typeof c.l === 'number' &&
        typeof c.a === 'number' &&
        typeof c.b === 'number' &&
        typeof c.alpha === 'number'
      ) {
        return { l: c.l, a: c.a, b: c.b, alpha: c.alpha };
      }
    }
    // OklchColor: l/c/h present, no 'lch' colorSpace brand
    if ('l' in obj && 'c' in obj && 'h' in obj && obj.colorSpace !== 'lch' && !('a' in obj) && !('r' in obj)) {
      const c = input as OklchColor;
      if (typeof c.l === 'number' && typeof c.c === 'number' && typeof c.h === 'number') {
        const hRad = (c.h * Math.PI) / 180;
        return { l: c.l, a: c.c * Math.cos(hRad), b: c.c * Math.sin(hRad), alpha: c.alpha };
      }
    }
    // LabColor: convert Lab (D50) → XYZ D50 → D65 → linear sRGB → OKLab (no clamping)
    if (obj.colorSpace === 'lab') {
      const c = input as LabColor;
      if (typeof c.l !== 'number' || typeof c.a !== 'number' || typeof c.b !== 'number') return null;
      const [ol, oa, ob] = labToOklab(c.l, c.a, c.b);
      return { l: ol, a: oa, b: ob, alpha: typeof c.alpha === 'number' ? c.alpha : 1 };
    }
    // LchColor: LCH (D50) → Lab (D50) → XYZ → linear sRGB → OKLab (no clamping).
    // Without this, LCH inputs were returning null → inGamutP3/Rec2020 defaulted to true
    // and mapSrgb passed the color through unchanged, masking out-of-gamut colors.
    if (obj.colorSpace === 'lch') {
      const c = input as LchColor;
      if (typeof c.l !== 'number' || typeof c.c !== 'number' || typeof c.h !== 'number') return null;
      const hRad = (c.h * Math.PI) / 180;
      const [ol, oa, ob] = labToOklab(c.l, c.c * Math.cos(hRad), c.c * Math.sin(hRad));
      return { l: ol, a: oa, b: ob, alpha: typeof c.alpha === 'number' ? c.alpha : 1 };
    }
    // Display-P3 / Rec.2020 / XYZ wide-gamut inputs. Same bug class as Lab/LCH: without these
    // branches, inGamutSrgb on a P3-branded { r, g, b } or color(display-p3 …) would return
    // the sRGB-bounded default (always true) and Colordx.toGamutSrgb would fall back to naive
    // clip, diverging from colordx(p3).mapSrgb() which works via _rgb.
    if (obj.colorSpace === 'display-p3') {
      const c = input as P3Color;
      if (typeof c.r !== 'number' || typeof c.g !== 'number' || typeof c.b !== 'number') return null;
      const [ol, oa, ob] = p3ToOklab(c.r, c.g, c.b);
      return { l: ol, a: oa, b: ob, alpha: typeof c.alpha === 'number' ? c.alpha : 1 };
    }
    if (obj.colorSpace === 'rec2020') {
      const c = input as Rec2020Color;
      if (typeof c.r !== 'number' || typeof c.g !== 'number' || typeof c.b !== 'number') return null;
      const [ol, oa, ob] = rec2020ToOklab(c.r, c.g, c.b);
      return { l: ol, a: oa, b: ob, alpha: typeof c.alpha === 'number' ? c.alpha : 1 };
    }
    if (obj.colorSpace === 'xyz-d65') {
      const c = input as XyzD65Color;
      if (typeof c.x !== 'number' || typeof c.y !== 'number' || typeof c.z !== 'number') return null;
      const [ol, oa, ob] = xyzD65ToOklab(c.x, c.y, c.z);
      return { l: ol, a: oa, b: ob, alpha: typeof c.alpha === 'number' ? c.alpha : 1 };
    }
    // Unbranded XYZ D50 { x, y, z }. Matches parseXyzObject's convention: any object with
    // x/y/z keys and no xyz-d65 brand is D50. Placed after the branded branches so
    // colorSpace: 'xyz-d65' doesn't fall through here.
    if ('x' in obj && 'y' in obj && 'z' in obj) {
      const c = input as XyzColor;
      if (typeof c.x !== 'number' || typeof c.y !== 'number' || typeof c.z !== 'number') return null;
      const [ol, oa, ob] = xyzD50ToOklab(c.x, c.y, c.z);
      return { l: ol, a: oa, b: ob, alpha: typeof c.alpha === 'number' ? c.alpha : 1 };
    }
    return null;
  }

  if (typeof input === 'string') {
    let m = OKLCH_RE.exec(input);
    if (m) {
      const l = m[2] ? Number(m[1]) / 100 : Number(m[1]);
      const c = m[4] ? Number(m[3]) * 0.004 : Number(m[3]);
      const unit = m[6]?.toLowerCase() ?? 'deg';
      const hDeg = Number(m[5]) * (ANGLE_UNITS[unit] ?? 1);
      const hRad = (hDeg * Math.PI) / 180;
      const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
      return { l, a: c * Math.cos(hRad), b: c * Math.sin(hRad), alpha };
    }
    m = OKLAB_RE.exec(input);
    if (m) {
      const l = m[2] ? Number(m[1]) / 100 : Number(m[1]);
      const a = m[4] ? Number(m[3]) * 0.004 : Number(m[3]);
      const b = m[6] ? Number(m[5]) * 0.004 : Number(m[5]);
      const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
      return { l, a, b, alpha };
    }
    m = LAB_RE.exec(input);
    if (m) {
      const l = Number(m[1]); // 100% = 100, so the value is the same whether `%` is present
      const a = m[4] ? Number(m[3]) * 1.25 : Number(m[3]);
      const b = m[6] ? Number(m[5]) * 1.25 : Number(m[5]);
      const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
      const [ol, oa, ob] = labToOklab(l, a, b);
      return { l: ol, a: oa, b: ob, alpha };
    }
    m = LCH_RE.exec(input);
    if (m) {
      const l = Number(m[1]);
      const c = m[4] ? Number(m[3]) * 1.5 : Number(m[3]);
      const unit = m[6]?.toLowerCase() ?? 'deg';
      const hDeg = Number(m[5]) * (ANGLE_UNITS[unit] ?? 1);
      const hRad = (hDeg * Math.PI) / 180;
      const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
      const [ol, oa, ob] = labToOklab(l, c * Math.cos(hRad), c * Math.sin(hRad));
      return { l: ol, a: oa, b: ob, alpha };
    }
    m = P3_STR_RE.exec(input);
    if (m) {
      const r = m[2] ? Number(m[1]) / 100 : Number(m[1]);
      const g = m[4] ? Number(m[3]) / 100 : Number(m[3]);
      const b = m[6] ? Number(m[5]) / 100 : Number(m[5]);
      const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
      const [ol, oa, ob] = p3ToOklab(r, g, b);
      return { l: ol, a: oa, b: ob, alpha };
    }
    m = REC2020_STR_RE.exec(input);
    if (m) {
      const r = m[2] ? Number(m[1]) / 100 : Number(m[1]);
      const g = m[4] ? Number(m[3]) / 100 : Number(m[3]);
      const b = m[6] ? Number(m[5]) / 100 : Number(m[5]);
      const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
      const [ol, oa, ob] = rec2020ToOklab(r, g, b);
      return { l: ol, a: oa, b: ob, alpha };
    }
    m = XYZ_D50_STR_RE.exec(input);
    if (m) {
      // XYZ uses the library's 0–100 scale; % is treated as the same scale per parseXyzD50String.
      const x = Number(m[1]);
      const y = Number(m[2]);
      const z = Number(m[3]);
      const alpha = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
      const [ol, oa, ob] = xyzD50ToOklab(x, y, z);
      return { l: ol, a: oa, b: ob, alpha };
    }
    m = XYZ_D65_STR_RE.exec(input);
    if (m) {
      const x = Number(m[1]);
      const y = Number(m[2]);
      const z = Number(m[3]);
      const alpha = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
      const [ol, oa, ob] = xyzD65ToOklab(x, y, z);
      return { l: ol, a: oa, b: ob, alpha };
    }
    return null;
  }

  return null;
};

// Tolerance for inGamut* checks — NOT used in gamut mapping, which uses strict bounds.
// Covers two sources of error:
//   1. Matrix floating-point noise: accumulated cbrt + matrix error is ~3e-10
//   2. Value rounding: OKLCH stored at 4 dp (L, C) / 2 dp (H) produces linear-sRGB
//      deviations up to 4.4e-4 on sRGB boundary colors (exhaustive scan of all 256^3 sRGB
//      values confirms this). EPS = 5e-4 absorbs all rounding artifacts while staying below
//      ~1.6 gamma-encoded steps (imperceptible), and correctly rejects genuine out-of-gamut
//      colors (typically 1e-3 and above).
const EPS = 5e-4;

const isLinearInGamut = (r: number, g: number, b: number): boolean =>
  r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS;

const strictInGamut = (r: number, g: number, b: number): boolean =>
  r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1;

/**
 * Returns true if the color is within the sRGB gamut.
 * Always true for hex, rgb, hsl, hsv, and hwb inputs.
 * For oklch/oklab inputs, checks whether the computed linear sRGB channels are in [0, 1].
 */
export const inGamutSrgb = (input: AnyColor): boolean => {
  const raw = getRawOklab(input);
  if (raw === null) return true;
  const [r, g, b] = oklabToLinear(raw.l, raw.a, raw.b);
  return isLinearInGamut(r, g, b);
};

// CSS Color 4 gamut mapping constants
// https://www.w3.org/TR/css-color-4/#css-gamut-mapping
const JND = 0.02;
const GAMUT_EPSILON = 0.0001;

/** Euclidean distance in OKLab — the CSS Color 4 deltaEOK metric. */
const deltaEOK = (lab1: readonly [number, number, number], lab2: readonly [number, number, number]): number => {
  const dl = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dl * dl + da * da + db * db);
};

type LinearConverter = (l: number, a: number, b: number) => [number, number, number];
type FromLinearConverter = (r: number, g: number, b: number) => [number, number, number];

/** Clipped linear target-space channels plus alpha. Channels are in [0, 1] on the gamut boundary. */
type GamutMapResult = { linear: readonly [number, number, number]; alpha: number };

/**
 * CSS Color 4 gamut mapping algorithm.
 * Binary-searches for the highest chroma where clip(color) is within JND (0.02 deltaEOK)
 * of the chroma-reduced color. Returns the clipped linear target-space channels directly
 * (already in [0, 1]); callers re-encode to their storage format without a round-trip
 * through OKLab, which would reintroduce 1-ULP asymmetries at the gamut surface.
 *
 * toLinear: OKLab → unclamped linear target-space channels
 * fromLinear: linear target-space channels → OKLab (used to measure deltaEOK of clipped color)
 */
const cssGamutMap = (
  l: number,
  a: number,
  b: number,
  toLinear: LinearConverter,
  fromLinear: FromLinearConverter
): [number, number, number] => {
  if (l >= 1) return [1, 1, 1];
  if (l <= 0) return [0, 0, 0];

  const [r0, g0, b0] = toLinear(l, a, b);
  if (strictInGamut(r0, g0, b0)) return [r0, g0, b0];

  // Early exit: if the simple clip is already within JND, use it directly
  const c0r = clamp(r0, 0, 1),
    c0g = clamp(g0, 0, 1),
    c0b = clamp(b0, 0, 1);
  if (deltaEOK(fromLinear(c0r, c0g, c0b), [l, a, b]) <= JND) return [c0r, c0g, c0b];

  const hRad = Math.atan2(b, a);
  const C = Math.sqrt(a * a + b * b);
  let lo = 0;
  let hi = C;
  let minInGamut = true;
  let lastR = c0r,
    lastG = c0g,
    lastB = c0b;

  while (hi - lo > GAMUT_EPSILON) {
    const mid = (lo + hi) / 2;
    const ma = mid * Math.cos(hRad);
    const mb = mid * Math.sin(hRad);
    const [lr, lg, lb] = toLinear(l, ma, mb);

    if (minInGamut && strictInGamut(lr, lg, lb)) {
      lo = mid;
      continue;
    }

    const cr = clamp(lr, 0, 1),
      cg = clamp(lg, 0, 1),
      cb = clamp(lb, 0, 1);
    lastR = cr;
    lastG = cg;
    lastB = cb;
    const E = deltaEOK(fromLinear(cr, cg, cb), [l, ma, mb]);

    if (E <= JND) {
      lo = mid;
      minInGamut = false;
    } else {
      hi = mid;
    }
  }

  return [lastR, lastG, lastB];
};

/**
 * Maps an out-of-sRGB-gamut color using the CSS Color 4 algorithm.
 * Returns null for sRGB-bounded inputs (hex, rgb, hsl, etc.) — pass through unchanged.
 * Otherwise returns the clipped linear-sRGB channels (in [0, 1]) plus alpha.
 */
export const toGamutSrgbRaw = (input: AnyColor): GamutMapResult | null => {
  const raw = getRawOklab(input);
  if (raw === null) return null;
  return { linear: cssGamutMap(raw.l, raw.a, raw.b, oklabToLinear, linearSrgbToOklab), alpha: raw.alpha };
};

export const inGamutCustom = (input: AnyColor, toLinear: LinearConverter): boolean => {
  const raw = getRawOklab(input);
  // sRGB-bounded inputs (hex, rgb, hsl, etc.) are always inside the wider P3/Rec.2020 gamut
  if (raw === null) return true;
  const [r, g, b] = toLinear(raw.l, raw.a, raw.b);
  return isLinearInGamut(r, g, b);
};

/**
 * Maps an out-of-gamut color into a custom gamut using the CSS Color 4 gamut mapping algorithm.
 * Returns null for sRGB-bounded inputs (hex, rgb, hsl, etc.) — pass through unchanged.
 * Otherwise returns the clipped linear target-space channels (in [0, 1]) plus alpha.
 * toLinear: OKLab → unclamped linear target-space channels
 * fromLinear: linear target-space channels → OKLab (for deltaEOK of clipped colors)
 */
export const toGamutCustom = (
  input: AnyColor,
  toLinear: LinearConverter,
  fromLinear: FromLinearConverter
): GamutMapResult | null => {
  const raw = getRawOklab(input);
  if (raw === null) return null;
  return { linear: cssGamutMap(raw.l, raw.a, raw.b, toLinear, fromLinear), alpha: raw.alpha };
};

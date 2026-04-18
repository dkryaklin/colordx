import { labToXyz } from './colorModels/lab.js';
import { linearSrgbToOklab, oklabToLinear } from './colorModels/oklab.js';
import { xyzD50ToLinearSrgb } from './colorModels/xyz.js';
import { ANGLE_UNITS, clamp } from './helpers.js';
import type { AnyColor, LabColor, OklabColor, OklchColor } from './types.js';

const OKLCH_RE =
  /^oklch\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

const OKLAB_RE =
  /^oklab\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

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
      const { x, y, z } = labToXyz(c);
      const [lr, lg, lb] = xyzD50ToLinearSrgb(x, y, z);
      const [ol, oa, ob] = linearSrgbToOklab(lr, lg, lb);
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

export type LinearConverter = (l: number, a: number, b: number) => [number, number, number];
export type FromLinearConverter = (r: number, g: number, b: number) => [number, number, number];

/**
 * CSS Color 4 gamut mapping algorithm.
 * Binary-searches for the highest chroma where clip(color) is within JND (0.02 deltaEOK)
 * of the chroma-reduced color, then returns the clipped result.
 * This preserves lightness and hue while accepting only perceptually negligible clip error.
 *
 * toLinear: OKLab → unclamped linear target-space channels
 * fromLinear: linear target-space channels → OKLab (used to measure deltaEOK of clipped color)
 */
const cssGamutMap = (
  l: number,
  a: number,
  b: number,
  alpha: number,
  toLinear: LinearConverter,
  fromLinear: FromLinearConverter
): OklabColor => {
  if (l >= 1) return { l: 1, a: 0, b: 0, alpha };
  if (l <= 0) return { l: 0, a: 0, b: 0, alpha };

  const [r0, g0, b0] = toLinear(l, a, b);
  if (strictInGamut(r0, g0, b0)) return { l, a, b, alpha };

  // Early exit: if the simple clip is already within JND, use it directly
  const clip0 = fromLinear(clamp(r0, 0, 1), clamp(g0, 0, 1), clamp(b0, 0, 1));
  if (deltaEOK(clip0, [l, a, b]) <= JND) {
    return { l: clip0[0], a: clip0[1], b: clip0[2], alpha };
  }

  const hRad = Math.atan2(b, a);
  const C = Math.sqrt(a * a + b * b);
  let lo = 0;
  let hi = C;
  let minInGamut = true;
  let lastClip: readonly [number, number, number] = clip0;

  while (hi - lo > GAMUT_EPSILON) {
    const mid = (lo + hi) / 2;
    const ma = mid * Math.cos(hRad);
    const mb = mid * Math.sin(hRad);
    const [lr, lg, lb] = toLinear(l, ma, mb);

    if (minInGamut && strictInGamut(lr, lg, lb)) {
      lo = mid;
      continue;
    }

    const clipOklab = fromLinear(clamp(lr, 0, 1), clamp(lg, 0, 1), clamp(lb, 0, 1));
    lastClip = clipOklab;
    const E = deltaEOK(clipOklab, [l, ma, mb]);

    if (E <= JND) {
      lo = mid;
      minInGamut = false;
    } else {
      hi = mid;
    }
  }

  return { l: lastClip[0], a: lastClip[1], b: lastClip[2], alpha };
};

/**
 * Maps an out-of-sRGB-gamut color using the CSS Color 4 algorithm.
 * Returns null for sRGB-bounded inputs (hex, rgb, hsl, etc.) — pass through unchanged.
 * Returns the mapped OklabColor otherwise.
 */
export const toGamutSrgbRaw = (input: AnyColor): OklabColor | null => {
  const raw = getRawOklab(input);
  if (raw === null) return null;
  const { l, a, b, alpha } = raw;
  return cssGamutMap(l, a, b, alpha, oklabToLinear, linearSrgbToOklab);
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
 * Returns the mapped OklabColor otherwise.
 * toLinear: OKLab → unclamped linear target-space channels
 * fromLinear: linear target-space channels → OKLab (for deltaEOK of clipped colors)
 */
export const toGamutCustom = (
  input: AnyColor,
  toLinear: LinearConverter,
  fromLinear: FromLinearConverter
): OklabColor | null => {
  const raw = getRawOklab(input);
  if (raw === null) return null;
  const { l, a, b, alpha } = raw;
  return cssGamutMap(l, a, b, alpha, toLinear, fromLinear);
};

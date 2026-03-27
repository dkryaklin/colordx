import { labToXyz } from './colorModels/lab.js';
import { linearSrgbToOklab, oklabToLinear } from './colorModels/oklab.js';
import { oklabToLinearP3 } from './colorModels/p3.js';
import { oklabToLinearRec2020 } from './colorModels/rec2020.js';
import { xyzD50ToLinearSrgb } from './colorModels/xyz.js';
import { Colordx } from './colordx.js';
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

// Tolerance for floating point rounding introduced by limited-precision OKLCH strings
// (4 decimal places in L/C and 2 in H can cause linear sRGB to deviate by up to ~2e-3)
const EPS = 2e-3;

const isLinearInGamut = (r: number, g: number, b: number): boolean =>
  r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS;

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

/**
 * Maps an out-of-gamut color into sRGB by reducing chroma (CSS Color 4 gamut mapping).
 * Colors already in gamut are returned as-is. sRGB inputs (hex, rgb, hsl, etc.) are passed through.
 */
export const toGamutSrgb = (input: AnyColor): Colordx => {
  const raw = getRawOklab(input);
  if (raw === null) return new Colordx(input);

  const { l, a, b, alpha } = raw;
  const [r, g, bv] = oklabToLinear(l, a, b);
  if (isLinearInGamut(r, g, bv)) return new Colordx(input);

  // Binary search: reduce chroma while keeping lightness and hue
  const hRad = Math.atan2(b, a);
  let lo = 0;
  let hi = Math.sqrt(a ** 2 + b ** 2);

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const [lr, lg, lb] = oklabToLinear(l, mid * Math.cos(hRad), mid * Math.sin(hRad));
    if (isLinearInGamut(lr, lg, lb)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const cFinal = (lo + hi) / 2;
  const oklab: OklabColor = {
    l: clamp(l, 0, 1),
    a: cFinal * Math.cos(hRad),
    b: cFinal * Math.sin(hRad),
    alpha: clamp(alpha, 0, 1),
  };
  return new Colordx(oklab);
};

type LinearConverter = (l: number, a: number, b: number) => [number, number, number];

const inGamutCustom = (input: AnyColor, toLinear: LinearConverter): boolean => {
  const raw = getRawOklab(input);
  // sRGB-bounded inputs (hex, rgb, hsl, etc.) are always inside the wider P3/Rec.2020 gamut
  if (raw === null) return true;
  const [r, g, b] = toLinear(raw.l, raw.a, raw.b);
  return isLinearInGamut(r, g, b);
};

const toGamutCustom = (input: AnyColor, toLinear: LinearConverter): Colordx => {
  const raw = getRawOklab(input);
  if (raw === null) return new Colordx(input);

  const { l, a, b, alpha } = raw;
  const [r, g, bv] = toLinear(l, a, b);
  if (isLinearInGamut(r, g, bv)) return new Colordx(input);

  const hRad = Math.atan2(b, a);
  let lo = 0;
  let hi = Math.sqrt(a ** 2 + b ** 2);

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const [lr, lg, lb] = toLinear(l, mid * Math.cos(hRad), mid * Math.sin(hRad));
    if (isLinearInGamut(lr, lg, lb)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const cFinal = (lo + hi) / 2;
  const oklab: OklabColor = {
    l: clamp(l, 0, 1),
    a: cFinal * Math.cos(hRad),
    b: cFinal * Math.sin(hRad),
    alpha: clamp(alpha, 0, 1),
  };
  return new Colordx(oklab);
};

/**
 * Returns true if the color is within the Display-P3 gamut.
 * sRGB inputs (hex, rgb, hsl, etc.) always return true (sRGB ⊂ P3).
 */
export const inGamutP3 = (input: AnyColor): boolean => inGamutCustom(input, oklabToLinearP3);

/**
 * Maps an out-of-P3-gamut color into Display-P3 by reducing chroma (constant lightness and hue).
 * Colors already in P3 gamut are returned as-is. sRGB inputs are passed through.
 */
export const toGamutP3 = (input: AnyColor): Colordx => toGamutCustom(input, oklabToLinearP3);

/**
 * Returns true if the color is within the Rec.2020 gamut.
 * sRGB inputs (hex, rgb, hsl, etc.) always return true (sRGB ⊂ Rec.2020).
 */
export const inGamutRec2020 = (input: AnyColor): boolean => inGamutCustom(input, oklabToLinearRec2020);

/**
 * Maps an out-of-Rec.2020-gamut color into Rec.2020 by reducing chroma (constant lightness and hue).
 * Colors already in Rec.2020 gamut are returned as-is. sRGB inputs are passed through.
 */
export const toGamutRec2020 = (input: AnyColor): Colordx => toGamutCustom(input, oklabToLinearRec2020);

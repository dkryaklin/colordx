import { linearSrgbToOklab, oklabToLinear } from './colorModels/oklab.js';
import { ANGLE_UNITS, clamp, isNumber } from './helpers.js';
import { parse } from './parse.js';
import { srgbToLinear } from './transfer.js';
import type { AnyColor, ColorParser, OklabColor, OklchColor } from './types.js';

const OKLCH_RE =
  /^oklch\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

const OKLAB_RE =
  /^oklab\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

type RawOklab = { l: number; a: number; b: number; alpha: number };

/**
 * Extract raw OKLab {l, a, b, alpha} without clamping.
 * OKLab / OKLCH inputs are read directly, under the same rules as the parsers: L is clamped to
 * [0, 1] (CSS Color 4 parsed-value clamping), C to ≥ 0, alpha defaults to 1, and an object with
 * L > 1 is not OKLab (it is CIE Lab/LCH missing its colorSpace brand) so it falls through to the
 * shared parser and is rejected there. Everything else goes through `own` (a plugin's parser for
 * its own format, so its gamut helpers work without `extend()`) and then the regular parser;
 * channels outside [0, 255] carry the out-of-gamut information.
 * Returns null for inputs that are already sRGB-bounded (hex, rgb, hsl, hsv, hwb, etc.).
 */
const getRawOklab = (input: AnyColor, own?: ColorParser): RawOklab | null => {
  if (typeof input === 'object' && input !== null) {
    const obj = input as unknown as Record<string, unknown>;
    // OklabColor: l/a/b present, no 'lab' colorSpace brand
    if ('l' in obj && 'a' in obj && 'b' in obj && obj.colorSpace !== 'lab' && !('c' in obj) && !('r' in obj)) {
      const c = input as OklabColor;
      const alpha = c.alpha === undefined ? 1 : c.alpha;
      if (isNumber(c.l) && isNumber(c.a) && isNumber(c.b) && isNumber(alpha) && c.l <= 1) {
        return { l: clamp(c.l, 0, 1), a: c.a, b: c.b, alpha };
      }
    }
    // OklchColor: l/c/h present, no 'lch' colorSpace brand
    if ('l' in obj && 'c' in obj && 'h' in obj && obj.colorSpace !== 'lch' && !('a' in obj) && !('r' in obj)) {
      const c = input as OklchColor;
      const alpha = c.alpha === undefined ? 1 : c.alpha;
      if (isNumber(c.l) && isNumber(c.c) && isNumber(c.h) && isNumber(alpha) && c.l <= 1) {
        const hRad = (c.h * Math.PI) / 180;
        const C = Math.max(0, c.c);
        return { l: clamp(c.l, 0, 1), a: C * Math.cos(hRad), b: C * Math.sin(hRad), alpha };
      }
    }
  } else if (typeof input === 'string') {
    let m = OKLCH_RE.exec(input);
    if (m) {
      const l = clamp(m[2] ? Number(m[1]) / 100 : Number(m[1]), 0, 1);
      const c = Math.max(0, m[4] ? Number(m[3]) * 0.004 : Number(m[3]));
      const unit = m[6]?.toLowerCase() ?? 'deg';
      const hDeg = Number(m[5]) * (ANGLE_UNITS[unit] ?? 1);
      const hRad = (hDeg * Math.PI) / 180;
      const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
      return { l, a: c * Math.cos(hRad), b: c * Math.sin(hRad), alpha };
    }
    m = OKLAB_RE.exec(input);
    if (m) {
      const l = clamp(m[2] ? Number(m[1]) / 100 : Number(m[1]), 0, 1);
      const a = m[4] ? Number(m[3]) * 0.004 : Number(m[3]);
      const b = m[6] ? Number(m[5]) * 0.004 : Number(m[5]);
      const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
      return { l, a, b, alpha };
    }
  } else {
    return null;
  }

  const rgb = own?.(input) ?? parse(input);
  if (rgb === null) return null;
  const { r, g, b, alpha } = rgb;
  if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) return null;
  const [l, a, bb] = linearSrgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  return { l, a, b: bb, alpha };
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
 * True when the color falls inside the sRGB gamut.
 * sRGB-bounded inputs (hex, rgb, hsl, hsv, hwb) are always in gamut.
 * Wide-gamut inputs (oklch, oklab, lab, lch, p3, rec2020, xyz) are checked against [0, 1] in linear sRGB.
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
  // hypot rather than sqrt(a² + b²): a finite a of 1e308 squares to Infinity. An infinite or NaN
  // chroma (from `oklab(0.5 1e400 0)` or `{ a: Infinity }`) has nothing to bisect — `hi - lo >
  // GAMUT_EPSILON` would never turn false — so naive clip is the only answer such an input has,
  // the same one toHex() gives it. clamp() has already read any NaN channel as 0.
  const C = Math.hypot(a, b);
  if (!Number.isFinite(C)) return [c0r, c0g, c0b];
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

export const inGamutCustom = (input: AnyColor, toLinear: LinearConverter, own?: ColorParser): boolean => {
  const raw = getRawOklab(input, own);
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
 * own: the plugin's parser for its own format, tried before the shared parser
 */
export const toGamutCustom = (
  input: AnyColor,
  toLinear: LinearConverter,
  fromLinear: FromLinearConverter,
  own?: ColorParser
): GamutMapResult | null => {
  const raw = getRawOklab(input, own);
  if (raw === null) return null;
  return { linear: cssGamutMap(raw.l, raw.a, raw.b, toLinear, fromLinear), alpha: raw.alpha };
};

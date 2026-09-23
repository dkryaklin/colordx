// Comparison clamp: NaN fails both tests and lands on `min`, the same "NaN reads as the low
// bound" rule the object parsers use, so a NaN never reaches a formatter. Math.min/Math.max
// would propagate it.
export const clamp = (n: number, min: number, max: number): number => (n > min ? (n < max ? n : max) : min);

// `|| 0` folds the -0 that Math.round leaves on a tiny negative (a grey's OKLab a/b, the L of a
// black with chroma) so formatted objects never carry a signed zero.
export const round = (n: number, d = 0): number => {
  const p = 10 ** d;
  return Math.round(p * n) / p || 0;
};

// Normalize hue to [0, 360). Avoids (h + 360) % 360 which can lose precision
// when h is already in [0, 360) due to binary floating-point subtraction.
// `|| 0` folds -0 and the NaN that `Infinity % 360` produces to 0, so a non-finite hue
// reads as 0° instead of poisoning every channel downstream.
export const normalizeHue = (h: number): number => (h >= 0 && h < 360 ? h : ((h % 360) + 360) % 360 || 0);

// Channels closer than this (0–1 scale) are read as achromatic by rgbToHsl/rgbToHsv. Matrix-based
// producers (Lab, LCH, mixOklab, display-p3, …) leave up to ~1.5e-7 of noise on a grey; an exact
// max !== min then invents a hue. 1e-6 is 50× below the smallest saturation toHsl() can print
// (0.005%) and 4000× below one 16-bit step, so no representable colour reads differently.
export const ACHROMATIC_EPS = 1e-6;

export const ANGLE_UNITS: Record<string, number> = { deg: 1, grad: 0.9, turn: 360, rad: 360 / (2 * Math.PI) };

// Accepts any JS number type (including NaN/±Infinity); use sanitize() before clamping
export const isAnyNumber = (n: unknown): n is number => typeof n === 'number';

// Replace NaN with 0; ±Infinity is left for clamp() to handle naturally
export const sanitize = (n: number): number => (Number.isNaN(n) ? 0 : n);

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// CSS whitespace (CSS Syntax 3 §4.2): space, tab, LF, CR and FF only. JS `\s` and String.trim()
// also accept NBSP, \v, U+2028, the BOM and other Unicode spaces, which no CSS parser does.
export const isWs = (c: number): boolean => c === 32 || c === 9 || c === 10 || c === 13 || c === 12;

/** Regex fragment matching one CSS whitespace character, for the color-function patterns. */
export const WS = '[ \\t\\n\\r\\f]';

/** String.trim() restricted to CSS whitespace. Linear: a `^ws+|ws+$` regex backtracks quadratically. */
export const trimWs = (s: string): string => {
  let i = 0,
    j = s.length;
  while (i < j && isWs(s.charCodeAt(i))) i++;
  while (j > i && isWs(s.charCodeAt(j - 1))) j--;
  return i === 0 && j === s.length ? s : s.slice(i, j);
};

// Shared regex fragments. NUM matches a CSS Syntax 3 <number-token>: a signed decimal with an
// optional exponent (`1e2`, `6e-1`). NUM_OR_NONE adds the CSS Color 4 `none` keyword, which is
// an ident, so it can't take a `%` or an angle unit (`none%`, `nonedeg` are invalid).
// The alternation is deliberate: the shorter `\\d*\\.?\\d+` is ambiguous and backtracks
// quadratically on a long digit run that ultimately fails to match.
export const NUM = '[+-]?(?:\\d*\\.\\d+|\\d+)(?:[eE][+-]?\\d+)?';
export const NUM_OR_NONE = `(?:none(?![%a-zA-Z])|${NUM})`;

/** Parse a CSS Color 4 channel token. `none` → 0; a plain number is returned as-is. */
export const parseNum = (v: string): number => (v.toLowerCase() === 'none' ? 0 : Number(v));

/**
 * Rewrites exponent-notation numbers (`4e-8`) in a serialized color as fixed decimals. CSS accepts
 * both, but a caller asking for 7+ decimals wants to read them. Only a nonzero value below 1e-6
 * prints with an exponent, and none survives rounding to 6 dp, so the defaults skip the regex.
 */
export const fixedNotation = (s: string, precision: number): string =>
  precision < 7
    ? s
    : s.replace(/-?\d+(?:\.(\d+))?e-(\d+)/g, (m, frac: string | undefined, exp: string) =>
        Number(m).toFixed((frac?.length ?? 0) + Number(exp))
      );

/** Clamp+round to a 0-255 byte, avoiding the generic round()'s `10 ** 0` per channel. */
export const toByte = (n: number): number => (n > 0 ? (n < 255 ? Math.round(n) : 255) : 0);

/** Clamp+round alpha to 3 decimals, likewise avoiding the generic round(). */
export const round3 = (n: number): number => (n > 0 ? (n < 1 ? Math.round(n * 1000) / 1000 : 1) : 0);

// Only a missing `a` defaults to 1, like a missing `alpha` (a destructuring default): `{ a: null }`
// is as invalid as `{ alpha: null }`.
export const alphaAlias = (input: unknown): unknown => {
  const a = (input as { a?: unknown }).a;
  return a === undefined ? 1 : a;
};

/**
 * Channel weights for mixing `a1`-alpha and `a2`-alpha colors at ratio `w`, the way CSS color-mix()
 * does it: premultiply each color by its alpha, interpolate, then divide by the mixed alpha.
 * Returns [k1, k2, alpha] so a channel mixes as `c1 * k1 + c2 * k2`. Opaque colors get (1 − w, w).
 * When the mixed alpha is 0 there is nothing to divide by, so the straight weights are kept.
 */
export const mixWeights = (a1: number, a2: number, w: number): [number, number, number] => {
  const p1 = a1 * (1 - w),
    p2 = a2 * w,
    alpha = p1 + p2;
  return alpha > 0 ? [p1 / alpha, p2 / alpha, alpha] : [1 - w, w, 0];
};

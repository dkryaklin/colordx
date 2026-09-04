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

export const isNumber = (n: unknown): n is number => typeof n === 'number' && !Number.isNaN(n) && Number.isFinite(n);

// Accepts any JS number type (including NaN/±Infinity); use sanitize() before clamping
export const isAnyNumber = (n: unknown): n is number => typeof n === 'number';

// Replace NaN with 0; ±Infinity is left for clamp() to handle naturally
export const sanitize = (n: number): number => (Number.isNaN(n) ? 0 : n);

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Must match JS regex `\s` exactly, since these scanners replace regexes:
// [\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]
export const isWs = (c: number): boolean => {
  if (c === 32 || (c >= 9 && c <= 13)) return true; // space, \t \n \v \f \r — the hot path
  if (c < 0xa0) return false;
  return (
    c === 0xa0 ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000 ||
    c === 0xfeff
  );
};

// Shared regex fragments. NUM matches a signed decimal, NUM_OR_NONE adds the CSS Color 4 `none` keyword.
// The alternation is deliberate: the shorter `\\d*\\.?\\d+` is ambiguous and backtracks
// quadratically on a long digit run that ultimately fails to match.
export const NUM = '[+-]?(?:\\d*\\.\\d+|\\d+)';
export const NUM_OR_NONE = `(?:none|${NUM})`;

/** Parse a CSS Color 4 channel token. `none` → 0; a plain number is returned as-is. */
export const parseNum = (v: string): number => (v.toLowerCase() === 'none' ? 0 : Number(v));

/** `none` check without a regex or a toLowerCase allocation. */
export const isNone = (v: string): boolean =>
  v.length === 4 &&
  (v.charCodeAt(0) | 32) === 110 &&
  (v.charCodeAt(1) | 32) === 111 &&
  (v.charCodeAt(2) | 32) === 110 &&
  (v.charCodeAt(3) | 32) === 101;

/** Clamp+round to a 0-255 byte, avoiding the generic round()'s `10 ** 0` per channel. */
export const toByte = (n: number): number => (n > 0 ? (n < 255 ? Math.round(n) : 255) : 0);

/** Clamp+round alpha to 3 decimals, likewise avoiding the generic round(). */
export const round3 = (n: number): number => (n > 0 ? (n < 1 ? Math.round(n * 1000) / 1000 : 1) : 0);

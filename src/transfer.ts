import type { RgbColor } from './types.js';

/**
 * sRGB / Display-P3 transfer function (IEC 61966-2-1), extended to the full real line.
 * For in-gamut values [0, 1] this is the standard curve.
 * Extended to negative values using the mirror of the power curve (not the linear piece),
 * matching the CSS Color 4 spec for out-of-gamut channels.
 */
export const srgbToLinear = (c: number): number => {
  const abs = Math.abs(c);
  const linear = abs <= 0.04045 ? abs / 12.92 : ((abs + 0.055) / 1.055) ** 2.4;
  return c < 0 ? -linear : linear;
};

/**
 * Linear → gamma-encoded sRGB (extended piecewise, per CSS Color 4).
 * For in-gamut values [0, 1] this is the standard IEC 61966-2-1 curve.
 * Extended to negative values using the mirror of the power curve (not the linear piece),
 * matching the CSS Color 4 spec and display-p3 behaviour for out-of-gamut channels.
 */
export const srgbFromLinear = (n: number): number => {
  const abs = Math.abs(n);
  const encoded = abs <= 0.0031308 ? 12.92 * abs : 1.055 * abs ** (1 / 2.4) - 0.055;
  return n < 0 ? -encoded : encoded;
};

/**
 * Largest magnitude a stored gamma-encoded ×255 channel may have. Unbounded channels (Lab a/b,
 * OKLab a/b, XYZ) are legitimately unclamped, so an absurd input (`lab(50 1e400 0)`,
 * `{ a: -1e308 }`) arrives as NaN, ±Infinity, or a finite 1e129 that overflows to Infinity in the
 * next matrix and prints NaN from every formatter. ~4000× sRGB white is far beyond any real color
 * space and small enough that every downstream transfer curve and matrix stays finite.
 */
const MAX_CHANNEL = 1e6;

/** Clamp a stored channel to ±MAX_CHANNEL; NaN reads as 0. The range test is false for all three. */
export const boundChannel = (n: number): number =>
  n >= -MAX_CHANNEL && n <= MAX_CHANNEL ? n : n > MAX_CHANNEL ? MAX_CHANNEL : n < -MAX_CHANNEL ? -MAX_CHANNEL : 0;

/**
 * Linear sRGB → the gamma-encoded ×255 form Colordx stores. Unclamped, so wide-gamut channels
 * outside [0, 255] survive to toP3() / mapSrgb() / inGamut*, but bounded (see MAX_CHANNEL).
 * Every wide-gamut parser ends here; the sRGB-bounded parsers clamp to [0, 255] themselves.
 */
export const linearToStoredRgb = (lr: number, lg: number, lb: number, alpha: number): RgbColor => ({
  r: boundChannel(srgbFromLinear(lr) * 255),
  g: boundChannel(srgbFromLinear(lg) * 255),
  b: boundChannel(srgbFromLinear(lb) * 255),
  alpha,
});

/**
 * Rec.2020 transfer function: a pure 2.4 power curve, the BT.1886 reference display EOTF with no
 * black lift. CSS Color 4 defines `rec2020` as display-referred this way (lin_2020 / gam_2020 in
 * conversions.js); earlier drafts used the BT.2020 camera OETF (α = 1.0993, exponent 0.45), which
 * encodes the same linear value up to 27/255 higher. Extended to the full real line (sign-preserving).
 */
export const rec2020ToLinear = (c: number): number => {
  const linear = Math.abs(c) ** 2.4;
  return c < 0 ? -linear : linear;
};

/** Linear → Rec.2020 gamma-encoded (the inverse 1/2.4 power). Sign-preserving. */
export const rec2020FromLinear = (n: number): number => {
  const encoded = Math.abs(n) ** (1 / 2.4);
  return n < 0 ? -encoded : encoded;
};

/**
 * A98 (Adobe RGB 1998) transfer function. A simple power curve with exponent 563/256,
 * no linear segment (CSS Color 4). Extended to the full real line (sign-preserving).
 */
export const a98ToLinear = (c: number): number => {
  const linear = Math.abs(c) ** (563 / 256);
  return c < 0 ? -linear : linear;
};

/** A98 linear → gamma-encoded (exponent 256/563). Extended to the full real line. */
export const a98FromLinear = (n: number): number => {
  const encoded = Math.abs(n) ** (256 / 563);
  return n < 0 ? -encoded : encoded;
};

/**
 * ProPhoto (ROMM RGB) transfer function: gamma 1.8 with a short linear toe below
 * 16/512 in the gamma-encoded domain (CSS Color 4). Extended to the full real line.
 */
export const prophotoToLinear = (c: number): number => {
  const abs = Math.abs(c);
  const linear = abs <= 16 / 512 ? abs / 16 : abs ** 1.8;
  return c < 0 ? -linear : linear;
};

/** ProPhoto linear → gamma-encoded (gamma 1/1.8 with a linear toe below 1/512). */
export const prophotoFromLinear = (n: number): number => {
  const abs = Math.abs(n);
  const encoded = abs >= 1 / 512 ? abs ** (1 / 1.8) : 16 * abs;
  return n < 0 ? -encoded : encoded;
};

// srgbToLinear(i / 255) for every byte, so the common integer-channel case skips the pow().
// Values are produced by the same function, so lookups are bit-identical to the direct call.
// Built on first use: a top-level initializer would survive tree-shaking in every bundle that
// touches this chunk, since the minified dist carries no #__PURE__ annotations.
let byteLin: Float64Array | undefined;
const buildByteLin = (): Float64Array => {
  const t = new Float64Array(256);
  for (let i = 0; i < 256; i++) t[i] = srgbToLinear(i / 255);
  return t;
};

/** srgbToLinear(n / 255), table-driven for integer n in [0, 255]. */
export const byteToLinear = (n: number): number =>
  (n & 255) === n ? (byteLin ??= buildByteLin())[n]! : srgbToLinear(n / 255);

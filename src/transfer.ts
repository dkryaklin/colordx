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

/** BT.2020 transfer function constants. */
export const REC2020_ALPHA = 1.09929682680944;
export const REC2020_BETA = 0.018053968510807;

/** BT.2020 gamma-encoded → linear. Extended to the full real line (sign-preserving). */
export const rec2020ToLinear = (c: number): number => {
  const abs = Math.abs(c);
  const linear = abs < REC2020_BETA * 4.5 ? abs / 4.5 : ((abs + REC2020_ALPHA - 1) / REC2020_ALPHA) ** (1 / 0.45);
  return c < 0 ? -linear : linear;
};

/** BT.2020 linear → gamma-encoded. Extended to the full real line (sign-preserving). */
export const rec2020FromLinear = (n: number): number => {
  const abs = Math.abs(n);
  const encoded = abs < REC2020_BETA ? 4.5 * abs : REC2020_ALPHA * abs ** 0.45 - (REC2020_ALPHA - 1);
  return n < 0 ? -encoded : encoded;
};

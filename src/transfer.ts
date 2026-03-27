/** sRGB / Display-P3 transfer function (IEC 61966-2-1). Input: 0–1 normalized float. */
export const srgbToLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export const srgbFromLinear = (n: number): number => (n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055);

/** BT.2020 transfer function constants. */
export const REC2020_ALPHA = 1.09929682680944;
export const REC2020_BETA = 0.018053968510807;

/** BT.2020 gamma-encoded → linear. Input: 0–1 normalized float. */
export const rec2020ToLinear = (c: number): number =>
  c < REC2020_BETA * 4.5 ? c / 4.5 : ((c + REC2020_ALPHA - 1) / REC2020_ALPHA) ** (1 / 0.45);

/** BT.2020 linear → gamma-encoded. Input: 0–1 linear float. */
export const rec2020FromLinear = (n: number): number =>
  n < REC2020_BETA ? 4.5 * n : REC2020_ALPHA * n ** 0.45 - (REC2020_ALPHA - 1);

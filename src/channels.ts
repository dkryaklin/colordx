import { oklabToLinear } from './colorModels/oklab.js';
import { oklabToLinearP3, srgbLinearToP3Linear } from './colorModels/p3.js';
import { oklabToLinearRec2020, srgbLinearToRec2020Linear } from './colorModels/rec2020.js';

const DEG_TO_RAD = Math.PI / 180;

// sRGB / Display-P3 transfer function (IEC 61966-2-1)
// Display-P3 uses the same gamma curve as sRGB — not DCI-P3 gamma 2.6.
const srgbFromLinear = (n: number): number => (n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055);

// BT.2020 transfer function (CSS Color 4 § 10.5)
const REC2020_ALPHA = 1.09929682680944;
const REC2020_BETA = 0.018053968510807;
const rec2020FromLinear = (n: number): number =>
  n < REC2020_BETA ? 4.5 * n : REC2020_ALPHA * n ** 0.45 - (REC2020_ALPHA - 1);

/**
 * Convert OKLCH to unclamped linear sRGB channels without object allocation.
 * This is the shared expensive step (OKLCH → OKLab → linear sRGB via 3× cbrt + matrix).
 * Use this when you need multiple color spaces from the same color — compute once,
 * then pass to linearToP3Channels / linearToRec2020Channels to avoid duplicate work.
 *
 * In-gamut sRGB colors have all channels in [0, 1]. Channels outside this range
 * indicate an out-of-gamut color — use as a free gamut check.
 */
export const oklchToLinear = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return oklabToLinear(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/**
 * Convert linear sRGB channels (from oklchToLinear) to gamma-encoded Display-P3 channels.
 * This is the cheap step — only a matrix multiply + gamma encoding, no cbrt.
 * Pair with oklchToLinear to convert one OKLCH color to multiple spaces without
 * repeating the expensive OKLab pipeline.
 */
export const linearToP3Channels = (lr: number, lg: number, lb: number): [number, number, number] => {
  const [r, g, b] = srgbLinearToP3Linear(lr, lg, lb);
  return [srgbFromLinear(r), srgbFromLinear(g), srgbFromLinear(b)];
};

/**
 * Convert linear sRGB channels (from oklchToLinear) to gamma-encoded Rec.2020 channels.
 * This is the cheap step — only a matrix multiply + BT.2020 gamma, no cbrt.
 */
export const linearToRec2020Channels = (lr: number, lg: number, lb: number): [number, number, number] => {
  const [r, g, b] = srgbLinearToRec2020Linear(lr, lg, lb);
  return [rec2020FromLinear(r), rec2020FromLinear(g), rec2020FromLinear(b)];
};

/**
 * Convert OKLCH to gamma-encoded sRGB channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors. Out-of-gamut channels may
 * exceed this range — callers are responsible for clamping before byte encoding.
 */
export const oklchToRgbChannels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  const [r, g, b] = oklabToLinear(l, c * Math.cos(hRad), c * Math.sin(hRad));
  return [srgbFromLinear(r), srgbFromLinear(g), srgbFromLinear(b)];
};

/**
 * Convert OKLCH to gamma-encoded Display-P3 channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors. Out-of-gamut channels may
 * exceed this range — callers are responsible for clamping before byte encoding.
 * Uses the sRGB transfer function (P3 does not use DCI-P3 gamma 2.6).
 */
export const oklchToP3Channels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  const [r, g, b] = oklabToLinearP3(l, c * Math.cos(hRad), c * Math.sin(hRad));
  return [srgbFromLinear(r), srgbFromLinear(g), srgbFromLinear(b)];
};

/**
 * Convert OKLCH to gamma-encoded Rec.2020 channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors. Out-of-gamut channels may
 * exceed this range — callers are responsible for clamping before byte encoding.
 * Uses the BT.2020 transfer function (exponent 0.45, distinct from sRGB 1/2.4).
 */
export const oklchToRec2020Channels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  const [r, g, b] = oklabToLinearRec2020(l, c * Math.cos(hRad), c * Math.sin(hRad));
  return [rec2020FromLinear(r), rec2020FromLinear(g), rec2020FromLinear(b)];
};

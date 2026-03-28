import { oklabToLinear } from './colorModels/oklab.js';
import { srgbFromLinear } from './transfer.js';

const DEG_TO_RAD = Math.PI / 180;

/**
 * Convert OKLCH to unclamped linear sRGB channels without object allocation.
 * This is the shared expensive step (OKLCH → OKLab → linear sRGB via 3× cbrt + matrix).
 * Use this when you need multiple color spaces from the same color — compute once,
 * then pass to linearToP3Channels / linearToRec2020Channels (from their plugins) to avoid duplicate work.
 *
 * In-gamut sRGB colors have all channels in [0, 1]. Channels outside this range
 * indicate an out-of-gamut color — use as a free gamut check.
 */
export const oklchToLinear = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return oklabToLinear(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/**
 * Convert OKLCH to gamma-encoded sRGB channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors. Out-of-gamut channels may
 * exceed this range — callers are responsible for clamping before byte encoding.
 */
export const oklchToRgbChannels = (l: number, c: number, h: number): [number, number, number] => {
  const [r, g, b] = oklchToLinear(l, c, h);
  return [srgbFromLinear(r), srgbFromLinear(g), srgbFromLinear(b)];
};

/**
 * Convert OKLCH to both linear and gamma-encoded sRGB channels in a single pass.
 * Avoids recomputing the expensive OKLCH → OKLab → linear step when you need both.
 *
 * Linear channels are useful for gamut checks (all in [0,1] = in sRGB gamut)
 * and as input to P3/Rec2020 conversion matrices.
 * Gamma channels are ready for display on an sRGB canvas (still need clamping for out-of-gamut).
 *
 * Returns [[lr, lg, lb], [sr, sg, sb]] — both in [0, 1] for in-gamut colors.
 */
export const oklchToLinearAndSrgb = (
  l: number,
  c: number,
  h: number
): [[number, number, number], [number, number, number]] => {
  const [lr, lg, lb] = oklchToLinear(l, c, h);
  return [
    [lr, lg, lb],
    [srgbFromLinear(lr), srgbFromLinear(lg), srgbFromLinear(lb)],
  ];
};

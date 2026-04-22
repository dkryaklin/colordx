import { labToXyzValues, labToXyzValuesInto } from './colorModels/lab.js';
import { oklabToLinear, oklabToLinearInto } from './colorModels/oklab.js';
import { xyzD50ToLinearSrgb, xyzD50ToLinearSrgbInto } from './colorModels/xyz.js';
import { srgbFromLinear, srgbToLinear } from './transfer.js';

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

/** Zero-allocation sibling of oklchToLinear — writes [lr, lg, lb] into `out`. */
export const oklchToLinearInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  oklabToLinearInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
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

/** Zero-allocation sibling of oklchToRgbChannels — writes [r, g, b] (gamma-encoded, 0–1) into `out`. */
export const oklchToRgbChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  oklchToLinearInto(out, l, c, h);
  out[0] = srgbFromLinear(out[0]!);
  out[1] = srgbFromLinear(out[1]!);
  out[2] = srgbFromLinear(out[2]!);
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

/**
 * Zero-allocation sibling of oklchToLinearAndSrgb — writes linear channels into `linOut`
 * and gamma-encoded sRGB channels into `srgbOut`. The two buffers must be distinct.
 */
export const oklchToLinearAndSrgbInto = (
  linOut: Float64Array | number[],
  srgbOut: Float64Array | number[],
  l: number,
  c: number,
  h: number
): void => {
  oklchToLinearInto(linOut, l, c, h);
  srgbOut[0] = srgbFromLinear(linOut[0]!);
  srgbOut[1] = srgbFromLinear(linOut[1]!);
  srgbOut[2] = srgbFromLinear(linOut[2]!);
};

/**
 * Gamma-encoded sRGB (0–1) → linear sRGB (0–1). Vector sibling of `srgbToLinear`.
 * For byte-scale RGB, pass `r/255, g/255, b/255`. Output range tracks input:
 * channels outside [0, 1] are preserved with the CSS Color 4 extended transfer curve.
 */
export const rgbToLinear = (r: number, g: number, b: number): [number, number, number] => [
  srgbToLinear(r),
  srgbToLinear(g),
  srgbToLinear(b),
];

/** Zero-allocation sibling of rgbToLinear — writes [lr, lg, lb] into `out`. */
export const rgbToLinearInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = srgbToLinear(r);
  out[1] = srgbToLinear(g);
  out[2] = srgbToLinear(b);
};

/**
 * CIE Lab (D50) → unclamped linear sRGB (0–1). Goes via XYZ D50 with Bradford adaptation.
 * L in [0, 100]; a/b typically in [-128, 128]. Out-of-sRGB-gamut colors return channels
 * outside [0, 1] — use as a free gamut check or pass to `srgbFromLinear` for display.
 */
export const labToLinearSrgb = (l: number, a: number, b: number): [number, number, number] => {
  const [x, y, z] = labToXyzValues(l, a, b);
  return xyzD50ToLinearSrgb(x, y, z);
};

/** Zero-allocation sibling of labToLinearSrgb — writes [lr, lg, lb] into `out`. */
export const labToLinearSrgbInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  labToXyzValuesInto(out, l, a, b);
  xyzD50ToLinearSrgbInto(out, out[0]!, out[1]!, out[2]!);
};

/**
 * CIE LCH (D50) → unclamped linear sRGB (0–1). Polar-to-rectangular to Lab, then Lab → linear sRGB.
 * L in [0, 100]; C is the chroma (0–~150); H in degrees. Out-of-gamut colors return channels
 * outside [0, 1] — useful in LCH render hot paths where you want linear pixels and a gamut check in one step.
 */
export const lchToLinearSrgb = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToLinearSrgb(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of lchToLinearSrgb — writes [lr, lg, lb] into `out`. */
export const lchToLinearSrgbInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToLinearSrgbInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/**
 * CIE Lab (D50) → gamma-encoded sRGB (0–1). Convenience wrapper over `labToLinearSrgb` + `srgbFromLinear`.
 * In-gamut colors return channels in [0, 1]; out-of-gamut channels may exceed this range — clamp before byte encoding.
 */
export const labToRgbChannels = (l: number, a: number, b: number): [number, number, number] => {
  const [lr, lg, lb] = labToLinearSrgb(l, a, b);
  return [srgbFromLinear(lr), srgbFromLinear(lg), srgbFromLinear(lb)];
};

/** Zero-allocation sibling of labToRgbChannels — writes [r, g, b] (gamma-encoded, 0–1) into `out`. */
export const labToRgbChannelsInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  labToLinearSrgbInto(out, l, a, b);
  out[0] = srgbFromLinear(out[0]!);
  out[1] = srgbFromLinear(out[1]!);
  out[2] = srgbFromLinear(out[2]!);
};

/**
 * CIE LCH (D50) → gamma-encoded sRGB (0–1). Polar-to-rectangular to Lab, then Lab → gamma sRGB.
 * In-gamut colors return channels in [0, 1]; out-of-gamut channels may exceed this range.
 */
export const lchToRgbChannels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToRgbChannels(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of lchToRgbChannels — writes [r, g, b] (gamma-encoded, 0–1) into `out`. */
export const lchToRgbChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToRgbChannelsInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/**
 * CIE Lab (D50) → both linear and gamma-encoded sRGB in a single pass.
 * Avoids recomputing Lab → XYZ D50 → linear sRGB when you need both (e.g. gamut check + pixel).
 * Returns [[lr, lg, lb], [sr, sg, sb]].
 */
export const labToLinearAndSrgb = (
  l: number,
  a: number,
  b: number
): [[number, number, number], [number, number, number]] => {
  const [lr, lg, lb] = labToLinearSrgb(l, a, b);
  return [
    [lr, lg, lb],
    [srgbFromLinear(lr), srgbFromLinear(lg), srgbFromLinear(lb)],
  ];
};

/**
 * Zero-allocation sibling of labToLinearAndSrgb — writes linear channels into `linOut`
 * and gamma-encoded sRGB channels into `srgbOut`. The two buffers must be distinct.
 */
export const labToLinearAndSrgbInto = (
  linOut: Float64Array | number[],
  srgbOut: Float64Array | number[],
  l: number,
  a: number,
  b: number
): void => {
  labToLinearSrgbInto(linOut, l, a, b);
  srgbOut[0] = srgbFromLinear(linOut[0]!);
  srgbOut[1] = srgbFromLinear(linOut[1]!);
  srgbOut[2] = srgbFromLinear(linOut[2]!);
};

/**
 * CIE LCH (D50) → both linear and gamma-encoded sRGB in a single pass.
 * Polar-to-rectangular to Lab, then Lab → linear + gamma sRGB. Returns [[lr, lg, lb], [sr, sg, sb]].
 */
export const lchToLinearAndSrgb = (
  l: number,
  c: number,
  h: number
): [[number, number, number], [number, number, number]] => {
  const hRad = h * DEG_TO_RAD;
  return labToLinearAndSrgb(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of lchToLinearAndSrgb — same buffer rules as labToLinearAndSrgbInto. */
export const lchToLinearAndSrgbInto = (
  linOut: Float64Array | number[],
  srgbOut: Float64Array | number[],
  l: number,
  c: number,
  h: number
): void => {
  const hRad = h * DEG_TO_RAD;
  labToLinearAndSrgbInto(linOut, srgbOut, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

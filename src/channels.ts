import { labToXyzValues, labToXyzValuesInto } from './colorModels/lab.js';
import { oklabToLinear, oklabToLinearInto } from './colorModels/oklab.js';
import { xyzD50ToLinearSrgb, xyzD50ToLinearSrgbInto } from './colorModels/xyz.js';
import { srgbFromLinear, srgbToLinear } from './transfer.js';

const DEG_TO_RAD = Math.PI / 180;

/**
 * OKLCh → unclamped linear sRGB. Returns `[r, g, b]`.
 * Channels in [0, 1] mean the color is in-gamut sRGB; outside means out-of-gamut.
 */
export const oklchToLinear = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return oklabToLinear(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of `oklchToLinear` — writes `[lr, lg, lb]` into `out`. */
export const oklchToLinearInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  oklabToLinearInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/**
 * OKLCh → gamma-encoded sRGB (0–1). Returns `[r, g, b]`.
 * Out-of-gamut channels may exceed [0, 1]; clamp before byte encoding.
 */
export const oklchToRgbChannels = (l: number, c: number, h: number): [number, number, number] => {
  const [r, g, b] = oklchToLinear(l, c, h);
  return [srgbFromLinear(r), srgbFromLinear(g), srgbFromLinear(b)];
};

/** Zero-allocation sibling of `oklchToRgbChannels` — writes `[r, g, b]` into `out`. */
export const oklchToRgbChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  oklchToLinearInto(out, l, c, h);
  out[0] = srgbFromLinear(out[0]!);
  out[1] = srgbFromLinear(out[1]!);
  out[2] = srgbFromLinear(out[2]!);
};

/**
 * OKLCh → both linear and gamma-encoded sRGB in one pass. Returns `[[lr, lg, lb], [sr, sg, sb]]`.
 * Use when you need both — saves a duplicate OKLCh → OKLab → linear step.
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
 * Zero-allocation sibling of `oklchToLinearAndSrgb`.
 * Writes linear channels into `linOut`, gamma-encoded into `srgbOut`. Buffers must be distinct.
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
 * Gamma-encoded sRGB (0–1) → linear sRGB. Returns `[lr, lg, lb]`.
 * For byte-scale RGB, pass `r/255, g/255, b/255`.
 */
export const rgbToLinear = (r: number, g: number, b: number): [number, number, number] => [
  srgbToLinear(r),
  srgbToLinear(g),
  srgbToLinear(b),
];

/** Zero-allocation sibling of `rgbToLinear` — writes `[lr, lg, lb]` into `out`. */
export const rgbToLinearInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = srgbToLinear(r);
  out[1] = srgbToLinear(g);
  out[2] = srgbToLinear(b);
};

/**
 * CIE Lab (D50) → unclamped linear sRGB. Returns `[lr, lg, lb]`.
 * L in [0, 100]; a/b roughly in [-128, 128]. Out-of-gamut channels fall outside [0, 1].
 */
export const labToLinearSrgb = (l: number, a: number, b: number): [number, number, number] => {
  const [x, y, z] = labToXyzValues(l, a, b);
  return xyzD50ToLinearSrgb(x, y, z);
};

/** Zero-allocation sibling of `labToLinearSrgb` — writes `[lr, lg, lb]` into `out`. */
export const labToLinearSrgbInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  labToXyzValuesInto(out, l, a, b);
  xyzD50ToLinearSrgbInto(out, out[0]!, out[1]!, out[2]!);
};

/**
 * CIE LCh (D50) → unclamped linear sRGB. Returns `[lr, lg, lb]`.
 * L in [0, 100]; C in [0, ~150]; H in degrees. Out-of-gamut channels fall outside [0, 1].
 */
export const lchToLinearSrgb = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToLinearSrgb(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of `lchToLinearSrgb` — writes `[lr, lg, lb]` into `out`. */
export const lchToLinearSrgbInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToLinearSrgbInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/**
 * CIE Lab (D50) → gamma-encoded sRGB (0–1). Returns `[r, g, b]`.
 * Out-of-gamut channels may exceed [0, 1]; clamp before byte encoding.
 */
export const labToRgbChannels = (l: number, a: number, b: number): [number, number, number] => {
  const [lr, lg, lb] = labToLinearSrgb(l, a, b);
  return [srgbFromLinear(lr), srgbFromLinear(lg), srgbFromLinear(lb)];
};

/** Zero-allocation sibling of `labToRgbChannels` — writes `[r, g, b]` into `out`. */
export const labToRgbChannelsInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  labToLinearSrgbInto(out, l, a, b);
  out[0] = srgbFromLinear(out[0]!);
  out[1] = srgbFromLinear(out[1]!);
  out[2] = srgbFromLinear(out[2]!);
};

/**
 * CIE LCh (D50) → gamma-encoded sRGB (0–1). Returns `[r, g, b]`.
 * Out-of-gamut channels may exceed [0, 1]; clamp before byte encoding.
 */
export const lchToRgbChannels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToRgbChannels(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of `lchToRgbChannels` — writes `[r, g, b]` into `out`. */
export const lchToRgbChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToRgbChannelsInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/**
 * CIE Lab (D50) → both linear and gamma-encoded sRGB in one pass.
 * Returns `[[lr, lg, lb], [sr, sg, sb]]`.
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
 * Zero-allocation sibling of `labToLinearAndSrgb`.
 * Writes linear channels into `linOut`, gamma-encoded into `srgbOut`. Buffers must be distinct.
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
 * CIE LCh (D50) → both linear and gamma-encoded sRGB in one pass.
 * Returns `[[lr, lg, lb], [sr, sg, sb]]`.
 */
export const lchToLinearAndSrgb = (
  l: number,
  c: number,
  h: number
): [[number, number, number], [number, number, number]] => {
  const hRad = h * DEG_TO_RAD;
  return labToLinearAndSrgb(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/**
 * Zero-allocation sibling of `lchToLinearAndSrgb`.
 * Writes linear channels into `linOut`, gamma-encoded into `srgbOut`. Buffers must be distinct.
 */
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

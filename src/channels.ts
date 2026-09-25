import { labToXyzValues, labToXyzValuesInto } from './colorModels/lab.js';
import { oklabToLinear, oklabToLinearInto } from './colorModels/oklab.js';
import { xyzD50ToLinearSrgb, xyzD50ToLinearSrgbInto } from './colorModels/xyz.js';
import { srgbFromLinear, srgbToLinear } from './transfer.js';

const DEG_TO_RAD = Math.PI / 180;

/** OKLCh → unclamped linear sRGB `[r, g, b]`. Channels outside [0, 1] are out of gamut. */
export const oklchToLinear = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return oklabToLinear(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of `oklchToLinear` — writes `[lr, lg, lb]` into `out`. */
export const oklchToLinearInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  oklabToLinearInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** OKLCh → gamma sRGB `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
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

/** OKLCh → `[[lr, lg, lb], [r, g, b]]`, linear and gamma sRGB in one pass. */
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

/** Zero-allocation sibling of `oklchToLinearAndSrgb`. `linOut` and `srgbOut` must be distinct. */
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

/** Gamma sRGB in 0–1 → linear sRGB `[r, g, b]`. */
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

/** CIE Lab (D50) → unclamped linear sRGB `[r, g, b]`. Channels outside [0, 1] are out of gamut. */
export const labToLinearSrgb = (l: number, a: number, b: number): [number, number, number] => {
  const [x, y, z] = labToXyzValues(l, a, b);
  return xyzD50ToLinearSrgb(x, y, z);
};

/** Zero-allocation sibling of `labToLinearSrgb` — writes `[lr, lg, lb]` into `out`. */
export const labToLinearSrgbInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  labToXyzValuesInto(out, l, a, b);
  xyzD50ToLinearSrgbInto(out, out[0]!, out[1]!, out[2]!);
};

/** CIE LCh (D50) → unclamped linear sRGB `[r, g, b]`. Channels outside [0, 1] are out of gamut. */
export const lchToLinearSrgb = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToLinearSrgb(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of `lchToLinearSrgb` — writes `[lr, lg, lb]` into `out`. */
export const lchToLinearSrgbInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToLinearSrgbInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** CIE Lab (D50) → gamma sRGB `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
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

/** CIE LCh (D50) → gamma sRGB `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
export const lchToRgbChannels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToRgbChannels(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of `lchToRgbChannels` — writes `[r, g, b]` into `out`. */
export const lchToRgbChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToRgbChannelsInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** CIE Lab (D50) → `[[lr, lg, lb], [r, g, b]]`, linear and gamma sRGB in one pass. */
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

/** Zero-allocation sibling of `labToLinearAndSrgb`. `linOut` and `srgbOut` must be distinct. */
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

/** CIE LCh (D50) → `[[lr, lg, lb], [r, g, b]]`, linear and gamma sRGB in one pass. */
export const lchToLinearAndSrgb = (
  l: number,
  c: number,
  h: number
): [[number, number, number], [number, number, number]] => {
  const hRad = h * DEG_TO_RAD;
  return labToLinearAndSrgb(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of `lchToLinearAndSrgb`. `linOut` and `srgbOut` must be distinct. */
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

// Each color space exposes two types:
//   - XxxColor:       canonical output shape. alpha is always present (the library
//                     always writes it), so consumers of toRgb() / toOklch() / etc.
//                     never need `?? 1` fallbacks.
//   - XxxColorInput:  input shape. alpha is optional and defaults to 1 at parse
//                     time, matching the runtime parsers. Use this for function
//                     parameters that accept user-supplied color objects.
// AnyColor below is the union of the *Input* types, since it's always used as
// an input contract for colordx(), parse(), mix(), etc.

export interface RgbColor {
  r: number;
  g: number;
  b: number;
  alpha: number;
}
export type RgbColorInput = Omit<RgbColor, 'alpha'> & { alpha?: number };

export interface HslColor {
  h: number;
  s: number;
  l: number;
  alpha: number;
}
export type HslColorInput = Omit<HslColor, 'alpha'> & { alpha?: number };

export interface HsvColor {
  h: number;
  s: number;
  v: number;
  alpha: number;
}
export type HsvColorInput = Omit<HsvColor, 'alpha'> & { alpha?: number };

export interface HwbColor {
  h: number;
  /** Whiteness [0, 100] */
  w: number;
  /** Blackness [0, 100] */
  b: number;
  alpha: number;
}
export type HwbColorInput = Omit<HwbColor, 'alpha'> & { alpha?: number };

/** CIE LAB (D50) */
export interface LabColor {
  l: number;
  /** Green–red axis */
  a: number;
  /** Blue–yellow axis */
  b: number;
  alpha: number;
  readonly colorSpace: 'lab';
}
export type LabColorInput = Omit<LabColor, 'alpha'> & { alpha?: number };

/** CIE LCH (D50) */
export interface LchColor {
  l: number;
  c: number;
  h: number;
  alpha: number;
  readonly colorSpace: 'lch';
}
export type LchColorInput = Omit<LchColor, 'alpha'> & { alpha?: number };

/** CIE XYZ (D50) */
export interface XyzColor {
  x: number;
  y: number;
  z: number;
  alpha: number;
}
export type XyzColorInput = Omit<XyzColor, 'alpha'> & { alpha?: number };

/** CIE XYZ (D65) */
export interface XyzD65Color {
  x: number;
  y: number;
  z: number;
  alpha: number;
  readonly colorSpace: 'xyz-d65';
}
type XyzD65ColorInput = Omit<XyzD65Color, 'alpha'> & { alpha?: number };

export interface CmykColor {
  c: number;
  m: number;
  y: number;
  k: number;
  alpha: number;
}
export type CmykColorInput = Omit<CmykColor, 'alpha'> & { alpha?: number };

/** Oklab — perceptually uniform, D65 */
export interface OklabColor {
  l: number;
  /** Green–red axis */
  a: number;
  /** Blue–yellow axis */
  b: number;
  alpha: number;
}
export type OklabColorInput = Omit<OklabColor, 'alpha'> & { alpha?: number };

/** Oklch — perceptually uniform, polar form of Oklab */
export interface OklchColor {
  l: number;
  c: number;
  h: number;
  alpha: number;
}
export type OklchColorInput = Omit<OklchColor, 'alpha'> & { alpha?: number };

/** CSS Color 4 Display-P3 */
export interface P3Color {
  r: number;
  g: number;
  b: number;
  alpha: number;
  readonly colorSpace: 'display-p3';
}
export type P3ColorInput = Omit<P3Color, 'alpha'> & { alpha?: number };

/** CSS Color 4 Rec.2020 */
export interface Rec2020Color {
  r: number;
  g: number;
  b: number;
  alpha: number;
  readonly colorSpace: 'rec2020';
}
export type Rec2020ColorInput = Omit<Rec2020Color, 'alpha'> & { alpha?: number };

export type AnyColor =
  | string
  | RgbColorInput
  | HslColorInput
  | HsvColorInput
  | HwbColorInput
  | LabColorInput
  | LchColorInput
  | XyzColorInput
  | XyzD65ColorInput
  | CmykColorInput
  | OklabColorInput
  | OklchColorInput
  | P3ColorInput
  | Rec2020ColorInput;

export type ColorParser<T = AnyColor> = (input: T) => RgbColor | null;

export type ColorFormat =
  | 'hex'
  | 'rgb'
  | 'hsl'
  | 'hsv'
  | 'hwb'
  | 'oklab'
  | 'oklch'
  | 'lab'
  | 'lch'
  | 'xyz'
  | 'xyz-d65'
  | 'cmyk'
  | 'p3'
  | 'rec2020'
  | 'name';

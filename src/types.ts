// Each color space exposes two types:
//   - XxxColor:      output shape. `alpha` is always present, so consumers of
//                    toRgb() / toOklch() / etc. never need `?? 1` fallbacks.
//   - XxxColorInput: input shape. `alpha` is optional and defaults to 1.
// AnyColor is the union of the *Input* types — it's the input contract for
// colordx(), parse(), mix(), etc.

/** sRGB color. r, g, b in [0, 255]; alpha in [0, 1]. */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
  alpha: number;
}
/** Input shape of `RgbColor` — `alpha` is optional and defaults to 1. */
export type RgbColorInput = Omit<RgbColor, 'alpha'> & { alpha?: number };

/** HSL color. h in [0, 360); s, l in [0, 100]; alpha in [0, 1]. */
export interface HslColor {
  h: number;
  s: number;
  l: number;
  alpha: number;
}
/** Input shape of `HslColor` — `alpha` is optional and defaults to 1. */
export type HslColorInput = Omit<HslColor, 'alpha'> & { alpha?: number };

/** HSV color. h in [0, 360); s, v in [0, 100]; alpha in [0, 1]. */
export interface HsvColor {
  h: number;
  s: number;
  v: number;
  alpha: number;
}
/** Input shape of `HsvColor` — `alpha` is optional and defaults to 1. */
export type HsvColorInput = Omit<HsvColor, 'alpha'> & { alpha?: number };

/** HWB color. h in [0, 360); w, b in [0, 100]; alpha in [0, 1]. */
export interface HwbColor {
  h: number;
  /** Whiteness [0, 100]. */
  w: number;
  /** Blackness [0, 100]. */
  b: number;
  alpha: number;
}
/** Input shape of `HwbColor` — `alpha` is optional and defaults to 1. */
export type HwbColorInput = Omit<HwbColor, 'alpha'> & { alpha?: number };

/** CIE Lab (D50). L in [0, 100]; a, b roughly in [-128, 128]. */
export interface LabColor {
  l: number;
  /** Green–red axis. */
  a: number;
  /** Blue–yellow axis. */
  b: number;
  alpha: number;
  readonly colorSpace: 'lab';
}
/** Input shape of `LabColor` — `alpha` is optional and defaults to 1. */
export type LabColorInput = Omit<LabColor, 'alpha'> & { alpha?: number };

/** CIE LCh (D50). L in [0, 100]; C in [0, ~150]; h in degrees. */
export interface LchColor {
  l: number;
  c: number;
  h: number;
  alpha: number;
  readonly colorSpace: 'lch';
}
/** Input shape of `LchColor` — `alpha` is optional and defaults to 1. */
export type LchColorInput = Omit<LchColor, 'alpha'> & { alpha?: number };

/** CIE XYZ (D50). x, y, z on the library's 0–100 scale. */
export interface XyzColor {
  x: number;
  y: number;
  z: number;
  alpha: number;
}
/** Input shape of `XyzColor` — `alpha` is optional and defaults to 1. */
export type XyzColorInput = Omit<XyzColor, 'alpha'> & { alpha?: number };

/** CIE XYZ (D65). x, y, z on the library's 0–100 scale. */
export interface XyzD65Color {
  x: number;
  y: number;
  z: number;
  alpha: number;
  readonly colorSpace: 'xyz-d65';
}
type XyzD65ColorInput = Omit<XyzD65Color, 'alpha'> & { alpha?: number };

/** CMYK color. c, m, y, k in [0, 100]; alpha in [0, 1]. */
export interface CmykColor {
  c: number;
  m: number;
  y: number;
  k: number;
  alpha: number;
}
/** Input shape of `CmykColor` — `alpha` is optional and defaults to 1. */
export type CmykColorInput = Omit<CmykColor, 'alpha'> & { alpha?: number };

/** OKLab. Perceptually uniform (D65). L in [0, 1]; a, b roughly in [-0.4, 0.4]. */
export interface OklabColor {
  l: number;
  /** Green–red axis. */
  a: number;
  /** Blue–yellow axis. */
  b: number;
  alpha: number;
}
/** Input shape of `OklabColor` — `alpha` is optional and defaults to 1. */
export type OklabColorInput = Omit<OklabColor, 'alpha'> & { alpha?: number };

/** OKLCh. Polar form of OKLab. L in [0, 1]; C in [0, ~0.4]; h in degrees. */
export interface OklchColor {
  l: number;
  c: number;
  h: number;
  alpha: number;
}
/** Input shape of `OklchColor` — `alpha` is optional and defaults to 1. */
export type OklchColorInput = Omit<OklchColor, 'alpha'> & { alpha?: number };

/** CSS Color 4 Display-P3. r, g, b in [0, 1]. */
export interface P3Color {
  r: number;
  g: number;
  b: number;
  alpha: number;
  readonly colorSpace: 'display-p3';
}
/** Input shape of `P3Color` — `alpha` is optional and defaults to 1. */
export type P3ColorInput = Omit<P3Color, 'alpha'> & { alpha?: number };

/** CSS Color 4 Rec.2020. r, g, b in [0, 1]. */
export interface Rec2020Color {
  r: number;
  g: number;
  b: number;
  alpha: number;
  readonly colorSpace: 'rec2020';
}
/** Input shape of `Rec2020Color` — `alpha` is optional and defaults to 1. */
export type Rec2020ColorInput = Omit<Rec2020Color, 'alpha'> & { alpha?: number };

/** Any color input accepted by `colordx()` and friends — a CSS string or one of the input objects. */
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

/** A parser registered by a plugin. Returns the sRGB equivalent or `null` if the input doesn't match. */
export type ColorParser<T = AnyColor> = (input: T) => RgbColor | null;

/** Format tags returned by `getFormat()`. */
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

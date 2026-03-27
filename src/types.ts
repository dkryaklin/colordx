export interface RgbColor {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
  alpha: number;
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
  alpha: number;
}

export interface HwbColor {
  h: number;
  /** Whiteness [0, 100] */
  w: number;
  /** Blackness [0, 100] */
  b: number;
  alpha: number;
}

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

/** CIE LCH (D50) */
export interface LchColor {
  l: number;
  c: number;
  h: number;
  alpha: number;
  readonly colorSpace: 'lch';
}

/** CIE XYZ (D65) */
export interface XyzColor {
  x: number;
  y: number;
  z: number;
  alpha: number;
}

export interface CmykColor {
  c: number;
  m: number;
  y: number;
  k: number;
  alpha: number;
}

/** Oklab — perceptually uniform, D65 */
export interface OklabColor {
  l: number;
  /** Green–red axis */
  a: number;
  /** Blue–yellow axis */
  b: number;
  alpha: number;
}

/** Oklch — perceptually uniform, polar form of Oklab */
export interface OklchColor {
  l: number;
  c: number;
  h: number;
  alpha: number;
}

/** CSS Color 4 Display-P3 */
export interface P3Color {
  r: number;
  g: number;
  b: number;
  alpha: number;
  readonly colorSpace: 'display-p3';
}

/** CSS Color 4 Rec.2020 */
export interface Rec2020Color {
  r: number;
  g: number;
  b: number;
  alpha: number;
  readonly colorSpace: 'rec2020';
}

export type AnyColor =
  | string
  | RgbColor
  | HslColor
  | HsvColor
  | HwbColor
  | LabColor
  | LchColor
  | XyzColor
  | CmykColor
  | OklabColor
  | OklchColor
  | P3Color
  | Rec2020Color;

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
  | 'cmyk'
  | 'p3'
  | 'rec2020'
  | 'name';

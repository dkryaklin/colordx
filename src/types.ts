export interface RgbColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
  a: number;
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
  a: number;
}

export interface HwbColor {
  h: number;
  w: number;
  b: number;
  a: number;
}

/** CIE LAB (D50) */
export interface LabColor {
  l: number;
  a: number;
  b: number;
  alpha: number;
}

/** CIE LCH (D50) */
export interface LchColor {
  l: number;
  c: number;
  h: number;
  a: number;
}

/** CIE XYZ (D65) */
export interface XyzColor {
  x: number;
  y: number;
  z: number;
  a: number;
}

export interface CmykColor {
  c: number;
  m: number;
  y: number;
  k: number;
  a: number;
}

/** Oklab — perceptually uniform, D65 */
export interface OklabColor {
  l: number;
  a: number;
  b: number;
  alpha: number;
}

/** Oklch — perceptually uniform, polar form of Oklab */
export interface OklchColor {
  l: number;
  c: number;
  h: number;
  a: number;
}

/** CSS Color 4 Display-P3 */
export interface P3Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** CSS Color 4 Rec.2020 */
export interface Rec2020Color {
  r: number;
  g: number;
  b: number;
  a: number;
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

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'hsv' | 'hwb' | 'lab' | 'lch' | 'xyz' | 'cmyk' | 'name';

import { labToLinearSrgb, labToLinearSrgbInto, oklchToLinear, oklchToLinearInto } from '../channels.js';
import { linearSrgbToOklab } from '../colorModels/oklab.js';
import {
  linearP3ToSrgb,
  oklabToLinearP3,
  parseP3Object,
  parseP3String,
  rgbToP3Raw,
  srgbLinearToP3Linear,
  srgbLinearToP3LinearInto,
} from '../colorModels/p3.js';
import type { Plugin } from '../colordx.js';
import { inGamutCustom, toGamutCustom } from '../gamut.js';
import { round } from '../helpers.js';
import { srgbFromLinear } from '../transfer.js';
import type { AnyColor, P3Color } from '../types.js';

const p3FromLinear = (r: number, g: number, b: number): [number, number, number] =>
  linearSrgbToOklab(...linearP3ToSrgb(r, g, b));

declare module '@colordx/core' {
  interface Colordx {
    toP3(precision?: number): P3Color;
    toP3String(precision?: number): string;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Colordx {
    function toGamutP3(input: AnyColor): Colordx;
  }
}

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

/** Zero-allocation sibling of linearToP3Channels — writes [pr, pg, pb] (gamma-encoded, 0–1) into `out`. */
export const linearToP3ChannelsInto = (out: Float64Array | number[], lr: number, lg: number, lb: number): void => {
  srgbLinearToP3LinearInto(out, lr, lg, lb);
  out[0] = srgbFromLinear(out[0]!);
  out[1] = srgbFromLinear(out[1]!);
  out[2] = srgbFromLinear(out[2]!);
};

/**
 * Convert OKLCH to gamma-encoded Display-P3 channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors. Out-of-gamut channels may
 * exceed this range — callers are responsible for clamping before byte encoding.
 * Uses the sRGB transfer function (P3 does not use DCI-P3 gamma 2.6).
 */
export const oklchToP3Channels = (l: number, c: number, h: number): [number, number, number] =>
  linearToP3Channels(...oklchToLinear(l, c, h));

/** Zero-allocation sibling of oklchToP3Channels — writes [pr, pg, pb] into `out`. */
export const oklchToP3ChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  oklchToLinearInto(out, l, c, h);
  linearToP3ChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

const DEG_TO_RAD = Math.PI / 180;

/**
 * Convert CIE Lab (D50) to gamma-encoded Display-P3 channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors. Out-of-gamut channels may exceed [0, 1].
 * Goes Lab → XYZ D50 → linear sRGB → linear P3 → gamma P3.
 */
export const labToP3Channels = (l: number, a: number, b: number): [number, number, number] =>
  linearToP3Channels(...labToLinearSrgb(l, a, b));

/** Zero-allocation sibling of labToP3Channels — writes [pr, pg, pb] into `out`. */
export const labToP3ChannelsInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  labToLinearSrgbInto(out, l, a, b);
  linearToP3ChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

/**
 * Convert CIE LCH (D50) to gamma-encoded Display-P3 channels without object allocation.
 * Polar-to-rectangular to Lab, then Lab → gamma P3. Out-of-gamut channels may exceed [0, 1].
 */
export const lchToP3Channels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToP3Channels(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of lchToP3Channels — writes [pr, pg, pb] into `out`. */
export const lchToP3ChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToP3ChannelsInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/**
 * Returns true if the color is within the Display-P3 gamut.
 * sRGB inputs (hex, rgb, hsl, etc.) always return true (sRGB ⊂ P3).
 */
export const inGamutP3 = (input: AnyColor): boolean => inGamutCustom(input, oklabToLinearP3);

const p3: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.toGamutP3 = (input: AnyColor) => {
    const mapped = toGamutCustom(input, oklabToLinearP3, p3FromLinear);
    return mapped !== null ? ColordxClass._makeFromOklab(mapped) : new ColordxClass(input);
  };
  ColordxClass.prototype.toP3 = function (precision = 4) {
    const { r, g, b, alpha } = rgbToP3Raw(this._rawRgb());
    return {
      r: round(r, precision),
      g: round(g, precision),
      b: round(b, precision),
      alpha,
      colorSpace: 'display-p3' as const,
    };
  };
  ColordxClass.prototype.toP3String = function (precision = 4) {
    const { r, g, b, alpha } = this.toP3(precision);
    return alpha < 1 ? `color(display-p3 ${r} ${g} ${b} / ${alpha})` : `color(display-p3 ${r} ${g} ${b})`;
  };
  parsers.push(parseP3String, parseP3Object);
  formatParsers.push([parseP3String, 'p3'], [parseP3Object, 'p3']);
};

export default p3;

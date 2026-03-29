import { oklchToLinear } from '../channels.js';
import { linearSrgbToOklab } from '../colorModels/oklab.js';
import {
  linearP3ToSrgb,
  oklabToLinearP3,
  parseP3Object,
  parseP3String,
  rgbToP3,
  srgbLinearToP3Linear,
} from '../colorModels/p3.js';
import type { Plugin } from '../colordx.js';
import { inGamutCustom, toGamutCustom } from '../gamut.js';
import { srgbFromLinear } from '../transfer.js';
import type { AnyColor, P3Color } from '../types.js';

const p3FromLinear = (r: number, g: number, b: number): [number, number, number] =>
  linearSrgbToOklab(...linearP3ToSrgb(r, g, b));

declare module '@colordx/core' {
  interface Colordx {
    toP3(): P3Color;
    toP3String(): string;
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

/**
 * Convert OKLCH to gamma-encoded Display-P3 channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors. Out-of-gamut channels may
 * exceed this range — callers are responsible for clamping before byte encoding.
 * Uses the sRGB transfer function (P3 does not use DCI-P3 gamma 2.6).
 */
export const oklchToP3Channels = (l: number, c: number, h: number): [number, number, number] =>
  linearToP3Channels(...oklchToLinear(l, c, h));

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
  ColordxClass.prototype.toP3 = function () {
    return rgbToP3(this._rawRgb());
  };
  ColordxClass.prototype.toP3String = function () {
    const { r, g, b, alpha } = this.toP3();
    return alpha < 1 ? `color(display-p3 ${r} ${g} ${b} / ${alpha})` : `color(display-p3 ${r} ${g} ${b})`;
  };
  parsers.push(parseP3String, parseP3Object);
  formatParsers.push([parseP3String, 'p3'], [parseP3Object, 'p3']);
};

export default p3;

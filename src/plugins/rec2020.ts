import { oklchToLinear } from '../channels.js';
import {
  oklabToLinearRec2020,
  parseRec2020Object,
  parseRec2020String,
  rgbToRec2020,
  srgbLinearToRec2020Linear,
} from '../colorModels/rec2020.js';
import type { Plugin } from '../colordx.js';
import type { Colordx } from '../colordx.js';
import { inGamutCustom, toGamutCustom } from '../gamut.js';
import { rec2020FromLinear } from '../transfer.js';
import type { AnyColor, Rec2020Color } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toRec2020(): Rec2020Color;
    toRec2020String(): string;
  }
}

/**
 * Convert linear sRGB channels (from oklchToLinear) to gamma-encoded Rec.2020 channels.
 * This is the cheap step — only a matrix multiply + BT.2020 gamma, no cbrt.
 */
export const linearToRec2020Channels = (lr: number, lg: number, lb: number): [number, number, number] => {
  const [r, g, b] = srgbLinearToRec2020Linear(lr, lg, lb);
  return [rec2020FromLinear(r), rec2020FromLinear(g), rec2020FromLinear(b)];
};

/**
 * Convert OKLCH to gamma-encoded Rec.2020 channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors. Out-of-gamut channels may
 * exceed this range — callers are responsible for clamping before byte encoding.
 * Uses the BT.2020 transfer function (exponent 0.45, distinct from sRGB 1/2.4).
 */
export const oklchToRec2020Channels = (l: number, c: number, h: number): [number, number, number] =>
  linearToRec2020Channels(...oklchToLinear(l, c, h));

/**
 * Returns true if the color is within the Rec.2020 gamut.
 * sRGB inputs (hex, rgb, hsl, etc.) always return true (sRGB ⊂ Rec.2020).
 */
export const inGamutRec2020 = (input: AnyColor): boolean => inGamutCustom(input, oklabToLinearRec2020);

/**
 * Maps an out-of-Rec.2020-gamut color into Rec.2020 by reducing chroma (constant lightness and hue).
 * Colors already in Rec.2020 gamut are returned as-is. sRGB inputs are passed through.
 */
export const toGamutRec2020 = (input: AnyColor): Colordx => toGamutCustom(input, oklabToLinearRec2020);

const rec2020: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toRec2020 = function () {
    return rgbToRec2020(this._rawRgb());
  };
  ColordxClass.prototype.toRec2020String = function () {
    const { r, g, b, alpha } = this.toRec2020();
    return alpha < 1 ? `color(rec2020 ${r} ${g} ${b} / ${alpha})` : `color(rec2020 ${r} ${g} ${b})`;
  };
  parsers.push(parseRec2020String, parseRec2020Object);
  formatParsers.push([parseRec2020String, 'rec2020'], [parseRec2020Object, 'rec2020']);
};

export default rec2020;

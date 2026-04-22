import { oklchToLinear, oklchToLinearInto } from '../channels.js';
import { linearSrgbToOklab } from '../colorModels/oklab.js';
import {
  linearRec2020ToSrgb,
  oklabToLinearRec2020,
  parseRec2020Object,
  parseRec2020String,
  rgbToRec2020Raw,
  srgbLinearToRec2020Linear,
  srgbLinearToRec2020LinearInto,
} from '../colorModels/rec2020.js';
import type { Plugin } from '../colordx.js';
import { inGamutCustom, toGamutCustom } from '../gamut.js';
import { round } from '../helpers.js';
import { rec2020FromLinear } from '../transfer.js';
import type { AnyColor, Rec2020Color } from '../types.js';

const rec2020FromLinearConverter = (r: number, g: number, b: number): [number, number, number] =>
  linearSrgbToOklab(...linearRec2020ToSrgb(r, g, b));

declare module '@colordx/core' {
  interface Colordx {
    toRec2020(precision?: number): Rec2020Color;
    toRec2020String(precision?: number): string;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Colordx {
    function toGamutRec2020(input: AnyColor): Colordx;
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

/** Zero-allocation sibling of linearToRec2020Channels — writes [rr, rg, rb] (gamma-encoded, 0–1) into `out`. */
export const linearToRec2020ChannelsInto = (out: Float64Array | number[], lr: number, lg: number, lb: number): void => {
  srgbLinearToRec2020LinearInto(out, lr, lg, lb);
  out[0] = rec2020FromLinear(out[0]!);
  out[1] = rec2020FromLinear(out[1]!);
  out[2] = rec2020FromLinear(out[2]!);
};

/**
 * Convert OKLCH to gamma-encoded Rec.2020 channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors. Out-of-gamut channels may
 * exceed this range — callers are responsible for clamping before byte encoding.
 * Uses the BT.2020 transfer function (exponent 0.45, distinct from sRGB 1/2.4).
 */
export const oklchToRec2020Channels = (l: number, c: number, h: number): [number, number, number] =>
  linearToRec2020Channels(...oklchToLinear(l, c, h));

/** Zero-allocation sibling of oklchToRec2020Channels — writes [rr, rg, rb] into `out`. */
export const oklchToRec2020ChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  oklchToLinearInto(out, l, c, h);
  linearToRec2020ChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

/**
 * Returns true if the color is within the Rec.2020 gamut.
 * sRGB inputs (hex, rgb, hsl, etc.) always return true (sRGB ⊂ Rec.2020).
 */
export const inGamutRec2020 = (input: AnyColor): boolean => inGamutCustom(input, oklabToLinearRec2020);

const rec2020: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.toGamutRec2020 = (input: AnyColor) => {
    const mapped = toGamutCustom(input, oklabToLinearRec2020, rec2020FromLinearConverter);
    return mapped !== null ? ColordxClass._makeFromOklab(mapped) : new ColordxClass(input);
  };
  ColordxClass.prototype.toRec2020 = function (precision = 4) {
    const { r, g, b, alpha } = rgbToRec2020Raw(this._rawRgb());
    return {
      r: round(r, precision),
      g: round(g, precision),
      b: round(b, precision),
      alpha,
      colorSpace: 'rec2020' as const,
    };
  };
  ColordxClass.prototype.toRec2020String = function (precision = 4) {
    const { r, g, b, alpha } = this.toRec2020(precision);
    return alpha < 1 ? `color(rec2020 ${r} ${g} ${b} / ${alpha})` : `color(rec2020 ${r} ${g} ${b})`;
  };
  parsers.push(parseRec2020String, parseRec2020Object);
  formatParsers.push([parseRec2020String, 'rec2020'], [parseRec2020Object, 'rec2020']);
};

export default rec2020;

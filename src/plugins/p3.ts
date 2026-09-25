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
import { fixedNotation, round } from '../helpers.js';
import { srgbFromLinear } from '../transfer.js';
import type { AnyColor, ColorParser, P3Color } from '../types.js';

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

/** Linear sRGB → gamma Display-P3 `[r, g, b]`. Pair with `oklchToLinear` to convert to several spaces. */
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

/** OKLCh → gamma Display-P3 `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
export const oklchToP3Channels = (l: number, c: number, h: number): [number, number, number] =>
  linearToP3Channels(...oklchToLinear(l, c, h));

/** Zero-allocation sibling of oklchToP3Channels — writes [pr, pg, pb] into `out`. */
export const oklchToP3ChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  oklchToLinearInto(out, l, c, h);
  linearToP3ChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

const DEG_TO_RAD = Math.PI / 180;

/** CIE Lab (D50) → gamma Display-P3 `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
export const labToP3Channels = (l: number, a: number, b: number): [number, number, number] =>
  linearToP3Channels(...labToLinearSrgb(l, a, b));

/** Zero-allocation sibling of labToP3Channels — writes [pr, pg, pb] into `out`. */
export const labToP3ChannelsInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  labToLinearSrgbInto(out, l, a, b);
  linearToP3ChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

/** CIE LCh (D50) → gamma Display-P3 `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
export const lchToP3Channels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToP3Channels(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of lchToP3Channels — writes [pr, pg, pb] into `out`. */
export const lchToP3ChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToP3ChannelsInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

const parseP3: ColorParser = (input) => parseP3String(input) ?? parseP3Object(input);

/** True when the color is inside the Display-P3 gamut. sRGB inputs always are. */
export const inGamutP3 = (input: AnyColor): boolean => inGamutCustom(input, oklabToLinearP3, parseP3);

const p3: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.toGamutP3 = (input: AnyColor) => {
    const mapped = toGamutCustom(input, oklabToLinearP3, p3FromLinear, parseP3);
    if (mapped === null || mapped.inGamut) return new ColordxClass(input);
    const [lpR, lpG, lpB] = mapped.linear;
    const [lr, lg, lb] = linearP3ToSrgb(lpR, lpG, lpB);
    return ColordxClass._makeFromLinearSrgb(lr, lg, lb, mapped.alpha, false);
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
    return fixedNotation(
      alpha < 1 ? `color(display-p3 ${r} ${g} ${b} / ${alpha})` : `color(display-p3 ${r} ${g} ${b})`,
      precision
    );
  };
  (parseP3String as ColorParser).inputKind = 'string';
  (parseP3Object as ColorParser).inputKind = 'object';
  parsers.push(parseP3String, parseP3Object);
  formatParsers.push([parseP3String, 'p3'], [parseP3Object, 'p3']);
};

export default p3;

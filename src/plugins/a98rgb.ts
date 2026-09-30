import { labToLinearSrgb, labToLinearSrgbInto, oklchToLinear, oklchToLinearInto } from '../channels.js';
import {
  linearA98ToSrgb,
  oklabToLinearA98,
  parseA98Object,
  parseA98String,
  rgbToA98Raw,
  srgbLinearToA98Linear,
  srgbLinearToA98LinearInto,
} from '../colorModels/a98rgb.js';
import { linearSrgbToOklab } from '../colorModels/oklab.js';
import type { Colordx, Plugin } from '../colordx.js';
import { inGamutCustom, toGamutCustom } from '../gamut.js';
import { fixedNotation, round } from '../helpers.js';
import { a98FromLinear } from '../transfer.js';
import type { A98Color, AnyColor, ColorParser } from '../types.js';

const a98FromLinearConverter = (r: number, g: number, b: number): [number, number, number] =>
  linearSrgbToOklab(...linearA98ToSrgb(r, g, b));

declare module '@colordx/core' {
  interface Colordx {
    toA98(precision?: number): A98Color;
    toA98String(precision?: number): string;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Colordx {
    function toGamutA98(input: AnyColor | Colordx): Colordx;
  }
}

/** Linear sRGB → gamma A98 `[r, g, b]`. Pair with `oklchToLinear` to convert to several spaces. */
export const linearToA98Channels = (lr: number, lg: number, lb: number): [number, number, number] => {
  const [r, g, b] = srgbLinearToA98Linear(lr, lg, lb);
  return [a98FromLinear(r), a98FromLinear(g), a98FromLinear(b)];
};

/** Zero-allocation sibling of linearToA98Channels — writes [rr, rg, rb] (gamma-encoded, 0–1) into `out`. */
export const linearToA98ChannelsInto = (out: Float64Array | number[], lr: number, lg: number, lb: number): void => {
  srgbLinearToA98LinearInto(out, lr, lg, lb);
  out[0] = a98FromLinear(out[0]!);
  out[1] = a98FromLinear(out[1]!);
  out[2] = a98FromLinear(out[2]!);
};

/** OKLCh → gamma A98 `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
export const oklchToA98Channels = (l: number, c: number, h: number): [number, number, number] =>
  linearToA98Channels(...oklchToLinear(l, c, h));

/** Zero-allocation sibling of oklchToA98Channels — writes [rr, rg, rb] into `out`. */
export const oklchToA98ChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  oklchToLinearInto(out, l, c, h);
  linearToA98ChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

const DEG_TO_RAD = Math.PI / 180;

/** CIE Lab (D50) → gamma A98 `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
export const labToA98Channels = (l: number, a: number, b: number): [number, number, number] =>
  linearToA98Channels(...labToLinearSrgb(l, a, b));

/** Zero-allocation sibling of labToA98Channels — writes [rr, rg, rb] into `out`. */
export const labToA98ChannelsInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  labToLinearSrgbInto(out, l, a, b);
  linearToA98ChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

/** CIE LCh (D50) → gamma A98 `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
export const lchToA98Channels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToA98Channels(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of lchToA98Channels — writes [rr, rg, rb] into `out`. */
export const lchToA98ChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToA98ChannelsInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

const parseA98: ColorParser = (input) => parseA98String(input) ?? parseA98Object(input);

/** True when the color is inside the A98 gamut. sRGB inputs always are. */
export const inGamutA98 = (input: AnyColor | Colordx): boolean => inGamutCustom(input, oklabToLinearA98, parseA98);

const a98: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.toGamutA98 = (input: AnyColor | Colordx) => {
    const mapped = toGamutCustom(input, oklabToLinearA98, a98FromLinearConverter, parseA98);
    if (mapped === null || mapped.inGamut) return new ColordxClass(input);
    const [lrR, lrG, lrB] = mapped.linear;
    const [lr, lg, lb] = linearA98ToSrgb(lrR, lrG, lrB);
    return ColordxClass._makeFromLinearSrgb(lr, lg, lb, mapped.alpha, false);
  };
  ColordxClass.prototype.toA98 = function (precision = 4) {
    const { r, g, b, alpha } = rgbToA98Raw(this._rawRgb());
    return {
      r: round(r, precision),
      g: round(g, precision),
      b: round(b, precision),
      alpha,
      colorSpace: 'a98-rgb' as const,
    };
  };
  ColordxClass.prototype.toA98String = function (precision = 4) {
    const { r, g, b, alpha } = this.toA98(precision);
    return fixedNotation(
      alpha < 1 ? `color(a98-rgb ${r} ${g} ${b} / ${alpha})` : `color(a98-rgb ${r} ${g} ${b})`,
      precision
    );
  };
  (parseA98String as ColorParser).inputKind = 'string';
  (parseA98Object as ColorParser).inputKind = 'object';
  parsers.push(parseA98String, parseA98Object);
  formatParsers.push([parseA98String, 'a98-rgb'], [parseA98Object, 'a98-rgb']);
};

export default a98;

import { labToLinearSrgb, labToLinearSrgbInto, oklchToLinear, oklchToLinearInto } from '../channels.js';
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
import type { Colordx, Plugin } from '../colordx.js';
import { inGamutCustom, toGamutCustom } from '../gamut.js';
import { fixedNotation, round } from '../helpers.js';
import { rec2020FromLinear } from '../transfer.js';
import type { AnyColor, ColorParser, Rec2020Color } from '../types.js';

const rec2020FromLinearConverter = (r: number, g: number, b: number): [number, number, number] =>
  linearSrgbToOklab(...linearRec2020ToSrgb(r, g, b));

declare module '@colordx/core' {
  interface Colordx {
    toRec2020(precision?: number): Rec2020Color;
    toRec2020String(precision?: number): string;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Colordx {
    function toGamutRec2020(input: AnyColor | Colordx): Colordx;
  }
}

/** Linear sRGB → gamma Rec.2020 `[r, g, b]`. Pair with `oklchToLinear` to convert to several spaces. */
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

/** OKLCh → gamma Rec.2020 `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
export const oklchToRec2020Channels = (l: number, c: number, h: number): [number, number, number] =>
  linearToRec2020Channels(...oklchToLinear(l, c, h));

/** Zero-allocation sibling of oklchToRec2020Channels — writes [rr, rg, rb] into `out`. */
export const oklchToRec2020ChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  oklchToLinearInto(out, l, c, h);
  linearToRec2020ChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

const DEG_TO_RAD = Math.PI / 180;

/** CIE Lab (D50) → gamma Rec.2020 `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
export const labToRec2020Channels = (l: number, a: number, b: number): [number, number, number] =>
  linearToRec2020Channels(...labToLinearSrgb(l, a, b));

/** Zero-allocation sibling of labToRec2020Channels — writes [rr, rg, rb] into `out`. */
export const labToRec2020ChannelsInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  labToLinearSrgbInto(out, l, a, b);
  linearToRec2020ChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

/** CIE LCh (D50) → gamma Rec.2020 `[r, g, b]` in 0–1. Out-of-gamut channels exceed it. */
export const lchToRec2020Channels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToRec2020Channels(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of lchToRec2020Channels — writes [rr, rg, rb] into `out`. */
export const lchToRec2020ChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToRec2020ChannelsInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

const parseRec2020: ColorParser = (input) => parseRec2020String(input) ?? parseRec2020Object(input);

/** True when the color is inside the Rec.2020 gamut. sRGB inputs always are. */
export const inGamutRec2020 = (input: AnyColor | Colordx): boolean =>
  inGamutCustom(input, oklabToLinearRec2020, parseRec2020);

const rec2020: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.toGamutRec2020 = (input: AnyColor | Colordx) => {
    const mapped = toGamutCustom(input, oklabToLinearRec2020, rec2020FromLinearConverter, parseRec2020);
    if (mapped === null || mapped.inGamut) return new ColordxClass(input);
    const [lrR, lrG, lrB] = mapped.linear;
    const [lr, lg, lb] = linearRec2020ToSrgb(lrR, lrG, lrB);
    return ColordxClass._makeFromLinearSrgb(lr, lg, lb, mapped.alpha, false);
  };
  ColordxClass.prototype.toRec2020 = function (precision = 5) {
    const { r, g, b, alpha } = rgbToRec2020Raw(this._rawRgb());
    return {
      r: round(r, precision),
      g: round(g, precision),
      b: round(b, precision),
      alpha,
      colorSpace: 'rec2020' as const,
    };
  };
  ColordxClass.prototype.toRec2020String = function (precision = 5) {
    const { r, g, b, alpha } = this.toRec2020(precision);
    return fixedNotation(
      alpha < 1 ? `color(rec2020 ${r} ${g} ${b} / ${alpha})` : `color(rec2020 ${r} ${g} ${b})`,
      precision
    );
  };
  (parseRec2020String as ColorParser).inputKind = 'string';
  (parseRec2020Object as ColorParser).inputKind = 'object';
  parsers.push(parseRec2020String, parseRec2020Object);
  formatParsers.push([parseRec2020String, 'rec2020'], [parseRec2020Object, 'rec2020']);
};

export default rec2020;

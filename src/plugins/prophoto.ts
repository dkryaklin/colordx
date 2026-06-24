import { labToLinearSrgb, labToLinearSrgbInto, oklchToLinear, oklchToLinearInto } from '../channels.js';
import { linearSrgbToOklab } from '../colorModels/oklab.js';
import {
  linearProphotoToSrgb,
  oklabToLinearProphoto,
  parseProphotoObject,
  parseProphotoString,
  rgbToProphotoRaw,
  srgbLinearToProphotoLinear,
  srgbLinearToProphotoLinearInto,
} from '../colorModels/prophoto.js';
import type { Plugin } from '../colordx.js';
import { inGamutCustom, toGamutCustom } from '../gamut.js';
import { round } from '../helpers.js';
import { prophotoFromLinear } from '../transfer.js';
import type { AnyColor, ProPhotoColor } from '../types.js';

const prophotoFromLinearConverter = (r: number, g: number, b: number): [number, number, number] =>
  linearSrgbToOklab(...linearProphotoToSrgb(r, g, b));

declare module '@colordx/core' {
  interface Colordx {
    toProphoto(precision?: number): ProPhotoColor;
    toProphotoString(precision?: number): string;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Colordx {
    function toGamutProphoto(input: AnyColor): Colordx;
  }
}

/**
 * Convert linear sRGB channels (from oklchToLinear) to gamma-encoded ProPhoto channels.
 * This is the cheap step — only a matrix multiply + the ProPhoto gamma 1.8 curve, no cbrt.
 */
export const linearToProphotoChannels = (lr: number, lg: number, lb: number): [number, number, number] => {
  const [r, g, b] = srgbLinearToProphotoLinear(lr, lg, lb);
  return [prophotoFromLinear(r), prophotoFromLinear(g), prophotoFromLinear(b)];
};

/** Zero-allocation sibling of linearToProphotoChannels — writes [rr, rg, rb] (gamma-encoded, 0–1) into `out`. */
export const linearToProphotoChannelsInto = (
  out: Float64Array | number[],
  lr: number,
  lg: number,
  lb: number
): void => {
  srgbLinearToProphotoLinearInto(out, lr, lg, lb);
  out[0] = prophotoFromLinear(out[0]!);
  out[1] = prophotoFromLinear(out[1]!);
  out[2] = prophotoFromLinear(out[2]!);
};

/**
 * Convert OKLCH to gamma-encoded ProPhoto channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors. Out-of-gamut channels may
 * exceed this range — callers are responsible for clamping before byte encoding.
 */
export const oklchToProphotoChannels = (l: number, c: number, h: number): [number, number, number] =>
  linearToProphotoChannels(...oklchToLinear(l, c, h));

/** Zero-allocation sibling of oklchToProphotoChannels — writes [rr, rg, rb] into `out`. */
export const oklchToProphotoChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  oklchToLinearInto(out, l, c, h);
  linearToProphotoChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

const DEG_TO_RAD = Math.PI / 180;

/**
 * Convert CIE Lab (D50) to gamma-encoded ProPhoto channels without object allocation.
 * Returns [r, g, b] in [0, 1] for in-gamut colors; out-of-gamut channels may exceed [0, 1].
 * Goes Lab → XYZ D50 → linear sRGB → linear ProPhoto → ProPhoto gamma.
 */
export const labToProphotoChannels = (l: number, a: number, b: number): [number, number, number] =>
  linearToProphotoChannels(...labToLinearSrgb(l, a, b));

/** Zero-allocation sibling of labToProphotoChannels — writes [rr, rg, rb] into `out`. */
export const labToProphotoChannelsInto = (out: Float64Array | number[], l: number, a: number, b: number): void => {
  labToLinearSrgbInto(out, l, a, b);
  linearToProphotoChannelsInto(out, out[0]!, out[1]!, out[2]!);
};

/**
 * Convert CIE LCH (D50) to gamma-encoded ProPhoto channels without object allocation.
 * Polar-to-rectangular to Lab, then Lab → gamma ProPhoto.
 */
export const lchToProphotoChannels = (l: number, c: number, h: number): [number, number, number] => {
  const hRad = h * DEG_TO_RAD;
  return labToProphotoChannels(l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/** Zero-allocation sibling of lchToProphotoChannels — writes [rr, rg, rb] into `out`. */
export const lchToProphotoChannelsInto = (out: Float64Array | number[], l: number, c: number, h: number): void => {
  const hRad = h * DEG_TO_RAD;
  labToProphotoChannelsInto(out, l, c * Math.cos(hRad), c * Math.sin(hRad));
};

/**
 * Returns true if the color is within the ProPhoto (ROMM RGB) gamut.
 * sRGB inputs (hex, rgb, hsl, etc.) always return true (sRGB ⊂ ProPhoto).
 */
export const inGamutProphoto = (input: AnyColor): boolean => inGamutCustom(input, oklabToLinearProphoto);

const prophoto: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.toGamutProphoto = (input: AnyColor) => {
    const mapped = toGamutCustom(input, oklabToLinearProphoto, prophotoFromLinearConverter);
    if (mapped === null) return new ColordxClass(input);
    // Clipped linear-ProPhoto → linear-sRGB (wide-gamut when the ProPhoto color is outside
    // sRGB), then gamma-encode for storage. No round-trip through OKLab.
    const [lrR, lrG, lrB] = mapped.linear;
    const [lr, lg, lb] = linearProphotoToSrgb(lrR, lrG, lrB);
    return ColordxClass._makeFromLinearSrgb(lr, lg, lb, mapped.alpha);
  };
  ColordxClass.prototype.toProphoto = function (precision = 4) {
    const { r, g, b, alpha } = rgbToProphotoRaw(this._rawRgb());
    return {
      r: round(r, precision),
      g: round(g, precision),
      b: round(b, precision),
      alpha,
      colorSpace: 'prophoto-rgb' as const,
    };
  };
  ColordxClass.prototype.toProphotoString = function (precision = 4) {
    const { r, g, b, alpha } = this.toProphoto(precision);
    return alpha < 1 ? `color(prophoto-rgb ${r} ${g} ${b} / ${alpha})` : `color(prophoto-rgb ${r} ${g} ${b})`;
  };
  parsers.push(parseProphotoString, parseProphotoObject);
  formatParsers.push([parseProphotoString, 'prophoto-rgb'], [parseProphotoObject, 'prophoto-rgb']);
};

export default prophoto;

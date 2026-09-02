import { parseSrgbLinearObject, parseSrgbLinearString, rgbToSrgbLinearRaw } from '../colorModels/srgb-linear.js';
import type { Plugin } from '../colordx.js';
import { round } from '../helpers.js';
import type { SrgbLinearColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toSrgbLinear(precision?: number): SrgbLinearColor;
    toSrgbLinearString(precision?: number): string;
  }
}

// Gamut is sRGB itself, so inGamutSrgb / Colordx.toGamutSrgb already cover it.
// Channel math is oklchToLinear / rgbToLinear from core.
const srgbLinear: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toSrgbLinear = function (precision = 5) {
    const { r, g, b, alpha } = rgbToSrgbLinearRaw(this._rawRgb());
    return {
      r: round(r, precision),
      g: round(g, precision),
      b: round(b, precision),
      alpha,
      colorSpace: 'srgb-linear' as const,
    };
  };
  ColordxClass.prototype.toSrgbLinearString = function (precision = 5) {
    const { r, g, b, alpha } = this.toSrgbLinear(precision);
    return alpha < 1 ? `color(srgb-linear ${r} ${g} ${b} / ${alpha})` : `color(srgb-linear ${r} ${g} ${b})`;
  };
  parsers.push(parseSrgbLinearString, parseSrgbLinearObject);
  formatParsers.push([parseSrgbLinearString, 'srgb-linear'], [parseSrgbLinearObject, 'srgb-linear']);
};

export default srgbLinear;

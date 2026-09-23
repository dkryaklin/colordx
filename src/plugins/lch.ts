import { parseLchObject, parseLchString, rgbToLchRaw } from '../colorModels/lch.js';
import type { Plugin } from '../colordx.js';
import { fixedNotation, round } from '../helpers.js';
import type { LchColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toLch(precision?: number): LchColor;
    toLchString(precision?: number): string;
  }
}

const lch: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toLch = function (precision = 2) {
    const { l, c, h, alpha } = rgbToLchRaw(this._rawRgb());
    const cR = round(c, precision);
    const hR = round(h, precision);
    return {
      l: round(l, precision),
      c: cR,
      // Achromatic threshold on LCH scale (0–~150): below this chroma the hue is numerically unstable.
      // round() can push a hue just below 360 to 360; wrap back to 0 so H stays in [0, 360).
      h: c < 0.0015 || hR >= 360 ? 0 : hR,
      alpha,
      colorSpace: 'lch' as const,
    };
  };
  ColordxClass.prototype.toLchString = function (precision = 2) {
    const { l, c, h, alpha } = this.toLch(precision);
    // `none` when the unrounded chroma is achromatic — the same test toLch() uses to zero the hue.
    const H = c === 0 || (h === 0 && rgbToLchRaw(this._rawRgb()).c < 0.0015) ? 'none' : h;
    return fixedNotation(alpha < 1 ? `lch(${l} ${c} ${H} / ${alpha})` : `lch(${l} ${c} ${H})`, precision);
  };
  parsers.push(parseLchObject, parseLchString);
  formatParsers.push([parseLchObject, 'lch'], [parseLchString, 'lch']);
};

export default lch;

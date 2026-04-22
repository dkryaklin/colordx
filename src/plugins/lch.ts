import { parseLchObject, parseLchString, rgbToLchRaw } from '../colorModels/lch.js';
import type { Plugin } from '../colordx.js';
import { round } from '../helpers.js';
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
    return {
      l: round(l, precision),
      c: cR,
      // Achromatic threshold on LCH scale (0–~150): below this chroma the hue is numerically unstable.
      h: c < 0.0015 ? 0 : round(h, precision),
      alpha,
      colorSpace: 'lch' as const,
    };
  };
  ColordxClass.prototype.toLchString = function (precision = 2) {
    const { l, c, h, alpha } = this.toLch(precision);
    const H = c === 0 ? 'none' : h;
    return alpha < 1 ? `lch(${l} ${c} ${H} / ${alpha})` : `lch(${l} ${c} ${H})`;
  };
  parsers.push(parseLchObject, parseLchString);
  formatParsers.push([parseLchObject, 'lch'], [parseLchString, 'lch']);
};

export default lch;

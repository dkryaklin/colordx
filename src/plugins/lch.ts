import { parseLchObject, parseLchString, rgbToLchRaw } from '../colorModels/lch.js';
import type { Plugin } from '../colordx.js';
import { fixedNotation, round } from '../helpers.js';
import type { ColorParser, LchColor } from '../types.js';

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
      h: c < 0.0015 || hR >= 360 ? 0 : hR,
      alpha,
      colorSpace: 'lch' as const,
    };
  };
  ColordxClass.prototype.toLchString = function (precision = 2) {
    const { l, c, h, alpha } = this.toLch(precision);
    const H = c === 0 || (h === 0 && rgbToLchRaw(this._rawRgb()).c < 0.0015) ? 'none' : h;
    return fixedNotation(alpha < 1 ? `lch(${l} ${c} ${H} / ${alpha})` : `lch(${l} ${c} ${H})`, precision);
  };
  (parseLchObject as ColorParser).inputKind = 'object';
  (parseLchString as ColorParser).inputKind = 'string';
  parsers.push(parseLchObject, parseLchString);
  formatParsers.push([parseLchObject, 'lch'], [parseLchString, 'lch']);
};

export default lch;

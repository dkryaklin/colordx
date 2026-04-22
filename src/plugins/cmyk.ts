import { parseCmykObject, parseCmykString, rgbToCmykRaw } from '../colorModels/cmyk.js';
import type { Plugin } from '../colordx.js';
import { round } from '../helpers.js';
import type { CmykColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toCmyk(precision?: number): CmykColor;
    toCmykString(precision?: number): string;
  }
}

const cmyk: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toCmyk = function (precision = 2) {
    const { c, m, y, k, alpha } = rgbToCmykRaw(this._rawRgb());
    return { c: round(c, precision), m: round(m, precision), y: round(y, precision), k: round(k, precision), alpha };
  };
  ColordxClass.prototype.toCmykString = function (precision = 2) {
    const { c, m, y, k, alpha } = this.toCmyk(precision);
    return alpha < 1 ? `device-cmyk(${c}% ${m}% ${y}% ${k}% / ${alpha})` : `device-cmyk(${c}% ${m}% ${y}% ${k}%)`;
  };
  parsers.push(parseCmykObject, parseCmykString);
  formatParsers.push([parseCmykObject, 'cmyk'], [parseCmykString, 'cmyk']);
};

export default cmyk;

import { parseCmykObject, parseCmykString, rgbToCmyk } from '../colorModels/cmyk.js';
import type { Plugin } from '../colordx.js';
import type { CmykColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toCmyk(): CmykColor;
    toCmykString(): string;
  }
}

const cmyk: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toCmyk = function () {
    return rgbToCmyk(this._rawRgb());
  };
  ColordxClass.prototype.toCmykString = function () {
    const { c, m, y, k, alpha } = this.toCmyk();
    return alpha < 1 ? `device-cmyk(${c}% ${m}% ${y}% ${k}% / ${alpha})` : `device-cmyk(${c}% ${m}% ${y}% ${k}%)`;
  };
  parsers.push(parseCmykObject, parseCmykString);
  formatParsers.push([parseCmykObject, 'cmyk'], [parseCmykString, 'cmyk']);
};

export default cmyk;

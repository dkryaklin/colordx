import { parseCmykObject, parseCmykString, rgbToCmyk } from '../colorModels/cmyk.js';
import type { Plugin } from '../colordx.js';
import type { CmykColor } from '../types.js';

declare module '../colordx.js' {
  interface Colordx {
    toCmyk(): CmykColor;
    toCmykString(): string;
  }
}

const cmyk: Plugin = (ColordxClass, parsers) => {
  ColordxClass.prototype.toCmyk = function () {
    return rgbToCmyk(this.toRgb());
  };
  ColordxClass.prototype.toCmykString = function () {
    const { c, m, y, k, a } = this.toCmyk();
    return a < 1 ? `device-cmyk(${c}% ${m}% ${y}% ${k}% / ${a})` : `device-cmyk(${c}% ${m}% ${y}% ${k}%)`;
  };
  parsers.push(parseCmykObject, parseCmykString);
};

export default cmyk;

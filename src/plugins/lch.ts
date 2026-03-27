import { parseLchObject, parseLchString, rgbToLch } from '../colorModels/lch.js';
import type { Plugin } from '../colordx.js';
import type { LchColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toLch(): LchColor;
    toLchString(): string;
  }
}

const lch: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toLch = function () {
    return rgbToLch(this.toRgb());
  };
  ColordxClass.prototype.toLchString = function () {
    const { l, c, h, a } = this.toLch();
    const H = c < 0.0015 ? 'none' : h;
    return a < 1 ? `lch(${l}% ${c} ${H} / ${a})` : `lch(${l}% ${c} ${H})`;
  };
  parsers.push(parseLchObject, parseLchString);
  formatParsers.push([parseLchObject, 'lch'], [parseLchString, 'lch']);
};

export default lch;

import { parseLchObject, parseLchString, rgbToLch } from '../colorModels/lch.js';
import type { Plugin } from '../colordx.js';
import { round } from '../helpers.js';
import type { LchColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toLch(): LchColor;
    toLchString(): string;
  }
}

const lch: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toLch = function () {
    const { l, c, h, alpha } = rgbToLch(this.toRgb());
    return { l: round(l, 2), c, h, alpha, colorSpace: 'lch' as const };
  };
  ColordxClass.prototype.toLchString = function () {
    const { l, c, h, alpha } = this.toLch();
    // c is already rounded to 2dp; c === 0 is the effective achromatic check at this precision.
    const H = c === 0 ? 'none' : h;
    return alpha < 1 ? `lch(${l}% ${c} ${H} / ${alpha})` : `lch(${l}% ${c} ${H})`;
  };
  parsers.push(parseLchObject, parseLchString);
  formatParsers.push([parseLchObject, 'lch'], [parseLchString, 'lch']);
};

export default lch;

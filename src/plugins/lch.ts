import { parseLchObject, parseLchString, rgbToLch } from '../colorModels/lch.js';
import type { Plugin } from '../colordx.js';
import type { LchColor } from '../types.js';

declare module '../colordx.js' {
  interface Colordx {
    toLch(): LchColor;
    toLchString(): string;
  }
}

const lch: Plugin = (ColordxClass, parsers) => {
  ColordxClass.prototype.toLch = function () {
    return rgbToLch(this.toRgb());
  };
  ColordxClass.prototype.toLchString = function () {
    const { l, c, h, a } = this.toLch();
    return a < 1 ? `lch(${l}% ${c} ${h} / ${a})` : `lch(${l}% ${c} ${h})`;
  };
  parsers.push(parseLchObject, parseLchString);
};

export default lch;

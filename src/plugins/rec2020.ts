import { parseRec2020String, rgbToRec2020 } from '../colorModels/rec2020.js';
import type { Plugin } from '../colordx.js';
import type { Rec2020Color } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toRec2020(): Rec2020Color;
    toRec2020String(): string;
  }
}

const rec2020: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toRec2020 = function () {
    return rgbToRec2020(this._rawRgb());
  };
  ColordxClass.prototype.toRec2020String = function () {
    const { r, g, b, alpha } = this.toRec2020();
    return alpha < 1 ? `color(rec2020 ${r} ${g} ${b} / ${alpha})` : `color(rec2020 ${r} ${g} ${b})`;
  };
  parsers.push(parseRec2020String);
  formatParsers.push([parseRec2020String, 'rec2020']);
};

export default rec2020;

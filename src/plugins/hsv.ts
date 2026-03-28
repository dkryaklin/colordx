import { parseHsvObject, parseHsvString, rgbToHsv } from '../colorModels/hsv.js';
import type { Colordx, Plugin } from '../colordx.js';
import type { HsvColor } from '../types.js';

// HSV/HSVA is a non-standard, library-defined format (not part of any CSS spec).
declare module '@colordx/core' {
  interface Colordx {
    toHsv(): HsvColor;
    toHsvString(): string;
  }
}

const hsv: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toHsv = function (this: Colordx): HsvColor {
    return rgbToHsv(this._rawRgb());
  };

  ColordxClass.prototype.toHsvString = function (this: Colordx): string {
    const { h, s, v, alpha } = this.toHsv();
    return alpha < 1 ? `hsva(${h}, ${s}%, ${v}%, ${alpha})` : `hsv(${h}, ${s}%, ${v}%)`;
  };

  parsers.push(parseHsvString, parseHsvObject);
  formatParsers.push([parseHsvString, 'hsv'], [parseHsvObject, 'hsv']);
};

export default hsv;

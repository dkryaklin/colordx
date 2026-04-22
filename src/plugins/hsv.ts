import { parseHsvObject, parseHsvString, rgbToHsvRaw } from '../colorModels/hsv.js';
import type { Colordx, Plugin } from '../colordx.js';
import { round } from '../helpers.js';
import type { HsvColor } from '../types.js';

// HSV/HSVA is a non-standard, library-defined format (not part of any CSS spec).
declare module '@colordx/core' {
  interface Colordx {
    toHsv(precision?: number): HsvColor;
    toHsvString(precision?: number): string;
  }
}

const hsv: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toHsv = function (this: Colordx, precision = 2): HsvColor {
    const { h, s, v, alpha } = rgbToHsvRaw(this._rawRgb());
    const hr = round(h, precision);
    return { h: hr >= 360 ? 0 : hr, s: round(s, precision), v: round(v, precision), alpha };
  };

  ColordxClass.prototype.toHsvString = function (this: Colordx, precision = 2): string {
    const { h, s, v, alpha } = this.toHsv(precision);
    return alpha < 1 ? `hsv(${h} ${s}% ${v}% / ${alpha})` : `hsv(${h} ${s}% ${v}%)`;
  };

  parsers.push(parseHsvString, parseHsvObject);
  formatParsers.push([parseHsvString, 'hsv'], [parseHsvObject, 'hsv']);
};

export default hsv;

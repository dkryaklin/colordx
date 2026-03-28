import { parseHwbObject, parseHwbString, rgbToHwb } from '../colorModels/hwb.js';
import type { Colordx, Plugin } from '../colordx.js';
import { round } from '../helpers.js';
import type { HwbColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toHwb(precision?: number): HwbColor;
    toHwbString(precision?: number): string;
  }
}

const hwb: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toHwb = function (this: Colordx, precision = 0): HwbColor {
    const { h, w, b, alpha } = rgbToHwb(this._rawRgb());
    return { h: round(h, precision), w: round(w, precision), b: round(b, precision), alpha: round(alpha, 3) };
  };
  ColordxClass.prototype.toHwbString = function (this: Colordx, precision = 0): string {
    const { h, w, b, alpha } = this.toHwb(precision);
    return alpha < 1 ? `hwb(${h} ${w}% ${b}% / ${alpha})` : `hwb(${h} ${w}% ${b}%)`;
  };
  parsers.push(parseHwbString, parseHwbObject);
  formatParsers.push([parseHwbString, 'hwb'], [parseHwbObject, 'hwb']);
};

export default hwb;

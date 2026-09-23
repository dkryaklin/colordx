import { parseHwbObject, parseHwbString, rgbToHwb } from '../colorModels/hwb.js';
import type { Colordx, Plugin } from '../colordx.js';
import { fixedNotation, round } from '../helpers.js';
import type { HwbColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toHwb(precision?: number): HwbColor;
    toHwbString(precision?: number): string;
  }
}

const hwb: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toHwb = function (this: Colordx, precision = 2): HwbColor {
    const { h, w, b, alpha } = rgbToHwb(this._srgbRgb());
    const hr = round(h, precision);
    // round() can push a hue just below 360 to 360 (e.g. #ff0001 at 0 dp); wrap to 0.
    return { h: hr >= 360 ? 0 : hr, w: round(w, precision), b: round(b, precision), alpha };
  };
  ColordxClass.prototype.toHwbString = function (this: Colordx, precision = 2): string {
    const { h, w, b, alpha } = this.toHwb(precision);
    return fixedNotation(alpha < 1 ? `hwb(${h} ${w}% ${b}% / ${alpha})` : `hwb(${h} ${w}% ${b}%)`, precision);
  };
  parsers.push(parseHwbString, parseHwbObject);
  formatParsers.push([parseHwbString, 'hwb'], [parseHwbObject, 'hwb']);
};

export default hwb;

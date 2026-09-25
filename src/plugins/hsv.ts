import { parseHsvObject, parseHsvString, rgbToHsvRaw } from '../colorModels/hsv.js';
import type { Colordx, Plugin } from '../colordx.js';
import { fixedNotation, round } from '../helpers.js';
import type { ColorParser, HsvColor } from '../types.js';

export { hsvToRgbChannels, hsvToRgbChannelsInto, rgbToHsvChannels, rgbToHsvChannelsInto } from '../colorModels/hsv.js';

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
    return fixedNotation(alpha < 1 ? `hsv(${h} ${s}% ${v}% / ${alpha})` : `hsv(${h} ${s}% ${v}%)`, precision);
  };

  (parseHsvString as ColorParser).inputKind = 'string';

  (parseHsvObject as ColorParser).inputKind = 'object';
  parsers.push(parseHsvString, parseHsvObject);
  formatParsers.push([parseHsvString, 'hsv'], [parseHsvObject, 'hsv']);
};

export default hsv;

import { parseOkhsvObject, parseOkhsvString, rgbToOkhsvRaw } from '../colorModels/okhsv.js';
import type { Colordx, Plugin } from '../colordx.js';
import { fixedNotation, round } from '../helpers.js';
import type { ColorParser, OkhsvColor } from '../types.js';

export {
  okhsvToRgbChannels,
  okhsvToRgbChannelsInto,
  rgbToOkhsvChannels,
  rgbToOkhsvChannelsInto,
} from '../colorModels/okhsv.js';

declare module '@colordx/core' {
  interface Colordx {
    toOkhsv(precision?: number): OkhsvColor;
    toOkhsvString(precision?: number): string;
  }
}

const okhsv: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toOkhsv = function (this: Colordx, precision = 5): OkhsvColor {
    const { h, s, v, alpha } = rgbToOkhsvRaw(this._rawRgb());
    const hr = round(h, precision);
    return { h: hr >= 360 ? 0 : hr, s: round(s, precision), v: round(v, precision), alpha, colorSpace: 'okhsv' };
  };

  ColordxClass.prototype.toOkhsvString = function (this: Colordx, precision = 5): string {
    const { h, s, v, alpha } = this.toOkhsv(precision);
    return fixedNotation(alpha < 1 ? `okhsv(${h} ${s}% ${v}% / ${alpha})` : `okhsv(${h} ${s}% ${v}%)`, precision);
  };

  (parseOkhsvString as ColorParser).inputKind = 'string';

  (parseOkhsvObject as ColorParser).inputKind = 'object';
  parsers.push(parseOkhsvString, parseOkhsvObject);
  formatParsers.push([parseOkhsvString, 'okhsv'], [parseOkhsvObject, 'okhsv']);
};

export default okhsv;

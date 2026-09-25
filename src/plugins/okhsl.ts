import { parseOkhslObject, parseOkhslString, rgbToOkhslRaw } from '../colorModels/okhsl.js';
import type { Colordx, Plugin } from '../colordx.js';
import { fixedNotation, round } from '../helpers.js';
import type { ColorParser, OkhslColor } from '../types.js';

export {
  okhslToRgbChannels,
  okhslToRgbChannelsInto,
  rgbToOkhslChannels,
  rgbToOkhslChannelsInto,
} from '../colorModels/okhsl.js';

declare module '@colordx/core' {
  interface Colordx {
    toOkhsl(precision?: number): OkhslColor;
    toOkhslString(precision?: number): string;
  }
}

const okhsl: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toOkhsl = function (this: Colordx, precision = 5): OkhslColor {
    const { h, s, l, alpha } = rgbToOkhslRaw(this._rawRgb());
    const hr = round(h, precision);
    return { h: hr >= 360 ? 0 : hr, s: round(s, precision), l: round(l, precision), alpha, colorSpace: 'okhsl' };
  };

  ColordxClass.prototype.toOkhslString = function (this: Colordx, precision = 5): string {
    const { h, s, l, alpha } = this.toOkhsl(precision);
    return fixedNotation(alpha < 1 ? `okhsl(${h} ${s}% ${l}% / ${alpha})` : `okhsl(${h} ${s}% ${l}%)`, precision);
  };

  (parseOkhslString as ColorParser).inputKind = 'string';

  (parseOkhslObject as ColorParser).inputKind = 'object';
  parsers.push(parseOkhslString, parseOkhslObject);
  formatParsers.push([parseOkhslString, 'okhsl'], [parseOkhslObject, 'okhsl']);
};

export default okhsl;

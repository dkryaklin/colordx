import { parseOkhsvObject, parseOkhsvString, rgbToOkhsvRaw } from '../colorModels/okhsv.js';
import type { Colordx, Plugin } from '../colordx.js';
import { fixedNotation, round } from '../helpers.js';
import type { OkhsvColor } from '../types.js';

// Channel functions (allocation-free `*Into` siblings included) for per-pixel Okhsv work —
// pickers, saturation/value planes. Same scale as toOkhsv(): h in degrees, s/v in 0–100; RGB in 0–1.
export {
  okhsvToRgbChannels,
  okhsvToRgbChannelsInto,
  rgbToOkhsvChannels,
  rgbToOkhsvChannelsInto,
} from '../colorModels/okhsv.js';

// okhsv() is a library-defined format (no CSS spec defines one); objects carry `colorSpace: 'okhsv'`.
declare module '@colordx/core' {
  interface Colordx {
    toOkhsv(precision?: number): OkhsvColor;
    toOkhsvString(precision?: number): string;
  }
}

const okhsv: Plugin = (ColordxClass, parsers, formatParsers) => {
  // 5 dp like toOklch(), not the 2 of toHsl(): h is the OKLCH hue, and around the sRGB cube's edges
  // the most chromatic color of a hue moves fast with the hue — at 2 dp rgb(0, 42, 204) comes back
  // as rgb(7, 53, 190). 5 dp round-trips every color to the byte except two documented cases: the
  // pure-blue edge (r = g = 0), where the hue would need ~8 dp, and the ~0.1% of colors whose raw
  // s overshoots 100 (the reference's cusp fit) and is clamped here.
  ColordxClass.prototype.toOkhsv = function (this: Colordx, precision = 5): OkhsvColor {
    const { h, s, v, alpha } = rgbToOkhsvRaw(this._rawRgb()); // rgbToOkhsvRaw clips to sRGB itself
    const hr = round(h, precision);
    return { h: hr >= 360 ? 0 : hr, s: round(s, precision), v: round(v, precision), alpha, colorSpace: 'okhsv' };
  };

  ColordxClass.prototype.toOkhsvString = function (this: Colordx, precision = 5): string {
    const { h, s, v, alpha } = this.toOkhsv(precision);
    return fixedNotation(alpha < 1 ? `okhsv(${h} ${s}% ${v}% / ${alpha})` : `okhsv(${h} ${s}% ${v}%)`, precision);
  };

  parsers.push(parseOkhsvString, parseOkhsvObject);
  formatParsers.push([parseOkhsvString, 'okhsv'], [parseOkhsvObject, 'okhsv']);
};

export default okhsv;

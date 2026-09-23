import { parseOkhslObject, parseOkhslString, rgbToOkhslRaw } from '../colorModels/okhsl.js';
import type { Colordx, Plugin } from '../colordx.js';
import { fixedNotation, round } from '../helpers.js';
import type { OkhslColor } from '../types.js';

// Channel functions (allocation-free `*Into` siblings included) for per-pixel Okhsl work —
// pickers, hue wheels, lightness ramps. Same scale as toOkhsl(): h in degrees, s/l in 0–100; RGB in 0–1.
export {
  okhslToRgbChannels,
  okhslToRgbChannelsInto,
  rgbToOkhslChannels,
  rgbToOkhslChannelsInto,
} from '../colorModels/okhsl.js';

// okhsl() is a library-defined format (no CSS spec defines one); objects carry `colorSpace: 'okhsl'`.
declare module '@colordx/core' {
  interface Colordx {
    toOkhsl(precision?: number): OkhslColor;
    toOkhslString(precision?: number): string;
  }
}

const okhsl: Plugin = (ColordxClass, parsers, formatParsers) => {
  // 5 dp like toOklch(), not the 2 of toHsl(): h is the OKLCH hue, and around the sRGB cube's edges
  // the most chromatic color of a hue moves fast with the hue — at 2 dp rgb(0, 42, 204) comes back
  // as rgb(7, 53, 190). 5 dp round-trips every color to the byte except two documented cases: the
  // pure-blue edge (r = g = 0), where the hue would need ~8 dp, and the ~0.1% of colors whose raw
  // s overshoots 100 (the reference's cusp fit) and is clamped here.
  ColordxClass.prototype.toOkhsl = function (this: Colordx, precision = 5): OkhslColor {
    const { h, s, l, alpha } = rgbToOkhslRaw(this._rawRgb()); // rgbToOkhslRaw clips to sRGB itself
    const hr = round(h, precision);
    return { h: hr >= 360 ? 0 : hr, s: round(s, precision), l: round(l, precision), alpha, colorSpace: 'okhsl' };
  };

  ColordxClass.prototype.toOkhslString = function (this: Colordx, precision = 5): string {
    const { h, s, l, alpha } = this.toOkhsl(precision);
    return fixedNotation(alpha < 1 ? `okhsl(${h} ${s}% ${l}% / ${alpha})` : `okhsl(${h} ${s}% ${l}%)`, precision);
  };

  parsers.push(parseOkhslString, parseOkhslObject);
  formatParsers.push([parseOkhslString, 'okhsl'], [parseOkhslObject, 'okhsl']);
};

export default okhsl;

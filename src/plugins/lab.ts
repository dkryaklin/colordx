import { labToRgb, parseLabObject, rgbToLab } from '../colorModels/lab.js';
import { parseXyzObject, rgbToXyz } from '../colorModels/xyz.js';
import { Colordx } from '../colordx.js';
import type { Plugin } from '../colordx.js';
import { clamp, round } from '../helpers.js';
import type { AnyColor, LabColor, XyzColor } from '../types.js';

declare module '../colordx.js' {
  interface Colordx {
    toLab(): LabColor;
    toXyz(): XyzColor;
    mixLab(color: AnyColor, ratio?: number): Colordx;
  }
}

const lab: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toLab = function () {
    return rgbToLab(this.toRgb());
  };
  ColordxClass.prototype.toXyz = function () {
    return rgbToXyz(this.toRgb());
  };
  ColordxClass.prototype.mixLab = function (this: Colordx, color: AnyColor, ratio = 0.5): Colordx {
    const a = rgbToLab(this.toRgb());
    const b = rgbToLab(new Colordx(color).toRgb());
    const w = clamp(ratio, 0, 1);
    return new Colordx(
      labToRgb({
        l: a.l * (1 - w) + b.l * w,
        a: a.a * (1 - w) + b.a * w,
        b: a.b * (1 - w) + b.b * w,
        alpha: round(a.alpha * (1 - w) + b.alpha * w, 3),
      })
    );
  };
  parsers.push(parseLabObject, parseXyzObject);
  formatParsers.push([parseLabObject, 'lab'], [parseXyzObject, 'xyz']);
};

export default lab;

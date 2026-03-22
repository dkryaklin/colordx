import { parseLabObject, rgbToLab } from '../colorModels/lab.js';
import { parseXyzObject, rgbToXyz } from '../colorModels/xyz.js';
import type { Plugin } from '../colordx.js';
import type { LabColor, XyzColor } from '../types.js';

declare module '../colordx.js' {
  interface Colordx {
    toLab(): LabColor;
    toXyz(): XyzColor;
  }
}

const lab: Plugin = (ColordxClass, parsers) => {
  ColordxClass.prototype.toLab = function () {
    return rgbToLab(this.toRgb());
  };
  ColordxClass.prototype.toXyz = function () {
    return rgbToXyz(this.toRgb());
  };
  parsers.push(parseLabObject, parseXyzObject);
};

export default lab;

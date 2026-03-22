import { deltaE2000, rgbToLab } from '../colorModels/lab.js';
import type { Plugin } from '../colordx.js';
import { round } from '../helpers.js';
import type { AnyColor } from '../types.js';

declare module '../colordx.js' {
  interface Colordx {
    delta(color?: AnyColor): number;
  }
}

const delta: Plugin = (ColordxClass) => {
  ColordxClass.prototype.delta = function (color: AnyColor = '#fff') {
    return round(deltaE2000(rgbToLab(this.toRgb()), rgbToLab(new ColordxClass(color).toRgb())) / 100, 3);
  };
};

export default delta;

import { oklabToRgb, rgbToOklab } from '../colorModels/oklab.js';
import type { Colordx, Plugin } from '../colordx.js';
import { clamp, round } from '../helpers.js';
import type { AnyColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    mix(color: AnyColor | Colordx, ratio?: number): Colordx;
    mixOklab(color: AnyColor | Colordx, ratio?: number): Colordx;
    tints(count?: number): Colordx[];
    shades(count?: number): Colordx[];
    tones(count?: number): Colordx[];
    palette(count: number, target?: AnyColor): Colordx[];
  }
}

const mix: Plugin = (ColordxClass) => {
  ColordxClass.prototype.mix = function (this: Colordx, color: AnyColor | Colordx, ratio = 0.5): Colordx {
    const other = new ColordxClass(color).toRgb();
    const self = this._rawRgb();
    const w = clamp(ratio, 0, 1);
    return new ColordxClass({
      r: round(self.r * (1 - w) + other.r * w),
      g: round(self.g * (1 - w) + other.g * w),
      b: round(self.b * (1 - w) + other.b * w),
      alpha: round(self.alpha * (1 - w) + other.alpha * w, 3),
    });
  };

  ColordxClass.prototype.mixOklab = function (this: Colordx, color: AnyColor | Colordx, ratio = 0.5): Colordx {
    const oklab1 = rgbToOklab(this._rawRgb());
    const oklab2 = rgbToOklab(new ColordxClass(color)._rawRgb());
    const w = clamp(ratio, 0, 1);
    return new ColordxClass(
      oklabToRgb({
        l: oklab1.l * (1 - w) + oklab2.l * w,
        a: oklab1.a * (1 - w) + oklab2.a * w,
        b: oklab1.b * (1 - w) + oklab2.b * w,
        alpha: round(oklab1.alpha * (1 - w) + oklab2.alpha * w, 3),
      })
    );
  };

  const scale = (self: Colordx, count: number, target: AnyColor): Colordx[] => {
    if (count <= 0) return [];
    if (count === 1) return [self];
    return Array.from({ length: count }, (_, i) => self.mix(target, i / (count - 1)));
  };

  ColordxClass.prototype.tints = function (this: Colordx, count = 5): Colordx[] {
    return scale(this, count, '#ffffff');
  };

  ColordxClass.prototype.shades = function (this: Colordx, count = 5): Colordx[] {
    return scale(this, count, '#000000');
  };

  ColordxClass.prototype.tones = function (this: Colordx, count = 5): Colordx[] {
    return scale(this, count, '#808080');
  };

  ColordxClass.prototype.palette = function (this: Colordx, count: number, target: AnyColor = '#ffffff'): Colordx[] {
    return scale(this, count, target);
  };
};

export default mix;

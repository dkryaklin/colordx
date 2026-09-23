import { oklabToRgb, rgbToOklab } from '../colorModels/oklab.js';
import type { Colordx, Plugin } from '../colordx.js';
import { clamp, mixWeights, round } from '../helpers.js';
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
    // Both sides unrounded so a.mix(b, t) and b.mix(a, 1 - t) land on the same byte.
    const other = new ColordxClass(color)._rawRgb();
    const self = this._rawRgb();
    const [k1, k2, alpha] = mixWeights(self.alpha, other.alpha, clamp(ratio, 0, 1));
    return new ColordxClass({
      r: round(self.r * k1 + other.r * k2),
      g: round(self.g * k1 + other.g * k2),
      b: round(self.b * k1 + other.b * k2),
      alpha: round(alpha, 3),
    });
  };

  ColordxClass.prototype.mixOklab = function (this: Colordx, color: AnyColor | Colordx, ratio = 0.5): Colordx {
    const oklab1 = rgbToOklab(this._rawRgb());
    const oklab2 = rgbToOklab(new ColordxClass(color)._rawRgb());
    const [k1, k2, alpha] = mixWeights(oklab1.alpha, oklab2.alpha, clamp(ratio, 0, 1));
    return new ColordxClass(
      oklabToRgb({
        l: oklab1.l * k1 + oklab2.l * k2,
        a: oklab1.a * k1 + oklab2.a * k2,
        b: oklab1.b * k1 + oklab2.b * k2,
        alpha: round(alpha, 3),
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

import { oklabToLinear, rgbToOklab } from '../colorModels/oklab.js';
import type { Colordx, Plugin } from '../colordx.js';
import { clamp, mixWeight, round } from '../helpers.js';
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
    // Both sides unrounded so a.mix(b, t) and b.mix(a, 1 - t) are the same color, and the result
    // unclamped like color-mix(in srgb): a wide-gamut input stays wide-gamut.
    const other = new ColordxClass(color)._rawRgb();
    const self = this._rawRgb();
    const w = clamp(ratio, 0, 1);
    const k = mixWeight(self.alpha, other.alpha, w);
    return ColordxClass._makeFromStoredRgb({
      r: self.r * (1 - k) + other.r * k,
      g: self.g * (1 - k) + other.g * k,
      b: self.b * (1 - k) + other.b * k,
      alpha: round(self.alpha * (1 - w) + other.alpha * w, 3),
    });
  };

  ColordxClass.prototype.mixOklab = function (this: Colordx, color: AnyColor | Colordx, ratio = 0.5): Colordx {
    const oklab1 = rgbToOklab(this._rawRgb());
    const oklab2 = rgbToOklab(new ColordxClass(color)._rawRgb());
    const w = clamp(ratio, 0, 1);
    const k = mixWeight(oklab1.alpha, oklab2.alpha, w);
    // Unclamped, like color-mix(in oklab): a wide-gamut input stays wide-gamut.
    const [lr, lg, lb] = oklabToLinear(
      oklab1.l * (1 - k) + oklab2.l * k,
      oklab1.a * (1 - k) + oklab2.a * k,
      oklab1.b * (1 - k) + oklab2.b * k
    );
    return ColordxClass._makeFromLinearSrgb(lr, lg, lb, round(oklab1.alpha * (1 - w) + oklab2.alpha * w, 3), false);
  };

  const scale = (method: string, self: Colordx, count: number, target: AnyColor): Colordx[] => {
    if (count === Infinity) throw new RangeError(`${method}: count must be finite, got Infinity`);
    const n = Math.floor(count);
    if (!(n >= 1)) return [];
    if (n === 1) return [self];
    return Array.from({ length: n }, (_, i) => self.mix(target, i / (n - 1)));
  };

  ColordxClass.prototype.tints = function (this: Colordx, count = 5): Colordx[] {
    return scale('tints', this, count, '#ffffff');
  };

  ColordxClass.prototype.shades = function (this: Colordx, count = 5): Colordx[] {
    return scale('shades', this, count, '#000000');
  };

  ColordxClass.prototype.tones = function (this: Colordx, count = 5): Colordx[] {
    return scale('tones', this, count, '#808080');
  };

  ColordxClass.prototype.palette = function (this: Colordx, count: number, target: AnyColor = '#ffffff'): Colordx[] {
    return scale('palette', this, count, target);
  };
};

export default mix;

import { oklabToLinear, rgbToOklab } from '../colorModels/oklab.js';
import { OKLCH_ACHROMATIC, rgbToOklch } from '../colorModels/oklch.js';
import type { Colordx, Plugin } from '../colordx.js';
import { clamp, invalidColorError, mixWeight, round } from '../helpers.js';
import type { AnyColor } from '../types.js';

/** How `mixOklch()` walks the hue circle, as in CSS `color-mix(in oklch <method> hue, …)`. */
export type HueMethod = 'shorter' | 'longer' | 'increasing' | 'decreasing';

declare module '@colordx/core' {
  interface Colordx {
    mix(color: AnyColor | Colordx, ratio?: number): Colordx;
    mixOklab(color: AnyColor | Colordx, ratio?: number): Colordx;
    mixOklch(color: AnyColor | Colordx, ratio?: number, options?: { hue?: HueMethod }): Colordx;
    tints(count?: number): Colordx[];
    shades(count?: number): Colordx[];
    tones(count?: number): Colordx[];
    palette(count: number, target?: AnyColor | Colordx): Colordx[];
  }
}

const DEG = Math.PI / 180;

const hueDelta = (h1: number, h2: number, method: HueMethod): number => {
  const d = h2 - h1;
  switch (method) {
    case 'shorter':
      return d > 180 ? d - 360 : d < -180 ? d + 360 : d;
    case 'longer':
      return d > 0 && d < 180 ? d - 360 : d > -180 && d < 0 ? d + 360 : d;
    case 'increasing':
      return d < 0 ? d + 360 : d;
    case 'decreasing':
      return d > 0 ? d - 360 : d;
    default:
      throw new RangeError(`mixOklch: unknown hue method "${String(method)}"`);
  }
};

const mix: Plugin = (ColordxClass) => {
  const pair = (method: string, self: Colordx, input: AnyColor | Colordx): Colordx => {
    if (!self.isValid()) throw invalidColorError(method, self, true);
    const other = new ColordxClass(input);
    if (!other.isValid()) throw invalidColorError(method, input);
    return other;
  };

  ColordxClass.prototype.mix = function (this: Colordx, color: AnyColor | Colordx, ratio = 0.5): Colordx {
    const other = pair('mix', this, color)._rawRgb();
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
    const oklab2 = rgbToOklab(pair('mixOklab', this, color)._rawRgb());
    const oklab1 = rgbToOklab(this._rawRgb());
    const w = clamp(ratio, 0, 1);
    const k = mixWeight(oklab1.alpha, oklab2.alpha, w);
    const [lr, lg, lb] = oklabToLinear(
      oklab1.l * (1 - k) + oklab2.l * k,
      oklab1.a * (1 - k) + oklab2.a * k,
      oklab1.b * (1 - k) + oklab2.b * k
    );
    return ColordxClass._makeFromLinearSrgb(lr, lg, lb, round(oklab1.alpha * (1 - w) + oklab2.alpha * w, 3), false);
  };

  ColordxClass.prototype.mixOklch = function (
    this: Colordx,
    color: AnyColor | Colordx,
    ratio = 0.5,
    options?: { hue?: HueMethod }
  ): Colordx {
    const c2 = rgbToOklch(pair('mixOklch', this, color)._rawRgb());
    const c1 = rgbToOklch(this._rawRgb());
    const w = clamp(ratio, 0, 1);
    const k = mixWeight(c1.alpha, c2.alpha, w);
    const h1 = c1.c < OKLCH_ACHROMATIC ? c2.h : c1.h;
    const h2 = c2.c < OKLCH_ACHROMATIC ? c1.h : c2.h;
    const h = (h1 + hueDelta(h1, h2, options?.hue ?? 'shorter') * w) * DEG;
    const l = c1.l * (1 - k) + c2.l * k;
    const c = c1.c * (1 - k) + c2.c * k;
    const [lr, lg, lb] = oklabToLinear(l, c * Math.cos(h), c * Math.sin(h));
    return ColordxClass._makeFromLinearSrgb(lr, lg, lb, round(c1.alpha * (1 - w) + c2.alpha * w, 3), false);
  };

  const scale = (method: string, self: Colordx, count: number, target: AnyColor | Colordx): Colordx[] => {
    const to = pair(method, self, target);
    if (count === Infinity) throw new RangeError(`${method}: count must be finite, got Infinity`);
    const n = Math.floor(count);
    if (!(n >= 1)) return [];
    if (n === 1) return [self];
    return Array.from({ length: n }, (_, i) => self.mix(to, i / (n - 1)));
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

  ColordxClass.prototype.palette = function (
    this: Colordx,
    count: number,
    target: AnyColor | Colordx = '#ffffff'
  ): Colordx[] {
    return scale('palette', this, count, target);
  };
};

export default mix;

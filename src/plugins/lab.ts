import { deltaE2000, labToRgb, parseLabObject, parseLabString, rgbToLab, rgbToLabD65 } from '../colorModels/lab.js';
import { parseXyzObject, rgbToXyz } from '../colorModels/xyz.js';
import type { Colordx, Plugin } from '../colordx.js';
import { clamp, round } from '../helpers.js';
import type { AnyColor, LabColor, XyzColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toLab(): LabColor;
    toLabString(): string;
    toXyz(): XyzColor;
    toXyzString(): string;
    mixLab(color: AnyColor, ratio?: number): Colordx;
    delta(color?: AnyColor): number;
  }
}

const lab: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toLab = function () {
    const { l, a, b, alpha } = rgbToLab(this._rawRgb());
    return { l: round(l, 2), a: round(a, 2) || 0, b: round(b, 2) || 0, alpha, colorSpace: 'lab' as const }; // || 0 suppresses −0
  };
  ColordxClass.prototype.toLabString = function (this: Colordx) {
    const { l, a, b, alpha } = this.toLab();
    return alpha < 1 ? `lab(${l}% ${a} ${b} / ${alpha})` : `lab(${l}% ${a} ${b})`;
  };
  ColordxClass.prototype.toXyz = function () {
    const { x, y, z, alpha } = rgbToXyz(this._rawRgb());
    return { x: round(x, 2), y: round(y, 2), z: round(z, 2), alpha };
  };
  ColordxClass.prototype.toXyzString = function (this: Colordx) {
    const { x, y, z, alpha } = this.toXyz();
    return alpha < 1 ? `color(xyz-d65 ${x} ${y} ${z} / ${alpha})` : `color(xyz-d65 ${x} ${y} ${z})`;
  };
  ColordxClass.prototype.mixLab = function (this: Colordx, color: AnyColor, ratio = 0.5): Colordx {
    const lab1 = rgbToLab(this._rawRgb());
    const lab2 = rgbToLab(new ColordxClass(color)._rawRgb());
    const w = clamp(ratio, 0, 1);
    return new ColordxClass(
      labToRgb({
        l: lab1.l * (1 - w) + lab2.l * w,
        a: lab1.a * (1 - w) + lab2.a * w,
        b: lab1.b * (1 - w) + lab2.b * w,
        alpha: round(lab1.alpha * (1 - w) + lab2.alpha * w, 3),
        colorSpace: 'lab',
      })
    );
  };
  /** Returns ΔE2000 color difference normalized to [0, 1] (divide by 100). 0 = identical, 1 = maximally different. */
  ColordxClass.prototype.delta = function (color: AnyColor = '#fff') {
    return round(deltaE2000(rgbToLabD65(this._rawRgb()), rgbToLabD65(new ColordxClass(color)._rawRgb())) / 100, 3);
  };
  parsers.push(parseLabString, parseLabObject, parseXyzObject);
  formatParsers.push([parseLabString, 'lab'], [parseLabObject, 'lab'], [parseXyzObject, 'xyz']);
};

export default lab;

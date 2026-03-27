import { deltaE2000, labToRgb, parseLabObject, rgbToLab } from '../colorModels/lab.js';
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
    const { l, a, b, alpha } = rgbToLab(this.toRgb());
    return { l: round(l, 2), a: round(a, 2) || 0, b: round(b, 2) || 0, alpha };
  };
  ColordxClass.prototype.toLabString = function (this: Colordx) {
    const { l, a, b, alpha } = this.toLab();
    return alpha < 1 ? `lab(${l}% ${a} ${b} / ${alpha})` : `lab(${l}% ${a} ${b})`;
  };
  ColordxClass.prototype.toXyz = function () {
    const { x, y, z, alpha } = rgbToXyz(this.toRgb());
    return { x: round(x, 2), y: round(y, 2), z: round(z, 2), alpha };
  };
  ColordxClass.prototype.toXyzString = function (this: Colordx) {
    const { x, y, z, alpha } = this.toXyz();
    return alpha < 1 ? `color(xyz-d65 ${x} ${y} ${z} / ${alpha})` : `color(xyz-d65 ${x} ${y} ${z})`;
  };
  ColordxClass.prototype.mixLab = function (this: Colordx, color: AnyColor, ratio = 0.5): Colordx {
    const a = rgbToLab(this.toRgb());
    const b = rgbToLab(new ColordxClass(color).toRgb());
    const w = clamp(ratio, 0, 1);
    return new ColordxClass(
      labToRgb({
        l: a.l * (1 - w) + b.l * w,
        a: a.a * (1 - w) + b.a * w,
        b: a.b * (1 - w) + b.b * w,
        alpha: round(a.alpha * (1 - w) + b.alpha * w, 3),
      })
    );
  };
  ColordxClass.prototype.delta = function (color: AnyColor = '#fff') {
    return round(deltaE2000(rgbToLab(this.toRgb()), rgbToLab(new ColordxClass(color).toRgb())) / 100, 3);
  };
  parsers.push(parseLabObject, parseXyzObject);
  formatParsers.push([parseLabObject, 'lab'], [parseXyzObject, 'xyz']);
};

export default lab;

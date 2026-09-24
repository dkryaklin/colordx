import {
  deltaE2000,
  labToXyzValues,
  parseLabObject,
  parseLabString,
  rgbToLab,
  rgbToLabD65,
} from '../colorModels/lab.js';
import {
  parseXyzD50String,
  parseXyzD65Object,
  parseXyzD65String,
  parseXyzObject,
  rgbToXyz,
  rgbToXyzD65,
  xyzD50ToLinearSrgb,
} from '../colorModels/xyz.js';
import type { Colordx, Plugin } from '../colordx.js';
import { clamp, fixedNotation, mixWeight, round } from '../helpers.js';
import type { AnyColor, ColorParser, LabColor, XyzColor, XyzD65Color } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toLab(precision?: number): LabColor;
    toLabString(precision?: number): string;
    toXyz(precision?: number): XyzColor;
    toXyzString(precision?: number): string;
    toXyzD65(precision?: number): XyzD65Color;
    toXyzD65String(precision?: number): string;
    mixLab(color: AnyColor, ratio?: number): Colordx;
    delta(color?: AnyColor | Colordx, precision?: number): number;
  }
}

const lab: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toLab = function (precision = 2) {
    const { l, a, b, alpha } = rgbToLab(this._rawRgb());
    return {
      l: round(l, precision),
      a: round(a, precision),
      b: round(b, precision),
      alpha,
      colorSpace: 'lab' as const,
    };
  };
  ColordxClass.prototype.toLabString = function (this: Colordx, precision = 2) {
    const { l, a, b, alpha } = this.toLab(precision);
    return fixedNotation(alpha < 1 ? `lab(${l} ${a} ${b} / ${alpha})` : `lab(${l} ${a} ${b})`, precision);
  };
  ColordxClass.prototype.toXyz = function (precision = 2) {
    const { x, y, z, alpha } = rgbToXyz(this._rawRgb());
    return { x: round(x, precision), y: round(y, precision), z: round(z, precision), alpha };
  };
  // CSS Color 4 color(xyz-*) channels are 0–1 (1 = reference-white Y); the object API is 0–100.
  ColordxClass.prototype.toXyzString = function (this: Colordx, precision = 5) {
    const { x, y, z, alpha } = rgbToXyz(this._rawRgb());
    const cx = round(x / 100, precision),
      cy = round(y / 100, precision),
      cz = round(z / 100, precision);
    return fixedNotation(
      alpha < 1 ? `color(xyz-d50 ${cx} ${cy} ${cz} / ${alpha})` : `color(xyz-d50 ${cx} ${cy} ${cz})`,
      precision
    );
  };
  ColordxClass.prototype.toXyzD65 = function (precision = 2) {
    const { x, y, z, alpha } = rgbToXyzD65(this._rawRgb());
    return {
      x: round(x, precision),
      y: round(y, precision),
      z: round(z, precision),
      alpha,
      colorSpace: 'xyz-d65' as const,
    };
  };
  ColordxClass.prototype.toXyzD65String = function (this: Colordx, precision = 5) {
    const { x, y, z, alpha } = rgbToXyzD65(this._rawRgb());
    const cx = round(x / 100, precision),
      cy = round(y / 100, precision),
      cz = round(z / 100, precision);
    return fixedNotation(
      alpha < 1 ? `color(xyz-d65 ${cx} ${cy} ${cz} / ${alpha})` : `color(xyz-d65 ${cx} ${cy} ${cz})`,
      precision
    );
  };
  ColordxClass.prototype.mixLab = function (this: Colordx, color: AnyColor, ratio = 0.5): Colordx {
    const lab1 = rgbToLab(this._rawRgb());
    const lab2 = rgbToLab(new ColordxClass(color)._rawRgb());
    const w = clamp(ratio, 0, 1);
    const k = mixWeight(lab1.alpha, lab2.alpha, w);
    // Unclamped, like color-mix(in lab): a wide-gamut input stays wide-gamut.
    const [x, y, z] = labToXyzValues(
      lab1.l * (1 - k) + lab2.l * k,
      lab1.a * (1 - k) + lab2.a * k,
      lab1.b * (1 - k) + lab2.b * k
    );
    const [lr, lg, lb] = xyzD50ToLinearSrgb(x, y, z);
    return ColordxClass._makeFromLinearSrgb(lr, lg, lb, round(lab1.alpha * (1 - w) + lab2.alpha * w, 3), false);
  };
  /** Returns ΔE2000 color difference normalized to [0, 1] (divide by 100). 0 = identical, 1 = maximally different. */
  ColordxClass.prototype.delta = function (color: AnyColor | Colordx = '#fff', precision = 3) {
    return round(
      deltaE2000(rgbToLabD65(this._rawRgb()), rgbToLabD65(new ColordxClass(color)._rawRgb())) / 100,
      precision
    );
  };
  (parseLabString as ColorParser).inputKind = 'string';
  (parseLabObject as ColorParser).inputKind = 'object';
  (parseXyzD65String as ColorParser).inputKind = 'string';
  (parseXyzD65Object as ColorParser).inputKind = 'object';
  (parseXyzD50String as ColorParser).inputKind = 'string';
  (parseXyzObject as ColorParser).inputKind = 'object';
  parsers.push(parseLabString, parseLabObject, parseXyzD65String, parseXyzD65Object, parseXyzD50String, parseXyzObject);
  formatParsers.push(
    [parseLabString, 'lab'],
    [parseLabObject, 'lab'],
    [parseXyzD65String, 'xyz-d65'],
    [parseXyzD65Object, 'xyz-d65'],
    [parseXyzD50String, 'xyz'],
    [parseXyzObject, 'xyz']
  );
};

export default lab;

import { parseP3String, rgbToP3 } from '../colorModels/p3.js';
import type { Plugin } from '../colordx.js';
import type { P3Color } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    toP3(): P3Color;
    toP3String(): string;
  }
}

const p3: Plugin = (ColordxClass, parsers, formatParsers) => {
  ColordxClass.prototype.toP3 = function () {
    return rgbToP3(this.toRgb());
  };
  ColordxClass.prototype.toP3String = function () {
    const { r, g, b, a } = this.toP3();
    return a < 1 ? `color(display-p3 ${r} ${g} ${b} / ${a})` : `color(display-p3 ${r} ${g} ${b})`;
  };
  parsers.push(parseP3String);
  formatParsers.push([parseP3String, 'p3']);
};

export default p3;

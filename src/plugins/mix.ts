import type { Plugin } from '../colordx.js';
import { Colordx } from '../colordx.js';
import type { AnyColor } from '../types.js';

declare module '../colordx.js' {
  interface Colordx {
    tint(amount?: number): Colordx;
    shade(amount?: number): Colordx;
    tone(amount?: number): Colordx;
    palette(count: number, target?: AnyColor): Colordx[];
  }
}

/**
 * Extends Colordx with tint/shade/tone helpers and multi-stop mixing.
 */
const mix: Plugin = (ColordClass) => {
  ColordClass.prototype.tint = function (this: Colordx, amount = 0.1): Colordx {
    return this.mix('#ffffff', amount);
  };

  ColordClass.prototype.shade = function (this: Colordx, amount = 0.1): Colordx {
    return this.mix('#000000', amount);
  };

  ColordClass.prototype.tone = function (this: Colordx, amount = 0.1): Colordx {
    return this.mix('#808080', amount);
  };

  ColordClass.prototype.palette = function (this: Colordx, count: number, target: AnyColor = '#ffffff'): Colordx[] {
    return Array.from({ length: count }, (_, i) => this.mix(target, i / (count - 1)));
  };
};

export default mix;

import type { Colordx, Plugin } from '../colordx.js';
import type { AnyColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    tints(count?: number): Colordx[];
    shades(count?: number): Colordx[];
    tones(count?: number): Colordx[];
    palette(count: number, target?: AnyColor): Colordx[];
  }
}

const mix: Plugin = (ColordxClass) => {
  ColordxClass.prototype.tints = function (this: Colordx, count = 5): Colordx[] {
    return Array.from({ length: count }, (_, i) => this.mix('#ffffff', i / (count - 1)));
  };

  ColordxClass.prototype.shades = function (this: Colordx, count = 5): Colordx[] {
    return Array.from({ length: count }, (_, i) => this.mix('#000000', i / (count - 1)));
  };

  ColordxClass.prototype.tones = function (this: Colordx, count = 5): Colordx[] {
    return Array.from({ length: count }, (_, i) => this.mix('#808080', i / (count - 1)));
  };

  ColordxClass.prototype.palette = function (this: Colordx, count: number, target: AnyColor = '#ffffff'): Colordx[] {
    return Array.from({ length: count }, (_, i) => this.mix(target, i / (count - 1)));
  };
};

export default mix;

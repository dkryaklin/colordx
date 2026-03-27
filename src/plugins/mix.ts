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

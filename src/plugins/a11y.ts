import type { Plugin } from '../colordx.js';
import { Colordx } from '../colordx.js';
import type { AnyColor } from '../types.js';

declare module '../colordx.js' {
  interface Colordx {
    isReadable(background?: AnyColor, options?: { level?: 'AA' | 'AAA'; size?: 'normal' | 'large' }): boolean;
    minReadable(background?: AnyColor): Colordx;
  }
}

const a11y: Plugin = (ColordClass) => {
  ColordClass.prototype.isReadable = function (
    this: Colordx,
    background: AnyColor = '#fff',
    options: { level?: 'AA' | 'AAA'; size?: 'normal' | 'large' } = {}
  ): boolean {
    const { level = 'AA', size = 'normal' } = options;
    const ratio = this.contrast(background);
    if (level === 'AAA') return size === 'large' ? ratio >= 4.5 : ratio >= 7;
    return size === 'large' ? ratio >= 3 : ratio >= 4.5;
  };

  ColordClass.prototype.minReadable = function (this: Colordx, background: AnyColor = '#fff'): Colordx {
    let color: Colordx = new Colordx(this.toRgb());
    const bgLuminance = new Colordx(background).luminance();
    const darken = this.luminance() < bgLuminance;

    for (let i = 0; i < 100; i++) {
      if (color.contrast(background) >= 4.5) break;
      color = darken ? color.darken(0.01) : color.lighten(0.01);
    }
    return color;
  };
};

export default a11y;

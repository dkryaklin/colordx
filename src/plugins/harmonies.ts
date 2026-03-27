import type { Colordx, Plugin } from '../colordx.js';

declare module '@colordx/core' {
  interface Colordx {
    harmonies(type?: 'complementary' | 'analogous' | 'triadic' | 'tetradic' | 'split-complementary'): Colordx[];
  }
}

const harmonies: Plugin = (ColordxClass) => {
  ColordxClass.prototype.harmonies = function (
    this: Colordx,
    type: 'complementary' | 'analogous' | 'triadic' | 'tetradic' | 'split-complementary' = 'complementary'
  ): Colordx[] {
    switch (type) {
      case 'complementary':
        return [this, this.rotate(180)];
      case 'analogous':
        return [this.rotate(-30), this, this.rotate(30)];
      case 'triadic':
        return [this, this.rotate(120), this.rotate(240)];
      case 'tetradic':
        return [this, this.rotate(90), this.rotate(180), this.rotate(270)];
      case 'split-complementary':
        return [this, this.rotate(150), this.rotate(210)];
      default:
        return [this];
    }
  };
};

export default harmonies;

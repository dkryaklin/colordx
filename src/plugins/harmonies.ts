import type { Colordx, Plugin } from '../colordx.js';

type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'tetradic'
  | 'split-complementary'
  | 'double-split-complementary'
  | 'rectangle';

declare module '@colordx/core' {
  interface Colordx {
    harmonies(type?: HarmonyType): Colordx[];
  }
}

const HARMONIES: Record<HarmonyType, number[]> = {
  analogous: [-30, 0, 30],
  complementary: [0, 180],
  'double-split-complementary': [-30, 0, 30, 150, 210],
  rectangle: [0, 60, 180, 240],
  tetradic: [0, 90, 180, 270],
  triadic: [0, 120, 240],
  'split-complementary': [0, 150, 210],
};

const harmonies: Plugin = (ColordxClass) => {
  ColordxClass.prototype.harmonies = function (this: Colordx, type: HarmonyType = 'complementary'): Colordx[] {
    return HARMONIES[type].map((degrees) => this.rotate(degrees));
  };
};

export default harmonies;

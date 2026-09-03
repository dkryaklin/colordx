import type { Colordx, Plugin } from '../colordx.js';
import { srgbToLinear } from '../transfer.js';

export type CvdType = 'protanopia' | 'deuteranopia' | 'tritanopia';

declare module '@colordx/core' {
  interface Colordx {
    simulate(type: CvdType): Colordx;
  }
}

type Matrix = readonly [number, number, number, number, number, number, number, number, number];

// Machado, Oliveira & Fernandes 2009, severity 1.0, on linear sRGB. Same matrices as Chrome and Firefox DevTools.
const MACHADO: Record<'protanopia' | 'deuteranopia', Matrix> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
};

// Brettel, Viénot & Mollon 1997 for tritan (Machado is weak there): one projection per half-plane,
// split by a plane through the achromatic axis. RGB form of daltonlens 0.1 (Python) with its
// LMSModel_sRGB_SmithPokorny75: rgb_from_lms · H · lms_from_rgb, and the plane normal · lms_from_rgb.
const BRETTEL_TRITAN = {
  a: [
    1.0135416153, 0.1426823107, -0.156223926, -0.0118053648, 0.8756118317, 0.1361935331, 0.0770725345, 0.8120809125,
    0.110846553,
  ] as Matrix,
  b: [
    0.9333697629, 0.1999900499, -0.1333598129, 0.0580871806, 0.8256518564, 0.1162609631, -0.3792281148, 1.1382497342,
    0.2409783807,
  ] as Matrix,
  plane: [0.0396009507, -0.0283072037, -0.011293747] as const,
};

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

const cvd: Plugin = (ColordxClass) => {
  ColordxClass.prototype.simulate = function (this: Colordx, type: CvdType): Colordx {
    const { r, g, b, alpha } = this.mapSrgb()._rawRgb();
    const lr = srgbToLinear(r / 255);
    const lg = srgbToLinear(g / 255);
    const lb = srgbToLinear(b / 255);
    let m: Matrix | undefined;
    if (type === 'tritanopia') {
      const [nr, ng, nb] = BRETTEL_TRITAN.plane;
      m = nr * lr + ng * lg + nb * lb >= 0 ? BRETTEL_TRITAN.a : BRETTEL_TRITAN.b;
    } else m = MACHADO[type];
    if (!m) throw new RangeError(`simulate: unknown type "${String(type)}"`);
    return ColordxClass._makeFromLinearSrgb(
      clamp01(m[0] * lr + m[1] * lg + m[2] * lb),
      clamp01(m[3] * lr + m[4] * lg + m[5] * lb),
      clamp01(m[6] * lr + m[7] * lg + m[8] * lb),
      alpha
    );
  };
};

export default cvd;

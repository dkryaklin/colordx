import type { Colordx, Plugin } from '../colordx.js';
import { byteToLinear } from '../transfer.js';

export type CvdType = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

declare module '@colordx/core' {
  interface Colordx {
    simulate(type: CvdType, severity?: number): Colordx;
  }
}

type Matrix = readonly [number, number, number, number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const MACHADO: Record<'protanopia' | 'deuteranopia', readonly number[][]> = {
  protanopia: [
    [0.856167, 0.182038, -0.038205, 0.029342, 0.955115, 0.015544, -0.00288, -0.001563, 1.004443],
    [0.734766, 0.334872, -0.069637, 0.05184, 0.919198, 0.028963, -0.004928, -0.004209, 1.009137],
    [0.630323, 0.465641, -0.095964, 0.069181, 0.890046, 0.040773, -0.006308, -0.007724, 1.014032],
    [0.539009, 0.579343, -0.118352, 0.082546, 0.866121, 0.051332, -0.007136, -0.011959, 1.019095],
    [0.458064, 0.679578, -0.137642, 0.092785, 0.846313, 0.060902, -0.007494, -0.016807, 1.024301],
    [0.38545, 0.769005, -0.154455, 0.100526, 0.829802, 0.069673, -0.007442, -0.02219, 1.029632],
    [0.319627, 0.849633, -0.169261, 0.106241, 0.815969, 0.07779, -0.007025, -0.028051, 1.035076],
    [0.259411, 0.923008, -0.18242, 0.110296, 0.80434, 0.085364, -0.006276, -0.034346, 1.040622],
    [0.203876, 0.990338, -0.194214, 0.112975, 0.794542, 0.092483, -0.005222, -0.041043, 1.046265],
    [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.866435, 0.177704, -0.044139, 0.049567, 0.939063, 0.01137, -0.003453, 0.007233, 0.99622],
    [0.760729, 0.319078, -0.079807, 0.090568, 0.889315, 0.020117, -0.006027, 0.013325, 0.992702],
    [0.675425, 0.43385, -0.109275, 0.125303, 0.847755, 0.026942, -0.00795, 0.018572, 0.989378],
    [0.605511, 0.52856, -0.134071, 0.155318, 0.812366, 0.032316, -0.009376, 0.023176, 0.9862],
    [0.547494, 0.607765, -0.155259, 0.181692, 0.781742, 0.036566, -0.01041, 0.027275, 0.983136],
    [0.498864, 0.674741, -0.173604, 0.205199, 0.754872, 0.039929, -0.011131, 0.030969, 0.980162],
    [0.457771, 0.731899, -0.18967, 0.226409, 0.731012, 0.042579, -0.011595, 0.034333, 0.977261],
    [0.422823, 0.781057, -0.203881, 0.245752, 0.709602, 0.044646, -0.011843, 0.037423, 0.974421],
    [0.392952, 0.82361, -0.216562, 0.263559, 0.69021, 0.046232, -0.01191, 0.040281, 0.97163],
    [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  ],
};

const machado = (type: 'protanopia' | 'deuteranopia', severity: number): Matrix => {
  const rows = MACHADO[type];
  const x = severity * rows.length;
  const i = Math.floor(x);
  const hi = rows[i < rows.length ? i : rows.length - 1]!;
  const lo = i > 0 ? rows[i - 1]! : IDENTITY;
  const t = x - i;
  return (t === 0 ? lo : lo.map((v, k) => v + (hi[k]! - v) * t)) as unknown as Matrix;
};

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

const LUMINANCE: Matrix = [0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722];

const clamp01 = (n: number): number => (n > 0 ? (n < 1 ? n : 1) : 0);

const cvd: Plugin = (ColordxClass) => {
  ColordxClass.prototype.simulate = function (this: Colordx, type: CvdType, severity = 1): Colordx {
    const { r, g, b, alpha } = this.mapSrgb()._rawRgb();
    const lr = byteToLinear(r);
    const lg = byteToLinear(g);
    const lb = byteToLinear(b);
    const s = clamp01(severity);
    let m: Matrix;
    let blend = 1;
    if (type === 'tritanopia') {
      const [nr, ng, nb] = BRETTEL_TRITAN.plane;
      m = nr * lr + ng * lg + nb * lb >= 0 ? BRETTEL_TRITAN.a : BRETTEL_TRITAN.b;
      blend = s;
    } else if (type === 'achromatopsia') {
      m = LUMINANCE;
      blend = s;
    } else if (type === 'protanopia' || type === 'deuteranopia') m = machado(type, s);
    else throw new RangeError(`simulate: unknown type "${String(type)}"`);
    const keep = 1 - blend;
    return ColordxClass._makeFromLinearSrgb(
      clamp01((m[0] * lr + m[1] * lg + m[2] * lb) * blend + lr * keep),
      clamp01((m[3] * lr + m[4] * lg + m[5] * lb) * blend + lg * keep),
      clamp01((m[6] * lr + m[7] * lg + m[8] * lb) * blend + lb * keep),
      alpha
    );
  };
};

export default cvd;

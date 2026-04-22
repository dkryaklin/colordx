import { NUM_OR_NONE, clamp, hasKeys, isAnyNumber, isObject, parseNum, round, sanitize } from '../helpers.js';
import { srgbToLinear } from '../transfer.js';
import type { LabColor, RgbColor, XyzColor } from '../types.js';
import { D50_WX as WX, D50_WY as WY, D50_WZ as WZ, rgbToXyz, xyzToRgb } from './xyz.js';

// D65 white point derived from CIE chromaticity (x=0.3127, y=0.329)
const D65_WX = (0.3127 / 0.329) * 100;
const D65_WY = 100;
const D65_WZ = ((1 - 0.3127 - 0.329) / 0.329) * 100;

const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

const f = (t: number) => (t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116);

export const xyzToLab = ({ x, y, z, alpha }: XyzColor): LabColor => {
  const fy = f(y / WY);
  return {
    l: 116 * fy - 16,
    a: 500 * (f(x / WX) - fy) || 0, // || 0 suppresses −0; NaN is impossible since WX/WZ are non-zero constants
    b: 200 * (fy - f(z / WZ)) || 0,
    alpha: round(alpha, 3),
    colorSpace: 'lab' as const,
  };
};

export const labToXyz = ({ l, a, b, alpha }: LabColor): XyzColor => {
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  return {
    x: (fx ** 3 > EPSILON ? fx ** 3 : (116 * fx - 16) / KAPPA) * WX,
    y: (l > 8 ? fy ** 3 : l / KAPPA) * WY,
    z: (fz ** 3 > EPSILON ? fz ** 3 : (116 * fz - 16) / KAPPA) * WZ,
    alpha,
  };
};

export const rgbToLab = (rgb: RgbColor): LabColor => xyzToLab(rgbToXyz(rgb));

/** RGB → CIE Lab using D65 white point (screen-native; used for perceptual difference). */
export const rgbToLabD65 = ({ r, g, b, alpha }: RgbColor): LabColor => {
  const lr = srgbToLinear(r / 255),
    lg = srgbToLinear(g / 255),
    lb = srgbToLinear(b / 255);
  const x = 100 * (0.41239079926595951 * lr + 0.35758433938387796 * lg + 0.18048078840183429 * lb);
  const y = 100 * (0.21263900587151036 * lr + 0.71516867876775592 * lg + 0.072192315360733714 * lb);
  const z = 100 * (0.019330818715591849 * lr + 0.11919477979462599 * lg + 0.95053215224966059 * lb);
  const fy = f(y / D65_WY);
  return {
    l: 116 * fy - 16,
    a: 500 * (f(x / D65_WX) - fy) || 0,
    b: 200 * (fy - f(z / D65_WZ)) || 0,
    alpha: round(alpha, 3),
    colorSpace: 'lab' as const,
  };
};

export const deltaE2000 = (lab1: LabColor, lab2: LabColor): number => {
  const { l: L1, a: a1, b: b1 } = lab1;
  const { l: L2, a: a2, b: b2 } = lab2;
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const C1 = Math.sqrt(a1 ** 2 + b1 ** 2);
  const C2 = Math.sqrt(a2 ** 2 + b2 ** 2);
  const Cab = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cab / (Cab + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p ** 2 + b1 ** 2);
  const C2p = Math.sqrt(a2p ** 2 + b2 ** 2);
  const Cp = (C1p + C2p) / 2;

  const h1p = a1p === 0 && b1 === 0 ? 0 : Math.atan2(b1, a1p) * deg;
  const h2p = a2p === 0 && b2 === 0 ? 0 : Math.atan2(b2, a2p) * deg;
  const h1 = h1p < 0 ? h1p + 360 : h1p;
  const h2 = h2p < 0 ? h2p + 360 : h2p;

  let dhp = h2 - h1;
  const absDh = Math.abs(h2 - h1);
  if (absDh > 180 && h2 <= h1) dhp += 360;
  else if (absDh > 180 && h2 > h1) dhp -= 360;

  const Lm = (L1 + L2) / 2;
  let Hm = h1 + h2;
  if (absDh <= 180) Hm /= 2;
  else Hm = (h1 + h2 < 360 ? Hm + 360 : Hm - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos(rad * (Hm - 30)) +
    0.24 * Math.cos(2 * rad * Hm) +
    0.32 * Math.cos(rad * (3 * Hm + 6)) -
    0.2 * Math.cos(rad * (4 * Hm - 63));

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2 * Math.sin((rad * dhp) / 2) * Math.sqrt(C1p * C2p);

  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;

  const RC7 = Cp ** 7;
  const RC = 2 * Math.sqrt(RC7 / (RC7 + 25 ** 7));
  const dTheta = 30 * Math.exp(-(((Hm - 275) / 25) ** 2));
  const RT = -RC * Math.sin(2 * rad * dTheta);

  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
};

export const labToRgb = (lab: LabColor): RgbColor => xyzToRgb(labToXyz(lab));

// CSS Color 4: lab(L a b / alpha). L: number|percentage|none (100% = 100).
// a/b: number|percentage|none (100% = 125).
const LAB_RE = new RegExp(
  `^lab\\(\\s*(?<l>${NUM_OR_NONE})(?<lp>%?)\\s+(?<a>${NUM_OR_NONE})(?<ap>%?)\\s+(?<b>${NUM_OR_NONE})(?<bp>%?)` +
    `\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseLabString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = LAB_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const l = parseNum(g.l!); // 100% = 100, so value is unchanged whether `%` present
  const a = g.ap ? parseNum(g.a!) * 1.25 : parseNum(g.a!);
  const b = g.bp ? parseNum(g.b!) * 1.25 : parseNum(g.b!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return labToRgb({
    l: clamp(l, 0, 100),
    a,
    b,
    alpha: clamp(alpha, 0, 1),
    colorSpace: 'lab',
  });
};

export const parseLabObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'lab') return null;
  if (!hasKeys(input, ['l', 'a', 'b'])) return null;
  const { l, a, b, alpha = 1 } = input as { l: unknown; a: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(l) || !isAnyNumber(a) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return labToRgb({
    l: clamp(sanitize(l), 0, 100),
    a: sanitize(a),
    b: sanitize(b),
    alpha: clamp(sanitize(alpha), 0, 1),
    colorSpace: 'lab',
  });
};

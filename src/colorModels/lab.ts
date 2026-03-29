import { clamp, hasKeys, isAnyNumber, isObject, round, sanitize } from '../helpers.js';
import type { LabColor, RgbColor, XyzColor } from '../types.js';
import { D50_WX as WX, D50_WY as WY, D50_WZ as WZ, rgbToXyz, xyzToRgb } from './xyz.js';

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

const LAB_RE =
  /^lab\(\s*([+-]?\d*\.?\d+)%\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseLabString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = LAB_RE.exec(input.trim());
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : Number(m[4]) / (m[5] ? 100 : 1);
  return labToRgb({
    l: clamp(Number(m[1]), 0, 100),
    a: Number(m[2]),
    b: Number(m[3]),
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

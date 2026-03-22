import { clamp, hasKeys, isNumeric, isObject, round } from '../helpers.js';
import type { OklabColor, RgbColor } from '../types.js';

const toLinear = (c: number): number => {
  const n = c / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (n: number): number => (n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055);

export const rgbToOklab = ({ r, g, b, a }: RgbColor): OklabColor => {
  const lr = toLinear(r),
    lg = toLinear(g),
    lb = toLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
    alpha: a,
  };
};

export const oklabToRgb = ({ l, a, b, alpha }: OklabColor): RgbColor => {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lv = l_ ** 3;
  const mv = m_ ** 3;
  const sv = s_ ** 3;

  const r = 4.0767416613 * lv - 3.3077115904 * mv + 0.2309699287 * sv;
  const g = -1.2684380041 * lv + 2.6097574007 * mv - 0.3413193963 * sv;
  const bv = -0.0041960865 * lv - 0.7034186145 * mv + 1.7076147009 * sv;

  return {
    r: clamp(round(fromLinear(clamp(r, 0, 1)) * 255), 0, 255),
    g: clamp(round(fromLinear(clamp(g, 0, 1)) * 255), 0, 255),
    b: clamp(round(fromLinear(clamp(bv, 0, 1)) * 255), 0, 255),
    a: clamp(alpha, 0, 1),
  };
};

export const parseOklabObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['l', 'a', 'b'])) return null;
  if ('r' in input || 'x' in input || 'c' in input || 'h' in input) return null;
  if (!('alpha' in input) && 'a' in input && typeof input.a === 'number') {
    // Check it's an OklabColor by requiring 'alpha' key or treating 'a' as the a-channel
    // OklabColor has 'alpha' for transparency; LabColor also has 'alpha'
    // We need to distinguish: OklabColor has l in [0,1], LabColor has l in [0,100]
  }
  const { l, a, b, alpha = 1 } = input as { l: unknown; a: unknown; b: unknown; alpha?: unknown };
  if (!isNumeric(l as number) || !isNumeric(a as number) || !isNumeric(b as number) || !isNumeric(alpha as number))
    return null;
  // Distinguish OklabColor (l in 0-1) from LabColor (l in 0-100): if l > 1 treat as Lab
  if ((l as number) > 1) return null;
  return oklabToRgb({
    l: l as number,
    a: a as number,
    b: b as number,
    alpha: clamp(alpha as number, 0, 1),
  });
};

const OKLAB_RE =
  /^oklab\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

export const parseOklabString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = OKLAB_RE.exec(input);
  if (!m) return null;
  const L = m[2] ? Number(m[1]) / 100 : Number(m[1]);
  const a = m[4] ? Number(m[3]) * 0.004 : Number(m[3]);
  const b = m[6] ? Number(m[5]) * 0.004 : Number(m[5]);
  const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
  return oklabToRgb({ l: L, a, b, alpha: clamp(alpha, 0, 1) });
};

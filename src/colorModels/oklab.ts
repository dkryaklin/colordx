import { clamp, hasKeys, isAnyNumber, isObject, sanitize } from '../helpers.js';
import { srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { OklabColor, RgbColor } from '../types.js';
import { clampRgb } from './rgb.js';

/** Convert linear sRGB channels to OKLab (Björn Ottosson). No gamma, no clamping. */
export const linearSrgbToOklab = (lr: number, lg: number, lb: number): [number, number, number] => {
  const lv = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const mv = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const sv = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * lv + 0.793617785 * mv - 0.0040720468 * sv,
    1.9779984951 * lv - 2.428592205 * mv + 0.4505937099 * sv,
    0.0259040371 * lv + 0.7827717662 * mv - 0.808675766 * sv,
  ];
};

export const rgbToOklab = ({ r, g, b, alpha }: RgbColor): OklabColor => {
  const [l, a, bv] = linearSrgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
  return { l, a, b: bv, alpha };
};

/** Unclamped OKLab → gamma-encoded sRGB. Channels may exceed [0, 255] for out-of-sRGB-gamut colors. */
export const oklabToRgbUnclamped = ({ l, a, b, alpha }: OklabColor): RgbColor => {
  const [lr, lg, lb] = oklabToLinear(l, a, b);
  return {
    r: srgbFromLinear(lr) * 255,
    g: srgbFromLinear(lg) * 255,
    b: srgbFromLinear(lb) * 255,
    alpha,
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

  return clampRgb({
    r: srgbFromLinear(clamp(r, 0, 1)) * 255,
    g: srgbFromLinear(clamp(g, 0, 1)) * 255,
    b: srgbFromLinear(clamp(bv, 0, 1)) * 255,
    alpha,
  });
};

/** Unclamped linear sRGB channels from OKLab values. Channels may exceed [0, 1] for out-of-gamut colors. */
export const oklabToLinear = (l: number, a: number, b: number): [number, number, number] => {
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const lv = l_ ** 3,
    mv = m_ ** 3,
    sv = s_ ** 3;
  return [
    4.0767416613 * lv - 3.3077115904 * mv + 0.2309699287 * sv,
    -1.2684380041 * lv + 2.6097574007 * mv - 0.3413193963 * sv,
    -0.0041960865 * lv - 0.7034186145 * mv + 1.7076147009 * sv,
  ];
};

export const parseOklabObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  // Objects with colorSpace: 'lab' are CIE Lab, not OKLab — let parseLabObject handle them.
  if ((input as { colorSpace?: unknown }).colorSpace === 'lab') return null;
  if (!hasKeys(input, ['l', 'a', 'b'])) return null;
  if ('r' in input || 'x' in input || 'c' in input || 'h' in input) return null;
  const { l, a, b, alpha = 1 } = input as { l: unknown; a: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(l) || !isAnyNumber(a) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  if (sanitize(l) > 1) return null; // OKLab L is always [0, 1]; reject CIE Lab values passed without colorSpace branding
  return oklabToRgbUnclamped({
    l: sanitize(l),
    a: sanitize(a),
    b: sanitize(b),
    alpha: clamp(sanitize(alpha), 0, 1),
  });
};

const OKLAB_RE =
  /^oklab\(\s*(none|[+-]?\d*\.?\d+)(%?)\s+(none|[+-]?\d*\.?\d+)(%?)\s+(none|[+-]?\d*\.?\d+)(%?)\s*(?:\/\s*(none|[+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

const val = (v: string): number => (v.toLowerCase() === 'none' ? 0 : Number(v));

export const parseOklabString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = OKLAB_RE.exec(input.trim());
  if (!m) return null;
  const L = m[2] ? val(m[1]!) / 100 : val(m[1]!);
  const a = m[4] ? val(m[3]!) * 0.004 : val(m[3]!); // CSS Color 4: 100% = 0.4, so 1% = 0.004
  const b = m[6] ? val(m[5]!) * 0.004 : val(m[5]!);
  const alpha = m[7] === undefined ? 1 : val(m[7]) / (m[8] ? 100 : 1);
  return oklabToRgbUnclamped({ l: L, a, b, alpha: clamp(alpha, 0, 1) });
};

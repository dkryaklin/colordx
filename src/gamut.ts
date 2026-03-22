import { Colordx } from './colordx.js';
import { ANGLE_UNITS, clamp } from './helpers.js';
import type { AnyColor, OklabColor, OklchColor } from './types.js';

/** Unclamped linear sRGB channels from OKLab values. */
const oklabToLinear = (l: number, a: number, b: number): [number, number, number] => {
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

const OKLCH_RE =
  /^oklch\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(deg|rad|grad|turn)?\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

const OKLAB_RE =
  /^oklab\(\s*([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s+([+-]?\d*\.?\d+)(%?)\s*(?:\/\s*([+-]?\d*\.?\d+)(%)?\s*)?\)$/i;

/**
 * Extract raw OKLab {l, a, b, alpha} without clamping.
 * Returns null for inputs that are already sRGB-bounded (hex, rgb, hsl, hsv, hwb, etc.).
 */
const getRawOklab = (input: AnyColor): { l: number; a: number; b: number; alpha: number } | null => {
  if (typeof input === 'object' && input !== null) {
    const obj = input as unknown as Record<string, unknown>;
    // OklabColor: has l, a, b, alpha — no c, h, r, x
    if ('l' in obj && 'a' in obj && 'b' in obj && 'alpha' in obj && !('c' in obj) && !('h' in obj) && !('r' in obj)) {
      const c = input as OklabColor;
      if (
        typeof c.l === 'number' &&
        typeof c.a === 'number' &&
        typeof c.b === 'number' &&
        typeof c.alpha === 'number'
      ) {
        return { l: c.l, a: c.a, b: c.b, alpha: c.alpha };
      }
    }
    // OklchColor: has l, c, h — no r, x, alpha (alpha uses 'a')
    if ('l' in obj && 'c' in obj && 'h' in obj && !('r' in obj) && !('x' in obj) && !('alpha' in obj)) {
      const c = input as OklchColor;
      if (typeof c.l === 'number' && typeof c.c === 'number' && typeof c.h === 'number') {
        const hRad = (c.h * Math.PI) / 180;
        return { l: c.l, a: c.c * Math.cos(hRad), b: c.c * Math.sin(hRad), alpha: typeof c.a === 'number' ? c.a : 1 };
      }
    }
    return null;
  }

  if (typeof input === 'string') {
    let m = OKLCH_RE.exec(input);
    if (m) {
      const l = m[2] ? Number(m[1]) / 100 : Number(m[1]);
      const c = m[4] ? Number(m[3]) * 0.004 : Number(m[3]);
      const unit = m[6]?.toLowerCase() ?? 'deg';
      const hDeg = Number(m[5]) * (ANGLE_UNITS[unit] ?? 1);
      const hRad = (hDeg * Math.PI) / 180;
      const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
      return { l, a: c * Math.cos(hRad), b: c * Math.sin(hRad), alpha };
    }
    m = OKLAB_RE.exec(input);
    if (m) {
      const l = m[2] ? Number(m[1]) / 100 : Number(m[1]);
      const a = m[4] ? Number(m[3]) * 0.004 : Number(m[3]);
      const b = m[6] ? Number(m[5]) * 0.004 : Number(m[5]);
      const alpha = m[7] === undefined ? 1 : Number(m[7]) / (m[8] ? 100 : 1);
      return { l, a, b, alpha };
    }
    return null;
  }

  return null;
};

// Tolerance for floating point rounding introduced by limited-precision OKLCH strings
// (4 decimal places in L/C and 2 in H can cause linear sRGB to deviate by up to ~2e-3)
const EPS = 2e-3;

const isLinearInGamut = (r: number, g: number, b: number): boolean =>
  r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS;

/**
 * Returns true if the color is within the sRGB gamut.
 * Always true for hex, rgb, hsl, hsv, and hwb inputs.
 * For oklch/oklab inputs, checks whether the computed linear sRGB channels are in [0, 1].
 */
export const inGamutSrgb = (input: AnyColor): boolean => {
  const raw = getRawOklab(input);
  if (raw === null) return true;
  const [r, g, b] = oklabToLinear(raw.l, raw.a, raw.b);
  return isLinearInGamut(r, g, b);
};

/**
 * Maps an out-of-gamut color into sRGB by reducing chroma (CSS Color 4 gamut mapping).
 * Colors already in gamut are returned as-is. sRGB inputs (hex, rgb, hsl, etc.) are passed through.
 */
export const toGamutSrgb = (input: AnyColor): Colordx => {
  const raw = getRawOklab(input);
  if (raw === null) return new Colordx(input);

  const { l, a, b, alpha } = raw;
  const [r, g, bv] = oklabToLinear(l, a, b);
  if (isLinearInGamut(r, g, bv)) return new Colordx(input);

  // Binary search: reduce chroma while keeping lightness and hue
  const hRad = Math.atan2(b, a);
  let lo = 0;
  let hi = Math.sqrt(a ** 2 + b ** 2);

  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const [lr, lg, lb] = oklabToLinear(l, mid * Math.cos(hRad), mid * Math.sin(hRad));
    if (isLinearInGamut(lr, lg, lb)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const cFinal = (lo + hi) / 2;
  const hDeg = ((hRad * 180) / Math.PI + 360) % 360;
  const oklch: OklchColor = { l: clamp(l, 0, 1), c: cFinal, h: hDeg, a: clamp(alpha, 0, 1) };
  return new Colordx(oklch);
};

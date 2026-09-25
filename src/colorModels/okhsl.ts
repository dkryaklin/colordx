import { alphaAlias, clamp, isObject, normalizeHue, round } from '../helpers.js';
import { SC, scanFunc } from '../scan.js';
import { srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { OkhslColor, RgbColor } from '../types.js';
import { CS, LAB, LIN, findCs, linearToOklabScratch, oklabToLinearScratch, toe, toeInv } from './okgamut.js';
import { clampRgb } from './rgb.js';

const ACHROMATIC_C = 0.000004;

const MID = 0.8;
const MID_INV = 1.25;

/** Gamma sRGB in 0–1 → Okhsl (h in [0, 360), s and l in 0–100), written into `out`. Unclamped: s can pass 100. */
export const rgbToOkhslChannelsInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  linearToOklabScratch(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  const L = LAB[0]!,
    a = LAB[1]!,
    bb = LAB[2]!;
  const C = Math.sqrt(a * a + bb * bb);
  if (C < ACHROMATIC_C) {
    out[0] = 0;
    out[1] = 0;
    out[2] = toe(L) * 100;
    return;
  }
  findCs(L, a / C, bb / C);
  const C_0 = CS[0]!,
    C_mid = CS[1]!,
    C_max = CS[2]!;

  let s: number;
  if (C < C_mid) {
    const k_1 = MID * C_0;
    const k_2 = 1 - k_1 / C_mid;
    s = (C / (k_1 + k_2 * C)) * MID;
  } else {
    const k_1 = ((1 - MID) * C_mid * C_mid * MID_INV * MID_INV) / C_0;
    const k_2 = 1 - k_1 / (C_max - C_mid);
    const t = (C - C_mid) / (k_1 + k_2 * (C - C_mid));
    s = MID + (1 - MID) * t;
  }

  out[0] = normalizeHue((Math.atan2(bb, a) * 180) / Math.PI);
  out[1] = s * 100;
  out[2] = toe(L) * 100;
};

/** Allocating sibling of `rgbToOkhslChannelsInto` — returns `[h, s, l]`. */
export const rgbToOkhslChannels = (r: number, g: number, b: number): [number, number, number] => {
  linearToOklabScratch(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  const L = LAB[0]!,
    a = LAB[1]!,
    bb = LAB[2]!;
  const C = Math.sqrt(a * a + bb * bb);
  if (C < ACHROMATIC_C) return [0, 0, toe(L) * 100];
  findCs(L, a / C, bb / C);
  const C_0 = CS[0]!,
    C_mid = CS[1]!,
    C_max = CS[2]!;

  let s: number;
  if (C < C_mid) {
    const k_1 = MID * C_0;
    const k_2 = 1 - k_1 / C_mid;
    s = (C / (k_1 + k_2 * C)) * MID;
  } else {
    const k_1 = ((1 - MID) * C_mid * C_mid * MID_INV * MID_INV) / C_0;
    const k_2 = 1 - k_1 / (C_max - C_mid);
    const t = (C - C_mid) / (k_1 + k_2 * (C - C_mid));
    s = MID + (1 - MID) * t;
  }

  return [normalizeHue((Math.atan2(bb, a) * 180) / Math.PI), s * 100, toe(L) * 100];
};

const _buf: OkhslColor = { h: 0, s: 0, l: 0, alpha: 0, colorSpace: 'okhsl' };

export const rgbToOkhslRaw = ({ r, g, b, alpha }: RgbColor): OkhslColor => {
  let rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  if (rn > 1 || rn < 0 || gn > 1 || gn < 0 || bn > 1 || bn < 0) {
    rn = clamp(rn, 0, 1);
    gn = clamp(gn, 0, 1);
    bn = clamp(bn, 0, 1);
  }
  linearToOklabScratch(srgbToLinear(rn), srgbToLinear(gn), srgbToLinear(bn));
  const L = LAB[0]!,
    a = LAB[1]!,
    bb = LAB[2]!;
  const C = Math.sqrt(a * a + bb * bb);
  let h = 0,
    s = 0;
  if (C >= ACHROMATIC_C) {
    findCs(L, a / C, bb / C);
    const C_0 = CS[0]!,
      C_mid = CS[1]!,
      C_max = CS[2]!;
    if (C < C_mid) {
      const k_1 = MID * C_0;
      const k_2 = 1 - k_1 / C_mid;
      s = (C / (k_1 + k_2 * C)) * MID;
    } else {
      const k_1 = ((1 - MID) * C_mid * C_mid * MID_INV * MID_INV) / C_0;
      const k_2 = 1 - k_1 / (C_max - C_mid);
      const t = (C - C_mid) / (k_1 + k_2 * (C - C_mid));
      s = MID + (1 - MID) * t;
    }
    h = normalizeHue((Math.atan2(bb, a) * 180) / Math.PI);
  }
  _buf.h = h;
  _buf.s = clamp(s * 100, 0, 100);
  _buf.l = clamp(toe(L) * 100, 0, 100);
  _buf.alpha = clamp(round(alpha, 3), 0, 1);
  return _buf;
};

/** sRGB → Okhsl, rounded to 5 decimals. */
export const rgbToOkhsl = (rgb: RgbColor): OkhslColor => {
  const { h, s, l, alpha } = rgbToOkhslRaw(rgb);
  const hr = round(h, 5);
  return { h: hr >= 360 ? 0 : hr, s: round(s, 5), l: round(l, 5), alpha, colorSpace: 'okhsl' };
};

/** Okhsl (h in degrees, s and l in 0–100) → unclamped gamma sRGB in 0–1, written into `out`. */
export const okhslToRgbChannelsInto = (out: Float64Array | number[], h: number, s: number, l: number): void => {
  const ln = l / 100;
  if (ln >= 1) {
    out[0] = out[1] = out[2] = 1;
    return;
  }
  if (ln <= 0) {
    out[0] = out[1] = out[2] = 0;
    return;
  }
  const sn = s / 100;
  const hRad = (h * Math.PI) / 180;
  const a_ = Math.cos(hRad),
    b_ = Math.sin(hRad);
  const L = toeInv(ln);

  findCs(L, a_, b_);
  const C_0 = CS[0]!,
    C_mid = CS[1]!,
    C_max = CS[2]!;

  let C: number;
  if (sn < MID) {
    const t = MID_INV * sn;
    const k_1 = MID * C_0;
    const k_2 = 1 - k_1 / C_mid;
    C = (t * k_1) / (1 - k_2 * t);
  } else {
    const t = (sn - MID) / (1 - MID);
    const k_1 = ((1 - MID) * C_mid * C_mid * MID_INV * MID_INV) / C_0;
    const k_2 = 1 - k_1 / (C_max - C_mid);
    C = C_mid + (t * k_1) / (1 - k_2 * t);
  }

  oklabToLinearScratch(L, C * a_, C * b_);
  out[0] = srgbFromLinear(LIN[0]!);
  out[1] = srgbFromLinear(LIN[1]!);
  out[2] = srgbFromLinear(LIN[2]!);
};

/** Allocating sibling of `okhslToRgbChannelsInto` — returns `[r, g, b]`. */
export const okhslToRgbChannels = (h: number, s: number, l: number): [number, number, number] => {
  const ln = l / 100;
  if (ln >= 1) return [1, 1, 1];
  if (ln <= 0) return [0, 0, 0];
  const sn = s / 100;
  const hRad = (h * Math.PI) / 180;
  const a_ = Math.cos(hRad),
    b_ = Math.sin(hRad);
  const L = toeInv(ln);

  findCs(L, a_, b_);
  const C_0 = CS[0]!,
    C_mid = CS[1]!,
    C_max = CS[2]!;

  let C: number;
  if (sn < MID) {
    const t = MID_INV * sn;
    const k_1 = MID * C_0;
    const k_2 = 1 - k_1 / C_mid;
    C = (t * k_1) / (1 - k_2 * t);
  } else {
    const t = (sn - MID) / (1 - MID);
    const k_1 = ((1 - MID) * C_mid * C_mid * MID_INV * MID_INV) / C_0;
    const k_2 = 1 - k_1 / (C_max - C_mid);
    C = C_mid + (t * k_1) / (1 - k_2 * t);
  }

  oklabToLinearScratch(L, C * a_, C * b_);
  return [srgbFromLinear(LIN[0]!), srgbFromLinear(LIN[1]!), srgbFromLinear(LIN[2]!)];
};

/** Okhsl → sRGB, clamped to [0, 255]. h in degrees, s / l in 0–100. */
export const okhslToRgb = ({ h, s, l, alpha }: OkhslColor): RgbColor => {
  const ln = l / 100;
  if (ln >= 1) return clampRgb({ r: 255, g: 255, b: 255, alpha });
  if (ln <= 0) return clampRgb({ r: 0, g: 0, b: 0, alpha });
  const sn = s / 100;
  const hRad = (h * Math.PI) / 180;
  const a_ = Math.cos(hRad),
    b_ = Math.sin(hRad);
  const L = toeInv(ln);

  findCs(L, a_, b_);
  const C_0 = CS[0]!,
    C_mid = CS[1]!,
    C_max = CS[2]!;

  let C: number;
  if (sn < MID) {
    const t = MID_INV * sn;
    const k_1 = MID * C_0;
    const k_2 = 1 - k_1 / C_mid;
    C = (t * k_1) / (1 - k_2 * t);
  } else {
    const t = (sn - MID) / (1 - MID);
    const k_1 = ((1 - MID) * C_mid * C_mid * MID_INV * MID_INV) / C_0;
    const k_2 = 1 - k_1 / (C_max - C_mid);
    C = C_mid + (t * k_1) / (1 - k_2 * t);
  }

  oklabToLinearScratch(L, C * a_, C * b_);
  return clampRgb({
    r: srgbFromLinear(clamp(LIN[0]!, 0, 1)) * 255,
    g: srgbFromLinear(clamp(LIN[1]!, 0, 1)) * 255,
    b: srgbFromLinear(clamp(LIN[2]!, 0, 1)) * 255,
    alpha,
  });
};

export const parseOkhslString = (input: unknown): RgbColor | null =>
  typeof input === 'string' && scanFunc(input, 'okhsl(', 0)
    ? okhslToRgb({
        h: normalizeHue(SC[0]!),
        s: clamp(SC[1]!, 0, 100),
        l: clamp(SC[2]!, 0, 100),
        alpha: clamp(round(SC[3]!, 3), 0, 1),
        colorSpace: 'okhsl',
      })
    : null;

export const parseOkhslObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'okhsl') return null;
  if (!('h' in input && 's' in input && 'l' in input)) return null;
  const { h, s, l, alpha = alphaAlias(input) } = input as { h: unknown; s: unknown; l: unknown; alpha?: unknown };
  if (typeof h !== 'number' || typeof s !== 'number' || typeof l !== 'number' || typeof alpha !== 'number') return null;
  return okhslToRgb({
    h: normalizeHue(h === h ? h : 0),
    s: s > 100 ? 100 : s > 0 ? s : 0,
    l: l > 100 ? 100 : l > 0 ? l : 0,
    alpha: alpha > 1 ? 1 : alpha > 0 ? Math.round(alpha * 1000) / 1000 : 0,
    colorSpace: 'okhsl',
  });
};

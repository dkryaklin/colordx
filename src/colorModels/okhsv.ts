import { alphaAlias, clamp, isObject, normalizeHue, round } from '../helpers.js';
import { SC, scanFunc } from '../scan.js';
import { srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { OkhsvColor, RgbColor } from '../types.js';
import { CUSP, LAB, LIN, findCusp, linearToOklabScratch, oklabToLinearScratch, toe, toeInv } from './okgamut.js';
import { clampRgb } from './rgb.js';

const ACHROMATIC_C = 0.000004;

const S_0 = 0.5;

/** Gamma sRGB in 0–1 → Okhsv (h in [0, 360), s and v in 0–100), written into `out`. Unclamped: s can pass 100. */
export const rgbToOkhsvChannelsInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  linearToOklabScratch(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  let L = LAB[0]!;
  const a = LAB[1]!,
    bb = LAB[2]!;
  const C = Math.sqrt(a * a + bb * bb);
  if (C < ACHROMATIC_C) {
    out[0] = 0;
    out[1] = 0;
    out[2] = toe(L) * 100;
    return;
  }
  const a_ = a / C,
    b_ = bb / C;

  findCusp(a_, b_);
  const S_max = CUSP[1]! / CUSP[0]!;
  const T_max = CUSP[1]! / (1 - CUSP[0]!);
  const k = 1 - S_0 / S_max;

  const t = T_max / (C + L * T_max);
  const L_v = t * L;
  const C_v = t * C;

  const L_vt = toeInv(L_v);
  const C_vt = (C_v * L_vt) / L_v;

  oklabToLinearScratch(L_vt, a_ * C_vt, b_ * C_vt);
  const scale_L = Math.cbrt(1 / Math.max(LIN[0]!, LIN[1]!, LIN[2]!, 0));
  L = toe(L / scale_L);

  out[0] = normalizeHue((Math.atan2(bb, a) * 180) / Math.PI);
  out[1] = (((S_0 + T_max) * C_v) / (T_max * S_0 + T_max * k * C_v)) * 100;
  out[2] = (L / L_v) * 100;
};

/** Allocating sibling of `rgbToOkhsvChannelsInto` — returns `[h, s, v]`. */
export const rgbToOkhsvChannels = (r: number, g: number, b: number): [number, number, number] => {
  linearToOklabScratch(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  let L = LAB[0]!;
  const a = LAB[1]!,
    bb = LAB[2]!;
  const C = Math.sqrt(a * a + bb * bb);
  if (C < ACHROMATIC_C) return [0, 0, toe(L) * 100];
  const a_ = a / C,
    b_ = bb / C;

  findCusp(a_, b_);
  const S_max = CUSP[1]! / CUSP[0]!;
  const T_max = CUSP[1]! / (1 - CUSP[0]!);
  const k = 1 - S_0 / S_max;

  const t = T_max / (C + L * T_max);
  const L_v = t * L;
  const C_v = t * C;

  const L_vt = toeInv(L_v);
  const C_vt = (C_v * L_vt) / L_v;

  oklabToLinearScratch(L_vt, a_ * C_vt, b_ * C_vt);
  const scale_L = Math.cbrt(1 / Math.max(LIN[0]!, LIN[1]!, LIN[2]!, 0));
  L = toe(L / scale_L);

  return [
    normalizeHue((Math.atan2(bb, a) * 180) / Math.PI),
    (((S_0 + T_max) * C_v) / (T_max * S_0 + T_max * k * C_v)) * 100,
    (L / L_v) * 100,
  ];
};

const _buf: OkhsvColor = { h: 0, s: 0, v: 0, alpha: 0, colorSpace: 'okhsv' };

export const rgbToOkhsvRaw = ({ r, g, b, alpha }: RgbColor): OkhsvColor => {
  let rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  if (rn > 1 || rn < 0 || gn > 1 || gn < 0 || bn > 1 || bn < 0) {
    rn = clamp(rn, 0, 1);
    gn = clamp(gn, 0, 1);
    bn = clamp(bn, 0, 1);
  }
  linearToOklabScratch(srgbToLinear(rn), srgbToLinear(gn), srgbToLinear(bn));
  let L = LAB[0]!;
  const a = LAB[1]!,
    bb = LAB[2]!;
  const C = Math.sqrt(a * a + bb * bb);
  let h = 0,
    s = 0,
    v = toe(L);
  if (C >= ACHROMATIC_C) {
    const a_ = a / C,
      b_ = bb / C;

    findCusp(a_, b_);
    const S_max = CUSP[1]! / CUSP[0]!;
    const T_max = CUSP[1]! / (1 - CUSP[0]!);
    const k = 1 - S_0 / S_max;

    const t = T_max / (C + L * T_max);
    const L_v = t * L;
    const C_v = t * C;

    const L_vt = toeInv(L_v);
    const C_vt = (C_v * L_vt) / L_v;

    oklabToLinearScratch(L_vt, a_ * C_vt, b_ * C_vt);
    const scale_L = Math.cbrt(1 / Math.max(LIN[0]!, LIN[1]!, LIN[2]!, 0));
    L = toe(L / scale_L);

    h = normalizeHue((Math.atan2(bb, a) * 180) / Math.PI);
    s = ((S_0 + T_max) * C_v) / (T_max * S_0 + T_max * k * C_v);
    v = L / L_v;
  }
  _buf.h = h;
  _buf.s = clamp(s * 100, 0, 100);
  _buf.v = clamp(v * 100, 0, 100);
  _buf.alpha = clamp(round(alpha, 3), 0, 1);
  return _buf;
};

/** sRGB → Okhsv, rounded to 5 decimals. */
export const rgbToOkhsv = (rgb: RgbColor): OkhsvColor => {
  const { h, s, v, alpha } = rgbToOkhsvRaw(rgb);
  const hr = round(h, 5);
  return { h: hr >= 360 ? 0 : hr, s: round(s, 5), v: round(v, 5), alpha, colorSpace: 'okhsv' };
};

/** Okhsv (h in degrees, s and v in 0–100) → unclamped gamma sRGB in 0–1, written into `out`. */
export const okhsvToRgbChannelsInto = (out: Float64Array | number[], h: number, s: number, v: number): void => {
  const sn = s / 100,
    vn = v / 100;
  const hRad = (h * Math.PI) / 180;
  const a_ = Math.cos(hRad),
    b_ = Math.sin(hRad);

  findCusp(a_, b_);
  const S_max = CUSP[1]! / CUSP[0]!;
  const T_max = CUSP[1]! / (1 - CUSP[0]!);
  const k = 1 - S_0 / S_max;

  const denom = S_0 + T_max - T_max * k * sn;
  const L_v = 1 - (sn * S_0) / denom;
  const C_v = (sn * T_max * S_0) / denom;

  const L_vt = toeInv(L_v);
  const C_vt = (C_v * L_vt) / L_v;

  const L_new = toeInv(vn * L_v);
  let C = (C_v * L_new) / L_v;

  oklabToLinearScratch(L_vt, a_ * C_vt, b_ * C_vt);
  const scale_L = Math.cbrt(1 / Math.max(LIN[0]!, LIN[1]!, LIN[2]!, 0));

  const L = L_new * scale_L;
  C = C * scale_L;

  oklabToLinearScratch(L, C * a_, C * b_);
  out[0] = srgbFromLinear(LIN[0]!);
  out[1] = srgbFromLinear(LIN[1]!);
  out[2] = srgbFromLinear(LIN[2]!);
};

/** Allocating sibling of `okhsvToRgbChannelsInto` — returns `[r, g, b]`. */
export const okhsvToRgbChannels = (h: number, s: number, v: number): [number, number, number] => {
  const sn = s / 100,
    vn = v / 100;
  const hRad = (h * Math.PI) / 180;
  const a_ = Math.cos(hRad),
    b_ = Math.sin(hRad);

  findCusp(a_, b_);
  const S_max = CUSP[1]! / CUSP[0]!;
  const T_max = CUSP[1]! / (1 - CUSP[0]!);
  const k = 1 - S_0 / S_max;

  const denom = S_0 + T_max - T_max * k * sn;
  const L_v = 1 - (sn * S_0) / denom;
  const C_v = (sn * T_max * S_0) / denom;

  const L_vt = toeInv(L_v);
  const C_vt = (C_v * L_vt) / L_v;

  const L_new = toeInv(vn * L_v);
  let C = (C_v * L_new) / L_v;

  oklabToLinearScratch(L_vt, a_ * C_vt, b_ * C_vt);
  const scale_L = Math.cbrt(1 / Math.max(LIN[0]!, LIN[1]!, LIN[2]!, 0));

  const L = L_new * scale_L;
  C = C * scale_L;

  oklabToLinearScratch(L, C * a_, C * b_);
  return [srgbFromLinear(LIN[0]!), srgbFromLinear(LIN[1]!), srgbFromLinear(LIN[2]!)];
};

/** Okhsv → sRGB, clamped to [0, 255]. h in degrees, s / v in 0–100. */
export const okhsvToRgb = ({ h, s, v, alpha }: OkhsvColor): RgbColor => {
  const sn = s / 100,
    vn = v / 100;
  const hRad = (h * Math.PI) / 180;
  const a_ = Math.cos(hRad),
    b_ = Math.sin(hRad);

  findCusp(a_, b_);
  const S_max = CUSP[1]! / CUSP[0]!;
  const T_max = CUSP[1]! / (1 - CUSP[0]!);
  const k = 1 - S_0 / S_max;

  const denom = S_0 + T_max - T_max * k * sn;
  const L_v = 1 - (sn * S_0) / denom;
  const C_v = (sn * T_max * S_0) / denom;

  const L_vt = toeInv(L_v);
  const C_vt = (C_v * L_vt) / L_v;

  const L_new = toeInv(vn * L_v);
  let C = (C_v * L_new) / L_v;

  oklabToLinearScratch(L_vt, a_ * C_vt, b_ * C_vt);
  const scale_L = Math.cbrt(1 / Math.max(LIN[0]!, LIN[1]!, LIN[2]!, 0));

  const L = L_new * scale_L;
  C = C * scale_L;

  oklabToLinearScratch(L, C * a_, C * b_);
  return clampRgb({
    r: srgbFromLinear(clamp(LIN[0]!, 0, 1)) * 255,
    g: srgbFromLinear(clamp(LIN[1]!, 0, 1)) * 255,
    b: srgbFromLinear(clamp(LIN[2]!, 0, 1)) * 255,
    alpha,
  });
};

export const parseOkhsvString = (input: unknown): RgbColor | null =>
  typeof input === 'string' && scanFunc(input, 'okhsv(', 0)
    ? okhsvToRgb({
        h: normalizeHue(SC[0]!),
        s: clamp(SC[1]!, 0, 100),
        v: clamp(SC[2]!, 0, 100),
        alpha: clamp(round(SC[3]!, 3), 0, 1),
        colorSpace: 'okhsv',
      })
    : null;

export const parseOkhsvObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'okhsv') return null;
  if (!('h' in input && 's' in input && 'v' in input)) return null;
  const { h, s, v, alpha = alphaAlias(input) } = input as { h: unknown; s: unknown; v: unknown; alpha?: unknown };
  if (typeof h !== 'number' || typeof s !== 'number' || typeof v !== 'number' || typeof alpha !== 'number') return null;
  return okhsvToRgb({
    h: normalizeHue(h === h ? h : 0),
    s: s > 100 ? 100 : s > 0 ? s : 0,
    v: v > 100 ? 100 : v > 0 ? v : 0,
    alpha: alpha > 1 ? 1 : alpha > 0 ? Math.round(alpha * 1000) / 1000 : 0,
    colorSpace: 'okhsv',
  });
};

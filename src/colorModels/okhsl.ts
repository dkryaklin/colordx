import {
  ANGLE_UNITS,
  NUM_OR_NONE,
  WS,
  alphaAlias,
  clamp,
  isObject,
  normalizeHue,
  parseNum,
  round,
  trimWs,
} from '../helpers.js';
import { srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { OkhslColor, RgbColor } from '../types.js';
import { CS, LAB, LIN, findCs, linearToOklabScratch, oklabToLinearScratch, toe, toeInv } from './okgamut.js';
import { clampRgb } from './rgb.js';

// Okhsl (Björn Ottosson, https://bottosson.github.io/posts/colorpicker/). Hue is the OKLCH hue;
// lightness is the L_r toe of OKLab L; saturation remaps OKLCH chroma onto [0, 1] through three
// scales (C_0 / C_mid / C_max, see okgamut.ts) so the sRGB gamut becomes a cylinder while the
// interior stays smooth. Defined for sRGB only. Scale here matches toHsl(): h in degrees, s / l
// in 0–100. The reference uses h in turns and s / l in 0–1.
//
// Same rule as hsv.ts: the channel functions, their allocating siblings and the object
// converters keep separate bodies so each `*Into` only ever sees the caller's buffer.

// Below this OKLCH chroma the hue is noise (rgbToOklch uses the same threshold), so the color is
// reported achromatic: h = 0, s = 0. Between here and the gamut edge s is computed as the
// reference does, including the near-white corner where a tiny chroma is still fully saturated.
const ACHROMATIC_C = 0.000004;

const MID = 0.8;
const MID_INV = 1.25;

/**
 * Gamma-encoded sRGB (0–1) → Okhsl channels. Writes `[h, s, l]` into `out`: h in degrees
 * [0, 360), s and l in 0–100 — the scale `toOkhsl()` reports. Achromatic input reports h = 0,
 * s = 0. No clipping: Okhsl is defined on the sRGB cube, so clip wide-gamut input first —
 * outside it s runs past 100. Inside it s can still overshoot 100 by up to ~1%, because the
 * gamut cusp the reference algorithm uses is a polynomial fit; `toOkhsl()` clamps, this does not.
 */
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

  // Inverse of the interpolation in okhslToRgbChannelsInto.
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

/** Allocating sibling of `rgbToOkhslChannelsInto` — returns `[h, s, l]`. Own body: see the note above. */
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

// Shared write buffer for rgbToOkhslRaw — callers must destructure immediately, never store the reference.
const _buf: OkhslColor = { h: 0, s: 0, l: 0, alpha: 0, colorSpace: 'okhsl' };

/** Unrounded Okhsl of a stored RGB. Clips to the sRGB cube first; s and l are clamped to [0, 100]. */
export const rgbToOkhslRaw = ({ r, g, b, alpha }: RgbColor): OkhslColor => {
  let rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  if (rn > 1 || rn < 0 || gn > 1 || gn < 0 || bn > 1 || bn < 0) {
    // Same rule as rgbToHsvRaw: Okhsl lives on the sRGB cube, so clip a wide-gamut color first.
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

/** Okhsl rounded to 5 dp — the plugin's default, see the note in plugins/okhsl.ts. */
export const rgbToOkhsl = (rgb: RgbColor): OkhslColor => {
  const { h, s, l, alpha } = rgbToOkhslRaw(rgb);
  const hr = round(h, 5);
  // round() can push a value just below 360 to 360 due to floating-point; clamp back to 0.
  return { h: hr >= 360 ? 0 : hr, s: round(s, 5), l: round(l, 5), alpha, colorSpace: 'okhsl' };
};

/**
 * Okhsl channels → gamma-encoded sRGB (0–1). Writes `[r, g, b]` into `out`. h in degrees (any
 * value), s and l in 0–100. l ≥ 100 is white and l ≤ 0 is black (the reference's guards, which
 * are also where the chroma scales stop being defined). s is not clamped: a few percent above 100
 * walks out of the gamut (channels leave [0, 1]), further out the chroma interpolation has no
 * meaning and folds back, so clamp untrusted input. Even s = 100 exactly can land a hair outside
 * (down to about −0.005) because the reference's gamut cusp is a polynomial fit — a
 * `Uint8ClampedArray` store absorbs it; clamp yourself if you need exact [0, 1].
 */
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

  // Interpolate the three chroma scales so that dC/ds = C_0 at s = 0, C = C_mid at s = 0.8 and
  // C = C_max at s = 1.
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

/** Allocating sibling of `okhslToRgbChannelsInto` — returns `[r, g, b]`. Own body: see the note above. */
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

// okhsl() is a library-defined syntax (no CSS spec defines one). Modern space form only, in the
// shape of hsl(): optional `%` on s / l, angle units on h, the CSS Color 4 `none` keyword.
const OKHSL_RE = new RegExp(
  `^okhsl\\(${WS}*(?<h>${NUM_OR_NONE})(?<hu>deg|rad|grad|turn)?` +
    `${WS}+(?<s>${NUM_OR_NONE})%?${WS}+(?<l>${NUM_OR_NONE})%?` +
    `${WS}*(?:/${WS}*(?<al>${NUM_OR_NONE})(?<alp>%?)${WS}*)?\\)$`,
  'i'
);

export const parseOkhslString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = OKHSL_RE.exec(trimWs(input))?.groups;
  if (!g) return null;
  const unit = g.hu?.toLowerCase() ?? 'deg';
  const h = parseNum(g.h!) * (ANGLE_UNITS[unit] ?? 1);
  const s = parseNum(g.s!);
  const l = parseNum(g.l!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return okhslToRgb({
    h: normalizeHue(h),
    s: clamp(s, 0, 100),
    l: clamp(l, 0, 100),
    alpha: clamp(round(alpha, 3), 0, 1),
    colorSpace: 'okhsl',
  });
};

// `{ h, s, l }` alone is HSL; the brand is what selects Okhsl (parseHslBody rejects it in turn).
export const parseOkhslObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'okhsl') return null;
  if (!('h' in input && 's' in input && 'l' in input)) return null;
  const { h, s, l, alpha = alphaAlias(input) } = input as { h: unknown; s: unknown; l: unknown; alpha?: unknown };
  if (typeof h !== 'number' || typeof s !== 'number' || typeof l !== 'number' || typeof alpha !== 'number') return null;
  // comparison clamps: NaN falls to the low bound, matching sanitize()+clamp()
  return okhslToRgb({
    h: normalizeHue(h === h ? h : 0),
    s: s > 100 ? 100 : s > 0 ? s : 0,
    l: l > 100 ? 100 : l > 0 ? l : 0,
    alpha: alpha > 1 ? 1 : alpha > 0 ? Math.round(alpha * 1000) / 1000 : 0,
    colorSpace: 'okhsl',
  });
};
parseOkhslObject.inputKind = 'object' as const;
parseOkhslString.inputKind = 'string' as const;

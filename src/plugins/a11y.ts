import { linearSrgbToOklab } from '../colorModels/oklab.js';
import { rgbToOklch } from '../colorModels/oklch.js';
import { linearP3ToSrgb, oklabToLinearP3, srgbLinearToP3Linear } from '../colorModels/p3.js';
import type { Colordx, Plugin } from '../colordx.js';
import { toGamutCustom } from '../gamut.js';
import { round, toByte } from '../helpers.js';
import { srgbFromLinear, srgbToLinear } from '../transfer.js';
import type { AnyColor } from '../types.js';

export type ApcaSpace = 'srgb' | 'p3';
export interface FixContrastOptions {
  wcag?: number;
  apca?: number;
  space?: ApcaSpace;
}

declare module '@colordx/core' {
  interface Colordx {
    luminance(precision?: number): number;
    contrast(color?: AnyColor | Colordx, precision?: number): number;
    isReadable(background?: AnyColor | Colordx, options?: { level?: 'AA' | 'AAA'; size?: 'normal' | 'large' }): boolean;
    readableScore(background?: AnyColor | Colordx): 'AAA' | 'AA' | 'AA large' | 'fail';
    minReadable(background?: AnyColor | Colordx): Colordx;
    fixContrast(background?: AnyColor | Colordx, options?: FixContrastOptions): Colordx | null;
    apcaContrast(background?: AnyColor | Colordx, options?: { precision?: number; space?: ApcaSpace }): number;
    isReadableApca(
      background?: AnyColor | Colordx,
      options?: { size?: 'normal' | 'large'; space?: ApcaSpace }
    ): boolean;
  }
}

// APCA 0.0.98G-4g-W3 constants, as in apca-w3 0.1.9 (sRGBtoY / displayP3toY)
const APCA_COEF: Record<ApcaSpace, readonly [number, number, number]> = {
  srgb: [0.2126729, 0.7151522, 0.072175],
  p3: [0.228982959480578, 0.691749262585238, 0.0792677779341829],
};
const APCA = {
  normBG: 0.56,
  normTXT: 0.57,
  revBG: 0.65,
  revTXT: 0.62,
  scale: 1.14,
  loClip: 0.1,
  offset: 0.027,
  blkThrs: 0.022,
  blkClmp: 1.414,
  deltaYmin: 0.0005,
};

const DEG = Math.PI / 180;
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
const p3FromLinear = (r: number, g: number, b: number): [number, number, number] =>
  linearSrgbToOklab(...linearP3ToSrgb(r, g, b));

// WCAG relative luminance of the sRGB-mapped color (WCAG has no other form).
const wcagY = (c: Colordx): number => {
  const { r, g, b } = c.mapSrgb()._rawRgb();
  return 0.2126 * srgbToLinear(r / 255) + 0.7152 * srgbToLinear(g / 255) + 0.0722 * srgbToLinear(b / 255);
};

const wcagRatio = (fg: Colordx, bg: Colordx): number => {
  const l1 = wcagY(fg.over(bg));
  const l2 = wcagY(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// Gamma-encoded channels in [0, 1] of the color mapped into `space`.
const apcaChannels = (c: Colordx, space: ApcaSpace): [number, number, number] => {
  if (space === 'srgb') {
    const { r, g, b } = c.mapSrgb()._rawRgb();
    return [r / 255, g / 255, b / 255];
  }
  const { r, g, b, alpha } = c._rawRgb();
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);
  let p3 = srgbLinearToP3Linear(lr, lg, lb);
  if (p3.some((v) => v < 0 || v > 1)) {
    const [l, a, bb] = linearSrgbToOklab(lr, lg, lb);
    p3 = toGamutCustom({ l, a, b: bb, alpha }, oklabToLinearP3, p3FromLinear)!.linear as [number, number, number];
  }
  return [srgbFromLinear(p3[0]), srgbFromLinear(p3[1]), srgbFromLinear(p3[2])];
};

const apcaY = (c: Colordx, space: ApcaSpace): number => {
  const [r, g, b] = apcaChannels(c, space);
  const [kr, kg, kb] = APCA_COEF[space];
  // APCA intentionally uses a straight 2.4 power curve, not the piecewise sRGB function.
  const Y = kr * clamp01(r) ** 2.4 + kg * clamp01(g) ** 2.4 + kb * clamp01(b) ** 2.4;
  return Y > APCA.blkThrs ? Y : Y + (APCA.blkThrs - Y) ** APCA.blkClmp;
};

const apcaLc = (fg: Colordx, bg: Colordx, space: ApcaSpace): number => {
  const Yt = apcaY(fg.over(bg), space);
  const Ys = apcaY(bg, space);
  if (Math.abs(Ys - Yt) < APCA.deltaYmin) return 0;
  if (Ys > Yt) {
    const c = (Ys ** APCA.normBG - Yt ** APCA.normTXT) * APCA.scale;
    return c < APCA.loClip ? 0 : (c - APCA.offset) * 100;
  }
  const c = (Ys ** APCA.revBG - Yt ** APCA.revTXT) * APCA.scale;
  return c > -APCA.loClip ? 0 : (c + APCA.offset) * 100;
};

// oklch(l c h) gamut-mapped into `space` and quantized to its output format (bytes, or 4-decimal P3),
// so the fix passes as written, not just as a float.
const quantized = (C: typeof Colordx, l: number, c: number, h: number, alpha: number, space: ApcaSpace): Colordx => {
  if (space === 'srgb') {
    const { r, g, b } = C.toGamutSrgb({ l, c, h, alpha })._rawRgb();
    return new C({ r: toByte(r), g: toByte(g), b: toByte(b), alpha });
  }
  const lab = { l, a: c * Math.cos(h * DEG), b: c * Math.sin(h * DEG), alpha };
  const [pr, pg, pb] = toGamutCustom(lab, oklabToLinearP3, p3FromLinear)!.linear.map((v) =>
    srgbToLinear(round(srgbFromLinear(v), 4))
  );
  return C._makeFromLinearSrgb(...linearP3ToSrgb(pr!, pg!, pb!), alpha);
};

// Spec rule 10: keep hue, move lightness, let the gamut map reduce chroma only when it must,
// smallest move that passes. Same-polarity side first (APCA sign is kept), other side only if needed.
const fixContrast = (
  C: typeof Colordx,
  fg: Colordx,
  bg: Colordx,
  wcag: number | undefined,
  apca: number | undefined,
  space: ApcaSpace
): Colordx | null => {
  const passes = (x: Colordx): boolean =>
    (wcag === undefined || wcagRatio(x, bg) >= wcag) && (apca === undefined || Math.abs(apcaLc(x, bg, space)) >= apca);
  if (passes(fg)) return fg;
  const { l, c, h, alpha } = rgbToOklch(fg._rawRgb());
  const search = (extreme: number): Colordx | null => {
    let best = quantized(C, extreme, c, h, alpha, space);
    if (!passes(best)) return null;
    let lo = l;
    let hi = extreme;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const cand = quantized(C, mid, c, h, alpha, space);
      if (passes(cand)) {
        hi = mid;
        best = cand;
      } else lo = mid;
    }
    return best;
  };
  const darker = wcagY(fg) <= wcagY(bg);
  return search(darker ? 0 : 1) ?? search(darker ? 1 : 0);
};

const a11y: Plugin = (ColordxClass) => {
  ColordxClass.prototype.luminance = function (this: Colordx, precision = 4): number {
    return round(wcagY(this), precision);
  };

  ColordxClass.prototype.contrast = function (
    this: Colordx,
    color: AnyColor | Colordx = '#fff',
    precision = 2
  ): number {
    return round(wcagRatio(this, new ColordxClass(color)), precision);
  };

  ColordxClass.prototype.apcaContrast = function (
    this: Colordx,
    background: AnyColor | Colordx = '#fff',
    options: { precision?: number; space?: ApcaSpace } = {}
  ): number {
    const { precision = 1, space = 'srgb' } = options;
    return round(apcaLc(this, new ColordxClass(background), space), precision);
  };

  ColordxClass.prototype.isReadableApca = function (
    this: Colordx,
    background: AnyColor | Colordx = '#fff',
    options: { size?: 'normal' | 'large'; space?: ApcaSpace } = {}
  ): boolean {
    const { size = 'normal', space = 'srgb' } = options;
    const lc = Math.abs(apcaLc(this, new ColordxClass(background), space));
    // Lc 75 for normal body text, Lc 60 for large/bold — simplified defaults, not the full APCA lookup table.
    return size === 'large' ? lc >= 60 : lc >= 75;
  };

  ColordxClass.prototype.readableScore = function (
    this: Colordx,
    background: AnyColor | Colordx = '#fff'
  ): 'AAA' | 'AA' | 'AA large' | 'fail' {
    const ratio = wcagRatio(this, new ColordxClass(background));
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    if (ratio >= 3) return 'AA large';
    return 'fail';
  };

  ColordxClass.prototype.isReadable = function (
    this: Colordx,
    background: AnyColor | Colordx = '#fff',
    options: { level?: 'AA' | 'AAA'; size?: 'normal' | 'large' } = {}
  ): boolean {
    const { level = 'AA', size = 'normal' } = options;
    const ratio = wcagRatio(this, new ColordxClass(background));
    if (level === 'AAA') return size === 'large' ? ratio >= 4.5 : ratio >= 7;
    return size === 'large' ? ratio >= 3 : ratio >= 4.5;
  };

  ColordxClass.prototype.fixContrast = function (
    this: Colordx,
    background: AnyColor | Colordx = '#fff',
    options: FixContrastOptions = {}
  ): Colordx | null {
    const { apca, space = 'srgb' } = options;
    const wcag = options.wcag ?? (apca === undefined ? 4.5 : undefined);
    return fixContrast(ColordxClass, this, new ColordxClass(background), wcag, apca, space);
  };

  ColordxClass.prototype.minReadable = function (this: Colordx, background: AnyColor | Colordx = '#fff'): Colordx {
    return this.fixContrast(background) ?? this;
  };
};

export default a11y;

import type { Colordx, Plugin } from '../colordx.js';
import { round } from '../helpers.js';
import { srgbToLinear } from '../transfer.js';
import type { AnyColor } from '../types.js';

declare module '@colordx/core' {
  interface Colordx {
    luminance(): number;
    contrast(color?: AnyColor | Colordx): number;
    isReadable(background?: AnyColor, options?: { level?: 'AA' | 'AAA'; size?: 'normal' | 'large' }): boolean;
    readableScore(background?: AnyColor): 'AAA' | 'AA' | 'AA large' | 'fail';
    minReadable(background?: AnyColor): Colordx;
    apcaContrast(background?: AnyColor): number;
    isReadableApca(background?: AnyColor, options?: { size?: 'normal' | 'large' }): boolean;
  }
}

// APCA 0.0.98G-4g-W3 constants
const SA98G = { Rsco: 0.2126729, Gsco: 0.7151522, Bsco: 0.072175 };
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

function apcaLuminance(r: number, g: number, b: number): number {
  // APCA 0.0.98G intentionally uses a straight 2.4 power curve, not the piecewise sRGB function.
  const lin = (c: number) => (c / 255) ** 2.4;
  const Y = SA98G.Rsco * lin(r) + SA98G.Gsco * lin(g) + SA98G.Bsco * lin(b);
  return Y > APCA.blkThrs ? Y : Y + (APCA.blkThrs - Y) ** APCA.blkClmp;
}

function calcApca(textRgb: { r: number; g: number; b: number }, bgRgb: { r: number; g: number; b: number }): number {
  const Yt = apcaLuminance(textRgb.r, textRgb.g, textRgb.b);
  const Ys = apcaLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  if (Math.abs(Ys - Yt) < APCA.deltaYmin) return 0;
  if (Ys > Yt) {
    const c = (Ys ** APCA.normBG - Yt ** APCA.normTXT) * APCA.scale;
    return c < APCA.loClip ? 0 : (c - APCA.offset) * 100;
  } else {
    const c = (Ys ** APCA.revBG - Yt ** APCA.revTXT) * APCA.scale;
    return c > -APCA.loClip ? 0 : (c + APCA.offset) * 100;
  }
}

const a11y: Plugin = (ColordxClass) => {
  ColordxClass.prototype.luminance = function (this: Colordx): number {
    const { r, g, b } = this._rawRgb();
    return round(0.2126 * srgbToLinear(r / 255) + 0.7152 * srgbToLinear(g / 255) + 0.0722 * srgbToLinear(b / 255), 4);
  };

  ColordxClass.prototype.contrast = function (this: Colordx, color: AnyColor = '#fff'): number {
    const bg = new ColordxClass(color);
    const bgRgb = bg._rawRgb();
    const fgRgb = this._rawRgb();
    const effectiveFg =
      fgRgb.alpha < 1
        ? new ColordxClass({
            r: fgRgb.alpha * fgRgb.r + (1 - fgRgb.alpha) * bgRgb.r,
            g: fgRgb.alpha * fgRgb.g + (1 - fgRgb.alpha) * bgRgb.g,
            b: fgRgb.alpha * fgRgb.b + (1 - fgRgb.alpha) * bgRgb.b,
            alpha: 1,
          })
        : this;
    const l1 = effectiveFg.luminance();
    const l2 = bg.luminance();
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return round((lighter + 0.05) / (darker + 0.05), 2);
  };

  ColordxClass.prototype.apcaContrast = function (this: Colordx, background: AnyColor = '#fff'): number {
    const bgRgb = new ColordxClass(background).toRgb();
    const fgRgb = this.toRgb();
    // Composite semi-transparent foreground over background before APCA calculation.
    const effectiveFg =
      fgRgb.alpha < 1
        ? {
            r: fgRgb.alpha * fgRgb.r + (1 - fgRgb.alpha) * bgRgb.r,
            g: fgRgb.alpha * fgRgb.g + (1 - fgRgb.alpha) * bgRgb.g,
            b: fgRgb.alpha * fgRgb.b + (1 - fgRgb.alpha) * bgRgb.b,
          }
        : fgRgb;
    return Math.round(calcApca(effectiveFg, bgRgb) * 10) / 10;
  };

  ColordxClass.prototype.isReadableApca = function (
    this: Colordx,
    background: AnyColor = '#fff',
    options: { size?: 'normal' | 'large' } = {}
  ): boolean {
    const { size = 'normal' } = options;
    const lc = Math.abs(this.apcaContrast(background));
    // Lc 75 for normal body text, Lc 60 for large/bold — simplified defaults, not the full APCA lookup table.
    return size === 'large' ? lc >= 60 : lc >= 75;
  };

  ColordxClass.prototype.readableScore = function (
    this: Colordx,
    background: AnyColor = '#fff'
  ): 'AAA' | 'AA' | 'AA large' | 'fail' {
    const ratio = this.contrast(background);
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    if (ratio >= 3) return 'AA large';
    return 'fail';
  };

  ColordxClass.prototype.isReadable = function (
    this: Colordx,
    background: AnyColor = '#fff',
    options: { level?: 'AA' | 'AAA'; size?: 'normal' | 'large' } = {}
  ): boolean {
    const { level = 'AA', size = 'normal' } = options;
    const ratio = this.contrast(background);
    if (level === 'AAA') return size === 'large' ? ratio >= 4.5 : ratio >= 7;
    return size === 'large' ? ratio >= 3 : ratio >= 4.5;
  };

  ColordxClass.prototype.minReadable = function (this: Colordx, background: AnyColor = '#fff'): Colordx {
    const bgLuminance = new ColordxClass(background).luminance();
    // Pick direction by which extreme (black vs white) gives higher max contrast against the background.
    // Using fg vs bg luminance comparison fails for dark-on-dark: fg darker than bg → darken, but
    // darkening toward black may never reach 4.5:1 against a dark background.
    const darkContrast = (bgLuminance + 0.05) / 0.05;
    const lightContrast = 1.05 / (bgLuminance + 0.05);
    const shouldDarken = darkContrast >= lightContrast;
    const step = (c: Colordx) => (shouldDarken ? c.darken(0.01) : c.lighten(0.01));

    if (this.contrast(background) >= 4.5) return this;
    let color = step(this);
    for (let i = 1; i < 100; i++) {
      if (color.contrast(background) >= 4.5) break;
      color = step(color);
    }
    return color;
  };
};

export default a11y;

import type { Colordx, Plugin } from '../colordx.js';
import { isLinearInGamut } from '../gamut.js';
import { srgbToLinear } from '../transfer.js';

interface MinifyOptions {
  hex?: boolean;
  rgb?: boolean;
  hsl?: boolean;
  alphaHex?: boolean;
  transparent?: boolean;
  name?: boolean;
}

declare module '@colordx/core' {
  interface Colordx {
    minify(options?: MinifyOptions): string;
  }
}

const shortenLeadingZero = (n: number): string => (n > 0 && n < 1 ? n.toString().replace('0.', '.') : String(n));

const tryShortHex = (hex: string, alpha: number): string | null => {
  const chars = hex.split('');
  if (alpha !== 1) {
    if (chars[1] === chars[2] && chars[3] === chars[4] && chars[5] === chars[6] && chars[7] === chars[8]) {
      return `#${chars[1]}${chars[3]}${chars[5]}${chars[7]}`;
    }
    return null;
  }
  if (chars[1] === chars[2] && chars[3] === chars[4] && chars[5] === chars[6])
    return `#${chars[1]}${chars[3]}${chars[5]}`;
  return null;
};

// Returns true if alpha (0–1) can be represented as an 8-bit hex byte without perceptible loss.
// Uses 2-decimal-place comparison to match browser rounding behaviour.
// A visible alpha whose byte rounds to 00 is not lossless: #f000 is fully transparent.
const isAlphaHexLossless = (alpha: number): boolean => {
  const byte = Math.round(alpha * 255);
  if (byte === 0 && alpha > 0) return false;
  return Math.round((byte / 255) * 100) === Math.round(alpha * 100);
};

// A color outside sRGB (a wide-gamut oklch/oklab/lab/lch/color() input) has no hex, rgb, hsl or
// name form: each of those would clip it, and on a wide-gamut display the browser renders the
// original. Such a color minifies to its oklch() string instead, with leading zeros dropped.
const outsideSrgb = (c: Colordx): boolean => {
  const { r, g, b } = c._rawRgb();
  return !isLinearInGamut(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
};

const minifyPlugin: Plugin = (ColordxClass) => {
  ColordxClass.prototype.minify = function (this: Colordx, options: MinifyOptions = {}) {
    if (outsideSrgb(this)) return this.toOklchString().replace(/([ (])0\./g, '$1.');
    const opts = { hex: true, rgb: true, hsl: true, ...options };
    const { r, g, b } = this.toRgb();
    const alpha = this.alpha();
    const targetHex = this.toHex();
    const candidates: string[] = [];

    if (opts.hex && (alpha === 1 || (opts.alphaHex && isAlphaHexLossless(alpha)))) {
      // An alpha whose byte is ff (0.999) is opaque in hex, so drop the byte: #808080, not #808080ff.
      const opaque = alpha === 1 || Math.round(alpha * 255) === 255;
      const hex = opaque ? targetHex.slice(0, 7) : targetHex;
      candidates.push(tryShortHex(hex, opaque ? 1 : alpha) ?? hex);
    }

    // Legacy comma syntax below is intentional — byte-optimal AND IE11-safe for the
    // cssnano pipeline. Do NOT delegate to toRgbString() / toHslString(); those emit
    // modern CSS Color 4 space syntax which pre-2019 browsers can't parse.
    if (opts.rgb) {
      const aa = shortenLeadingZero(alpha);
      candidates.push(alpha === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${aa})`);
    }

    if (opts.hsl) {
      const aa = shortenLeadingZero(alpha);
      for (let p = 0; p <= 2; p++) {
        const { h, s, l } = this.toHsl(p);
        const ha = shortenLeadingZero(h),
          sa = shortenLeadingZero(s),
          la = shortenLeadingZero(l);
        const str = alpha === 1 ? `hsl(${ha},${sa}%,${la}%)` : `hsla(${ha},${sa}%,${la}%,${aa})`;
        if (new ColordxClass(str).toHex() === targetHex) {
          candidates.push(str);
          break;
        }
      }
    }

    if (opts.transparent && r === 0 && g === 0 && b === 0 && alpha === 0) {
      candidates.push('transparent');
    } else if (
      // else if: transparent takes priority over name even though it is also a CSS named color
      alpha === 1 &&
      opts.name &&
      typeof (this as { toName?: () => string | undefined }).toName === 'function'
    ) {
      const name = (this as { toName: () => string | undefined }).toName();
      if (name) candidates.push(name);
    }

    if (candidates.length === 0) return targetHex;
    return candidates.reduce((shortest, c) => (c.length < shortest.length ? c : shortest));
  };
};

export default minifyPlugin;

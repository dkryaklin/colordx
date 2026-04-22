import type { Colordx, Plugin } from '../colordx.js';

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
const isAlphaHexLossless = (alpha: number): boolean => {
  const byte = Math.round(alpha * 255);
  return Math.round((byte / 255) * 100) === Math.round(alpha * 100);
};

const minifyPlugin: Plugin = (ColordxClass) => {
  ColordxClass.prototype.minify = function (this: Colordx, options: MinifyOptions = {}) {
    const opts = { hex: true, rgb: true, hsl: true, ...options };
    const { r, g, b } = this.toRgb();
    const alpha = this.alpha();
    const targetHex = this.toHex();
    const candidates: string[] = [];

    if (opts.hex && (alpha === 1 || (opts.alphaHex && isAlphaHexLossless(alpha)))) {
      const short = tryShortHex(targetHex, alpha);
      candidates.push(short ?? targetHex);
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

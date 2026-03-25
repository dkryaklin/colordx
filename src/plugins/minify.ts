import type { Colordx, Plugin } from '../colordx.js';

interface MinifyOptions {
  hex?: boolean;
  rgb?: boolean;
  hsl?: boolean;
  alphaHex?: boolean;
  transparent?: boolean;
  name?: boolean;
}

declare module '../colordx.js' {
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
    const { h, s, l } = this.toHsl();
    const alpha = this.alpha();
    const candidates: string[] = [];

    if (opts.hex && (alpha === 1 || (opts.alphaHex && isAlphaHexLossless(alpha)))) {
      const short = tryShortHex(this.toHex(), alpha);
      candidates.push(short ?? this.toHex());
    }

    if (opts.rgb) {
      const ra = shortenLeadingZero(r),
        ga = shortenLeadingZero(g),
        ba = shortenLeadingZero(b),
        aa = shortenLeadingZero(alpha);
      candidates.push(alpha === 1 ? `rgb(${ra},${ga},${ba})` : `rgba(${ra},${ga},${ba},${aa})`);
    }

    if (opts.hsl) {
      const ha = shortenLeadingZero(h),
        sa = shortenLeadingZero(s),
        la = shortenLeadingZero(l),
        aa = shortenLeadingZero(alpha);
      candidates.push(alpha === 1 ? `hsl(${ha},${sa}%,${la}%)` : `hsla(${ha},${sa}%,${la}%,${aa})`);
    }

    if (opts.transparent && r === 0 && g === 0 && b === 0 && alpha === 0) {
      candidates.push('transparent');
    } else if (
      alpha === 1 &&
      opts.name &&
      typeof (this as { toName?: () => string | undefined }).toName === 'function'
    ) {
      const name = (this as { toName: () => string | undefined }).toName();
      if (name) candidates.push(name);
    }

    return candidates.reduce((shortest, c) => (c.length < shortest.length ? c : shortest));
  };
};

export default minifyPlugin;

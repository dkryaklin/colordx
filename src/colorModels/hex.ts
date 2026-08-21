import { clamp, isWs, round } from '../helpers.js';
import type { RgbColor } from '../types.js';

const HEX_BYTE = /* #__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/** Convert a number in [0, 255] to a 2-char lowercase hex byte. Clamps and rounds out-of-range inputs. */
export const toHexByte = (n: number): string => HEX_BYTE[clamp(Math.round(n), 0, 255)]!;
/** Hex digit value, or -1. Avoids a regex validation pass over the string. */
const hexDigit = (c: number): number => {
  const d = c - 48;
  if (d >= 0 && d <= 9) return d;
  const l = (c | 32) - 87; // 'a' (97) -> 10
  return l >= 10 && l <= 15 ? l : -1;
};

export const parseHex = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  // trim() allocates; only pay for it when there is actually padding to strip
  const s = isWs(input.charCodeAt(0)) || isWs(input.charCodeAt(input.length - 1)) ? input.trim() : input;
  const n = s.length;
  if (s.charCodeAt(0) !== 35) return null; // '#'
  if (n !== 4 && n !== 5 && n !== 7 && n !== 9) return null;

  // Validate and extract in one pass.
  const d1 = hexDigit(s.charCodeAt(1));
  const d2 = hexDigit(s.charCodeAt(2));
  const d3 = hexDigit(s.charCodeAt(3));
  if (d1 < 0 || d2 < 0 || d3 < 0) return null;

  if (n === 4 || n === 5) {
    let a = 255;
    if (n === 5) {
      const d4 = hexDigit(s.charCodeAt(4));
      if (d4 < 0) return null;
      a = d4 | (d4 << 4);
    }
    return {
      r: d1 | (d1 << 4),
      g: d2 | (d2 << 4),
      b: d3 | (d3 << 4),
      alpha: a === 255 ? 1 : round(a / 255, 3),
    };
  }

  const d4 = hexDigit(s.charCodeAt(4));
  const d5 = hexDigit(s.charCodeAt(5));
  const d6 = hexDigit(s.charCodeAt(6));
  if (d4 < 0 || d5 < 0 || d6 < 0) return null;
  let alpha = 1;
  if (n === 9) {
    const d7 = hexDigit(s.charCodeAt(7));
    const d8 = hexDigit(s.charCodeAt(8));
    if (d7 < 0 || d8 < 0) return null;
    alpha = round(((d7 << 4) | d8) / 255, 3);
  }
  return { r: (d1 << 4) | d2, g: (d3 << 4) | d4, b: (d5 << 4) | d6, alpha };
};

export const rgbToHex = ({ r, g, b, alpha }: RgbColor): string => {
  const hex = '#' + toHexByte(r) + toHexByte(g) + toHexByte(b);
  return alpha < 1 ? hex + toHexByte(alpha * 255) : hex;
};

/** Always emits 8-digit `#rrggbbaa`, regardless of alpha. Companion to `rgbToHex`. */
export const rgbToHex8 = ({ r, g, b, alpha }: RgbColor): string =>
  '#' + toHexByte(r) + toHexByte(g) + toHexByte(b) + toHexByte(alpha * 255);

import { clamp, round } from '../helpers.js';
import type { RgbColor } from '../types.js';

const HEX_BYTE = /* #__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
const hexNibble = (c: number): number => (c & 0xf) + 9 * (c >> 6);
const hexByte = (s: string, i: number): number => (hexNibble(s.charCodeAt(i)) << 4) | hexNibble(s.charCodeAt(i + 1));
const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const parseHex = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!HEX_RE.test(s)) return null;
  const len = s.length;

  if (len === 4 || len === 5) {
    const rv = hexNibble(s.charCodeAt(1));
    const gv = hexNibble(s.charCodeAt(2));
    const bv = hexNibble(s.charCodeAt(3));
    const av = len === 5 ? hexNibble(s.charCodeAt(4)) : 15;
    return { r: rv | (rv << 4), g: gv | (gv << 4), b: bv | (bv << 4), a: round((av | (av << 4)) / 255, 3) };
  }

  return {
    r: hexByte(s, 1),
    g: hexByte(s, 3),
    b: hexByte(s, 5),
    a: len === 9 ? round(hexByte(s, 7) / 255, 3) : 1,
  };
};

export const rgbToHex = ({ r, g, b, a }: RgbColor): string => {
  const hex =
    '#' +
    HEX_BYTE[clamp(Math.round(r), 0, 255)] +
    HEX_BYTE[clamp(Math.round(g), 0, 255)] +
    HEX_BYTE[clamp(Math.round(b), 0, 255)];
  return a < 1 ? hex + HEX_BYTE[clamp(Math.round(a * 255), 0, 255)] : hex;
};

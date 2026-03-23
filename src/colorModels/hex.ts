import { clamp, round } from '../helpers.js';
import type { RgbColor } from '../types.js';

const parseHexChannel = (hex: string): number => parseInt(hex.padEnd(2, hex), 16);

export const parseHex = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const clean = input.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{3,8}$/i.test(clean)) return null;

  if (clean.length === 3 || clean.length === 4) {
    const [r, g, b, a = 'f'] = clean.split('');
    return {
      r: parseHexChannel(r!),
      g: parseHexChannel(g!),
      b: parseHexChannel(b!),
      a: round(parseHexChannel(a) / 255, 3),
    };
  }

  if (clean.length === 6 || clean.length === 8) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
      a: clean.length === 8 ? round(parseInt(clean.slice(6, 8), 16) / 255, 3) : 1,
    };
  }

  return null;
};

export const rgbToHex = ({ r, g, b, a }: RgbColor): string => {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  return a < 1 ? hex + toHex(a * 255) : hex;
};

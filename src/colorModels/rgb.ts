import { clamp, hasKeys, isNumeric, isObject, round } from '../helpers.js';
import type { RgbColor } from '../types.js';

export const clampRgb = (rgb: RgbColor): RgbColor => ({
  r: clamp(round(rgb.r), 0, 255),
  g: clamp(round(rgb.g), 0, 255),
  b: clamp(round(rgb.b), 0, 255),
  a: clamp(round(rgb.a, 2), 0, 1),
});

export const parseRgbObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['r', 'g', 'b'])) return null;
  const { r, g, b, a = 1 } = input;
  if (!isNumeric(r) || !isNumeric(g) || !isNumeric(b) || !isNumeric(a as number)) return null;
  return clampRgb({ r: r, g: g, b: b, a: a as number });
};

export const parseRgbString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const match = input.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  if (!match) return null;
  return clampRgb({
    r: parseFloat(match[1]!),
    g: parseFloat(match[2]!),
    b: parseFloat(match[3]!),
    a: match[4] !== undefined ? parseFloat(match[4]) : 1,
  });
};

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

// Matches both legacy comma syntax: rgb(255, 0, 0) / rgba(255, 0, 0, 0.5)
// and modern space syntax: rgb(255 0 0) / rgb(255 0 0 / 0.5)
const RGB_RE =
  /^rgba?\(\s*([+-]?\d*\.?\d+)\s*(?:,\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)(?:\s*,\s*([+-]?\d*\.?\d+)(%)?)?\s*|\s+([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)(?:\s*\/\s*([+-]?\d*\.?\d+)(%)?)?\s*)\)$/i;

export const parseRgbString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = RGB_RE.exec(input);
  if (!m) return null;
  // m[2]/m[3]/m[4]/m[5] = comma branch; m[6]/m[7]/m[8]/m[9] = space branch
  const r = Number(m[1]);
  const g = Number(m[2] ?? m[6]);
  const b = Number(m[3] ?? m[7]);
  const rawA = m[4] ?? m[8];
  const isPercent = !!(m[5] ?? m[9]);
  const a = rawA === undefined ? 1 : Number(rawA) / (isPercent ? 100 : 1);
  return clampRgb({ r, g, b, a });
};

import { clamp, hasKeys, isNumber, isObject, round, sanitize } from '../helpers.js';
import type { RgbColor } from '../types.js';

export const clampRgb = (rgb: RgbColor): RgbColor => ({
  r: clamp(rgb.r, 0, 255),
  g: clamp(rgb.g, 0, 255),
  b: clamp(rgb.b, 0, 255),
  alpha: clamp(round(rgb.alpha, 3), 0, 1),
});

export const parseRgbObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!hasKeys(input, ['r', 'g', 'b'])) return null;
  const { r, g, b, alpha = 1 } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
  if (!isNumber(r) || !isNumber(g) || !isNumber(b) || !isNumber(alpha as number)) return null;
  return clampRgb({ r: sanitize(r), g: sanitize(g), b: sanitize(b), alpha: sanitize(alpha as number) });
};

// Matches both legacy comma syntax: rgb(255, 0, 0) / rgba(255, 0, 0, 0.5)
// and modern space syntax: rgb(255 0 0) / rgb(255 0 0 / 0.5)
// Also supports percentage-based channels: rgb(100%, 0%, 0%) / rgb(100% 0% 0%)
const N = '[+-]?\\d*\\.?\\d+';
const RGB_RE = new RegExp(
  `^rgba?\\(\\s*(${N})(%?)\\s*(?:` +
    // comma branch: r,g,b and optional alpha
    `,\\s*(${N})(%?)\\s*,\\s*(${N})(%?)(?:\\s*,\\s*(${N})(%?))?\\s*` +
    `|` +
    // space branch: r g b and optional /alpha
    `\\s+(${N})(%?)\\s+(${N})(%?)(?:\\s*/\\s*(${N})(%?))?\\s*` +
    `)\\)$`,
  'i'
);

export const parseRgbString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const m = RGB_RE.exec(input.trim());
  if (!m) return null;

  // comma branch: m[1]r m[2]r% m[3]g m[4]g% m[5]b m[6]b% m[7]a m[8]a%
  // space branch:  m[1]r m[2]r% m[9]g m[10]g% m[11]b m[12]b% m[13]a m[14]a%
  const rPct = !!m[2];
  const r = rPct ? (Number(m[1]) / 100) * 255 : Number(m[1]);

  const gRaw = m[3] ?? m[9];
  const gPct = !!(m[4] ?? m[10]);
  const g = gPct ? (Number(gRaw) / 100) * 255 : Number(gRaw);

  const bRaw = m[5] ?? m[11];
  const bPct = !!(m[6] ?? m[12]);
  const b = bPct ? (Number(bRaw) / 100) * 255 : Number(bRaw);

  // CSS requires r/g/b to be all-numbers or all-percentages, not mixed
  if (rPct !== gPct || gPct !== bPct) return null;

  const rawA = m[7] ?? m[13];
  const aPct = !!(m[8] ?? m[14]);
  const alpha = rawA === undefined ? 1 : Number(rawA) / (aPct ? 100 : 1);

  return clampRgb({ r, g, b, alpha });
};

import { NUM_OR_NONE, clamp, hasKeys, isAnyNumber, isObject, parseNum, round, sanitize } from '../helpers.js';
import type { RgbColor } from '../types.js';

export const clampRgb = (rgb: RgbColor): RgbColor => ({
  r: clamp(rgb.r, 0, 255),
  g: clamp(rgb.g, 0, 255),
  b: clamp(rgb.b, 0, 255),
  alpha: clamp(round(rgb.alpha, 3), 0, 1),
});

export const parseRgbObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  const cs = (input as { colorSpace?: unknown }).colorSpace;
  if (cs === 'display-p3' || cs === 'rec2020') return null;
  if (!hasKeys(input, ['r', 'g', 'b'])) return null;
  const { r, g, b, alpha = 1 } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(r) || !isAnyNumber(g) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return clampRgb({ r: sanitize(r), g: sanitize(g), b: sanitize(b), alpha: sanitize(alpha) });
};

// Matches both legacy comma syntax: rgb(255, 0, 0) / rgba(255, 0, 0, 0.5)
// and modern space syntax: rgb(255 0 0) / rgb(255 0 0 / 0.5).
// Supports percentage-based channels and the CSS Color 4 `none` keyword.
// Named groups are suffixed `_c` (comma/legacy branch) or `_s` (space/modern branch)
// because ES2022 regex requires distinct names across alternation branches.
const RGB_RE = new RegExp(
  `^rgba?\\(\\s*(?<r>${NUM_OR_NONE})(?<rp>%?)\\s*(?:` +
    `,\\s*(?<g_c>${NUM_OR_NONE})(?<gp_c>%?)\\s*,\\s*(?<b_c>${NUM_OR_NONE})(?<bp_c>%?)` +
    `(?:\\s*,\\s*(?<al_c>${NUM_OR_NONE})(?<alp_c>%?))?\\s*` +
    `|` +
    `\\s+(?<g_s>${NUM_OR_NONE})(?<gp_s>%?)\\s+(?<b_s>${NUM_OR_NONE})(?<bp_s>%?)` +
    `(?:\\s*/\\s*(?<al_s>${NUM_OR_NONE})(?<alp_s>%?))?\\s*` +
    `)\\)$`,
  'i'
);

export const parseRgbString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = RGB_RE.exec(input.trim())?.groups;
  if (!g) return null;

  const isComma = g.g_c !== undefined;
  const gRaw = g.g_c ?? g.g_s!;
  const bRaw = g.b_c ?? g.b_s!;
  const rPct = !!g.rp;
  const gPct = !!(g.gp_c ?? g.gp_s);
  const bPct = !!(g.bp_c ?? g.bp_s);

  const r = rPct ? (parseNum(g.r!) / 100) * 255 : parseNum(g.r!);
  const gc = gPct ? (parseNum(gRaw) / 100) * 255 : parseNum(gRaw);
  const b = bPct ? (parseNum(bRaw) / 100) * 255 : parseNum(bRaw);

  // Legacy: channels must match type, no `none`. Modern: mixing + `none` allowed.
  if (isComma) {
    if (rPct !== gPct || gPct !== bPct) return null;
    if (/^none$/i.test(g.r!) || /^none$/i.test(gRaw) || /^none$/i.test(bRaw)) return null;
  }

  const rawA = g.al_c ?? g.al_s;
  const aPct = !!(g.alp_c ?? g.alp_s);
  if (isComma && rawA !== undefined && /^none$/i.test(rawA)) return null;
  const alpha = rawA === undefined ? 1 : parseNum(rawA) / (aPct ? 100 : 1);

  return clampRgb({ r, g: gc, b, alpha });
};

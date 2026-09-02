import { NUM_OR_NONE, clamp, isObject, parseNum, round } from '../helpers.js';
import { scanChannel, scanNone, scanPct, scanPos, skipWs } from '../scan.js';
import type { RgbColor } from '../types.js';

export const clampRgb = (rgb: RgbColor): RgbColor => ({
  r: clamp(rgb.r, 0, 255),
  g: clamp(rgb.g, 0, 255),
  b: clamp(rgb.b, 0, 255),
  alpha: clamp(round(rgb.alpha, 3), 0, 1),
});

/**
 * Object body. Assumes the caller already established that `input` is a non-null
 * object carrying r/g/b — the dispatcher proves that with one key probe, so
 * re-checking here would duplicate it on every parse.
 *
 * Clamps with comparisons rather than Math.min/Math.max: `NaN > x` is always
 * false, so NaN falls through to the low bound. That is exactly what
 * sanitize()-then-clamp produced, for free and without four extra calls.
 */
export const parseRgbBody = (input: unknown): RgbColor | null => {
  const cs = (input as { colorSpace?: unknown }).colorSpace;
  if (cs === 'display-p3' || cs === 'rec2020' || cs === 'a98-rgb' || cs === 'prophoto-rgb' || cs === 'srgb-linear')
    return null;
  const { r, g, b, alpha = 1 } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
  if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number' || typeof alpha !== 'number') return null;
  const a = alpha > 1 ? 1 : alpha > 0 ? Math.round(alpha * 1000) / 1000 : 0;
  return {
    r: r > 255 ? 255 : r > 0 ? r : 0,
    g: g > 255 ? 255 : g > 0 ? g : 0,
    b: b > 255 ? 255 : b > 0 ? b : 0,
    alpha: a,
  };
};

export const parseRgbObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if (!('r' in input && 'g' in input && 'b' in input)) return null;
  return parseRgbBody(input);
};

export const parseRgbString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const s = input;
  const n = s.length;
  let i = skipWs(s, 0, n);

  // rgb | rgba
  if ((s.charCodeAt(i) | 32) !== 114) return null;
  if ((s.charCodeAt(i + 1) | 32) !== 103) return null;
  if ((s.charCodeAt(i + 2) | 32) !== 98) return null;
  i += 3;
  if ((s.charCodeAt(i) | 32) === 97) i++;
  if (s.charCodeAt(i) !== 40) return null;
  i = skipWs(s, i + 1, n);

  const r = scanChannel(s, i, n);
  if (r !== r) return null;
  const rPct = scanPct(),
    rNone = scanNone();
  i = scanPos();

  let j = skipWs(s, i, n);
  const comma = s.charCodeAt(j) === 44;
  if (comma) {
    if (rNone) return null; // legacy syntax has no `none`
    j = skipWs(s, j + 1, n);
  } else if (j === i) return null; // modern syntax needs whitespace between channels

  const g = scanChannel(s, j, n);
  if (g !== g) return null;
  const gPct = scanPct(),
    gNone = scanNone();
  j = scanPos();

  let k = skipWs(s, j, n);
  if (comma) {
    if (s.charCodeAt(k) !== 44 || gNone) return null;
    k = skipWs(s, k + 1, n);
  } else if (k === j) return null;

  const b = scanChannel(s, k, n);
  if (b !== b) return null;
  const bPct = scanPct(),
    bNone = scanNone();
  k = scanPos();

  // Legacy: channels must agree on percent-vs-number and forbid `none`.
  if (comma && (rPct !== gPct || gPct !== bPct || bNone)) return null;

  let m = skipWs(s, k, n);
  let alpha = 1;
  const sep = s.charCodeAt(m);
  if ((comma && sep === 44) || (!comma && sep === 47)) {
    m = skipWs(s, m + 1, n);
    const a = scanChannel(s, m, n);
    if (a !== a) return null;
    if (comma && scanNone()) return null;
    alpha = scanPct() ? a / 100 : a;
    m = skipWs(s, scanPos(), n);
  }
  if (s.charCodeAt(m) !== 41) return null;
  if (skipWs(s, m + 1, n) !== n) return null; // allow trailing whitespace, nothing else

  return clampRgb({
    r: rPct ? (r / 100) * 255 : r,
    g: gPct ? (g / 100) * 255 : g,
    b: bPct ? (b / 100) * 255 : b,
    alpha,
  });
};

// CSS Color 4: color(srgb r g b / alpha). Channels are 0–1, percent or none; 100% = 1.
// Not clamped: out-of-range channels are valid out-of-gamut colors.
const SRGB_RE = new RegExp(
  `^color\\(\\s*srgb\\s+(?<r>${NUM_OR_NONE})(?<rp>%?)\\s+(?<g>${NUM_OR_NONE})(?<gp>%?)` +
    `\\s+(?<b>${NUM_OR_NONE})(?<bp>%?)\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseSrgbColorString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = SRGB_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return {
    r: (g.rp ? parseNum(g.r!) / 100 : parseNum(g.r!)) * 255,
    g: (g.gp ? parseNum(g.g!) / 100 : parseNum(g.g!)) * 255,
    b: (g.bp ? parseNum(g.b!) / 100 : parseNum(g.b!)) * 255,
    alpha: clamp(alpha, 0, 1),
  };
};

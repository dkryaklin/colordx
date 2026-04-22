import {
  ANGLE_UNITS,
  NUM_OR_NONE,
  clamp,
  hasKeys,
  isAnyNumber,
  isObject,
  normalizeHue,
  parseNum,
  sanitize,
} from '../helpers.js';
import type { OklabColor, OklchColor, RgbColor } from '../types.js';
import { oklabToRgb, oklabToRgbUnclamped, rgbToOklab } from './oklab.js';

const oklchToOklab = ({ l, c, h, alpha }: OklchColor): OklabColor => ({
  l,
  a: c * Math.cos((h * Math.PI) / 180),
  b: c * Math.sin((h * Math.PI) / 180),
  alpha,
});

export const rgbToOklch = (rgb: RgbColor): OklchColor => {
  const { l: ol, a: oa, b: ob, alpha } = rgbToOklab(rgb);
  const C = Math.sqrt(oa * oa + ob * ob);
  const H = (Math.atan2(ob, oa) * 180) / Math.PI;
  // Achromatic threshold on OKLCH scale (0–~0.4): proportionally equivalent to LCH's 0.0015 threshold.
  return { l: ol, c: C, h: C < 0.000004 ? 0 : normalizeHue(H), alpha };
};

export const oklchToRgb = (oklch: OklchColor): RgbColor => oklabToRgb(oklchToOklab(oklch));
const oklchToRgbUnclamped = (oklch: OklchColor): RgbColor => oklabToRgbUnclamped(oklchToOklab(oklch));

export const parseOklchObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  // Objects with colorSpace: 'lch' are CIE LCH, not OKLCH — let parseLchObject handle them.
  if ((input as { colorSpace?: unknown }).colorSpace === 'lch') return null;
  if (!hasKeys(input, ['l', 'c', 'h'])) return null;
  const { l, c, h, alpha = 1 } = input as { l: unknown; c: unknown; h: unknown; alpha?: unknown };
  if (!isAnyNumber(l) || !isAnyNumber(c) || !isAnyNumber(h) || !isAnyNumber(alpha)) return null;
  if (sanitize(l) > 1) return null; // OKLCH L is always [0, 1]; reject CIE LCH values passed without colorSpace branding
  return oklchToRgbUnclamped({
    l: sanitize(l),
    c: Math.max(0, sanitize(c)),
    h: normalizeHue(sanitize(h)),
    alpha: clamp(sanitize(alpha), 0, 1),
  });
};

const OKLCH_RE = new RegExp(
  `^oklch\\(\\s*(?<l>${NUM_OR_NONE})(?<lp>%?)\\s+(?<c>${NUM_OR_NONE})(?<cp>%?)` +
    `\\s+(?<h>${NUM_OR_NONE})(?<hu>deg|rad|grad|turn)?` +
    `\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseOklchString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = OKLCH_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const L = g.lp ? parseNum(g.l!) / 100 : parseNum(g.l!); // 100% = 1
  const C = Math.max(0, g.cp ? parseNum(g.c!) * 0.004 : parseNum(g.c!)); // 100% = 0.4
  const unit = g.hu?.toLowerCase() ?? 'deg';
  const H = parseNum(g.h!) * (ANGLE_UNITS[unit] ?? 1);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return oklchToRgbUnclamped({
    l: L,
    c: C,
    h: normalizeHue(H),
    alpha: clamp(alpha, 0, 1),
  });
};

import {
  ANGLE_UNITS,
  NUM_OR_NONE,
  clamp,
  hasKeys,
  isAnyNumber,
  isObject,
  normalizeHue,
  parseNum,
  round,
  sanitize,
} from '../helpers.js';
import type { LchColor, RgbColor } from '../types.js';
import { labToRgb, labToRgbUnclamped, rgbToLab } from './lab.js';

const clampLch = (lch: Omit<LchColor, 'colorSpace'>): LchColor => ({
  l: clamp(lch.l, 0, 100),
  c: Math.max(0, lch.c),
  h: normalizeHue(lch.h),
  alpha: clamp(lch.alpha, 0, 1),
  colorSpace: 'lch',
});

export const rgbToLchRaw = (rgb: RgbColor): LchColor => {
  const lab = rgbToLab(rgb);
  const c = Math.sqrt(lab.a ** 2 + lab.b ** 2);
  const h = (Math.atan2(lab.b, lab.a) / Math.PI) * 180;
  return {
    l: lab.l,
    c,
    // Achromatic threshold on LCH scale (0–~150): below this chroma the hue is numerically unstable.
    h: c < 0.0015 ? 0 : h < 0 ? h + 360 : h,
    alpha: lab.alpha,
    colorSpace: 'lch',
  };
};

export const rgbToLch = (rgb: RgbColor): LchColor => {
  const { l, c, h, alpha } = rgbToLchRaw(rgb);
  const cR = round(c, 2);
  return { l, c: cR, h: cR < 0.0015 ? 0 : round(h, 2), alpha, colorSpace: 'lch' };
};

export const lchToRgb = ({ l, c, h, alpha }: LchColor): RgbColor =>
  labToRgb({
    l,
    a: c * Math.cos((h * Math.PI) / 180),
    b: c * Math.sin((h * Math.PI) / 180),
    alpha,
    colorSpace: 'lab',
  });

/** Unclamped LCH → gamma sRGB. Mirrors lchToRgb but preserves out-of-gamut channels. */
const lchToRgbUnclamped = ({ l, c, h, alpha }: LchColor): RgbColor =>
  labToRgbUnclamped({
    l,
    a: c * Math.cos((h * Math.PI) / 180),
    b: c * Math.sin((h * Math.PI) / 180),
    alpha,
    colorSpace: 'lab',
  });

export const parseLchObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'lch') return null;
  if (!hasKeys(input, ['l', 'c', 'h'])) return null;
  const { l, c, h, alpha = 1 } = input as { l: unknown; c: unknown; h: unknown; alpha?: unknown };
  if (!isAnyNumber(l) || !isAnyNumber(c) || !isAnyNumber(h) || !isAnyNumber(alpha)) return null;
  return lchToRgbUnclamped(
    clampLch({
      l: sanitize(l),
      c: sanitize(c),
      h: sanitize(h),
      alpha: sanitize(alpha),
    })
  );
};

// CSS Color 4: lch(L C H / alpha). L: 100%=100. C: 100%=150. H: number|angle|none.
const LCH_RE = new RegExp(
  `^lch\\(\\s*(?<l>${NUM_OR_NONE})(?<lp>%?)\\s+(?<c>${NUM_OR_NONE})(?<cp>%?)` +
    `\\s+(?<h>${NUM_OR_NONE})(?<hu>deg|rad|grad|turn)?` +
    `\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseLchString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = LCH_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const l = parseNum(g.l!); // 100% = 100
  const c = g.cp ? parseNum(g.c!) * 1.5 : parseNum(g.c!); // 100% = 150
  const unit = g.hu?.toLowerCase() ?? 'deg';
  const h = parseNum(g.h!) * (ANGLE_UNITS[unit] ?? 1);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return lchToRgbUnclamped(clampLch({ l, c, h, alpha }));
};

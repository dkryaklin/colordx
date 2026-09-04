import { NUM_OR_NONE, clamp, isAnyNumber, isObject, parseNum, sanitize } from '../helpers.js';
import { linearToStoredRgb, srgbToLinear } from '../transfer.js';
import type { RgbColor, SrgbLinearColor } from '../types.js';

// No clamping: srgb-linear may hold values outside [0, 1]. Callers clip on sRGB output.
export const rgbToSrgbLinearRaw = ({ r, g, b, alpha }: RgbColor): SrgbLinearColor => ({
  r: srgbToLinear(r / 255),
  g: srgbToLinear(g / 255),
  b: srgbToLinear(b / 255),
  alpha,
  colorSpace: 'srgb-linear',
});

const srgbLinearToRgbUnclamped = ({ r, g, b, alpha }: SrgbLinearColor): RgbColor => linearToStoredRgb(r, g, b, alpha);

export const parseSrgbLinearObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'srgb-linear') return null;
  if (!('r' in input && 'g' in input && 'b' in input)) return null;
  const { r, g, b, alpha = 1 } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(r) || !isAnyNumber(g) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return srgbLinearToRgbUnclamped({
    r: sanitize(r),
    g: sanitize(g),
    b: sanitize(b),
    alpha: clamp(sanitize(alpha), 0, 1),
    colorSpace: 'srgb-linear',
  });
};

// CSS Color 4: color(srgb-linear r g b / alpha). Channels accept number|percentage|none; 100% = 1.
const SRGB_LINEAR_RE = new RegExp(
  `^color\\(\\s*srgb-linear\\s+(?<r>${NUM_OR_NONE})(?<rp>%?)\\s+(?<g>${NUM_OR_NONE})(?<gp>%?)` +
    `\\s+(?<b>${NUM_OR_NONE})(?<bp>%?)\\s*(?:/\\s*(?<al>${NUM_OR_NONE})(?<alp>%?)\\s*)?\\)$`,
  'i'
);

export const parseSrgbLinearString = (input: unknown): RgbColor | null => {
  if (typeof input !== 'string') return null;
  const g = SRGB_LINEAR_RE.exec(input.trim())?.groups;
  if (!g) return null;
  const r = g.rp ? parseNum(g.r!) / 100 : parseNum(g.r!);
  const gc = g.gp ? parseNum(g.g!) / 100 : parseNum(g.g!);
  const b = g.bp ? parseNum(g.b!) / 100 : parseNum(g.b!);
  const alpha = g.al === undefined ? 1 : parseNum(g.al) / (g.alp ? 100 : 1);
  return srgbLinearToRgbUnclamped({
    r,
    g: gc,
    b,
    alpha: clamp(alpha, 0, 1),
    colorSpace: 'srgb-linear',
  });
};

parseSrgbLinearObject.inputKind = 'object' as const;
parseSrgbLinearString.inputKind = 'string' as const;

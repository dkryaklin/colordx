import { alphaAlias, clamp, isAnyNumber, isObject, sanitize } from '../helpers.js';
import { SC, scanColorRgb } from '../scan.js';
import { byteToLinear, linearToStoredRgb } from '../transfer.js';
import type { RgbColor, SrgbLinearColor } from '../types.js';

// No clamping: srgb-linear may hold values outside [0, 1]. Callers clip on sRGB output.
export const rgbToSrgbLinearRaw = ({ r, g, b, alpha }: RgbColor): SrgbLinearColor => ({
  r: byteToLinear(r),
  g: byteToLinear(g),
  b: byteToLinear(b),
  alpha,
  colorSpace: 'srgb-linear',
});

const srgbLinearToRgbUnclamped = ({ r, g, b, alpha }: SrgbLinearColor): RgbColor => linearToStoredRgb(r, g, b, alpha);

export const parseSrgbLinearObject = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'srgb-linear') return null;
  if (!('r' in input && 'g' in input && 'b' in input)) return null;
  const { r, g, b, alpha = alphaAlias(input) } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
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
export const parseSrgbLinearString = (input: unknown): RgbColor | null =>
  scanColorRgb(input, 'color(srgb-linear ')
    ? srgbLinearToRgbUnclamped({ r: SC[0]!, g: SC[1]!, b: SC[2]!, alpha: SC[3]!, colorSpace: 'srgb-linear' })
    : null;

parseSrgbLinearObject.inputKind = 'object' as const;
parseSrgbLinearString.inputKind = 'string' as const;

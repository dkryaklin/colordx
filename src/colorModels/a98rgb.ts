import { alphaAlias, clamp, isAnyNumber, isObject, sanitize } from '../helpers.js';
import { SC, scanColorRgb } from '../scan.js';
import { a98FromLinear, a98ToLinear, byteToLinear, linearToStoredRgb } from '../transfer.js';
import type { A98Color, RgbColor } from '../types.js';
import { oklabToLinear } from './oklab.js';

const SA9_RR = 0.71512560685562476,
  SA9_RG = 0.2848743931443754;
const SA9_BG = 0.04116194845011846,
  SA9_BB = 0.95883805154988155;
const A9S_RR = 1.3983557439607788,
  A9S_RG = -0.39835574396077827;
const A9S_BG = -0.042928989294473266,
  A9S_BB = 1.0429289892944733;

export const srgbLinearToA98LinearInto = (out: Float64Array | number[], r: number, g: number, b: number): void => {
  out[0] = SA9_RR * r + SA9_RG * g;
  out[1] = g;
  out[2] = SA9_BG * g + SA9_BB * b;
};

export const srgbLinearToA98Linear = (r: number, g: number, b: number): [number, number, number] => [
  SA9_RR * r + SA9_RG * g,
  g,
  SA9_BG * g + SA9_BB * b,
];

export const linearA98ToSrgb = (r: number, g: number, b: number): [number, number, number] => [
  A9S_RR * r + A9S_RG * g,
  g,
  A9S_BG * g + A9S_BB * b,
];

export const rgbToA98Raw = ({ r, g, b, alpha }: RgbColor): A98Color => {
  const [ar, ag, ab] = srgbLinearToA98Linear(byteToLinear(r), byteToLinear(g), byteToLinear(b));
  return {
    r: a98FromLinear(ar),
    g: a98FromLinear(ag),
    b: a98FromLinear(ab),
    alpha,
    colorSpace: 'a98-rgb',
  };
};

const a98ToRgbUnclamped = ({ r, g, b, alpha }: A98Color): RgbColor => {
  const [sr, sg, sb] = linearA98ToSrgb(a98ToLinear(r), a98ToLinear(g), a98ToLinear(b));
  return linearToStoredRgb(sr, sg, sb, alpha);
};

export const parseA98Object = (input: unknown): RgbColor | null => {
  if (!isObject(input)) return null;
  if ((input as { colorSpace?: unknown }).colorSpace !== 'a98-rgb') return null;
  if (!('r' in input && 'g' in input && 'b' in input)) return null;
  const { r, g, b, alpha = alphaAlias(input) } = input as { r: unknown; g: unknown; b: unknown; alpha?: unknown };
  if (!isAnyNumber(r) || !isAnyNumber(g) || !isAnyNumber(b) || !isAnyNumber(alpha)) return null;
  return a98ToRgbUnclamped({
    r: sanitize(r),
    g: sanitize(g),
    b: sanitize(b),
    alpha: clamp(sanitize(alpha), 0, 1),
    colorSpace: 'a98-rgb',
  });
};

export const parseA98String = (input: unknown): RgbColor | null =>
  scanColorRgb(input, 'color(a98-rgb ')
    ? a98ToRgbUnclamped({ r: SC[0]!, g: SC[1]!, b: SC[2]!, alpha: SC[3]!, colorSpace: 'a98-rgb' })
    : null;

export const oklabToLinearA98 = (l: number, a: number, b: number): [number, number, number] =>
  srgbLinearToA98Linear(...oklabToLinear(l, a, b));

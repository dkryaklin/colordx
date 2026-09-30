import type { Colordx } from './colordx.js';

export const clamp = (n: number, min: number, max: number): number => (n > min ? (n < max ? n : max) : min);

export const round = (n: number, d = 0): number => {
  const p = d > 0 ? 10 ** (d < 20 ? d : 20) : 1;
  return Math.round(p * n) / p || 0;
};

export const normalizeHue = (h: number): number => (h >= 0 && h < 360 ? h : ((h % 360) + 360) % 360 || 0);

export const ACHROMATIC_EPS = 1e-6;

export const ANGLE_UNITS: Record<string, number> = { deg: 1, grad: 0.9, turn: 360, rad: 360 / (2 * Math.PI) };

export const isAnyNumber = (n: unknown): n is number => typeof n === 'number';

export const sanitize = (n: number): number => (Number.isNaN(n) ? 0 : n);

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const isWs = (c: number): boolean => c === 32 || c === 9 || c === 10 || c === 13 || c === 12;

export const trimWs = (s: string): string => {
  let i = 0,
    j = s.length;
  while (i < j && isWs(s.charCodeAt(i))) i++;
  while (j > i && isWs(s.charCodeAt(j - 1))) j--;
  return i === 0 && j === s.length ? s : s.slice(i, j);
};

export const NUM = '[+-]?(?:\\d*\\.\\d+|\\d+)(?:[eE][+-]?\\d+)?';

export const fixedNotation = (s: string, precision: number): string =>
  precision < 7
    ? s
    : s.replace(/-?\d+(?:\.(\d+))?e-(\d+)/g, (m, frac: string | undefined, exp: string) =>
        Number(m).toFixed((frac?.length ?? 0) + Number(exp))
      );

export const toByte = (n: number): number => (n > 0 ? (n < 255 ? Math.round(n) : 255) : 0);

export const round3 = (n: number): number => (n > 0 ? (n < 1 ? Math.round(n * 1000) / 1000 : 1) : 0);

export const alphaAlias = (input: unknown): unknown => {
  const a = (input as { a?: unknown }).a;
  return a === undefined ? 1 : a;
};

export const mixWeight = (a1: number, a2: number, w: number): number => {
  if (a1 === a2) return w;
  const p2 = a2 * w,
    alpha = a1 * (1 - w) + p2;
  return alpha > 0 ? p2 / alpha : w;
};

export const isColordx = (input: unknown): input is Colordx =>
  typeof (input as Colordx | null | undefined)?._rawRgb === 'function';

export const invalidColorError = (method: string, input: unknown, self = false): RangeError => {
  if (self) return new RangeError(`${method}: this color is invalid`);
  if (isColordx(input)) return new RangeError(`${method}: the Colordx passed in is invalid`);
  let shown: string;
  try {
    shown = typeof input === 'string' ? JSON.stringify(input) : (JSON.stringify(input) ?? String(input));
  } catch {
    shown = String(input);
  }
  return new RangeError(`${method}: ${shown} is not a valid color`);
};

const BRANDS = new Set([
  'lab',
  'lch',
  'xyz-d65',
  'okhsl',
  'okhsv',
  'display-p3',
  'rec2020',
  'a98-rgb',
  'prophoto-rgb',
  'srgb-linear',
]);

export const hasBrand = (input: unknown): boolean => {
  const cs = (input as { colorSpace?: unknown }).colorSpace;
  return typeof cs === 'string' && BRANDS.has(cs);
};

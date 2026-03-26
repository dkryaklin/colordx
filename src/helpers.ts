export const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

export const round = (n: number, d = 0): number => {
  const p = 10 ** d;
  return Math.round(p * n) / p;
};

export const floor = (n: number, d = 0): number => {
  const p = 10 ** d;
  return Math.floor(n * p) / p;
};

// Normalize hue to [0, 360). Avoids (h + 360) % 360 which can lose precision
// when h is already in [0, 360) due to binary floating-point subtraction.
export const normalizeHue = (h: number): number => (h >= 0 && h < 360 ? h : ((h % 360) + 360) % 360);

export const ANGLE_UNITS: Record<string, number> = { deg: 1, grad: 0.9, turn: 360, rad: 360 / (2 * Math.PI) };

export const isNumeric = (n: unknown): n is number => typeof n === 'number' && !Number.isNaN(n) && Number.isFinite(n);

// Accepts any number type (including NaN/±Infinity); use sanitize() before clamping
export const isNumber = (n: unknown): n is number => typeof n === 'number';

// Replace NaN with 0; ±Infinity is left for clamp() to handle naturally
export const sanitize = (n: number): number => (Number.isNaN(n) ? 0 : n);

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const hasKeys = <T extends string>(obj: Record<string, unknown>, keys: T[]): obj is Record<T, unknown> =>
  keys.every((k) => k in obj);

export const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

const POW10 = [1, 10, 100, 1000, 10000];

export const round = (n: number, d = 0): number => {
  const p = POW10[d] ?? 10 ** d;
  return Math.round(n * p) / p;
};

export const floor = (n: number, d = 0): number => {
  const p = POW10[d] ?? 10 ** d;
  return Math.floor(n * p) / p;
};

export const ANGLE_UNITS: Record<string, number> = { deg: 1, grad: 0.9, turn: 360, rad: 360 / (2 * Math.PI) };

export const isNumeric = (n: unknown): n is number => typeof n === 'number' && !Number.isNaN(n) && Number.isFinite(n);

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const hasKeys = <T extends string>(obj: Record<string, unknown>, keys: T[]): obj is Record<T, unknown> =>
  keys.every((k) => k in obj);

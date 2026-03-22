export const clamp = (n: number, min: number, max: number): number => Math.min(Math.max(n, min), max);

export const round = (n: number, d = 0): number => Math.round(n * 10 ** d) / 10 ** d;

export const floor = (n: number, d = 0): number => Math.floor(n * 10 ** d) / 10 ** d;

export const isNumeric = (n: unknown): n is number => typeof n === 'number' && !Number.isNaN(n) && Number.isFinite(n);

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const hasKeys = <T extends string>(obj: Record<string, unknown>, keys: T[]): obj is Record<T, unknown> =>
  keys.every((k) => k in obj);

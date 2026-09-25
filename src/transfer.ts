import type { RgbColor } from './types.js';

export const srgbToLinear = (c: number): number => {
  const abs = Math.abs(c);
  const linear = abs <= 0.04045 ? abs / 12.92 : ((abs + 0.055) / 1.055) ** 2.4;
  return c < 0 ? -linear : linear;
};

export const srgbFromLinear = (n: number): number => {
  const abs = Math.abs(n);
  const encoded = abs <= 0.0031308 ? 12.92 * abs : 1.055 * abs ** (1 / 2.4) - 0.055;
  return n < 0 ? -encoded : encoded;
};

const MAX_CHANNEL = 1e6;

export const boundChannel = (n: number): number =>
  n >= -MAX_CHANNEL && n <= MAX_CHANNEL ? n : n > MAX_CHANNEL ? MAX_CHANNEL : n < -MAX_CHANNEL ? -MAX_CHANNEL : 0;

export const linearToStoredRgb = (lr: number, lg: number, lb: number, alpha: number): RgbColor => ({
  r: boundChannel(srgbFromLinear(lr) * 255),
  g: boundChannel(srgbFromLinear(lg) * 255),
  b: boundChannel(srgbFromLinear(lb) * 255),
  alpha,
});

export const rec2020ToLinear = (c: number): number => {
  const linear = Math.abs(c) ** 2.4;
  return c < 0 ? -linear : linear;
};

export const rec2020FromLinear = (n: number): number => {
  const encoded = Math.abs(n) ** (1 / 2.4);
  return n < 0 ? -encoded : encoded;
};

export const a98ToLinear = (c: number): number => {
  const linear = Math.abs(c) ** (563 / 256);
  return c < 0 ? -linear : linear;
};

export const a98FromLinear = (n: number): number => {
  const encoded = Math.abs(n) ** (256 / 563);
  return n < 0 ? -encoded : encoded;
};

export const prophotoToLinear = (c: number): number => {
  const abs = Math.abs(c);
  const linear = abs <= 16 / 512 ? abs / 16 : abs ** 1.8;
  return c < 0 ? -linear : linear;
};

export const prophotoFromLinear = (n: number): number => {
  const abs = Math.abs(n);
  const encoded = abs >= 1 / 512 ? abs ** (1 / 1.8) : 16 * abs;
  return n < 0 ? -encoded : encoded;
};

let byteLin: Float64Array | undefined;
const buildByteLin = (): Float64Array => {
  const t = new Float64Array(256);
  for (let i = 0; i < 256; i++) t[i] = srgbToLinear(i / 255);
  return t;
};

export const byteToLinear = (n: number): number =>
  (n & 255) === n ? (byteLin ??= buildByteLin())[n]! : srgbToLinear(n / 255);

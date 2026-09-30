import { linearSrgbToOklab, oklabToLinear, parseOklabObjectRaw, parseOklabStringRaw } from './colorModels/oklab.js';
import { parseOklchObjectRaw, parseOklchStringRaw } from './colorModels/oklch.js';
import type { Colordx } from './colordx.js';
import { clamp, isColordx } from './helpers.js';
import { parse } from './parse.js';
import { byteToLinear } from './transfer.js';
import type { AnyColor, ColorParser, RgbColor } from './types.js';

type RawOklab = { l: number; a: number; b: number; alpha: number };

const rgbToRawOklab = ({ r, g, b, alpha }: RgbColor): RawOklab | null => {
  if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) return null;
  const [l, a, bb] = linearSrgbToOklab(byteToLinear(r), byteToLinear(g), byteToLinear(b));
  return { l, a, b: bb, alpha };
};

const getRawOklab = (input: AnyColor | Colordx, own?: ColorParser): RawOklab | null | undefined => {
  if (isColordx(input)) return input.isValid() ? rgbToRawOklab(input._rawRgb()) : undefined;
  if (typeof input === 'object' && input !== null) {
    const raw = parseOklchObjectRaw(input) ?? parseOklabObjectRaw(input);
    if (raw) return raw;
  } else if (typeof input === 'string') {
    const raw = parseOklchStringRaw(input) ?? parseOklabStringRaw(input);
    if (raw) return raw;
  } else {
    return undefined;
  }

  const rgb = own?.(input) ?? parse(input);
  return rgb === null ? undefined : rgbToRawOklab(rgb);
};

const EPS = 5e-4;

export const isLinearInGamut = (r: number, g: number, b: number): boolean =>
  r >= -EPS && r <= 1 + EPS && g >= -EPS && g <= 1 + EPS && b >= -EPS && b <= 1 + EPS;

const strictInGamut = (r: number, g: number, b: number): boolean =>
  r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1;

/** True when the color is inside sRGB. sRGB-bounded inputs always are; invalid input is not. */
export const inGamutSrgb = (input: AnyColor | Colordx): boolean => {
  const raw = getRawOklab(input);
  if (raw === undefined) return false;
  if (raw === null) return true;
  const [r, g, b] = oklabToLinear(raw.l, raw.a, raw.b);
  return isLinearInGamut(r, g, b);
};

const JND = 0.02;
const GAMUT_EPSILON = 0.0001;

const deltaEOK = (lab1: readonly [number, number, number], l: number, a: number, b: number): number => {
  const dl = lab1[0] - l;
  const da = lab1[1] - a;
  const db = lab1[2] - b;
  return Math.sqrt(dl * dl + da * da + db * db);
};

type LinearConverter = (l: number, a: number, b: number) => [number, number, number];
type FromLinearConverter = (r: number, g: number, b: number) => [number, number, number];

type GamutMapResult = { linear: readonly [number, number, number]; alpha: number; inGamut: boolean };

const cssGamutMap = (
  raw: { l: number; a: number; b: number; alpha: number },
  toLinear: LinearConverter,
  fromLinear: FromLinearConverter
): GamutMapResult => {
  const { l, a, b, alpha } = raw;
  if (l > 1 - 1e-7) return { linear: [1, 1, 1], alpha, inGamut: false };
  if (l < 1e-7) return { linear: [0, 0, 0], alpha, inGamut: false };

  const [r0, g0, b0] = toLinear(l, a, b);
  if (strictInGamut(r0, g0, b0)) return { linear: [r0, g0, b0], alpha, inGamut: true };
  return { linear: bisectChroma(l, a, b, r0, g0, b0, toLinear, fromLinear), alpha, inGamut: false };
};

const bisectChroma = (
  l: number,
  a: number,
  b: number,
  r0: number,
  g0: number,
  b0: number,
  toLinear: LinearConverter,
  fromLinear: FromLinearConverter
): [number, number, number] => {
  const c0r = clamp(r0, 0, 1),
    c0g = clamp(g0, 0, 1),
    c0b = clamp(b0, 0, 1);
  if (deltaEOK(fromLinear(c0r, c0g, c0b), l, a, b) <= JND) return [c0r, c0g, c0b];

  const hRad = Math.atan2(b, a);
  const C = Math.hypot(a, b);
  if (!Number.isFinite(C)) return [c0r, c0g, c0b];
  let lo = 0;
  let hi = C;
  let minInGamut = true;
  const cosH = Math.cos(hRad),
    sinH = Math.sin(hRad);
  let lastR = c0r,
    lastG = c0g,
    lastB = c0b;

  while (hi - lo > GAMUT_EPSILON) {
    const mid = (lo + hi) / 2;
    const ma = mid * cosH;
    const mb = mid * sinH;
    const [lr, lg, lb] = toLinear(l, ma, mb);

    if (minInGamut && strictInGamut(lr, lg, lb)) {
      lo = mid;
      continue;
    }

    const cr = clamp(lr, 0, 1),
      cg = clamp(lg, 0, 1),
      cb = clamp(lb, 0, 1);
    lastR = cr;
    lastG = cg;
    lastB = cb;
    const E = deltaEOK(fromLinear(cr, cg, cb), l, ma, mb);

    if (E <= JND) {
      if (JND - E < GAMUT_EPSILON) return [cr, cg, cb];
      lo = mid;
      minInGamut = false;
    } else {
      hi = mid;
    }
  }

  return [lastR, lastG, lastB];
};

export const toGamutSrgbRaw = (input: AnyColor | Colordx): GamutMapResult | null => {
  const raw = getRawOklab(input);
  if (raw == null) return null;
  return cssGamutMap(raw, oklabToLinear, linearSrgbToOklab);
};

export const inGamutCustom = (input: AnyColor | Colordx, toLinear: LinearConverter, own?: ColorParser): boolean => {
  const raw = getRawOklab(input, own);
  if (raw === undefined) return false;
  if (raw === null) return true;
  const [r, g, b] = toLinear(raw.l, raw.a, raw.b);
  return isLinearInGamut(r, g, b);
};

export const toGamutCustom = (
  input: AnyColor | Colordx,
  toLinear: LinearConverter,
  fromLinear: FromLinearConverter,
  own?: ColorParser
): GamutMapResult | null => {
  const raw = getRawOklab(input, own);
  if (raw == null) return null;
  return cssGamutMap(raw, toLinear, fromLinear);
};

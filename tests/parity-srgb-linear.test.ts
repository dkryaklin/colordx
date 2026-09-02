import { converter } from 'culori';
import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend, inGamutSrgb } from '../src/index.js';
import srgbLinearPlugin from '../src/plugins/srgb-linear.js';

// External-reference parity for the srgb-linear plugin. culori's `lrgb` mode is the
// ground truth for the sRGB transfer function in both directions.

const COUNT = Number(process.env.PARITY_COUNT ?? 10_000);

const culoriToLrgb = converter('lrgb');
const culoriToRgb = converter('rgb');

let seed = 0x5eed1234;
const rand = () => {
  seed = (seed ^ (seed << 13)) >>> 0;
  seed = (seed ^ (seed >>> 17)) >>> 0;
  seed = (seed ^ (seed << 5)) >>> 0;
  return seed / 0xffffffff;
};

const round = (v: number, d = 4) => parseFloat(v.toFixed(d));
const absDiff = (a: number, b: number) => Math.abs(a - b);
const maxDiff = (...pairs: [number, number][]) => Math.max(...pairs.map(([a, b]) => absDiff(a, b)));

type Stats = { worst: number; worstColor: string };
const stats: Record<string, Stats> = {};
const record = (key: string, delta: number, color: string) => {
  const s = (stats[key] ??= { worst: 0, worstColor: '' });
  if (delta > s.worst) {
    s.worst = delta;
    s.worstColor = color;
  }
};

const BORDER = 2e-3;
type BoolStats = { agree: number; compared: number };
const boolStats: Record<string, BoolStats> = {};
const recordBool = (key: string, cx: boolean, cu: boolean, borderline = false) => {
  const s = (boolStats[key] ??= { agree: 0, compared: 0 });
  if (borderline) return;
  s.compared++;
  if (cx === cu) s.agree++;
};

type Rgb = { r?: number; g?: number; b?: number };
const inUnit = (c: Rgb) =>
  (c.r ?? 0) >= 0 && (c.r ?? 0) <= 1 && (c.g ?? 0) >= 0 && (c.g ?? 0) <= 1 && (c.b ?? 0) >= 0 && (c.b ?? 0) <= 1;
const nearBound = (c: Rgb) =>
  [c.r ?? 0, c.g ?? 0, c.b ?? 0].some((v) => Math.abs(v) < BORDER || Math.abs(v - 1) < BORDER);

type Lin = { toSrgbLinear(precision?: number): { r: number; g: number; b: number } };

const run = () => {
  extend([srgbLinearPlugin]);

  for (let i = 0; i < COUNT; i++) {
    // sRGB bytes → linear.
    const r8 = Math.floor(rand() * 256);
    const g8 = Math.floor(rand() * 256);
    const b8 = Math.floor(rand() * 256);
    const hex = colordx({ r: r8, g: g8, b: b8 }).toHex();
    const cxLin = (colordx(hex) as unknown as Lin).toSrgbLinear(8);
    const cuLin = culoriToLrgb({ mode: 'rgb', r: r8 / 255, g: g8 / 255, b: b8 / 255 })!;
    record('sRGB→linear', maxDiff([cxLin.r, cuLin.r ?? 0], [cxLin.g, cuLin.g ?? 0], [cxLin.b, cuLin.b ?? 0]), hex);

    // Unclamped OKLCH → linear, including out-of-gamut samples.
    const l = rand();
    const c = rand() * 0.4;
    const h = rand() * 360;
    const oklch = `oklch(${l.toFixed(6)} ${c.toFixed(6)} ${h.toFixed(4)})`;
    const cxOk = (colordx(oklch) as unknown as Lin).toSrgbLinear(8);
    const cuOk = culoriToLrgb({ mode: 'oklch', l, c, h })!;
    record('OKLCH→linear', maxDiff([cxOk.r, cuOk.r ?? 0], [cxOk.g, cuOk.g ?? 0], [cxOk.b, cuOk.b ?? 0]), oklch);

    // Linear string → sRGB bytes. Random channels reach past [0, 1] on both sides.
    const lr = rand() * 1.4 - 0.2;
    const lg = rand() * 1.4 - 0.2;
    const lb = rand() * 1.4 - 0.2;
    const str = `color(srgb-linear ${round(lr, 6)} ${round(lg, 6)} ${round(lb, 6)})`;
    const cxRgb = colordx(str).toRgb();
    const cuRgb = culoriToRgb({ mode: 'lrgb', r: round(lr, 6), g: round(lg, 6), b: round(lb, 6) })!;
    const clip = (v: number) => Math.min(1, Math.max(0, v));
    record(
      'linear str→sRGB',
      maxDiff(
        [cxRgb.r, Math.round(clip(cuRgb.r ?? 0) * 255)],
        [cxRgb.g, Math.round(clip(cuRgb.g ?? 0) * 255)],
        [cxRgb.b, Math.round(clip(cuRgb.b ?? 0) * 255)]
      ),
      str
    );

    // Linear string round-trips through toSrgbLinear unchanged.
    const rt = (colordx(str) as unknown as Lin).toSrgbLinear(6);
    record('linear str→linear', maxDiff([rt.r, round(lr, 6)], [rt.g, round(lg, 6)], [rt.b, round(lb, 6)]), str);

    // ∈-gamut classification for linear inputs vs culori's decoded sRGB.
    const obj = { r: lr, g: lg, b: lb, alpha: 1, colorSpace: 'srgb-linear' as const };
    const cuObjRgb = culoriToRgb({ mode: 'lrgb', r: lr, g: lg, b: lb })!;
    recordBool('inGamutSrgb(lin-obj)', inGamutSrgb(obj), inUnit(cuObjRgb), nearBound(cuObjRgb));
    recordBool('inGamutSrgb(lin-str)', inGamutSrgb(str), inUnit(cuObjRgb), nearBound(cuObjRgb));
  }
};

const ceilings: Record<string, number> = {
  'sRGB→linear': 1e-7,
  'OKLCH→linear': 1e-4,
  'linear str→sRGB': 1,
  'linear str→linear': 1e-6,
};
const boolFloor = 0.999;

describe('parity vs culori — srgb-linear', () => {
  beforeAll(() => {
    run();
  });

  for (const [fmt, ceil] of Object.entries(ceilings)) {
    it(`${fmt}: worst delta ≤ ${ceil}`, () => {
      expect(stats[fmt]!.worst).toBeLessThanOrEqual(ceil);
    });
  }

  for (const key of ['inGamutSrgb(lin-obj)', 'inGamutSrgb(lin-str)']) {
    it(`${key} agrees with culori ≥ ${(boolFloor * 100).toFixed(1)}%`, () => {
      const s = boolStats[key]!;
      expect(s.agree / s.compared).toBeGreaterThanOrEqual(boolFloor);
    });
  }
});

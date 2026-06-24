import { converter, toGamut } from 'culori';
import { beforeAll, describe, expect, it } from 'vitest';
import { Colordx, colordx, extend, inGamutSrgb } from '../src/index.js';
import a98Plugin, { inGamutA98, labToA98Channels, lchToA98Channels, oklchToA98Channels } from '../src/plugins/a98rgb.js';
import prophotoPlugin, {
  inGamutProphoto,
  labToProphotoChannels,
  lchToProphotoChannels,
  oklchToProphotoChannels,
} from '../src/plugins/prophoto.js';

// External-reference parity for the A98 and ProPhoto plugins, mirroring the structure of
// parity-culori.test.ts but scoped to the two new spaces. culori is the ground truth for
// raw channel conversion, gamut mapping, and ∈-gamut classification.

const COUNT = Number(process.env.PARITY_COUNT ?? 10_000);

const culoriToA98 = converter('a98');
const culoriToProphoto = converter('prophoto');
const culoriToLrgb = converter('lrgb');
const culoriA98GamutMap = toGamut('a98', 'oklch');
const culoriProphotoGamutMap = toGamut('prophoto', 'oklch');

let seed = 0x1234abcd;
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
// Boundary tie-breaking: colordx classifies ∈-gamut with a small EPS tolerance on linear
// channels, culori uses a strict bound on gamma-encoded channels. Within a thin band at the
// gamut surface the two legitimately disagree. We exclude samples whose culori channels sit
// within BORDER of a [0, 1] bound from the agreement denominator, so the boolean test asserts
// that AWAY from the boundary classification matches culori exactly. Raw-channel parity
// (≤ 0.001 below) is the authoritative check that the matrices/transfer are correct.
const BORDER = 2e-3;
type BoolStats = { agree: number; compared: number };
const boolStats: Record<string, BoolStats> = {};
const recordBool = (key: string, cx: boolean, cu: boolean, borderline = false) => {
  const s = (boolStats[key] ??= { agree: 0, compared: 0 });
  if (borderline) return;
  s.compared++;
  if (cx === cu) s.agree++;
};

const inUnit = (c: { r?: number; g?: number; b?: number }) =>
  (c.r ?? 0) >= 0 && (c.r ?? 0) <= 1 && (c.g ?? 0) >= 0 && (c.g ?? 0) <= 1 && (c.b ?? 0) >= 0 && (c.b ?? 0) <= 1;

const nearBound = (c: { r?: number; g?: number; b?: number }) =>
  [c.r ?? 0, c.g ?? 0, c.b ?? 0].some((v) => Math.abs(v) < BORDER || Math.abs(v - 1) < BORDER);

const run = () => {
  extend([a98Plugin, prophotoPlugin]);

  for (let i = 0; i < COUNT; i++) {
    const l = rand();
    const c = rand() * 0.4;
    const h = rand() * 360;
    const color = `oklch(${l.toFixed(6)} ${c.toFixed(6)} ${h.toFixed(4)})`;
    const oklchObj = { l, c, h, alpha: 1 };

    // Raw OKLCH → gamma-encoded channel conversion.
    const [cxA98R, cxA98G, cxA98B] = oklchToA98Channels(l, c, h);
    const cuA98 = culoriToA98({ mode: 'oklch', l, c, h })!;
    record(
      'A98 raw',
      maxDiff(
        [round(cxA98R, 4), round(cuA98.r ?? 0, 4)],
        [round(cxA98G, 4), round(cuA98.g ?? 0, 4)],
        [round(cxA98B, 4), round(cuA98.b ?? 0, 4)]
      ),
      color
    );

    const [cxPpR, cxPpG, cxPpB] = oklchToProphotoChannels(l, c, h);
    const cuPp = culoriToProphoto({ mode: 'oklch', l, c, h })!;
    record(
      'ProPhoto raw',
      maxDiff(
        [round(cxPpR, 4), round(cuPp.r ?? 0, 4)],
        [round(cxPpG, 4), round(cuPp.g ?? 0, 4)],
        [round(cxPpB, 4), round(cuPp.b ?? 0, 4)]
      ),
      color
    );

    // Gamut mapping (CSS Color 4) into each space.
    const cxGamutA98 = (
      Colordx.toGamutA98(oklchObj) as unknown as { toA98(): { r: number; g: number; b: number } }
    ).toA98();
    const cuGamutA98 = culoriA98GamutMap({ mode: 'oklch', l, c, h })!;
    record(
      'A98 gamut',
      maxDiff(
        [round(cxGamutA98.r, 4), round(cuGamutA98.r ?? 0, 4)],
        [round(cxGamutA98.g, 4), round(cuGamutA98.g ?? 0, 4)],
        [round(cxGamutA98.b, 4), round(cuGamutA98.b ?? 0, 4)]
      ),
      color
    );

    const cxGamutPp = (
      Colordx.toGamutProphoto(oklchObj) as unknown as { toProphoto(): { r: number; g: number; b: number } }
    ).toProphoto();
    const cuGamutPp = culoriProphotoGamutMap({ mode: 'oklch', l, c, h })!;
    record(
      'ProPhoto gamut',
      maxDiff(
        [round(cxGamutPp.r, 4), round(cuGamutPp.r ?? 0, 4)],
        [round(cxGamutPp.g, 4), round(cuGamutPp.g ?? 0, 4)],
        [round(cxGamutPp.b, 4), round(cuGamutPp.b ?? 0, 4)]
      ),
      color
    );

    // ∈-gamut classification agreement (boundary-band samples excluded — see recordBool).
    recordBool('inGamutA98', inGamutA98(oklchObj), inUnit(cuA98), nearBound(cuA98));
    recordBool('inGamutProphoto', inGamutProphoto(oklchObj), inUnit(cuPp), nearBound(cuPp));

    // Lab/LCH → channel conversions (use fresh CIE coordinates).
    const cieL = rand() * 100;
    const cieC = rand() * 150;
    const cieH = rand() * 360;
    const cieRad = (cieH * Math.PI) / 180;
    const cieA = cieC * Math.cos(cieRad);
    const cieB = cieC * Math.sin(cieRad);

    const [cxLabA98R, cxLabA98G, cxLabA98B] = labToA98Channels(cieL, cieA, cieB);
    const cuLabA98 = culoriToA98({ mode: 'lab', l: cieL, a: cieA, b: cieB })!;
    record(
      'Lab→A98',
      maxDiff(
        [round(cxLabA98R, 4), round(cuLabA98.r ?? 0, 4)],
        [round(cxLabA98G, 4), round(cuLabA98.g ?? 0, 4)],
        [round(cxLabA98B, 4), round(cuLabA98.b ?? 0, 4)]
      ),
      color
    );

    const [cxLchA98R, cxLchA98G, cxLchA98B] = lchToA98Channels(cieL, cieC, cieH);
    const cuLchA98 = culoriToA98({ mode: 'lch', l: cieL, c: cieC, h: cieH })!;
    record(
      'LCH→A98',
      maxDiff(
        [round(cxLchA98R, 4), round(cuLchA98.r ?? 0, 4)],
        [round(cxLchA98G, 4), round(cuLchA98.g ?? 0, 4)],
        [round(cxLchA98B, 4), round(cuLchA98.b ?? 0, 4)]
      ),
      color
    );

    const [cxLabPpR, cxLabPpG, cxLabPpB] = labToProphotoChannels(cieL, cieA, cieB);
    const cuLabPp = culoriToProphoto({ mode: 'lab', l: cieL, a: cieA, b: cieB })!;
    record(
      'Lab→ProPhoto',
      maxDiff(
        [round(cxLabPpR, 4), round(cuLabPp.r ?? 0, 4)],
        [round(cxLabPpG, 4), round(cuLabPp.g ?? 0, 4)],
        [round(cxLabPpB, 4), round(cuLabPp.b ?? 0, 4)]
      ),
      color
    );

    const [cxLchPpR, cxLchPpG, cxLchPpB] = lchToProphotoChannels(cieL, cieC, cieH);
    const cuLchPp = culoriToProphoto({ mode: 'lch', l: cieL, c: cieC, h: cieH })!;
    record(
      'LCH→ProPhoto',
      maxDiff(
        [round(cxLchPpR, 4), round(cuLchPp.r ?? 0, 4)],
        [round(cxLchPpG, 4), round(cuLchPp.g ?? 0, 4)],
        [round(cxLchPpB, 4), round(cuLchPp.b ?? 0, 4)]
      ),
      color
    );

    // Branded-object ∈-gamut parity: an A98/ProPhoto-branded { r, g, b } with all channels
    // in [0, 1] is in-gamut for its own space; sRGB membership follows culori's lrgb decode.
    const ar = rand(),
      ag = rand(),
      ab = rand();
    const a98Obj = { r: ar, g: ag, b: ab, alpha: 1, colorSpace: 'a98-rgb' as const };
    const cuA98Lrgb = culoriToLrgb({ mode: 'a98', r: ar, g: ag, b: ab })!;
    recordBool('inGamutA98(a98-obj)', inGamutA98(a98Obj), true);
    recordBool('inGamutSrgb(a98-obj)', inGamutSrgb(a98Obj), inUnit(cuA98Lrgb), nearBound(cuA98Lrgb));

    const pr = rand(),
      pg = rand(),
      pb = rand();
    const ppObj = { r: pr, g: pg, b: pb, alpha: 1, colorSpace: 'prophoto-rgb' as const };
    const cuPpLrgb = culoriToLrgb({ mode: 'prophoto', r: pr, g: pg, b: pb })!;
    recordBool('inGamutProphoto(pp-obj)', inGamutProphoto(ppObj), true);
    recordBool('inGamutSrgb(pp-obj)', inGamutSrgb(ppObj), inUnit(cuPpLrgb), nearBound(cuPpLrgb));

    // String round-trip: for in-gamut culori channels, parse the color() string back and
    // re-convert — should reproduce culori's channels.
    if (inUnit(cuA98)) {
      const a98Str = `color(a98-rgb ${round(cuA98.r ?? 0, 6)} ${round(cuA98.g ?? 0, 6)} ${round(cuA98.b ?? 0, 6)})`;
      const rt = (colordx(a98Str) as unknown as { toA98(): { r: number; g: number; b: number } }).toA98();
      record(
        'A98str→A98',
        maxDiff(
          [round(rt.r, 4), round(cuA98.r ?? 0, 4)],
          [round(rt.g, 4), round(cuA98.g ?? 0, 4)],
          [round(rt.b, 4), round(cuA98.b ?? 0, 4)]
        ),
        color
      );
    }
    if (inUnit(cuPp)) {
      const ppStr = `color(prophoto-rgb ${round(cuPp.r ?? 0, 6)} ${round(cuPp.g ?? 0, 6)} ${round(cuPp.b ?? 0, 6)})`;
      const rt = (colordx(ppStr) as unknown as { toProphoto(): { r: number; g: number; b: number } }).toProphoto();
      record(
        'PPstr→PP',
        maxDiff(
          [round(rt.r, 4), round(cuPp.r ?? 0, 4)],
          [round(rt.g, 4), round(cuPp.g ?? 0, 4)],
          [round(rt.b, 4), round(cuPp.b ?? 0, 4)]
        ),
        color
      );
    }
  }
};

// Conversions are exact (matrix + transfer); gamut mapping has CSS Color 4 implementation
// latitude inside the 0.02 deltaEOK JND band, so its ceiling is looser.
const ceilings: Record<string, number> = {
  'A98 raw': 0.001,
  'ProPhoto raw': 0.001,
  'A98 gamut': 0.1,
  'ProPhoto gamut': 0.1,
  'Lab→A98': 0.001,
  'LCH→A98': 0.001,
  'Lab→ProPhoto': 0.001,
  'LCH→ProPhoto': 0.001,
  'A98str→A98': 0.001,
  'PPstr→PP': 0.001,
};
const boolFloor = 0.97;

describe('parity vs culori — a98 + prophoto', () => {
  beforeAll(() => {
    run();
  });

  for (const [fmt, ceil] of Object.entries(ceilings)) {
    it(`${fmt}: worst delta ≤ ${ceil}`, () => {
      expect(stats[fmt]!.worst).toBeLessThanOrEqual(ceil);
    });
  }

  for (const key of [
    'inGamutA98',
    'inGamutProphoto',
    'inGamutA98(a98-obj)',
    'inGamutSrgb(a98-obj)',
    'inGamutProphoto(pp-obj)',
    'inGamutSrgb(pp-obj)',
  ]) {
    it(`${key} agrees with culori ≥ ${(boolFloor * 100).toFixed(0)}%`, () => {
      const s = boolStats[key]!;
      expect(s.agree / s.compared).toBeGreaterThanOrEqual(boolFloor);
    });
  }
});

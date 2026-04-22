import { converter, differenceCiede2000, toGamut } from 'culori';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  Colordx,
  colordx,
  extend,
  inGamutSrgb,
  labToLinearSrgb,
  lchToLinearSrgb,
  oklchToLinear,
} from '../src/index.js';
import hsvPlugin from '../src/plugins/hsv.js';
import hwbPlugin from '../src/plugins/hwb.js';
import labPlugin from '../src/plugins/lab.js';
import lchPlugin from '../src/plugins/lch.js';
import mixPlugin from '../src/plugins/mix.js';
import p3Plugin, {
  inGamutP3,
  labToP3Channels,
  lchToP3Channels,
  oklchToP3Channels,
} from '../src/plugins/p3.js';
import rec2020Plugin, {
  inGamutRec2020,
  labToRec2020Channels,
  lchToRec2020Channels,
  oklchToRec2020Channels,
} from '../src/plugins/rec2020.js';

// External-reference parity suite. For each format/operation we run N random
// inputs through colordx and culori, then assert that the worst per-color
// delta is at or below a documented ceiling. If culori patches a conversion
// or we introduce a regression, the affected format trips loudly.
//
// The counts default low enough to keep `yarn test` snappy. Set
// `PARITY_COUNT=100000` to reproduce the long-form script run.

const COUNT = Number(process.env.PARITY_COUNT ?? 10_000);
const COUNT_RGB = COUNT;

const culoriDeltaE2000 = differenceCiede2000();
const culoriGamutMap = toGamut('rgb', 'oklch');
const culoriP3GamutMap = toGamut('p3', 'oklch');
const culoriRec2020GamutMap = toGamut('rec2020', 'oklch');
const culoriToHsl = converter('hsl');
const culoriToHsv = converter('hsv');
const culoriToHwb = converter('hwb');
const culoriToP3 = converter('p3');
const culoriToRec2020 = converter('rec2020');
const culoriToLch = converter('lch');
const culoriToLab = converter('lab');
const culoriToOklab = converter('oklab');
const culoriToOklch = converter('oklch');
const culoriToRgb = converter('rgb');
const culoriToLrgb = converter('lrgb');
const culoriToXyz50 = converter('xyz50');
const culoriToXyz65 = converter('xyz65');

let seed = 0xdeadbeef;
const rand = () => {
  seed = (seed ^ (seed << 13)) >>> 0;
  seed = (seed ^ (seed >>> 17)) >>> 0;
  seed = (seed ^ (seed << 5)) >>> 0;
  return seed / 0xffffffff;
};

const round = (v: number, d = 4) => parseFloat(v.toFixed(d));
const absDiff = (a: number, b: number) => Math.abs(a - b);
const hueDiff = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return d > 180 ? 360 - d : d;
};
const maxDiff = (...pairs: [number, number][]) => Math.max(...pairs.map(([a, b]) => absDiff(a, b)));

type FormatStats = { matched: number; offBy1: number; larger: number; skipped: number; worstDelta: number; worstColor: string };
const mkStats = (): FormatStats => ({ matched: 0, offBy1: 0, larger: 0, skipped: 0, worstDelta: 0, worstColor: '' });

const stats: Record<string, FormatStats> = {
  RGB: mkStats(),
  HSL: mkStats(),
  HSV: mkStats(),
  HWB: mkStats(),
  'HEX→OKLch': mkStats(),
  'HEX→lighten': mkStats(),
  'Mix OKLab': mkStats(),
  'P3 raw': mkStats(),
  'P3 gamut': mkStats(),
  'Rec.2020 raw': mkStats(),
  'Rec.2020 gamut': mkStats(),
  'StrParse→P3': mkStats(),
  'StrParse→Rec2020': mkStats(),
  'StrParse(oklab)→P3': mkStats(),
  'StrParse(oklab)→Rec20': mkStats(),
  'P3str→P3': mkStats(),
  'Rec2020str→Rec2020': mkStats(),
  LCH: mkStats(),
  Lab: mkStats(),
  OKLab: mkStats(),
  XYZ: mkStats(),
  'XYZ D65': mkStats(),
  'Lab→LinSRGB': mkStats(),
  'LCH→LinSRGB': mkStats(),
  'Lab→P3': mkStats(),
  'LCH→P3': mkStats(),
  'Lab→Rec2020': mkStats(),
  'LCH→Rec2020': mkStats(),
  'mixLab()': mkStats(),
  'delta()': mkStats(),
  'Linear RGB': mkStats(),
  'RT:HSL': mkStats(),
  'RT:HSV': mkStats(),
  'RT:HWB': mkStats(),
  'RT:LCH': mkStats(),
  'RT:Lab': mkStats(),
  'RT:OKLch': mkStats(),
  'RT:OKLab': mkStats(),
  'RGB8:RGB': mkStats(),
  'RGB8:HEX': mkStats(),
  'RGB8:HSL': mkStats(),
  'RGB8:HSV': mkStats(),
  'RGB8:HWB': mkStats(),
  'RGB8:darken': mkStats(),
};

const record = (key: string, delta: number, color: string) => {
  const s = stats[key]!;
  if (delta === 0) s.matched++;
  else if (delta <= 1) s.offBy1++;
  else s.larger++;
  if (delta > s.worstDelta) {
    s.worstDelta = delta;
    s.worstColor = color;
  }
};
const recordSkip = (key: string) => {
  stats[key]!.skipped++;
};

type BoolStats = { agree: number; cxOnly: number; cuOnly: number };
const mkBool = (): BoolStats => ({ agree: 0, cxOnly: 0, cuOnly: 0 });
const boolStats: Record<string, BoolStats> = {
  inGamutSrgb: mkBool(),
  inGamutP3: mkBool(),
  inGamutRec2020: mkBool(),
};
const recordBool = (key: string, cx: boolean, cu: boolean) => {
  if (cx === cu) boolStats[key]!.agree++;
  else if (cx) boolStats[key]!.cxOnly++;
  else boolStats[key]!.cuOnly++;
};

const runParity = () => {
  extend([labPlugin, lchPlugin, p3Plugin, rec2020Plugin, mixPlugin, hsvPlugin, hwbPlugin]);

  for (let i = 0; i < COUNT; i++) {
    const l = rand();
    const c = rand() * 0.4;
    const h = rand() * 360;
    const color = `oklch(${l.toFixed(6)} ${c.toFixed(6)} ${h.toFixed(4)})`;
    const oklchObj = { l, c, h, alpha: 1 };

    const l2 = rand(),
      c2 = rand() * 0.4,
      h2 = rand() * 360;
    const cxHex2 = Colordx.toGamutSrgb({ l: l2, c: c2, h: h2, alpha: 1 }).toHex();

    const cxGamut = Colordx.toGamutSrgb(oklchObj);
    const cxHex = cxGamut.toHex();
    const cxCs = colordx(cxHex);

    const cuGamut = culoriGamutMap({ mode: 'oklch', l, c, h })!;

    const { r: cxR, g: cxG, b: cxB } = cxCs.toRgb();
    const cuR = Math.round(cuGamut.r * 255),
      cuG = Math.round(cuGamut.g * 255),
      cuB = Math.round(cuGamut.b * 255);
    record('RGB', maxDiff([cxR, cuR], [cxG, cuG], [cxB, cuB]), color);

    const { r: r2, g: g2, b: b2 } = colordx(cxHex2).toRgb();
    const rgbMatch = cxR === cuR && cxG === cuG && cxB === cuB;

    if (!rgbMatch) {
      for (const k of [
        'HSL',
        'HSV',
        'HWB',
        'HEX→OKLch',
        'HEX→lighten',
        'LCH',
        'Lab',
        'OKLab',
        'XYZ',
        'XYZ D65',
        'Lab→LinSRGB',
        'LCH→LinSRGB',
        'Lab→P3',
        'LCH→P3',
        'Lab→Rec2020',
        'LCH→Rec2020',
        'mixLab()',
        'delta()',
        'RT:HSL',
        'RT:HSV',
        'RT:HWB',
        'RT:LCH',
        'RT:Lab',
        'RT:OKLch',
        'RT:OKLab',
      ])
        recordSkip(k);
    } else {
      const cuBase = { mode: 'rgb' as const, r: cuR / 255, g: cuG / 255, b: cuB / 255 };

      const cxHsl = cxCs.toHsl();
      const cuHsl = culoriToHsl(cuBase)!;
      const cuHslH = cuHsl.h ?? 0,
        cuHslS = (cuHsl.s ?? 0) * 100,
        cuHslL = (cuHsl.l ?? 0) * 100;
      const hslAchromatic = cxHsl.s < 1 || cuHslS < 1;
      const hslHueDelta = hslAchromatic ? 0 : hueDiff(cxHsl.h, round(cuHslH, 2));
      record('HSL', Math.max(hslHueDelta, absDiff(cxHsl.s, round(cuHslS, 2)), absDiff(cxHsl.l, round(cuHslL, 2))), color);

      const cxHsv = (cxCs as unknown as { toHsv(): { h: number; s: number; v: number } }).toHsv();
      const cuHsv = culoriToHsv(cuBase)!;
      const cuHsvH = cuHsv.h ?? 0,
        cuHsvS = (cuHsv.s ?? 0) * 100,
        cuHsvV = (cuHsv.v ?? 0) * 100;
      const hsvAchromatic = cxHsv.s < 1 || cuHsvS < 1;
      const hsvHueDelta = hsvAchromatic ? 0 : hueDiff(cxHsv.h, round(cuHsvH, 2));
      record('HSV', Math.max(hsvHueDelta, absDiff(cxHsv.s, round(cuHsvS, 2)), absDiff(cxHsv.v, round(cuHsvV, 2))), color);

      const cxHwb = (cxCs as unknown as { toHwb(): { h: number; w: number; b: number } }).toHwb();
      const cuHwb = culoriToHwb(cuBase)!;
      const cuHwbH = cuHwb.h ?? 0,
        cuHwbW = (cuHwb.w ?? 0) * 100,
        cuHwbB2 = (cuHwb.b ?? 0) * 100;
      const hwbAchromatic = cxHwb.w + cxHwb.b >= 99 || cuHwbW + cuHwbB2 >= 99;
      const hwbHueDelta = hwbAchromatic ? 0 : hueDiff(cxHwb.h, round(cuHwbH, 0));
      record('HWB', Math.max(hwbHueDelta, absDiff(cxHwb.w, round(cuHwbW, 0)), absDiff(cxHwb.b, round(cuHwbB2, 0))), color);

      const cxOklch = cxCs.toOklch();
      const cuOklch = culoriToOklch(cuBase)!;
      const cuOklchC = cuOklch.c ?? 0,
        cuOklchH = cuOklch.h ?? 0;
      const oklchAchromatic = cxOklch.c < 0.001 || cuOklchC < 0.001;
      const oklchHueDelta = oklchAchromatic ? 0 : hueDiff(cxOklch.h, round(cuOklchH, 2));
      record(
        'HEX→OKLch',
        Math.max(oklchHueDelta, absDiff(cxOklch.l, round(cuOklch.l ?? 0, 4)), absDiff(cxOklch.c, round(cuOklchC, 4))),
        color
      );

      const { r: cxLR, g: cxLG, b: cxLB } = cxCs.lighten(0.1).toRgb();
      const cuLightened = culoriToRgb({ ...cuHsl, l: Math.min(1, (cuHsl.l ?? 0) + 0.1) })!;
      const cuLR = Math.round((cuLightened.r ?? 0) * 255);
      const cuLG = Math.round((cuLightened.g ?? 0) * 255);
      const cuLB = Math.round((cuLightened.b ?? 0) * 255);
      record('HEX→lighten', maxDiff([cxLR, cuLR], [cxLG, cuLG], [cxLB, cuLB]), color);

      const cxLch = (cxCs as unknown as { toLch(): { l: number; c: number; h: number } }).toLch();
      const cuLch = culoriToLch(cuBase)!;
      const cuLchL = cuLch.l ?? 0,
        cuLchC = cuLch.c ?? 0,
        cuLchH = cuLch.h ?? 0;
      const lchAchromatic = cxLch.c < 0.5 || cuLchC < 0.5;
      const lchHueDelta = lchAchromatic ? 0 : hueDiff(cxLch.h, round(cuLchH, 2));
      record('LCH', Math.max(lchHueDelta, absDiff(cxLch.l, round(cuLchL, 2)), absDiff(cxLch.c, round(cuLchC, 2))), color);

      const cxLab = (cxCs as unknown as { toLab(): { l: number; a: number; b: number } }).toLab();
      const cuLab = culoriToLab(cuBase)!;
      const cuLabL = cuLab.l ?? 0,
        cuLabA = cuLab.a ?? 0,
        cuLabB = cuLab.b ?? 0;
      record(
        'Lab',
        maxDiff([cxLab.l, round(cuLabL, 2)], [cxLab.a, round(cuLabA, 2)], [cxLab.b, round(cuLabB, 2)]),
        color
      );

      const cxOklab = cxCs.toOklab();
      const cuOklab = culoriToOklab(cuBase)!;
      record(
        'OKLab',
        maxDiff(
          [cxOklab.l, round(cuOklab.l ?? 0, 4)],
          [cxOklab.a, round(cuOklab.a ?? 0, 4)],
          [cxOklab.b, round(cuOklab.b ?? 0, 4)]
        ),
        color
      );

      const cxXyz = (cxCs as unknown as { toXyz(): { x: number; y: number; z: number } }).toXyz();
      const cuXyz = culoriToXyz50(cuLab)!;
      record(
        'XYZ',
        maxDiff(
          [cxXyz.x, round((cuXyz.x ?? 0) * 100, 2)],
          [cxXyz.y, round((cuXyz.y ?? 0) * 100, 2)],
          [cxXyz.z, round((cuXyz.z ?? 0) * 100, 2)]
        ),
        color
      );

      const cxXyz65 = (cxCs as unknown as { toXyzD65(): { x: number; y: number; z: number } }).toXyzD65();
      const cuXyz65 = culoriToXyz65(cuBase)!;
      record(
        'XYZ D65',
        maxDiff(
          [cxXyz65.x, round((cuXyz65.x ?? 0) * 100, 2)],
          [cxXyz65.y, round((cuXyz65.y ?? 0) * 100, 2)],
          [cxXyz65.z, round((cuXyz65.z ?? 0) * 100, 2)]
        ),
        color
      );

      // labToLinearSrgb: Lab D50 → linear sRGB via XYZ D50 / Bradford. Uses cuLab from above
      // so a culori Lab regression tests here, not in the feeder.
      const [cxLabLR, cxLabLG, cxLabLB] = labToLinearSrgb(cuLabL, cuLabA, cuLabB);
      const cuLabLrgb = culoriToLrgb({ mode: 'lab' as const, l: cuLabL, a: cuLabA, b: cuLabB })!;
      record(
        'Lab→LinSRGB',
        maxDiff(
          [round(cxLabLR, 5), round(cuLabLrgb.r ?? 0, 5)],
          [round(cxLabLG, 5), round(cuLabLrgb.g ?? 0, 5)],
          [round(cxLabLB, 5), round(cuLabLrgb.b ?? 0, 5)]
        ),
        color
      );

      // lchToLinearSrgb: LCH → Lab → linear sRGB. Uses cuLch from above.
      const [cxLchLR, cxLchLG, cxLchLB] = lchToLinearSrgb(cuLchL, cuLchC, cuLchH);
      const cuLchLrgb = culoriToLrgb({ mode: 'lch' as const, l: cuLchL, c: cuLchC, h: cuLchH })!;
      record(
        'LCH→LinSRGB',
        maxDiff(
          [round(cxLchLR, 5), round(cuLchLrgb.r ?? 0, 5)],
          [round(cxLchLG, 5), round(cuLchLrgb.g ?? 0, 5)],
          [round(cxLchLB, 5), round(cuLchLrgb.b ?? 0, 5)]
        ),
        color
      );

      // labToP3Channels: Lab → XYZ D50 → linear sRGB → linear P3 → gamma P3.
      const [cxLabP3R, cxLabP3G, cxLabP3B] = labToP3Channels(cuLabL, cuLabA, cuLabB);
      const cuLabP3 = culoriToP3({ mode: 'lab' as const, l: cuLabL, a: cuLabA, b: cuLabB })!;
      record(
        'Lab→P3',
        maxDiff(
          [round(cxLabP3R, 4), round(cuLabP3.r ?? 0, 4)],
          [round(cxLabP3G, 4), round(cuLabP3.g ?? 0, 4)],
          [round(cxLabP3B, 4), round(cuLabP3.b ?? 0, 4)]
        ),
        color
      );

      const [cxLchP3R, cxLchP3G, cxLchP3B] = lchToP3Channels(cuLchL, cuLchC, cuLchH);
      const cuLchP3 = culoriToP3({ mode: 'lch' as const, l: cuLchL, c: cuLchC, h: cuLchH })!;
      record(
        'LCH→P3',
        maxDiff(
          [round(cxLchP3R, 4), round(cuLchP3.r ?? 0, 4)],
          [round(cxLchP3G, 4), round(cuLchP3.g ?? 0, 4)],
          [round(cxLchP3B, 4), round(cuLchP3.b ?? 0, 4)]
        ),
        color
      );

      const [cxLabRecR, cxLabRecG, cxLabRecB] = labToRec2020Channels(cuLabL, cuLabA, cuLabB);
      const cuLabRec = culoriToRec2020({ mode: 'lab' as const, l: cuLabL, a: cuLabA, b: cuLabB })!;
      record(
        'Lab→Rec2020',
        maxDiff(
          [round(cxLabRecR, 4), round(cuLabRec.r ?? 0, 4)],
          [round(cxLabRecG, 4), round(cuLabRec.g ?? 0, 4)],
          [round(cxLabRecB, 4), round(cuLabRec.b ?? 0, 4)]
        ),
        color
      );

      const [cxLchRecR, cxLchRecG, cxLchRecB] = lchToRec2020Channels(cuLchL, cuLchC, cuLchH);
      const cuLchRec = culoriToRec2020({ mode: 'lch' as const, l: cuLchL, c: cuLchC, h: cuLchH })!;
      record(
        'LCH→Rec2020',
        maxDiff(
          [round(cxLchRecR, 4), round(cuLchRec.r ?? 0, 4)],
          [round(cxLchRecG, 4), round(cuLchRec.g ?? 0, 4)],
          [round(cxLchRecB, 4), round(cuLchRec.b ?? 0, 4)]
        ),
        color
      );

      const {
        r: cxMlR,
        g: cxMlG,
        b: cxMlB,
      } = (cxCs as unknown as { mixLab(other: string): Colordx }).mixLab(cxHex2).toRgb();
      const cuLab2 = culoriToLab({ mode: 'rgb' as const, r: r2 / 255, g: g2 / 255, b: b2 / 255 })!;
      const cuLabMixed = culoriToRgb({
        mode: 'lab' as const,
        l: ((cuLab.l ?? 0) + (cuLab2.l ?? 0)) / 2,
        a: ((cuLab.a ?? 0) + (cuLab2.a ?? 0)) / 2,
        b: ((cuLab.b ?? 0) + (cuLab2.b ?? 0)) / 2,
      })!;
      const cuMlR = Math.round(Math.max(0, Math.min(1, cuLabMixed.r ?? 0)) * 255);
      const cuMlG = Math.round(Math.max(0, Math.min(1, cuLabMixed.g ?? 0)) * 255);
      const cuMlB = Math.round(Math.max(0, Math.min(1, cuLabMixed.b ?? 0)) * 255);
      record('mixLab()', maxDiff([cxMlR, cuMlR], [cxMlG, cuMlG], [cxMlB, cuMlB]), color);

      const cxDelta = (colordx({ r: cuR, g: cuG, b: cuB }) as unknown as { delta(other: string): number }).delta(
        cxHex2
      );
      const cuDelta = round(
        culoriDeltaE2000(cuBase, { mode: 'rgb' as const, r: r2 / 255, g: g2 / 255, b: b2 / 255 }) / 100,
        3
      );
      record('delta()', absDiff(cxDelta, cuDelta), color);

      const cuRtRgb = (cu: { r?: number; g?: number; b?: number }) =>
        [Math.round((cu.r ?? 0) * 255), Math.round((cu.g ?? 0) * 255), Math.round((cu.b ?? 0) * 255)] as [number, number, number];

      const { r: rtHslR, g: rtHslG, b: rtHslB } = colordx(cxCs.toHslString()).toRgb();
      const [cuRtHslR, cuRtHslG, cuRtHslB] = cuRtRgb(culoriToRgb(culoriToHsl(cuBase)!)!);
      record('RT:HSL', maxDiff([rtHslR, cuRtHslR], [rtHslG, cuRtHslG], [rtHslB, cuRtHslB]), color);

      const {
        r: rtHsvR,
        g: rtHsvG,
        b: rtHsvB,
      } = colordx((cxCs as unknown as { toHsvString(): string }).toHsvString()).toRgb();
      const [cuRtHsvR, cuRtHsvG, cuRtHsvB] = cuRtRgb(culoriToRgb(culoriToHsv(cuBase)!)!);
      record('RT:HSV', maxDiff([rtHsvR, cuRtHsvR], [rtHsvG, cuRtHsvG], [rtHsvB, cuRtHsvB]), color);

      const {
        r: rtHwbR,
        g: rtHwbG,
        b: rtHwbB,
      } = colordx((cxCs as unknown as { toHwbString(p?: number): string }).toHwbString(2)).toRgb();
      const [cuRtHwbR, cuRtHwbG, cuRtHwbB] = cuRtRgb(culoriToRgb(culoriToHwb(cuBase)!)!);
      record('RT:HWB', maxDiff([rtHwbR, cuRtHwbR], [rtHwbG, cuRtHwbG], [rtHwbB, cuRtHwbB]), color);

      const {
        r: rtLchR,
        g: rtLchG,
        b: rtLchB,
      } = colordx((cxCs as unknown as { toLchString(): string }).toLchString()).toRgb();
      const [cuRtLchR, cuRtLchG, cuRtLchB] = cuRtRgb(culoriToRgb(culoriToLch(cuBase)!)!);
      record('RT:LCH', maxDiff([rtLchR, cuRtLchR], [rtLchG, cuRtLchG], [rtLchB, cuRtLchB]), color);

      const {
        r: rtLabR,
        g: rtLabG,
        b: rtLabB,
      } = colordx((cxCs as unknown as { toLabString(): string }).toLabString()).toRgb();
      const [cuRtLabR, cuRtLabG, cuRtLabB] = cuRtRgb(culoriToRgb(culoriToLab(cuBase)!)!);
      record('RT:Lab', maxDiff([rtLabR, cuRtLabR], [rtLabG, cuRtLabG], [rtLabB, cuRtLabB]), color);

      const { r: rtOklchR, g: rtOklchG, b: rtOklchB } = colordx(cxCs.toOklchString()).toRgb();
      const [cuRtOklchR, cuRtOklchG, cuRtOklchB] = cuRtRgb(culoriToRgb(culoriToOklch(cuBase)!)!);
      record('RT:OKLch', maxDiff([rtOklchR, cuRtOklchR], [rtOklchG, cuRtOklchG], [rtOklchB, cuRtOklchB]), color);

      const { r: rtOklabR, g: rtOklabG, b: rtOklabB } = colordx(cxCs.toOklabString()).toRgb();
      const [cuRtOklabR, cuRtOklabG, cuRtOklabB] = cuRtRgb(culoriToRgb(culoriToOklab(cuBase)!)!);
      record('RT:OKLab', maxDiff([rtOklabR, cuRtOklabR], [rtOklabG, cuRtOklabG], [rtOklabB, cuRtOklabB]), color);
    }

    const {
      r: cxMR,
      g: cxMG,
      b: cxMB,
    } = (colordx(cxHex) as unknown as { mixOklab(other: string): Colordx }).mixOklab(cxHex2).toRgb();
    const cuOk1 = culoriToOklab({ mode: 'rgb' as const, r: cxR / 255, g: cxG / 255, b: cxB / 255 })!;
    const cuOk2 = culoriToOklab({ mode: 'rgb' as const, r: r2 / 255, g: g2 / 255, b: b2 / 255 })!;
    const blended = culoriToRgb({
      mode: 'oklab' as const,
      l: ((cuOk1.l ?? 0) + (cuOk2.l ?? 0)) / 2,
      a: ((cuOk1.a ?? 0) + (cuOk2.a ?? 0)) / 2,
      b: ((cuOk1.b ?? 0) + (cuOk2.b ?? 0)) / 2,
    })!;
    const cuMR = Math.round(Math.max(0, Math.min(1, blended.r ?? 0)) * 255);
    const cuMG = Math.round(Math.max(0, Math.min(1, blended.g ?? 0)) * 255);
    const cuMB = Math.round(Math.max(0, Math.min(1, blended.b ?? 0)) * 255);
    record('Mix OKLab', maxDiff([cxMR, cuMR], [cxMG, cuMG], [cxMB, cuMB]), color);

    const [cxP3R, cxP3G, cxP3B] = oklchToP3Channels(l, c, h);
    const cuP3 = culoriToP3({ mode: 'oklch', l, c, h })!;
    const cuP3R = cuP3.r ?? 0,
      cuP3G = cuP3.g ?? 0,
      cuP3B = cuP3.b ?? 0;
    record(
      'P3 raw',
      maxDiff([round(cxP3R, 4), round(cuP3R, 4)], [round(cxP3G, 4), round(cuP3G, 4)], [round(cxP3B, 4), round(cuP3B, 4)]),
      color
    );

    const [cxLinR, cxLinG, cxLinB] = oklchToLinear(l, c, h);
    const cuLrgb = culoriToLrgb({ mode: 'oklch', l, c, h })!;
    const cuLinR = cuLrgb.r ?? 0,
      cuLinG = cuLrgb.g ?? 0,
      cuLinB = cuLrgb.b ?? 0;
    record(
      'Linear RGB',
      maxDiff(
        [round(cxLinR, 5), round(cuLinR, 5)],
        [round(cxLinG, 5), round(cuLinG, 5)],
        [round(cxLinB, 5), round(cuLinB, 5)]
      ),
      color
    );

    const [cxRec20R, cxRec20G, cxRec20B] = oklchToRec2020Channels(l, c, h);
    const cuRec20 = culoriToRec2020({ mode: 'oklch', l, c, h })!;
    record(
      'Rec.2020 raw',
      maxDiff(
        [round(cxRec20R, 4), round(cuRec20.r ?? 0, 4)],
        [round(cxRec20G, 4), round(cuRec20.g ?? 0, 4)],
        [round(cxRec20B, 4), round(cuRec20.b ?? 0, 4)]
      ),
      color
    );

    const cxGamutP3 = (
      Colordx.toGamutP3(oklchObj) as unknown as { toP3(): { r: number; g: number; b: number } }
    ).toP3();
    const cuGamutP3 = culoriP3GamutMap({ mode: 'oklch', l, c, h })!;
    record(
      'P3 gamut',
      maxDiff(
        [round(cxGamutP3.r, 4), round(cuGamutP3.r ?? 0, 4)],
        [round(cxGamutP3.g, 4), round(cuGamutP3.g ?? 0, 4)],
        [round(cxGamutP3.b, 4), round(cuGamutP3.b ?? 0, 4)]
      ),
      color
    );

    const cxGamutRec = (
      (Colordx as unknown as { toGamutRec2020(o: unknown): { toRec2020(): { r: number; g: number; b: number } } }).toGamutRec2020(oklchObj)
    ).toRec2020();
    const cuGamutRec = culoriRec2020GamutMap({ mode: 'oklch', l, c, h })!;
    record(
      'Rec.2020 gamut',
      maxDiff(
        [round(cxGamutRec.r, 4), round(cuGamutRec.r ?? 0, 4)],
        [round(cxGamutRec.g, 4), round(cuGamutRec.g ?? 0, 4)],
        [round(cxGamutRec.b, 4), round(cuGamutRec.b ?? 0, 4)]
      ),
      color
    );

    if (!inGamutSrgb(oklchObj)) {
      const cxStrP3 = (colordx(color) as unknown as { toP3(): { r: number; g: number; b: number } }).toP3();
      record(
        'StrParse→P3',
        maxDiff(
          [round(cxStrP3.r, 4), round(cuP3R, 4)],
          [round(cxStrP3.g, 4), round(cuP3G, 4)],
          [round(cxStrP3.b, 4), round(cuP3B, 4)]
        ),
        color
      );

      const cxStrRec = (colordx(color) as unknown as { toRec2020(): { r: number; g: number; b: number } }).toRec2020();
      record(
        'StrParse→Rec2020',
        maxDiff(
          [round(cxStrRec.r, 4), round(cuRec20.r ?? 0, 4)],
          [round(cxStrRec.g, 4), round(cuRec20.g ?? 0, 4)],
          [round(cxStrRec.b, 4), round(cuRec20.b ?? 0, 4)]
        ),
        color
      );
    } else {
      recordSkip('StrParse→P3');
      recordSkip('StrParse→Rec2020');
    }

    {
      const rawOklab = culoriToOklab({ mode: 'oklch', l, c, h })!;
      const oklabStr = `oklab(${(rawOklab.l ?? 0).toFixed(6)} ${(rawOklab.a ?? 0).toFixed(6)} ${(rawOklab.b ?? 0).toFixed(6)})`;
      if (!inGamutSrgb(oklchObj)) {
        const cxOklabP3 = (colordx(oklabStr) as unknown as { toP3(): { r: number; g: number; b: number } }).toP3();
        record(
          'StrParse(oklab)→P3',
          maxDiff(
            [round(cxOklabP3.r, 4), round(cuP3R, 4)],
            [round(cxOklabP3.g, 4), round(cuP3G, 4)],
            [round(cxOklabP3.b, 4), round(cuP3B, 4)]
          ),
          color
        );
        const cxOklabRec = (
          colordx(oklabStr) as unknown as { toRec2020(): { r: number; g: number; b: number } }
        ).toRec2020();
        record(
          'StrParse(oklab)→Rec20',
          maxDiff(
            [round(cxOklabRec.r, 4), round(cuRec20.r ?? 0, 4)],
            [round(cxOklabRec.g, 4), round(cuRec20.g ?? 0, 4)],
            [round(cxOklabRec.b, 4), round(cuRec20.b ?? 0, 4)]
          ),
          color
        );
      } else {
        recordSkip('StrParse(oklab)→P3');
        recordSkip('StrParse(oklab)→Rec20');
      }
    }

    {
      const inP3Gamut = cuP3R >= 0 && cuP3R <= 1 && cuP3G >= 0 && cuP3G <= 1 && cuP3B >= 0 && cuP3B <= 1;
      if (inP3Gamut) {
        const p3Str = `color(display-p3 ${round(cuP3R, 6)} ${round(cuP3G, 6)} ${round(cuP3B, 6)})`;
        const cxP3rt = (colordx(p3Str) as unknown as { toP3(): { r: number; g: number; b: number } }).toP3();
        record(
          'P3str→P3',
          maxDiff(
            [round(cxP3rt.r, 4), round(cuP3R, 4)],
            [round(cxP3rt.g, 4), round(cuP3G, 4)],
            [round(cxP3rt.b, 4), round(cuP3B, 4)]
          ),
          color
        );
      } else {
        recordSkip('P3str→P3');
      }
    }

    {
      const cuRec20R = cuRec20.r ?? 0,
        cuRec20G = cuRec20.g ?? 0,
        cuRec20B = cuRec20.b ?? 0;
      const inRec2020Gamut =
        cuRec20R >= 0 && cuRec20R <= 1 && cuRec20G >= 0 && cuRec20G <= 1 && cuRec20B >= 0 && cuRec20B <= 1;
      if (inRec2020Gamut) {
        const rec2020Str = `color(rec2020 ${round(cuRec20R, 6)} ${round(cuRec20G, 6)} ${round(cuRec20B, 6)})`;
        const cxRecrt = (
          colordx(rec2020Str) as unknown as { toRec2020(): { r: number; g: number; b: number } }
        ).toRec2020();
        record(
          'Rec2020str→Rec2020',
          maxDiff(
            [round(cxRecrt.r, 4), round(cuRec20R, 4)],
            [round(cxRecrt.g, 4), round(cuRec20G, 4)],
            [round(cxRecrt.b, 4), round(cuRec20B, 4)]
          ),
          color
        );
      } else {
        recordSkip('Rec2020str→Rec2020');
      }
    }

    recordBool(
      'inGamutSrgb',
      inGamutSrgb(oklchObj),
      cuLinR >= 0 && cuLinR <= 1 && cuLinG >= 0 && cuLinG <= 1 && cuLinB >= 0 && cuLinB <= 1
    );

    recordBool(
      'inGamutP3',
      inGamutP3(oklchObj),
      cuP3R >= 0 && cuP3R <= 1 && cuP3G >= 0 && cuP3G <= 1 && cuP3B >= 0 && cuP3B <= 1
    );

    const cuRec = culoriToRec2020({ mode: 'oklch', l, c, h })!;
    const cuRecR = cuRec.r ?? 0,
      cuRecG = cuRec.g ?? 0,
      cuRecB = cuRec.b ?? 0;
    recordBool(
      'inGamutRec2020',
      inGamutRec2020(oklchObj),
      cuRecR >= 0 && cuRecR <= 1 && cuRecG >= 0 && cuRecG <= 1 && cuRecB >= 0 && cuRecB <= 1
    );
  }

  for (let i = 0; i < COUNT_RGB; i++) {
    const r8 = Math.floor(rand() * 256);
    const g8 = Math.floor(rand() * 256);
    const b8 = Math.floor(rand() * 256);
    const hexColor = `#${r8.toString(16).padStart(2, '0')}${g8.toString(16).padStart(2, '0')}${b8.toString(16).padStart(2, '0')}`;
    const rgbLabel = `rgb(${r8},${g8},${b8})`;
    const cxRgb = colordx(hexColor);
    const cuBase8 = { mode: 'rgb' as const, r: r8 / 255, g: g8 / 255, b: b8 / 255 };

    const { r: cxRr, g: cxRg, b: cxRb } = cxRgb.toRgb();
    record('RGB8:RGB', maxDiff([cxRr, r8], [cxRg, g8], [cxRb, b8]), rgbLabel);

    const backHex = colordx(hexColor).toHex();
    record('RGB8:HEX', backHex === hexColor ? 0 : 1, rgbLabel);

    const cxHsl8 = cxRgb.toHsl();
    const cuHsl8 = culoriToHsl(cuBase8)!;
    const cuHsl8H = cuHsl8.h ?? 0,
      cuHsl8S = (cuHsl8.s ?? 0) * 100,
      cuHsl8L = (cuHsl8.l ?? 0) * 100;
    const hsl8Achromatic = cxHsl8.s < 1 || cuHsl8S < 1;
    const hsl8HueDelta = hsl8Achromatic ? 0 : hueDiff(cxHsl8.h, round(cuHsl8H, 2));
    record(
      'RGB8:HSL',
      Math.max(hsl8HueDelta, absDiff(cxHsl8.s, round(cuHsl8S, 2)), absDiff(cxHsl8.l, round(cuHsl8L, 2))),
      rgbLabel
    );

    const cxHsv8 = (cxRgb as unknown as { toHsv(): { h: number; s: number; v: number } }).toHsv();
    const cuHsv8 = culoriToHsv(cuBase8)!;
    const cuHsv8H = cuHsv8.h ?? 0,
      cuHsv8S = (cuHsv8.s ?? 0) * 100,
      cuHsv8V = (cuHsv8.v ?? 0) * 100;
    const hsv8Achromatic = cxHsv8.s < 1 || cuHsv8S < 1;
    const hsv8HueDelta = hsv8Achromatic ? 0 : hueDiff(cxHsv8.h, round(cuHsv8H, 2));
    record(
      'RGB8:HSV',
      Math.max(hsv8HueDelta, absDiff(cxHsv8.s, round(cuHsv8S, 2)), absDiff(cxHsv8.v, round(cuHsv8V, 2))),
      rgbLabel
    );

    const cxHwb8 = (cxRgb as unknown as { toHwb(): { h: number; w: number; b: number } }).toHwb();
    const cuHwb8 = culoriToHwb(cuBase8)!;
    const cuHwb8H = cuHwb8.h ?? 0,
      cuHwb8W = (cuHwb8.w ?? 0) * 100,
      cuHwb8B = (cuHwb8.b ?? 0) * 100;
    const hwb8Achromatic = cxHwb8.w + cxHwb8.b >= 99 || cuHwb8W + cuHwb8B >= 99;
    const hwb8HueDelta = hwb8Achromatic ? 0 : hueDiff(cxHwb8.h, round(cuHwb8H, 0));
    record(
      'RGB8:HWB',
      Math.max(hwb8HueDelta, absDiff(cxHwb8.w, round(cuHwb8W, 0)), absDiff(cxHwb8.b, round(cuHwb8B, 0))),
      rgbLabel
    );

    const { r: cxDR, g: cxDG, b: cxDB } = cxRgb.darken(0.1).toRgb();
    const cuDarkened = culoriToRgb({ ...cuHsl8, l: Math.max(0, (cuHsl8.l ?? 0) - 0.1) })!;
    const cuDR = Math.round((cuDarkened.r ?? 0) * 255);
    const cuDG = Math.round((cuDarkened.g ?? 0) * 255);
    const cuDB = Math.round((cuDarkened.b ?? 0) * 255);
    record('RGB8:darken', maxDiff([cxDR, cuDR], [cxDG, cuDG], [cxDB, cuDB]), rgbLabel);
  }
};

// Upper bounds per format. Each value is the largest per-color delta the
// implementation is allowed to exhibit vs culori under PARITY_COUNT samples.
// Generous on gamut-mapping outputs (CSS Color 4 leaves room for implementation
// choices) and strict on pure conversions.
const ceilings: Record<string, number> = {
  RGB: 2,
  HSL: 1,
  HSV: 1,
  HWB: 2,
  'HEX→OKLch': 0.011, // 0.01 floor drift from FP epsilon in rounding
  'HEX→lighten': 2,
  'Mix OKLab': 2,
  'P3 raw': 0.001,
  'P3 gamut': 0.1,
  'Rec.2020 raw': 0.001,
  'Rec.2020 gamut': 0.1,
  'StrParse→P3': 0.5, // sRGB-clip loss for out-of-gamut OKLCH strings
  'StrParse→Rec2020': 0.5,
  'StrParse(oklab)→P3': 0.5,
  'StrParse(oklab)→Rec20': 0.5,
  'P3str→P3': 0.001,
  'Rec2020str→Rec2020': 0.001,
  LCH: 1,
  Lab: 1,
  OKLab: 0.001,
  XYZ: 1,
  'XYZ D65': 1,
  'Lab→LinSRGB': 0.001,
  'LCH→LinSRGB': 0.001,
  'Lab→P3': 0.001,
  'LCH→P3': 0.001,
  'Lab→Rec2020': 0.001,
  'LCH→Rec2020': 0.001,
  'mixLab()': 2,
  'delta()': 0.01,
  'Linear RGB': 0.0001,
  'RT:HSL': 2,
  'RT:HSV': 2,
  'RT:HWB': 2,
  'RT:LCH': 3,
  'RT:Lab': 3,
  'RT:OKLch': 3,
  'RT:OKLab': 3,
  'RGB8:RGB': 0,
  'RGB8:HEX': 0,
  'RGB8:HSL': 1,
  'RGB8:HSV': 1,
  'RGB8:HWB': 1,
  'RGB8:darken': 2,
};

// Boundary colors where a point sits within float-epsilon of the gamut surface can
// legitimately classify differently under two implementations (each picks its own
// tolerance). Empirically ~2% of random OKLCH samples land in this band vs culori.
// 97% gives slack for boundary drift but still catches a matrix regression that would
// drop the agreement to <90%.
const boolFloor = 0.97;

const PAD = 20;

const printStats = () => {
  const header = `${'Format'.padEnd(PAD)} ${'Exact'.padStart(7)} ${'±1'.padStart(7)} ${'>1'.padStart(7)} ${'Skip'.padStart(7)}  Worst  Ceil  Worst input`;
  console.log(`\nParity vs culori — ${COUNT.toLocaleString()} OKLCH + ${COUNT_RGB.toLocaleString()} RGB samples`);
  console.log(header);
  console.log('─'.repeat(header.length + 40));
  for (const [fmt, s] of Object.entries(stats)) {
    const total = fmt.startsWith('RGB8:') ? COUNT_RGB : COUNT;
    const compared = total - s.skipped;
    const fmt1 = (n: number) => (compared > 0 ? `${((n / compared) * 100).toFixed(1)}%` : 'n/a');
    const exact = fmt1(s.matched);
    const pm1 = fmt1(s.offBy1);
    const big = fmt1(s.larger);
    const skip = s.skipped > 0 ? `${((s.skipped / total) * 100).toFixed(0)}%` : '—';
    const worst = s.worstDelta.toFixed(4);
    const ceil = (ceilings[fmt] ?? 0).toFixed(4);
    console.log(
      `${fmt.padEnd(PAD)} ${exact.padStart(7)} ${pm1.padStart(7)} ${big.padStart(7)} ${skip.padStart(7)}  ${worst.padStart(6)}  ${ceil.padStart(4)}  ${s.worstColor}`
    );
  }
  console.log('\nBoolean agreement:');
  for (const [fmt, s] of Object.entries(boolStats)) {
    const agree = ((s.agree / COUNT) * 100).toFixed(2);
    console.log(`  ${fmt.padEnd(PAD)} ${agree}%  (cx-only: ${s.cxOnly}, cu-only: ${s.cuOnly})`);
  }
  console.log('');
};

describe('parity vs culori', () => {
  beforeAll(() => {
    runParity();
    printStats();
  });

  for (const [fmt, ceil] of Object.entries(ceilings)) {
    it(`${fmt}: worst delta ≤ ${ceil}`, () => {
      expect(stats[fmt]!.worstDelta).toBeLessThanOrEqual(ceil);
    });
  }

  it(`inGamutSrgb agrees with culori ≥ ${(boolFloor * 100).toFixed(0)}%`, () => {
    expect(boolStats.inGamutSrgb!.agree / COUNT).toBeGreaterThanOrEqual(boolFloor);
  });
  it(`inGamutP3 agrees with culori ≥ ${(boolFloor * 100).toFixed(0)}%`, () => {
    expect(boolStats.inGamutP3!.agree / COUNT).toBeGreaterThanOrEqual(boolFloor);
  });
  it(`inGamutRec2020 agrees with culori ≥ ${(boolFloor * 100).toFixed(0)}%`, () => {
    expect(boolStats.inGamutRec2020!.agree / COUNT).toBeGreaterThanOrEqual(boolFloor);
  });
});

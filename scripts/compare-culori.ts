import { converter, differenceCiede2000, toGamut } from 'culori';
const culoriDeltaE2000 = differenceCiede2000();  // curried — call once to get distance fn
import { Colordx, colordx, extend, inGamutSrgb, oklchToLinear } from '../src/index.js';
import hsvPlugin from '../src/plugins/hsv.js';
import hwbPlugin from '../src/plugins/hwb.js';
import labPlugin from '../src/plugins/lab.js';
import lchPlugin from '../src/plugins/lch.js';
import mixPlugin from '../src/plugins/mix.js';
import p3Plugin, { inGamutP3, oklchToP3Channels } from '../src/plugins/p3.js';
import rec2020Plugin, { inGamutRec2020, oklchToRec2020Channels } from '../src/plugins/rec2020.js';

extend([labPlugin, lchPlugin, p3Plugin, rec2020Plugin, mixPlugin, hsvPlugin, hwbPlugin]);

// culori converters
const culoriGamutMap      = toGamut('rgb',    'oklch');  // CSS Color 4 gamut map to sRGB
const culoriP3GamutMap    = toGamut('p3',     'oklch');  // CSS Color 4 gamut map to P3
const culoriRec2020GamutMap = toGamut('rec2020', 'oklch'); // CSS Color 4 gamut map to Rec.2020
const culoriToHsl     = converter('hsl');
const culoriToHsv     = converter('hsv');
const culoriToHwb     = converter('hwb');
const culoriToP3      = converter('p3');
const culoriToRec2020 = converter('rec2020');
const culoriToLch     = converter('lch');
const culoriToLab     = converter('lab');
const culoriToOklab   = converter('oklab');
const culoriToOklch   = converter('oklch');
const culoriToRgb     = converter('rgb');
const culoriToLrgb    = converter('lrgb');          // linear sRGB
const culoriToXyz50   = converter('xyz50');          // CIE XYZ D50, 0-1 scale

const COUNT = 100_000;

// Reproducible seed-based random (mulberry32)
let seed = 0xdeadbeef;
const rand = () => {
  seed = (seed ^ (seed << 13)) >>> 0;
  seed = (seed ^ (seed >>> 17)) >>> 0;
  seed = (seed ^ (seed << 5)) >>> 0;
  return seed / 0xffffffff;
};

const round = (v: number, d = 4) => parseFloat(v.toFixed(d));
const absDiff = (a: number, b: number) => Math.abs(a - b);
const hueDiff = (a: number, b: number) => { const d = Math.abs(a - b); return d > 180 ? 360 - d : d; };
const maxDiff = (...pairs: [number, number][]) => Math.max(...pairs.map(([a, b]) => absDiff(a, b)));

// Per-format delta stats
type FormatStats = { matched: number; offBy1: number; larger: number; skipped: number; worstDelta: number; worstColor: string };
const mkStats = (): FormatStats => ({ matched: 0, offBy1: 0, larger: 0, skipped: 0, worstDelta: 0, worstColor: '' });

const stats: Record<string, FormatStats> = {
  RGB:            mkStats(),
  HSL:            mkStats(),
  HSV:            mkStats(),
  HWB:            mkStats(),
  'HEX→OKLch':   mkStats(),
  'HEX→lighten':  mkStats(),
  'Mix OKLab':    mkStats(),
  'P3 raw':       mkStats(),
  'P3 gamut':     mkStats(),
  'Rec.2020 raw': mkStats(),
  'Rec.2020 gamut': mkStats(),
  // Wide-gamut parse issue: parse oklch/p3/rec2020 CSS string → convert back to that space
  // For out-of-sRGB colors, the parser clips to sRGB first, so the output differs from a direct conversion.
  // culori reference: direct OKLCH → P3 / Rec.2020 conversion with no intermediate sRGB clip.
  'StrParse→P3':           mkStats(),
  'StrParse→Rec2020':      mkStats(),
  'StrParse(oklab)→P3':    mkStats(),
  'StrParse(oklab)→Rec20': mkStats(),
  'P3str→P3':              mkStats(),
  'Rec2020str→Rec2020':    mkStats(),
  LCH:            mkStats(),
  Lab:            mkStats(),
  OKLab:          mkStats(),
  XYZ:            mkStats(),
  'mixLab()':     mkStats(),
  'delta()':      mkStats(),
  'Linear RGB':   mkStats(),
  // Round-trip: hex → string format → parse back → integer RGB
  // Compares colordx's round-trip (lossy: string output is rounded) vs culori's (lossless: direct conversion)
  'RT:HSL':       mkStats(),
  'RT:HSV':       mkStats(),
  'RT:HWB':       mkStats(),
  'RT:LCH':       mkStats(),
  'RT:Lab':       mkStats(),
  'RT:OKLch':     mkStats(),
  'RT:OKLab':     mkStats(),
  'RGB8:RGB':     mkStats(),
  'RGB8:HEX':     mkStats(),
  'RGB8:HSL':     mkStats(),
  'RGB8:HSV':     mkStats(),
  'RGB8:HWB':     mkStats(),
  'RGB8:darken':  mkStats(),
};

const record = (key: string, delta: number, color: string) => {
  const s = stats[key];
  if (delta === 0)      s.matched++;
  else if (delta <= 1)  s.offBy1++;
  else                  s.larger++;
  if (delta > s.worstDelta) { s.worstDelta = delta; s.worstColor = color; }
};
const recordSkip = (key: string) => { stats[key].skipped++; };

// Boolean agreement stats (inGamut checks)
type BoolStats = { agree: number; cxOnly: number; cuOnly: number };
const mkBool = (): BoolStats => ({ agree: 0, cxOnly: 0, cuOnly: 0 });
const boolStats: Record<string, BoolStats> = {
  inGamutSrgb:    mkBool(),
  inGamutP3:      mkBool(),
  inGamutRec2020: mkBool(),
};
const recordBool = (key: string, cx: boolean, cu: boolean) => {
  if (cx === cu) boolStats[key].agree++;
  else if (cx)   boolStats[key].cxOnly++;
  else           boolStats[key].cuOnly++;
};

for (let i = 0; i < COUNT; i++) {
  const l = rand();
  const c = rand() * 0.4;
  const h = rand() * 360;
  const color = `oklch(${l.toFixed(6)} ${c.toFixed(6)} ${h.toFixed(4)})`;
  const oklchObj = { l, c, h, alpha: 1 };

  // Second color for mix comparison
  const l2 = rand(), c2 = rand() * 0.4, h2 = rand() * 360;
  const cxHex2 = Colordx.toGamutSrgb({ l: l2, c: c2, h: h2, alpha: 1 }).toHex();

  // --- Gamut-mapped sRGB (basis for sRGB-derived formats) ---
  const cxGamut = Colordx.toGamutSrgb(oklchObj);
  const cxHex   = cxGamut.toHex();
  const cxCs    = colordx(cxHex);               // normalized through hex

  const cuGamut = culoriGamutMap({ mode: 'oklch', l, c, h })!;

  // RGB (integer 0-255)
  const { r: cxR, g: cxG, b: cxB } = cxCs.toRgb();
  const cuR = Math.round(cuGamut.r * 255), cuG = Math.round(cuGamut.g * 255), cuB = Math.round(cuGamut.b * 255);
  record('RGB', maxDiff([cxR, cuR], [cxG, cuG], [cxB, cuB]), color);

  // Second color RGB — needed for mix/delta tests both inside and outside the rgbMatch block.
  const { r: r2, g: g2, b: b2 } = colordx(cxHex2).toRgb();

  // For format comparisons below, both libraries start from the same 8-bit sRGB base.
  // When gamut mapping disagrees, there is no common base — skip those comparisons.
  const rgbMatch = cxR === cuR && cxG === cuG && cxB === cuB;

  if (!rgbMatch) {
    recordSkip('HSL');
    recordSkip('HSV');
    recordSkip('HWB');
    recordSkip('HEX→OKLch');
    recordSkip('HEX→lighten');
    recordSkip('LCH');
    recordSkip('Lab');
    recordSkip('OKLab');
    recordSkip('RT:HSL');
    recordSkip('RT:HSV');
    recordSkip('RT:HWB');
    recordSkip('RT:LCH');
    recordSkip('RT:Lab');
    recordSkip('RT:OKLch');
    recordSkip('RT:OKLab');
    recordSkip('XYZ');
    recordSkip('mixLab()');
    recordSkip('delta()');
  } else {
    const cuBase = { mode: 'rgb' as const, r: cuR / 255, g: cuG / 255, b: cuB / 255 };

    // HSL (h 0-360, s/l 0-100) — skip hue if saturation is near 0 (hue undefined for achromatic)
    const cxHsl = cxCs.toHsl();
    const cuHsl = culoriToHsl(cuBase)!;
    const cuHslH = (cuHsl.h ?? 0), cuHslS = (cuHsl.s ?? 0) * 100, cuHslL = (cuHsl.l ?? 0) * 100;
    const hslAchromatic = cxHsl.s < 1 || cuHslS < 1;
    const hslHueDelta = hslAchromatic ? 0 : hueDiff(cxHsl.h, round(cuHslH, 2));
    record('HSL', Math.max(hslHueDelta, absDiff(cxHsl.s, round(cuHslS, 2)), absDiff(cxHsl.l, round(cuHslL, 2))), color);

    // HSV (h 0-360, s/v 0-100) — skip hue if saturation is near 0 (hue undefined for achromatic)
    const cxHsv = (cxCs as any).toHsv();
    const cuHsv = culoriToHsv(cuBase)!;
    const cuHsvH = (cuHsv.h ?? 0), cuHsvS = (cuHsv.s ?? 0) * 100, cuHsvV = (cuHsv.v ?? 0) * 100;
    const hsvAchromatic = cxHsv.s < 1 || cuHsvS < 1;
    const hsvHueDelta = hsvAchromatic ? 0 : hueDiff(cxHsv.h, round(cuHsvH, 2));
    record('HSV', Math.max(hsvHueDelta, absDiff(cxHsv.s, round(cuHsvS, 2)), absDiff(cxHsv.v, round(cuHsvV, 2))), color);

    // HWB (h 0-360, w/b 0-100) — skip hue if achromatic (w+b ≥ 100)
    const cxHwb = (cxCs as any).toHwb();
    const cuHwb = culoriToHwb(cuBase)!;
    const cuHwbH = (cuHwb.h ?? 0), cuHwbW = (cuHwb.w ?? 0) * 100, cuHwbB2 = (cuHwb.b ?? 0) * 100;
    const hwbAchromatic = cxHwb.w + cxHwb.b >= 99 || cuHwbW + cuHwbB2 >= 99;
    const hwbHueDelta = hwbAchromatic ? 0 : hueDiff(cxHwb.h, round(cuHwbH, 0));
    record('HWB', Math.max(hwbHueDelta, absDiff(cxHwb.w, round(cuHwbW, 0)), absDiff(cxHwb.b, round(cuHwbB2, 0))), color);

    // HEX → toOklch — skip hue if chroma is near 0 (hue undefined for achromatic)
    const cxOklch = cxCs.toOklch();
    const cuOklch = culoriToOklch(cuBase)!;
    const cuOklchC = cuOklch.c ?? 0, cuOklchH = cuOklch.h ?? 0;
    const oklchAchromatic = cxOklch.c < 0.001 || cuOklchC < 0.001;
    const oklchHueDelta = oklchAchromatic ? 0 : hueDiff(cxOklch.h, round(cuOklchH, 2));
    record('HEX→OKLch', Math.max(oklchHueDelta, absDiff(cxOklch.l, round(cuOklch.l ?? 0, 4)), absDiff(cxOklch.c, round(cuOklchC, 4))), color);

    // HEX → lighten(0.1) → toHex — both libraries apply +10% absolute HSL lightness
    const { r: cxLR, g: cxLG, b: cxLB } = cxCs.lighten(0.1).toRgb();
    const cuLightened = culoriToRgb({ ...cuHsl, l: Math.min(1, (cuHsl.l ?? 0) + 0.1) })!;
    const cuLR = Math.round((cuLightened.r ?? 0) * 255);
    const cuLG = Math.round((cuLightened.g ?? 0) * 255);
    const cuLB = Math.round((cuLightened.b ?? 0) * 255);
    record('HEX→lighten', maxDiff([cxLR, cuLR], [cxLG, cuLG], [cxLB, cuLB]), color);

    // LCH (l 0-100, c 0-150, h 0-360) — skip hue if chroma is near 0 (hue undefined for achromatic)
    const cxLch = cxCs.toLch();
    const cuLch = culoriToLch(cuBase)!;
    const cuLchL = cuLch.l ?? 0, cuLchC = cuLch.c ?? 0, cuLchH = cuLch.h ?? 0;
    const lchAchromatic = cxLch.c < 0.5 || cuLchC < 0.5;
    const lchHueDelta = lchAchromatic ? 0 : hueDiff(cxLch.h, round(cuLchH, 2));
    record('LCH', Math.max(lchHueDelta, absDiff(cxLch.l, round(cuLchL, 2)), absDiff(cxLch.c, round(cuLchC, 2))), color);

    // Lab (l 0-100, a/b -128..128)
    const cxLab = cxCs.toLab();
    const cuLab = culoriToLab(cuBase)!;
    const cuLabL = cuLab.l ?? 0, cuLabA = cuLab.a ?? 0, cuLabB = cuLab.b ?? 0;
    record('Lab', maxDiff([cxLab.l, round(cuLabL, 2)], [cxLab.a, round(cuLabA, 2)], [cxLab.b, round(cuLabB, 2)]), color);

    // OKLab — from gamut-mapped sRGB base; tests the actual toOklab() implementation
    const cxOklab = cxCs.toOklab();
    const cuOklab = culoriToOklab(cuBase)!;
    record('OKLab', maxDiff(
      [cxOklab.l, round(cuOklab.l ?? 0, 4)],
      [cxOklab.a, round(cuOklab.a ?? 0, 4)],
      [cxOklab.b, round(cuOklab.b ?? 0, 4)],
    ), color);

    // XYZ D50 — colordx uses 0-100 scale, culori xyz50 uses 0-1 scale; multiply culori by 100.
    // culori requires an intermediate Lab step: rgb→lab→xyz50 (rgb→xyz50 not directly registered).
    const cxXyz = (cxCs as any).toXyz();
    const cuXyz = culoriToXyz50(cuLab)!;
    record('XYZ', maxDiff(
      [cxXyz.x, round((cuXyz.x ?? 0) * 100, 2)],
      [cxXyz.y, round((cuXyz.y ?? 0) * 100, 2)],
      [cxXyz.z, round((cuXyz.z ?? 0) * 100, 2)],
    ), color);

    // mixLab() — blend in CIE Lab space at 50%; reference is culori Lab lerp + convert back
    const { r: cxMlR, g: cxMlG, b: cxMlB } = (cxCs as any).mixLab(cxHex2).toRgb();
    const cuLab2 = culoriToLab({ mode: 'rgb' as const, r: r2 / 255, g: g2 / 255, b: b2 / 255 })!;
    const cuLabMixed = culoriToRgb({ mode: 'lab' as const,
      l: ((cuLab.l ?? 0) + (cuLab2.l ?? 0)) / 2,
      a: ((cuLab.a ?? 0) + (cuLab2.a ?? 0)) / 2,
      b: ((cuLab.b ?? 0) + (cuLab2.b ?? 0)) / 2,
    })!;
    const cuMlR = Math.round(Math.max(0, Math.min(1, cuLabMixed.r ?? 0)) * 255);
    const cuMlG = Math.round(Math.max(0, Math.min(1, cuLabMixed.g ?? 0)) * 255);
    const cuMlB = Math.round(Math.max(0, Math.min(1, cuLabMixed.b ?? 0)) * 255);
    record('mixLab()', maxDiff([cxMlR, cuMlR], [cxMlG, cuMlG], [cxMlB, cuMlB]), color);

    // delta() — ΔE2000 / 100; colordx normalizes to [0,1], culori returns raw ΔE2000
    const cxDelta = (cxCs as any).delta(cxHex2);
    const cuDelta = round(culoriDeltaE2000(culoriToLab(cuBase)!, culoriToLab({ mode: 'rgb' as const, r: r2 / 255, g: g2 / 255, b: b2 / 255 })!) / 100, 3);
    record('delta()', absDiff(cxDelta, cuDelta), color);

    // Round-trips: hex → string format → parse back → integer RGB
    // colordx round-trips through its own rounded string output.
    // culori round-trips via direct conversion (lossless — no intermediate string rounding).
    // Difference shows precision lost from colordx's output format rounding.
    const cuRtRgb = (cu: { r?: number; g?: number; b?: number }) => [
      Math.round((cu.r ?? 0) * 255),
      Math.round((cu.g ?? 0) * 255),
      Math.round((cu.b ?? 0) * 255),
    ] as [number, number, number];

    const { r: rtHslR, g: rtHslG, b: rtHslB } = colordx(cxCs.toHslString()).toRgb();
    const [cuRtHslR, cuRtHslG, cuRtHslB] = cuRtRgb(culoriToRgb(culoriToHsl(cuBase)!)!);
    record('RT:HSL', maxDiff([rtHslR, cuRtHslR], [rtHslG, cuRtHslG], [rtHslB, cuRtHslB]), color);

    const { r: rtHsvR, g: rtHsvG, b: rtHsvB } = colordx((cxCs as any).toHsvString()).toRgb();
    const [cuRtHsvR, cuRtHsvG, cuRtHsvB] = cuRtRgb(culoriToRgb(culoriToHsv(cuBase)!)!);
    record('RT:HSV', maxDiff([rtHsvR, cuRtHsvR], [rtHsvG, cuRtHsvG], [rtHsvB, cuRtHsvB]), color);

    const { r: rtHwbR, g: rtHwbG, b: rtHwbB } = colordx((cxCs as any).toHwbString(2)).toRgb();
    const [cuRtHwbR, cuRtHwbG, cuRtHwbB] = cuRtRgb(culoriToRgb(culoriToHwb(cuBase)!)!);
    record('RT:HWB', maxDiff([rtHwbR, cuRtHwbR], [rtHwbG, cuRtHwbG], [rtHwbB, cuRtHwbB]), color);

    const { r: rtLchR, g: rtLchG, b: rtLchB } = colordx(cxCs.toLchString()).toRgb();
    const [cuRtLchR, cuRtLchG, cuRtLchB] = cuRtRgb(culoriToRgb(culoriToLch(cuBase)!)!);
    record('RT:LCH', maxDiff([rtLchR, cuRtLchR], [rtLchG, cuRtLchG], [rtLchB, cuRtLchB]), color);

    const { r: rtLabR, g: rtLabG, b: rtLabB } = colordx(cxCs.toLabString()).toRgb();
    const [cuRtLabR, cuRtLabG, cuRtLabB] = cuRtRgb(culoriToRgb(culoriToLab(cuBase)!)!);
    record('RT:Lab', maxDiff([rtLabR, cuRtLabR], [rtLabG, cuRtLabG], [rtLabB, cuRtLabB]), color);

    const { r: rtOklchR, g: rtOklchG, b: rtOklchB } = colordx(cxCs.toOklchString()).toRgb();
    const [cuRtOklchR, cuRtOklchG, cuRtOklchB] = cuRtRgb(culoriToRgb(culoriToOklch(cuBase)!)!);
    record('RT:OKLch', maxDiff([rtOklchR, cuRtOklchR], [rtOklchG, cuRtOklchG], [rtOklchB, cuRtOklchB]), color);

    const { r: rtOklabR, g: rtOklabG, b: rtOklabB } = colordx(cxCs.toOklabString()).toRgb();
    const [cuRtOklabR, cuRtOklabG, cuRtOklabB] = cuRtRgb(culoriToRgb(culoriToOklab(cuBase)!)!);
    record('RT:OKLab', maxDiff([rtOklabR, cuRtOklabR], [rtOklabG, cuRtOklabG], [rtOklabB, cuRtOklabB]), color);
  }

  // Mix OKLab — blend cxHex + cxHex2 in OKLab space at 50%; both sides use the same hex inputs
  const { r: cxMR, g: cxMG, b: cxMB } = colordx(cxHex).mixOklab(cxHex2).toRgb();
  const cuOk1 = culoriToOklab({ mode: 'rgb' as const, r: cxR / 255, g: cxG / 255, b: cxB / 255 })!;
  const cuOk2 = culoriToOklab({ mode: 'rgb' as const, r: r2 / 255, g: g2 / 255, b: b2 / 255 })!;
  const blended = culoriToRgb({ mode: 'oklab' as const,
    l: ((cuOk1.l ?? 0) + (cuOk2.l ?? 0)) / 2,
    a: ((cuOk1.a ?? 0) + (cuOk2.a ?? 0)) / 2,
    b: ((cuOk1.b ?? 0) + (cuOk2.b ?? 0)) / 2,
  })!;
  const cuMR = Math.round(Math.max(0, Math.min(1, blended.r ?? 0)) * 255);
  const cuMG = Math.round(Math.max(0, Math.min(1, blended.g ?? 0)) * 255);
  const cuMB = Math.round(Math.max(0, Math.min(1, blended.b ?? 0)) * 255);
  record('Mix OKLab', maxDiff([cxMR, cuMR], [cxMG, cuMG], [cxMB, cuMB]), color);

  // P3 raw — direct OKLCH → P3, no gamut mapping (channels may be negative)
  const [cxP3R, cxP3G, cxP3B] = oklchToP3Channels(l, c, h);
  const cuP3 = culoriToP3({ mode: 'oklch', l, c, h })!;
  const cuP3R = cuP3.r ?? 0, cuP3G = cuP3.g ?? 0, cuP3B = cuP3.b ?? 0;
  record('P3 raw', maxDiff(
    [round(cxP3R, 4), round(cuP3R, 4)],
    [round(cxP3G, 4), round(cuP3G, 4)],
    [round(cxP3B, 4), round(cuP3B, 4)],
  ), color);

  // Linear sRGB raw — direct OKLCH → linear sRGB, no gamut mapping
  const [cxLinR, cxLinG, cxLinB] = oklchToLinear(l, c, h);
  const cuLrgb = culoriToLrgb({ mode: 'oklch', l, c, h })!;
  const cuLinR = cuLrgb.r ?? 0, cuLinG = cuLrgb.g ?? 0, cuLinB = cuLrgb.b ?? 0;
  record('Linear RGB', maxDiff(
    [round(cxLinR, 5), round(cuLinR, 5)],
    [round(cxLinG, 5), round(cuLinG, 5)],
    [round(cxLinB, 5), round(cuLinB, 5)],
  ), color);

  // Rec.2020 raw — direct OKLCH → Rec.2020, no gamut mapping (channels may be out of [0,1])
  const [cxRec20R, cxRec20G, cxRec20B] = oklchToRec2020Channels(l, c, h);
  const cuRec20 = culoriToRec2020({ mode: 'oklch', l, c, h })!;
  record('Rec.2020 raw', maxDiff(
    [round(cxRec20R, 4), round(cuRec20.r ?? 0, 4)],
    [round(cxRec20G, 4), round(cuRec20.g ?? 0, 4)],
    [round(cxRec20B, 4), round(cuRec20.b ?? 0, 4)],
  ), color);

  // P3 gamut mapping — compare P3 channels after mapping to P3 boundary
  const cxGamutP3 = (Colordx.toGamutP3(oklchObj) as any).toP3();
  const cuGamutP3 = culoriP3GamutMap({ mode: 'oklch', l, c, h })!;
  record('P3 gamut', maxDiff(
    [round(cxGamutP3.r, 4), round(cuGamutP3.r ?? 0, 4)],
    [round(cxGamutP3.g, 4), round(cuGamutP3.g ?? 0, 4)],
    [round(cxGamutP3.b, 4), round(cuGamutP3.b ?? 0, 4)],
  ), color);

  // Rec.2020 gamut mapping — compare Rec.2020 channels after mapping to Rec.2020 boundary
  const cxGamutRec = (Colordx.toGamutRec2020(oklchObj) as any).toRec2020();
  const cuGamutRec = culoriRec2020GamutMap({ mode: 'oklch', l, c, h })!;
  record('Rec.2020 gamut', maxDiff(
    [round(cxGamutRec.r, 4), round(cuGamutRec.r ?? 0, 4)],
    [round(cxGamutRec.g, 4), round(cuGamutRec.g ?? 0, 4)],
    [round(cxGamutRec.b, 4), round(cuGamutRec.b ?? 0, 4)],
  ), color);

  // Wide-gamut string parse issue: parse the OKLCH CSS string, then convert to P3/Rec.2020.
  // For out-of-sRGB colors the parser clips to sRGB before storing, so toP3()/toRec2020() operates
  // on the clipped color — producing different channels than a direct OKLCH→P3/Rec.2020 conversion.
  // Reference: culori's direct conversion (cuP3R/G/B and cuRec20R/G/B, already computed above).
  // Only meaningful for out-of-sRGB colors; skip in-gamut ones (no clipping, so no discrepancy).
  if (!inGamutSrgb(oklchObj)) {
    const cxStrP3 = (colordx(color) as any).toP3();
    record('StrParse→P3', maxDiff(
      [round(cxStrP3.r, 4), round(cuP3R, 4)],
      [round(cxStrP3.g, 4), round(cuP3G, 4)],
      [round(cxStrP3.b, 4), round(cuP3B, 4)],
    ), color);

    const cxStrRec = (colordx(color) as any).toRec2020();
    record('StrParse→Rec2020', maxDiff(
      [round(cxStrRec.r, 4), round(cuRec20.r ?? 0, 4)],
      [round(cxStrRec.g, 4), round(cuRec20.g ?? 0, 4)],
      [round(cxStrRec.b, 4), round(cuRec20.b ?? 0, 4)],
    ), color);
  } else {
    recordSkip('StrParse→P3');
    recordSkip('StrParse→Rec2020');
  }

  // OKLab string parse → P3/Rec.2020 — same sRGB-clip issue as OKLCH string parse, different entry point.
  // Construct an oklab() CSS string from raw (non-gamut-mapped) OKLab values derived from the OKLCH color.
  // culori reference: direct OKLCH→P3 / OKLCH→Rec.2020 (cuP3R/G/B and cuRec20 already computed above).
  {
    const rawOklab = culoriToOklab({ mode: 'oklch', l, c, h })!;
    const oklabStr = `oklab(${(rawOklab.l ?? 0).toFixed(6)} ${(rawOklab.a ?? 0).toFixed(6)} ${(rawOklab.b ?? 0).toFixed(6)})`;
    if (!inGamutSrgb(oklchObj)) {
      const cxOklabP3 = (colordx(oklabStr) as any).toP3();
      record('StrParse(oklab)→P3', maxDiff(
        [round(cxOklabP3.r, 4), round(cuP3R, 4)],
        [round(cxOklabP3.g, 4), round(cuP3G, 4)],
        [round(cxOklabP3.b, 4), round(cuP3B, 4)],
      ), color);
      const cxOklabRec = (colordx(oklabStr) as any).toRec2020();
      record('StrParse(oklab)→Rec20', maxDiff(
        [round(cxOklabRec.r, 4), round(cuRec20.r ?? 0, 4)],
        [round(cxOklabRec.g, 4), round(cuRec20.g ?? 0, 4)],
        [round(cxOklabRec.b, 4), round(cuRec20.b ?? 0, 4)],
      ), color);
    } else {
      recordSkip('StrParse(oklab)→P3');
      recordSkip('StrParse(oklab)→Rec20');
    }
  }

  // P3 string → toP3() round-trip — parse a color(display-p3 ...) string and read P3 channels back.
  // For in-P3-gamut colors the channels should survive parse→toP3() unchanged.
  // For out-of-sRGB-but-in-P3 colors the parser clips to sRGB, so toP3() returns wrong channels.
  // culori reference: the raw P3 channels used to construct the string (cuP3R/G/B).
  {
    const inP3Gamut = cuP3R >= 0 && cuP3R <= 1 && cuP3G >= 0 && cuP3G <= 1 && cuP3B >= 0 && cuP3B <= 1;
    if (inP3Gamut) {
      const p3Str = `color(display-p3 ${round(cuP3R, 6)} ${round(cuP3G, 6)} ${round(cuP3B, 6)})`;
      const cxP3rt = (colordx(p3Str) as any).toP3();
      record('P3str→P3', maxDiff(
        [round(cxP3rt.r, 4), round(cuP3R, 4)],
        [round(cxP3rt.g, 4), round(cuP3G, 4)],
        [round(cxP3rt.b, 4), round(cuP3B, 4)],
      ), color);
    } else {
      recordSkip('P3str→P3');
    }
  }

  // Rec.2020 string → toRec2020() round-trip — same pattern as P3str→P3.
  {
    const cuRec20R = cuRec20.r ?? 0, cuRec20G = cuRec20.g ?? 0, cuRec20B = cuRec20.b ?? 0;
    const inRec2020Gamut = cuRec20R >= 0 && cuRec20R <= 1 && cuRec20G >= 0 && cuRec20G <= 1 && cuRec20B >= 0 && cuRec20B <= 1;
    if (inRec2020Gamut) {
      const rec2020Str = `color(rec2020 ${round(cuRec20R, 6)} ${round(cuRec20G, 6)} ${round(cuRec20B, 6)})`;
      const cxRecrt = (colordx(rec2020Str) as any).toRec2020();
      record('Rec2020str→Rec2020', maxDiff(
        [round(cxRecrt.r, 4), round(cuRec20R, 4)],
        [round(cxRecrt.g, 4), round(cuRec20G, 4)],
        [round(cxRecrt.b, 4), round(cuRec20B, 4)],
      ), color);
    } else {
      recordSkip('Rec2020str→Rec2020');
    }
  }

  // inGamutSrgb — boolean agreement; reuse already-computed linear sRGB channels
  recordBool('inGamutSrgb', inGamutSrgb(oklchObj), cuLinR >= 0 && cuLinR <= 1 && cuLinG >= 0 && cuLinG <= 1 && cuLinB >= 0 && cuLinB <= 1);

  // inGamutP3 — boolean agreement; reuse already-computed cuP3 channels
  recordBool('inGamutP3', inGamutP3(oklchObj), cuP3R >= 0 && cuP3R <= 1 && cuP3G >= 0 && cuP3G <= 1 && cuP3B >= 0 && cuP3B <= 1);

  // inGamutRec2020 — boolean agreement
  const cuRec = culoriToRec2020({ mode: 'oklch', l, c, h })!;
  const cuRecR = cuRec.r ?? 0, cuRecG = cuRec.g ?? 0, cuRecB = cuRec.b ?? 0;
  recordBool('inGamutRec2020', inGamutRec2020(oklchObj), cuRecR >= 0 && cuRecR <= 1 && cuRecG >= 0 && cuRecG <= 1 && cuRecB >= 0 && cuRecB <= 1);
}

// Generate random R,G,B byte triples and compare common sRGB-native conversions.
const COUNT_RGB = 100_000;
for (let i = 0; i < COUNT_RGB; i++) {
  const r8 = Math.floor(rand() * 256);
  const g8 = Math.floor(rand() * 256);
  const b8 = Math.floor(rand() * 256);
  const hexColor = `#${r8.toString(16).padStart(2, '0')}${g8.toString(16).padStart(2, '0')}${b8.toString(16).padStart(2, '0')}`;
  const rgbLabel = `rgb(${r8},${g8},${b8})`;
  const cxRgb = colordx(hexColor);
  const cuBase8 = { mode: 'rgb' as const, r: r8 / 255, g: g8 / 255, b: b8 / 255 };

  // RGB object → integer channels
  const { r: cxRr, g: cxRg, b: cxRb } = cxRgb.toRgb();
  record('RGB8:RGB', maxDiff([cxRr, r8], [cxRg, g8], [cxRb, b8]), rgbLabel);

  // HEX string output round-trip
  const backHex = colordx(hexColor).toHex();
  record('RGB8:HEX', backHex === hexColor ? 0 : 1, rgbLabel);

  // HSL
  const cxHsl8 = cxRgb.toHsl();
  const cuHsl8 = culoriToHsl(cuBase8)!;
  const cuHsl8H = (cuHsl8.h ?? 0), cuHsl8S = (cuHsl8.s ?? 0) * 100, cuHsl8L = (cuHsl8.l ?? 0) * 100;
  const hsl8Achromatic = cxHsl8.s < 1 || cuHsl8S < 1;
  const hsl8HueDelta = hsl8Achromatic ? 0 : hueDiff(cxHsl8.h, round(cuHsl8H, 2));
  record('RGB8:HSL', Math.max(hsl8HueDelta, absDiff(cxHsl8.s, round(cuHsl8S, 2)), absDiff(cxHsl8.l, round(cuHsl8L, 2))), rgbLabel);

  // HSV
  const cxHsv8 = (cxRgb as any).toHsv();
  const cuHsv8 = culoriToHsv(cuBase8)!;
  const cuHsv8H = (cuHsv8.h ?? 0), cuHsv8S = (cuHsv8.s ?? 0) * 100, cuHsv8V = (cuHsv8.v ?? 0) * 100;
  const hsv8Achromatic = cxHsv8.s < 1 || cuHsv8S < 1;
  const hsv8HueDelta = hsv8Achromatic ? 0 : hueDiff(cxHsv8.h, round(cuHsv8H, 2));
  record('RGB8:HSV', Math.max(hsv8HueDelta, absDiff(cxHsv8.s, round(cuHsv8S, 2)), absDiff(cxHsv8.v, round(cuHsv8V, 2))), rgbLabel);

  // HWB (culori uses 0-1, colordx uses 0-100 for w/b; hue precision 0dp)
  const cxHwb8 = (cxRgb as any).toHwb();
  const cuHwb8 = culoriToHwb(cuBase8)!;
  const cuHwb8H = (cuHwb8.h ?? 0), cuHwb8W = (cuHwb8.w ?? 0) * 100, cuHwb8B = (cuHwb8.b ?? 0) * 100;
  const hwb8Achromatic = cxHwb8.w + cxHwb8.b >= 99 || cuHwb8W + cuHwb8B >= 99;
  const hwb8HueDelta = hwb8Achromatic ? 0 : hueDiff(cxHwb8.h, round(cuHwb8H, 0));
  record('RGB8:HWB', Math.max(hwb8HueDelta, absDiff(cxHwb8.w, round(cuHwb8W, 0)), absDiff(cxHwb8.b, round(cuHwb8B, 0))), rgbLabel);

  // Darken by 10% — both libraries subtract 10% from HSL lightness
  const { r: cxDR, g: cxDG, b: cxDB } = cxRgb.darken(0.1).toRgb();
  const cuDarkened = culoriToRgb({ ...cuHsl8, l: Math.max(0, (cuHsl8.l ?? 0) - 0.1) })!;
  const cuDR = Math.round((cuDarkened.r ?? 0) * 255);
  const cuDG = Math.round((cuDarkened.g ?? 0) * 255);
  const cuDB = Math.round((cuDarkened.b ?? 0) * 255);
  record('RGB8:darken', maxDiff([cxDR, cuDR], [cxDG, cuDG], [cxDB, cuDB]), rgbLabel);
}

const PAD = 16;
const HEADER = `${'Format'.padEnd(PAD)} ${'Exact'.padStart(7)} ${'±1'.padStart(7)} ${'> 1'.padStart(7)} ${'Skipped'.padStart(8)}  Worst delta  Worst color`;
const RULE = '─'.repeat(104);

const printStats = (entries: [string, FormatStats][], total: number) => {
  console.log(HEADER);
  console.log(RULE);
  for (const [fmt, s] of entries) {
    const compared = total - s.skipped;
    const exact   = compared > 0 ? `${(s.matched / compared * 100).toFixed(1)}%` : 'n/a';
    const pm1     = compared > 0 ? `${(s.offBy1  / compared * 100).toFixed(1)}%` : 'n/a';
    const big     = compared > 0 ? `${(s.larger  / compared * 100).toFixed(1)}%` : 'n/a';
    const skipped = s.skipped > 0 ? `${(s.skipped / total * 100).toFixed(1)}%` : '—';
    const worst   = s.worstDelta > 0 ? `${s.worstDelta.toFixed(4).padStart(10)}   ${s.worstColor}` : '—';
    console.log(`${fmt.padEnd(PAD)} ${exact.padStart(7)} ${pm1.padStart(7)} ${big.padStart(7)} ${skipped.padStart(8)}  ${worst}`);
  }
};

const oklchEntries = Object.entries(stats).filter(([k]) => !k.startsWith('RGB8:'));
const rgb8Entries  = Object.entries(stats).filter(([k]) =>  k.startsWith('RGB8:'));

console.log(`\nResults over ${COUNT.toLocaleString()} random OKLCH colors:\n`);
printStats(oklchEntries, COUNT);

console.log(`\nResults over ${COUNT_RGB.toLocaleString()} random 8-bit RGB colors:\n`);
printStats(rgb8Entries, COUNT_RGB);

console.log(`\nBoolean agreement over ${COUNT.toLocaleString()} random OKLCH colors:\n`);
console.log(`${'Format'.padEnd(PAD)} ${'Agree'.padStart(7)} ${'cx only'.padStart(8)} ${'cu only'.padStart(8)}`);
console.log('─'.repeat(42));

for (const [fmt, s] of Object.entries(boolStats)) {
  const agree  = `${(s.agree   / COUNT * 100).toFixed(2)}%`;
  const cxOnly = `${(s.cxOnly  / COUNT * 100).toFixed(2)}%`;
  const cuOnly = `${(s.cuOnly  / COUNT * 100).toFixed(2)}%`;
  console.log(`${fmt.padEnd(PAD)} ${agree.padStart(7)} ${cxOnly.padStart(8)} ${cuOnly.padStart(8)}`);
}

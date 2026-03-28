import { converter, toGamut } from 'culori';
import { colordx, extend, toGamutSrgb, oklchToLinear } from '../src/index.js';
import labPlugin from '../src/plugins/lab.js';
import lchPlugin from '../src/plugins/lch.js';
import p3Plugin, { oklchToP3Channels } from '../src/plugins/p3.js';

extend([labPlugin, lchPlugin, p3Plugin]);

// culori converters
const culoriGamutMap = toGamut('rgb', 'oklch');   // CSS Color 4 gamut map to sRGB
const culoriToHsl  = converter('hsl');
const culoriToP3   = converter('p3');
const culoriToLch  = converter('lch');
const culoriToLab  = converter('lab');
const culoriToOklab = converter('oklab');
const culoriToLrgb = converter('lrgb');            // linear sRGB

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
const maxDiffHue = (hPair: [number, number], ...pairs: [number, number][]) =>
  Math.max(hueDiff(hPair[0], hPair[1]), ...pairs.map(([a, b]) => absDiff(a, b)));

// Per-format stats
type FormatStats = { matched: number; offBy1: number; larger: number; worstDelta: number; worstColor: string };
const mkStats = (): FormatStats => ({ matched: 0, offBy1: 0, larger: 0, worstDelta: 0, worstColor: '' });

const stats: Record<string, FormatStats> = {
  RGB:        mkStats(),
  HSL:        mkStats(),
  'P3 raw':   mkStats(),
  LCH:        mkStats(),
  Lab:        mkStats(),
  OKLab:      mkStats(),
  'Linear RGB': mkStats(),
};

const record = (key: string, delta: number, color: string) => {
  const s = stats[key];
  if (delta === 0)      s.matched++;
  else if (delta <= 1)  s.offBy1++;
  else                  s.larger++;
  if (delta > s.worstDelta) { s.worstDelta = delta; s.worstColor = color; }
};

for (let i = 0; i < COUNT; i++) {
  const l = rand();
  const c = rand() * 0.4;
  const h = rand() * 360;
  const color = `oklch(${l.toFixed(6)} ${c.toFixed(6)} ${h.toFixed(4)})`;
  const oklchObj = { l, c, h, alpha: 1 };

  // --- Gamut-mapped sRGB (basis for sRGB-derived formats) ---
  const cxGamut = toGamutSrgb(oklchObj);
  const cxHex   = cxGamut.toHex();
  const cxCs    = colordx(cxHex);               // normalized through hex

  const cuGamut = culoriGamutMap({ mode: 'oklch', l, c, h })!;

  // RGB (integer 0-255)
  const { r: cxR, g: cxG, b: cxB } = cxCs.toRgb();
  const cuR = Math.round(cuGamut.r * 255), cuG = Math.round(cuGamut.g * 255), cuB = Math.round(cuGamut.b * 255);
  record('RGB', maxDiff([cxR, cuR], [cxG, cuG], [cxB, cuB]), color);

  // For format comparisons below, normalize culori to same 8-bit base as colordx
  // to isolate conversion formula differences from gamut-mapping + quantization differences.
  // When RGB values differ (gamut mapping disagrees), any format deltas are contaminated —
  // skip those comparisons by using the same colordx hex as culori's base.
  const rgbMatch = cxR === cuR && cxG === cuG && cxB === cuB;
  const cuBase = rgbMatch
    ? { mode: 'rgb' as const, r: cuR / 255, g: cuG / 255, b: cuB / 255 }
    : { mode: 'rgb' as const, r: cxR / 255, g: cxG / 255, b: cxB / 255 };

  // HSL (h 0-360, s/l 0-100) — skip hue if saturation is near 0 (hue undefined for achromatic)
  const cxHsl = cxCs.toHsl();
  const cuHsl = culoriToHsl(cuBase)!;
  const cuHslH = (cuHsl.h ?? 0), cuHslS = (cuHsl.s ?? 0) * 100, cuHslL = (cuHsl.l ?? 0) * 100;
  const hslAchromatic = cxHsl.s < 1 || cuHslS < 1;
  const hslHueDelta = hslAchromatic ? 0 : hueDiff(cxHsl.h, round(cuHslH));
  record('HSL', Math.max(hslHueDelta, absDiff(cxHsl.s, round(cuHslS)), absDiff(cxHsl.l, round(cuHslL))), color);

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

  // OKLab — from raw OKLCH (polar decomposition, no gamut mapping)
  const rawOklabA = round(c * Math.cos(h * Math.PI / 180), 4);
  const rawOklabB = round(c * Math.sin(h * Math.PI / 180), 4);
  const cuOklab = culoriToOklab({ mode: 'oklch', l, c, h })!;
  const cuOlL = cuOklab.l ?? 0, cuOlA = cuOklab.a ?? 0, cuOlB = cuOklab.b ?? 0;
  record('OKLab', maxDiff(
    [round(l, 4), round(cuOlL, 4)],
    [rawOklabA, round(cuOlA, 4)],
    [rawOklabB, round(cuOlB, 4)],
  ), color);

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
  const [cxLR, cxLG, cxLB] = oklchToLinear(l, c, h);
  const cuLrgb = culoriToLrgb({ mode: 'oklch', l, c, h })!;
  const cuLR = cuLrgb.r ?? 0, cuLG = cuLrgb.g ?? 0, cuLLB = cuLrgb.b ?? 0;
  record('Linear RGB', maxDiff(
    [round(cxLR, 5), round(cuLR, 5)],
    [round(cxLG, 5), round(cuLG, 5)],
    [round(cxLB, 5), round(cuLLB, 5)],
  ), color);
}

const PAD = 12;
console.log(`\nResults over ${COUNT.toLocaleString()} random OKLCH colors:\n`);
console.log(`${'Format'.padEnd(PAD)} ${'Exact'.padStart(7)} ${'±1'.padStart(7)} ${'> 1'.padStart(7)}  Worst delta  Worst color`);
console.log('─'.repeat(90));

for (const [fmt, s] of Object.entries(stats)) {
  const exact = `${(s.matched / COUNT * 100).toFixed(1)}%`;
  const pm1   = `${(s.offBy1 / COUNT * 100).toFixed(1)}%`;
  const big   = `${(s.larger / COUNT * 100).toFixed(1)}%`;
  const worst = s.worstDelta > 0 ? `${s.worstDelta.toFixed(4).padStart(10)}   ${s.worstColor}` : '—';
  console.log(`${fmt.padEnd(PAD)} ${exact.padStart(7)} ${pm1.padStart(7)} ${big.padStart(7)}  ${worst}`);
}

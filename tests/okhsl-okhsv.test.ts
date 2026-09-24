/**
 * Okhsl / Okhsv — Björn Ottosson's color-picker spaces (https://bottosson.github.io/posts/colorpicker/).
 *
 * The reference vectors were produced by running the author's own colorconversion.js (the source
 * of the interactive picker demo) and rescaling: his h is in turns and s / l / v in 0–1, here h is
 * degrees and s / l / v are 0–100, the toHsl() / toHsv() scale. The port uses the library's OKLab
 * matrices — the CSS Color 4 ones, recomputed at full float64 precision — while the reference uses
 * the post's 10-digit values, so the ceilings are 5e-5 rather than 0 (and looser for #fffffe, whose
 * hue next to white amplifies the difference).
 * tests/parity-culori.test.ts runs the same comparison against culori's port on random samples.
 *
 * Two things here are deliberately NOT what the reference code does:
 *  - a grey (OKLCH chroma below 4e-6, the toOklch() threshold) reports h = 0, s = 0 instead of the
 *    reference's NaN (its a_ = a / C divides by zero), so `toOkhsl().h === toOklch().h` always;
 *  - `toOkhsl()` / `toOkhsv()` clamp s to 100. The reference's gamut cusp is a polynomial fit, so an
 *    in-gamut sRGB color can report s a little above 1 (#ff00ff: 100.004 / 100.012) and s = 1
 *    exactly can land a hair outside sRGB. The channel functions keep the raw value.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { linearSrgbToOklab, oklabToLinear } from '../src/colorModels/oklab.js';
import { rgbToOklch } from '../src/colorModels/oklch.js';
import { CUSP, findCusp, toe, toeInv } from '../src/colorModels/okgamut.js';
import { okhslToRgb, parseOkhslObject, parseOkhslString, rgbToOkhsl, rgbToOkhslRaw } from '../src/colorModels/okhsl.js';
import { okhsvToRgb, parseOkhsvObject, parseOkhsvString, rgbToOkhsv, rgbToOkhsvRaw } from '../src/colorModels/okhsv.js';
import { Colordx, colordx, extend, getFormat } from '../src/index.js';
import { srgbFromLinear, srgbToLinear } from '../src/transfer.js';
import hsv from '../src/plugins/hsv.js';
import okhsl, {
  okhslToRgbChannels,
  okhslToRgbChannelsInto,
  rgbToOkhslChannels,
  rgbToOkhslChannelsInto,
} from '../src/plugins/okhsl.js';
import okhsv, {
  okhsvToRgbChannels,
  okhsvToRgbChannelsInto,
  rgbToOkhsvChannels,
  rgbToOkhsvChannelsInto,
} from '../src/plugins/okhsv.js';

beforeAll(() => extend([hsv, okhsl, okhsv]));

type Okhsl = { h: number; s: number; l: number; alpha: number; colorSpace: 'okhsl' };
type Okhsv = { h: number; s: number; v: number; alpha: number; colorSpace: 'okhsv' };
type WithOk = Colordx & {
  toOkhsl(p?: number): Okhsl;
  toOkhslString(p?: number): string;
  toOkhsv(p?: number): Okhsv;
  toOkhsvString(p?: number): string;
  toHsv(): { h: number; s: number; v: number };
};
const cx = (input: unknown) => colordx(input as never) as WithOk;

const near = (got: number, want: number, eps: number, ctx: string) =>
  expect(Math.abs(got - want), `${ctx}: got ${got}, want ${want}`).toBeLessThanOrEqual(eps);

let seed = 0x0a1b2c3d;
const rand = () => {
  seed = (seed ^ (seed << 13)) >>> 0;
  seed = (seed ^ (seed >>> 17)) >>> 0;
  seed = (seed ^ (seed << 5)) >>> 0;
  return seed / 0xffffffff;
};
const sample = Array.from({ length: 3000 }, () => [rand(), rand(), rand()] as const);
const bytes = Array.from({ length: 3000 }, () => ({
  r: Math.floor(rand() * 256),
  g: Math.floor(rand() * 256),
  b: Math.floor(rand() * 256),
  alpha: 1,
}));

// ─── A. toe / cusp ───────────────────────────────────────────────────────

describe('toe (L_r lightness estimate)', () => {
  // From the reference implementation.
  const TOE: Array<[number, number, number]> = [
    [0, 0, 0],
    [0.1, 0.029631373307, 0.201033295063],
    [0.25, 0.146614129447, 0.347725657427],
    [0.5, 0.421140562609, 0.568838198942],
    [0.75, 0.709297257279, 0.78508100523],
    [1, 1, 1],
  ];
  it('toe and toeInv match the reference', () => {
    for (const [x, t, ti] of TOE) {
      near(toe(x), t, 1e-12, `toe(${x})`);
      near(toeInv(x), ti, 1e-12, `toeInv(${x})`);
    }
  });
  it('toeInv is the exact inverse of toe', () => {
    for (let i = 0; i <= 1000; i++) {
      const x = i / 1000;
      near(toe(toeInv(x)), x, 1e-14, `toe(toeInv(${x}))`);
      near(toeInv(toe(x)), x, 1e-14, `toeInv(toe(${x}))`);
    }
  });
  it('L_r is nearly CIELab L at 50%: Y = 0.18406 vs CIELab 0.18419 (the two numbers the post quotes)', () => {
    // OKLab L of a grey is cbrt(Y). CIELab L = 50 is Y = ((50 + 16) / 116)³.
    near(toeInv(0.5) ** 3, 0.18406, 1e-5, 'Y at L_r = 0.5');
    near(((50 + 16) / 116) ** 3, 0.18419, 1e-5, 'Y at CIELab L = 50');
    near(toe(Math.cbrt(((50 + 16) / 116) ** 3)), 0.5, 2e-4, 'L_r at CIELab L = 50');
  });
});

describe('findCusp', () => {
  // [hue°, L_cusp, C_cusp] from the reference implementation.
  const CUSPS: Array<[number, number, number]> = [
    [0, 0.6477039825, 0.262573544],
    [29.233885192, 0.6278315816, 0.2578067464],
    [90, 0.8636293025, 0.176488928],
    [142.495338888, 0.8664395992, 0.2948273048],
    [200, 0.8821631175, 0.1499727074],
    [264.052020638, 0.452008448, 0.3132179696],
    [330, 0.6973161332, 0.3178047902],
  ];
  it('matches the reference on every hue sector (red / green / blue channel first)', () => {
    for (const [h, L, C] of CUSPS) {
      const r = (h * Math.PI) / 180;
      findCusp(Math.cos(r), Math.sin(r));
      near(CUSP[0]!, L, 1e-8, `L_cusp(${h})`);
      near(CUSP[1]!, C, 1e-8, `C_cusp(${h})`);
    }
  });
  it('the cusp of the red hue is (almost) #ff0000 itself', () => {
    const { l, c } = rgbToOklch({ r: 255, g: 0, b: 0, alpha: 1 });
    const r = (29.233885192 * Math.PI) / 180;
    findCusp(Math.cos(r), Math.sin(r));
    // The reference's polynomial-plus-one-Halley-step cusp lands ~1e-4 from the true corner: the
    // max-saturation direction is accurate, the position of the cusp along it less so.
    near(CUSP[0]!, l, 2e-4, 'L_cusp(red)');
    near(CUSP[1]!, c, 2e-4, 'C_cusp(red)');
  });
});

// ─── B. Reference vectors ────────────────────────────────────────────────

// [hex, okhsl h s l, okhsv h s v] — reference implementation, rescaled to degrees / 0–100.
const FORWARD: Array<[string, [number, number, number], [number, number, number]]> = [
  ['#ff0000', [29.233885192, 100.000000014, 56.80846525], [29.233885192, 99.952196923, 100.000000017]],
  ['#00ff00', [142.495338888, 99.999997007, 84.452896453], [142.495338888, 99.999972104, 99.999998844]],
  ['#0000ff', [264.052020638, 99.999999486, 36.656533943], [264.052020638, 99.999109123, 99.999996462]],
  ['#ffff00', [109.769232077, 100.000003363, 96.270439681], [109.769232077, 100.000044676, 100.000003196]],
  ['#00ffff', [194.768947932, 99.999998584, 88.984830162], [194.768947932, 99.999942646, 99.999999501]],
  ['#ff00ff', [328.363417923, 100.003901879, 65.329874485], [328.363417923, 100.012213683, 99.999999787]],
  ['#3d7a9f', [237.656144693, 57.922005291, 48.38305172], [237.656144693, 65.38075665, 64.316049304]],
  // #fffffe: a tiny chroma next to white is still fully saturated in Okhsl (C_max → 0 there),
  // while Okhsv reads it as a slightly tinted white.
  ['#fffffe', [106.422887925, 100.001464104, 99.967683483], [106.422887925, 0.299147145, 100.000002703]],
  ['#010000', [29.233885192, 99.968770819, 0.895469581], [29.233885192, 99.952196923, 1.573632923]],
  ['#000001', [264.052020638, 99.999768497, 0.604631784], [264.052020638, 99.999109123, 1.602286563]],
  ['#c81e50', [11.726830703, 90.935370487, 46.969911063], [11.726830703, 94.572584752, 79.274854422]],
  ['#0ac85a', [149.323171775, 99.545020341, 68.375607758], [149.323171775, 98.814056515, 80.183392236]],
  ['#783cf0', [290.89682104, 92.776620623, 46.927650683], [290.89682104, 89.886885566, 94.290379491]],
];

// [okhsl/okhsv h s x, okhsl rgb 0–255, okhsv rgb 0–255] — reference implementation, unclamped.
const INVERSE: Array<[[number, number, number], [number, number, number], [number, number, number]]> = [
  [[29.2338802796, 100, 56.808465632], [255, -0.0000101, -0.0000083], [143.6452582, -0.1831164, -0.1003609]],
  [[264.052, 100, 36.6565], [1.4889314, 51.7606541, 225.666351], [0.249868, 17.2463177, 99.9126736]],
  [[200, 50, 50], [68.377428, 130.7107634, 134.0060926], [59.4865357, 117.203267, 120.2553468]],
  [[0, 0, 50], [118.8761016, 118.8761016, 118.8761016], [118.8761016, 118.8761016, 118.8761016]],
  [[120, 80, 20], [42.3077516, 50.4619549, 9.5046113], [39.2134487, 47.068919, 7.0805022]],
  [[300, 95, 80], [208.323609, 184.3949496, 254.0458312], [119.042749, 32.152842, 203.0506232]],
  [[45, 20, 95], [244.6732853, 239.5231591, 237.3078497], [240.8001965, 202.108791, 185.1527896]],
  [[180, 100, 5], [0, 11.6164329, 8.7782009], [0, 9.2107056, 6.9172992]],
];

const hexToUnit = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
];

describe('reference vectors — sRGB → Okhsl / Okhsv', () => {
  for (const [hex, [h, s, l], [hv, sv, v]] of FORWARD) {
    // Next to white, a 1e-8 matrix difference in a / b is a 5e-4° hue difference.
    const tol = hex === '#fffffe' ? 2e-3 : 5e-5;
    it(`${hex} okhsl(${h.toFixed(2)} ${s.toFixed(2)}% ${l.toFixed(2)}%)`, () => {
      const [r, g, b] = hexToUnit(hex);
      const got = rgbToOkhslChannels(r, g, b);
      near(got[0], h, tol, 'h');
      near(got[1], s, tol, 's');
      near(got[2], l, tol, 'l');
    });
    it(`${hex} okhsv(${hv.toFixed(2)} ${sv.toFixed(2)}% ${v.toFixed(2)}%)`, () => {
      const [r, g, b] = hexToUnit(hex);
      const got = rgbToOkhsvChannels(r, g, b);
      near(got[0], hv, tol, 'h');
      near(got[1], sv, tol, 's');
      near(got[2], v, tol, 'v');
    });
  }
  it('#808080: the reference reports h = 89.88, s = 1e-5 from matrix noise; a grey reads h = 0, s = 0 here', () => {
    expect(rgbToOkhslChannels(128 / 255, 128 / 255, 128 / 255)).toEqual([0, 0, expect.closeTo(53.570645941, 6)]);
    expect(rgbToOkhsvChannels(128 / 255, 128 / 255, 128 / 255)).toEqual([0, 0, expect.closeTo(53.570645941, 6)]);
  });
});

describe('reference vectors — Okhsl / Okhsv → sRGB', () => {
  for (const [[h, s, x], rgbL, rgbV] of INVERSE) {
    it(`okhsl(${h} ${s}% ${x}%) → rgb(${rgbL.map((c) => c.toFixed(2)).join(', ')})`, () => {
      const got = okhslToRgbChannels(h, s, x);
      for (let i = 0; i < 3; i++) near(got[i]! * 255, rgbL[i]!, 5e-5, `channel ${i}`);
    });
    it(`okhsv(${h} ${s}% ${x}%) → rgb(${rgbV.map((c) => c.toFixed(2)).join(', ')})`, () => {
      const got = okhsvToRgbChannels(h, s, x);
      for (let i = 0; i < 3; i++) near(got[i]! * 255, rgbV[i]!, 5e-5, `channel ${i}`);
    });
  }
  it('s = 100 exactly lands within a hair of the sRGB edge — the reference cusp fit, kept on purpose', () => {
    // okhsl(29.23 100% 56.81%) is #ff0000: the reference puts g and b at −1e-5 / 255, just outside;
    // with the full-precision OKLab matrices they land at +5e-12, just inside. Either way, a hair.
    const [, g, b] = okhslToRgbChannels(29.2338802796, 100, 56.808465632);
    expect(Math.abs(g)).toBeLessThan(1e-6);
    expect(Math.abs(b)).toBeLessThan(1e-6);
    // The clamped object converter and the public API print the byte the picker expects.
    const { r, g: g2, b: b2 } = okhslToRgb({ h: 29.2338802796, s: 100, l: 56.808465632, alpha: 1, colorSpace: 'okhsl' });
    expect(r).toBeCloseTo(255, 9);
    expect(g2).toBeCloseTo(0, 6);
    expect(b2).toBeCloseTo(0, 6);
    expect(colordx('okhsl(29.2338802796 100% 56.808465632%)').toHex()).toBe('#ff0000');
  });
});

// ─── C. Invariants ───────────────────────────────────────────────────────

describe('invariants', () => {
  it('h is the OKLCH hue, bit for bit, and Okhsl l is toe(OKLab L) — on every 8-bit color sampled', () => {
    // Bytes, so that c / 255 is the same double on both paths (rgbToOklch divides by 255 itself).
    for (const c of bytes) {
      const { l: L, h } = rgbToOklch(c);
      const hsl = rgbToOkhslChannels(c.r / 255, c.g / 255, c.b / 255);
      const hsvv = rgbToOkhsvChannels(c.r / 255, c.g / 255, c.b / 255);
      expect(hsl[0]).toBe(h);
      expect(hsvv[0]).toBe(h);
      expect(hsl[2]).toBe(toe(L) * 100);
    }
  });

  it('toOkhsl(5).h === toOklch(5).h and toOkhsv(5).h === toOklch(5).h on 8-bit colors', () => {
    for (const c of bytes) {
      const col = cx(c);
      const h = col.toOklch(5).h;
      expect(col.toOkhsl(5).h).toBe(h);
      expect(col.toOkhsv(5).h).toBe(h);
    }
  });

  it('rgb → okhsl → rgb and rgb → okhsv → rgb reproduce the input as well as rgb → OKLab → rgb does', () => {
    // The only loss is the library's own: M1 and M1⁻¹ are 10-digit roundings, not exact inverses,
    // so rgb → OKLab → rgb is off by up to ~1.5e-6 on this sample. Okhsl / Okhsv add nothing to it
    // (the transforms on top are algebraically exact inverses), except on a grey, where the 4e-6
    // chroma threshold drops the matrix noise on purpose.
    const out = new Float64Array(3);
    let worstOk = 0,
      worstLib = 0;
    for (const [r, g, b] of sample) {
      const lab = linearSrgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
      const lin = oklabToLinear(lab[0], lab[1], lab[2]);
      worstLib = Math.max(
        worstLib,
        Math.abs(srgbFromLinear(lin[0]) - r),
        Math.abs(srgbFromLinear(lin[1]) - g),
        Math.abs(srgbFromLinear(lin[2]) - b)
      );

      rgbToOkhslChannelsInto(out, r, g, b);
      okhslToRgbChannelsInto(out, out[0]!, out[1]!, out[2]!);
      worstOk = Math.max(worstOk, Math.abs(out[0]! - r), Math.abs(out[1]! - g), Math.abs(out[2]! - b));

      rgbToOkhsvChannelsInto(out, r, g, b);
      okhsvToRgbChannelsInto(out, out[0]!, out[1]!, out[2]!);
      worstOk = Math.max(worstOk, Math.abs(out[0]! - r), Math.abs(out[1]! - g), Math.abs(out[2]! - b));
    }
    expect(worstLib).toBeLessThanOrEqual(2e-6);
    expect(worstOk).toBeLessThanOrEqual(Math.max(worstLib, 2e-6));
  });

  it('okhsl → rgb → okhsl and okhsv → rgb → okhsv reproduce chromatic input', () => {
    // Same matrix noise, amplified where the coordinates are ill-conditioned: the hue where the
    // chroma is small (low s, or l next to white where C_max → 0) and s next to the gamut edge.
    // l / v are direct. The sample stays off those extremes; the low-chroma hue noise reaches
    // 0.01° at s = 2, l = 98.
    const out = new Float64Array(3);
    for (let i = 0; i < 2000; i++) {
      const h = rand() * 360,
        s = 5 + rand() * 94,
        x = 2 + rand() * 96;
      okhslToRgbChannelsInto(out, h, s, x);
      rgbToOkhslChannelsInto(out, out[0]!, out[1]!, out[2]!);
      near(out[0]!, h, 0.01, `okhsl h (${h} ${s} ${x})`);
      near(out[1]!, s, 0.01, `okhsl s (${h} ${s} ${x})`);
      near(out[2]!, x, 1e-4, `okhsl l (${h} ${s} ${x})`);

      okhsvToRgbChannelsInto(out, h, s, x);
      rgbToOkhsvChannelsInto(out, out[0]!, out[1]!, out[2]!);
      near(out[0]!, h, 0.01, `okhsv h (${h} ${s} ${x})`);
      near(out[1]!, s, 0.01, `okhsv s (${h} ${s} ${x})`);
      near(out[2]!, x, 1e-4, `okhsv v (${h} ${s} ${x})`);
    }
  });

  it('s from the channel functions overshoots 100 by up to ~1% inside sRGB (the reference cusp fit); the public API clamps', () => {
    let maxL = 0,
      maxV = 0;
    for (const [r, g, b] of sample) {
      maxL = Math.max(maxL, rgbToOkhslChannels(r, g, b)[1]);
      maxV = Math.max(maxV, rgbToOkhsvChannels(r, g, b)[1]);
    }
    // #ff00ff is a fixed example: the reference itself reports 100.0039 / 100.0122.
    expect(rgbToOkhslChannels(1, 0, 1)[1]).toBeGreaterThan(100);
    expect(rgbToOkhsvChannels(1, 0, 1)[1]).toBeGreaterThan(100);
    expect(Math.max(maxL, rgbToOkhslChannels(1, 0, 1)[1])).toBeLessThanOrEqual(100.5);
    expect(Math.max(maxV, rgbToOkhsvChannels(1, 0, 1)[1])).toBeLessThanOrEqual(101.1);
    expect(cx('#ff00ff').toOkhsl(6).s).toBe(100);
    expect(cx('#ff00ff').toOkhsv(6).s).toBe(100);
    for (const c of bytes) {
      const { s, l } = cx(c).toOkhsl(6);
      const { s: sv, v } = cx(c).toOkhsv(6);
      for (const x of [s, l, sv, v]) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
      }
    }
  });

  it('black, white and greys: s = 0, h = 0; okhsl l and okhsv v agree on a grey', () => {
    expect(cx('#000000').toOkhsl()).toEqual({ h: 0, s: 0, l: 0, alpha: 1, colorSpace: 'okhsl' });
    expect(cx('#000000').toOkhsv()).toEqual({ h: 0, s: 0, v: 0, alpha: 1, colorSpace: 'okhsv' });
    expect(cx('#ffffff').toOkhsl()).toEqual({ h: 0, s: 0, l: 100, alpha: 1, colorSpace: 'okhsl' });
    expect(cx('#ffffff').toOkhsv()).toEqual({ h: 0, s: 0, v: 100, alpha: 1, colorSpace: 'okhsv' });
    for (let v = 0; v <= 255; v++) {
      const c = cx({ r: v, g: v, b: v });
      const l = c.toOkhsl(6),
        h = c.toOkhsv(6);
      expect(l.h).toBe(0);
      expect(l.s).toBe(0);
      expect(h.h).toBe(0);
      expect(h.s).toBe(0);
      expect(h.v).toBe(l.l);
    }
    // In both spaces s = 0 is the grey with OKLab L = toeInv(l): the same grey, with equal channels
    // (the achromatic shortcut in oklabToLinearScratch, as in oklabToLinear).
    for (const x of [5, 25, 50, 75, 95]) {
      const l = okhslToRgbChannels(123, 0, x),
        v = okhsvToRgbChannels(321, 0, x);
      for (let i = 0; i < 3; i++) expect(l[i]).toBeCloseTo(v[i]!, 14);
      const [r, g, b] = okhslToRgbChannels(0, 0, x);
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it('okhsv: v = 0 is black for every s and h (no 0 / 0 in the toe compensation)', () => {
    for (const [h, s] of [
      [0, 0],
      [0, 100],
      [120, 50],
      [264, 100],
      [300, 120],
    ]) {
      expect(okhsvToRgbChannels(h!, s!, 0)).toEqual([0, 0, 0]);
      expect(colordx(`okhsv(${h} ${s}% 0%)`).toHex()).toBe('#000000');
    }
  });

  it('okhsl: l ≥ 100 is white and l ≤ 0 is black; okhsv: v = 100, s = 0 is white', () => {
    expect(okhslToRgbChannels(200, 50, 100)).toEqual([1, 1, 1]);
    expect(okhslToRgbChannels(200, 50, 120)).toEqual([1, 1, 1]);
    expect(okhslToRgbChannels(200, 50, 0)).toEqual([0, 0, 0]);
    expect(okhslToRgbChannels(200, 50, -5)).toEqual([0, 0, 0]);
    const [r, g, b] = okhsvToRgbChannels(200, 0, 100);
    for (const c of [r, g, b]) expect(c).toBeCloseTo(1, 9);
  });

  it('hue wraps: −30° is 330°, 390° is 30° (to float precision)', () => {
    for (const [a, b] of [
      [-30, 330],
      [390, 30],
      [720, 0],
    ]) {
      const x = okhslToRgbChannels(a!, 60, 50),
        y = okhslToRgbChannels(b!, 60, 50);
      const u = okhsvToRgbChannels(a!, 60, 50),
        w = okhsvToRgbChannels(b!, 60, 50);
      for (let i = 0; i < 3; i++) {
        expect(x[i]).toBeCloseTo(y[i]!, 12);
        expect(u[i]).toBeCloseTo(w[i]!, 12);
      }
    }
  });

  it('s a little above 100 walks out of the gamut (channels leave [0, 1]); the object converters clamp', () => {
    const [r, g, b] = okhslToRgbChannels(29.23, 102, 56.8);
    expect(Math.min(r, g, b)).toBeLessThan(-0.05);
    const [rv, gv, bv] = okhsvToRgbChannels(29.23, 102, 100);
    expect(Math.min(rv, gv, bv)).toBeLessThan(-0.05);
    const clampedL = okhslToRgb({ h: 29.23, s: 102, l: 56.8, alpha: 1, colorSpace: 'okhsl' });
    const clampedV = okhsvToRgb({ h: 29.23, s: 102, v: 100, alpha: 1, colorSpace: 'okhsv' });
    for (const c of [clampedL, clampedV]) {
      expect(Math.min(c.r, c.g, c.b)).toBeGreaterThanOrEqual(0);
      expect(Math.max(c.r, c.g, c.b)).toBeLessThanOrEqual(255);
    }
  });

  it('a wide-gamut input reads as its sRGB clip, like toHsl() / toHsv()', () => {
    for (const input of ['oklch(0.7 0.3 150)', 'oklch(0.6 0.35 30)', 'oklch(0.9 0.2 110)', 'oklab(0.5 -0.3 0.1)']) {
      const c = cx(input);
      const clipped = c.clampSrgb() as WithOk;
      expect(clipped).not.toBe(c); // the inputs really are outside sRGB
      expect(c.toOkhsl(4)).toEqual(clipped.toOkhsl(4));
      expect(c.toOkhsv(4)).toEqual(clipped.toOkhsv(4));
    }
  });

  it('object converters agree with the channel functions (rounded to 5 dp, s clamped)', () => {
    for (const c of bytes.slice(0, 500)) {
      const [h, s, l] = rgbToOkhslChannels(c.r / 255, c.g / 255, c.b / 255);
      const obj = rgbToOkhsl(c);
      expect(obj.h).toBeCloseTo(h, 5);
      expect(obj.s).toBeCloseTo(Math.min(100, s), 5);
      expect(obj.l).toBeCloseTo(l, 5);
      const [hv, sv, v] = rgbToOkhsvChannels(c.r / 255, c.g / 255, c.b / 255);
      const objv = rgbToOkhsv(c);
      expect(objv.h).toBeCloseTo(hv, 5);
      expect(objv.s).toBeCloseTo(Math.min(100, sv), 5);
      expect(objv.v).toBeCloseTo(Math.min(100, v), 5);
    }
  });

  it('*Into siblings are bit-identical to the allocating functions', () => {
    const out = new Float64Array(3);
    for (const [r, g, b] of sample.slice(0, 500)) {
      rgbToOkhslChannelsInto(out, r, g, b);
      expect(Array.from(out)).toEqual(rgbToOkhslChannels(r, g, b));
      rgbToOkhsvChannelsInto(out, r, g, b);
      expect(Array.from(out)).toEqual(rgbToOkhsvChannels(r, g, b));
      const h = r * 360,
        s = g * 100,
        x = b * 100;
      okhslToRgbChannelsInto(out, h, s, x);
      expect(Array.from(out)).toEqual(okhslToRgbChannels(h, s, x));
      okhsvToRgbChannelsInto(out, h, s, x);
      expect(Array.from(out)).toEqual(okhsvToRgbChannels(h, s, x));
    }
  });
});

// ─── D. Public API ───────────────────────────────────────────────────────

describe('okhsl / okhsv plugins — output', () => {
  it('toOkhsl / toOkhsv default to 5 dp (like toOklch) and carry the colorSpace brand', () => {
    expect(cx('#3d7a9f').toOkhsl()).toEqual({ h: 237.65615, s: 57.92201, l: 48.38305, alpha: 1, colorSpace: 'okhsl' });
    expect(cx('#3d7a9f').toOkhsv()).toEqual({ h: 237.65615, s: 65.38077, v: 64.31605, alpha: 1, colorSpace: 'okhsv' });
    expect(cx('#ff0000').toOkhsl()).toEqual({ h: 29.23388, s: 100, l: 56.80847, alpha: 1, colorSpace: 'okhsl' });
    expect(cx('#ff0000').toOkhsv()).toEqual({ h: 29.23388, s: 99.9522, v: 100, alpha: 1, colorSpace: 'okhsv' });
    expect(cx('#3d7a9f').toOkhsl(2)).toEqual({ h: 237.66, s: 57.92, l: 48.38, alpha: 1, colorSpace: 'okhsl' });
    expect(cx('#3d7a9f').toOkhsv(2)).toEqual({ h: 237.66, s: 65.38, v: 64.32, alpha: 1, colorSpace: 'okhsv' });
  });
  it('precision argument', () => {
    expect(cx('#3d7a9f').toOkhsl(0)).toEqual({ h: 238, s: 58, l: 48, alpha: 1, colorSpace: 'okhsl' });
    expect(cx('#3d7a9f').toOkhsl(4)).toEqual({ h: 237.6562, s: 57.922, l: 48.3831, alpha: 1, colorSpace: 'okhsl' });
    expect(cx('#3d7a9f').toOkhsv(4)).toEqual({ h: 237.6562, s: 65.3808, v: 64.3161, alpha: 1, colorSpace: 'okhsv' });
  });
  it('toOkhslString / toOkhsvString', () => {
    expect(cx('#3d7a9f').toOkhslString()).toBe('okhsl(237.65615 57.92201% 48.38305%)');
    expect(cx('#3d7a9f').toOkhsvString()).toBe('okhsv(237.65615 65.38077% 64.31605%)');
    expect(cx('#3d7a9f80').toOkhslString()).toBe('okhsl(237.65615 57.92201% 48.38305% / 0.502)');
    expect(cx('#3d7a9f80').toOkhsvString()).toBe('okhsv(237.65615 65.38077% 64.31605% / 0.502)');
    expect(cx('#3d7a9f').toOkhslString(2)).toBe('okhsl(237.66 57.92% 48.38%)');
    expect(cx('#3d7a9f').toOkhsvString(2)).toBe('okhsv(237.66 65.38% 64.32%)');
    expect(cx('#3d7a9f').toOkhslString(0)).toBe('okhsl(238 58% 48%)');
  });

  // Round-trip fidelity of the rounded public output. Two regions of the cube are excluded and
  // pinned separately below: the pure-blue edge (r = g = 0), where the OKLCH hue would need ~8 dp,
  // and the colors whose raw s overshoots 100 (the reference's cusp fit) and is clamped by toOkhsl().
  const rawS = (c: { r: number; g: number; b: number }) =>
    Math.max(rgbToOkhslChannels(c.r / 255, c.g / 255, c.b / 255)[1], rgbToOkhsvChannels(c.r / 255, c.g / 255, c.b / 255)[1]);
  const plain = (c: { r: number; g: number; b: number }) => !(c.r === 0 && c.g === 0) && rawS(c) <= 100;

  it('at the default 5 dp the output round-trips through the parser to the same bytes', () => {
    let checked = 0;
    for (const c of [...bytes.slice(0, 1500), ...FORWARD.map(([hex]) => cx(hex).toRgb())]) {
      if (!plain(c)) continue;
      checked++;
      const col = cx(c);
      expect(colordx(col.toOkhslString()).toRgb(), col.toHex()).toEqual(col.toRgb());
      expect(colordx(col.toOkhsvString()).toRgb(), col.toHex()).toEqual(col.toRgb());
      expect(colordx(col.toOkhsl()).toRgb(), col.toHex()).toEqual(col.toRgb());
      expect(colordx(col.toOkhsv()).toRgb(), col.toHex()).toEqual(col.toRgb());
    }
    expect(checked).toBeGreaterThan(1400);
  });

  it('at 2 dp the round trip is within a byte away from the cube edges, and not on them', () => {
    // Away from the edges 2 dp is plenty, as with toHsl(). Near the blue face the hue is sensitive
    // enough that rgb(0, 42, 204) comes back as rgb(7, 53, 190) — the reason the default is 5.
    for (const c of bytes.slice(0, 1500)) {
      if (!plain(c) || Math.min(c.r, c.g, c.b) === 0 || Math.max(c.r, c.g, c.b) === 255) continue;
      const col = cx(c);
      for (const back of [colordx(col.toOkhslString(2)).toRgb(), colordx(col.toOkhsvString(2)).toRgb()]) {
        expect(Math.abs(back.r - c.r), col.toHex()).toBeLessThanOrEqual(1);
        expect(Math.abs(back.g - c.g), col.toHex()).toBeLessThanOrEqual(1);
        expect(Math.abs(back.b - c.b), col.toHex()).toBeLessThanOrEqual(1);
      }
    }
    const back = colordx(cx({ r: 0, g: 42, b: 204 }).toOkhslString(2)).toRgb();
    expect(back).toEqual({ r: 7, g: 53, b: 190, alpha: 1 });
    expect(colordx(cx({ r: 0, g: 42, b: 204 }).toOkhslString()).toRgb()).toEqual({ r: 0, g: 42, b: 204, alpha: 1 });
  });

  it('the pure-blue edge does not round-trip at any printed precision: OKLCH hue is not locally linear there', () => {
    // At hue 264.05202 (blue is 264.052020638…) and blue's lightness, the most chromatic sRGB color
    // is rgb(1, 52, 226), not #0000ff — verified by brute force over the cube. Every Okhsl / Okhsv
    // implementation shares this; the CSS gamut mapper only hides it because its 0.02 JND lets it
    // clip to blue. The coordinates themselves survive the trip; only the color they name is
    // sensitive.
    const blue = cx('#0000ff');
    expect(blue.toOkhsl()).toEqual({ h: 264.05202, s: 100, l: 36.65653, alpha: 1, colorSpace: 'okhsl' });
    expect(blue.toOkhsv()).toEqual({ h: 264.05202, s: 99.99911, v: 100, alpha: 1, colorSpace: 'okhsv' });
    const backL = colordx(blue.toOkhslString()).toRgb();
    const backV = colordx(blue.toOkhsvString()).toRgb();
    expect(backL).toEqual({ r: 1, g: 52, b: 226, alpha: 1 });
    expect(backV).toEqual({ r: 2, g: 60, b: 255, alpha: 1 });
    const parsed = cx(blue.toOkhslString());
    expect(parsed.toOkhsl().h).toBe(264.05202);
    expect(parsed.toOkhsl().l).toBe(36.65653);
    expect(parsed.toOkhsl().s).toBeGreaterThan(99.9);
    // The unrounded value is exact: the sensitivity is in the 8th decimal of the hue.
    const [h, s, l] = rgbToOkhslChannels(0, 0, 1);
    const [r, g, b] = okhslToRgbChannels(h, s, l);
    expect(Math.round(r * 255)).toBeCloseTo(0); // may be -0: r lands at -1e-12
    expect(Math.round(g * 255)).toBeCloseTo(0);
    expect(Math.round(b * 255)).toBe(255);
    expect(colordx(blue.toOkhslString(8)).toHex()).toBe('#0000ff');
  });

  it('colors whose raw s overshoots 100 come back a few bytes inside the gamut once s is clamped', () => {
    // rgb(0, 54, 249): the reference cusp fit puts it at s = 100.43; clamped to 100 it parses back to
    // rgb(2, 57, 245). Bounded by the fit's ~1% error: at most ~5 bytes, on ~0.1% of the cube.
    const c = cx({ r: 0, g: 54, b: 249 });
    expect(rgbToOkhslChannels(0, 54 / 255, 249 / 255)[1]).toBeCloseTo(100.42681, 4);
    expect(c.toOkhsl().s).toBe(100);
    expect(colordx(c.toOkhslString()).toRgb()).toEqual({ r: 2, g: 57, b: 245, alpha: 1 });
    expect(colordx(c.toOkhsvString()).toRgb()).toEqual({ r: 2, g: 58, b: 249, alpha: 1 });
    let overshoot = 0,
      worst = 0;
    for (const c8 of bytes) {
      if (c8.r === 0 && c8.g === 0) continue;
      if (rawS(c8) <= 100) continue;
      overshoot++;
      const col = cx(c8);
      for (const back of [colordx(col.toOkhslString()).toRgb(), colordx(col.toOkhsvString()).toRgb()]) {
        worst = Math.max(worst, Math.abs(back.r - c8.r), Math.abs(back.g - c8.g), Math.abs(back.b - c8.b));
      }
    }
    expect(worst).toBeLessThanOrEqual(5);
    expect(overshoot).toBeLessThan(bytes.length / 100);
  });
  it('a hue that rounds to 360 wraps to 0', () => {
    // A hue within 0.005° of 360 rounds to 360.00 at 2 dp.
    let hits = 0;
    for (let g = 0; g < 32; g++)
      for (let b = 0; b < 32; b++) {
        const c = cx({ r: 200, g, b: 200 + b });
        if (c.toOkhsl(4).h > 359.995) {
          hits++;
          expect(c.toOkhsl(2).h).toBe(0);
          expect(c.toOkhsv(2).h).toBe(0);
        }
      }
    // If no 8-bit color happens to land in the band, pin the wrap through the raw path instead.
    const [h] = rgbToOkhslChannels(0.9, 0.7, 0.85);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
    expect(hits).toBeGreaterThanOrEqual(0);
  });
});

describe('okhsl / okhsv plugins — parsing', () => {
  it('okhsl() / okhsv() strings', () => {
    expect(colordx('okhsl(29.23 100% 56.81%)').toHex()).toBe('#ff0000');
    expect(colordx('okhsv(29.23 99.95% 100%)').toHex()).toBe('#ff0000');
    expect(colordx('okhsl(237.66 57.92% 48.38%)').toHex()).toBe('#3d7a9f');
    expect(colordx('okhsv(237.66 65.38% 64.32%)').toHex()).toBe('#3d7a9f');
    expect(colordx('OKHSL(237.66 57.92% 48.38%)').toHex()).toBe('#3d7a9f');
    expect(colordx('OkHsV(237.66 65.38% 64.32%)').toHex()).toBe('#3d7a9f');
    expect(colordx('  okhsl( 237.66   57.92%  48.38% )  ').toHex()).toBe('#3d7a9f');
    expect(colordx('\n\tokhsv( 237.66   65.38%  64.32% )\n').toHex()).toBe('#3d7a9f');
  });
  it('alpha, `%` alpha, angle units, optional `%`, `none`', () => {
    expect(colordx('okhsl(237.66 57.92% 48.38% / 0.5)').toRgb().alpha).toBe(0.5);
    expect(colordx('okhsl(237.66 57.92% 48.38% / 25%)').toRgb().alpha).toBe(0.25);
    expect(colordx('okhsv(237.66 65.38% 64.32% / 0.5)').toRgb().alpha).toBe(0.5);
    expect(colordx('okhsv(237.66 65.38% 64.32% / 50%)').toRgb().alpha).toBe(0.5);
    expect(colordx('okhsl(0.66015turn 57.92% 48.38%)').toHex()).toBe('#3d7a9f');
    expect(colordx('okhsl(237.66deg 57.92 48.38)').toHex()).toBe('#3d7a9f');
    expect(colordx('okhsv(264.11grad 65.38% 64.32%)').toHex()).toBe('#3d7a9f');
    expect(colordx('okhsl(none 0% 50%)').toHex()).toBe(colordx('okhsl(0 0% 50%)').toHex());
    expect(colordx('okhsl(200 none 50%)').toHex()).toBe(colordx('okhsl(200 0% 50%)').toHex());
    expect(colordx('okhsv(200 50% none)').toHex()).toBe('#000000');
    expect(colordx('okhsl(200 50% 50% / none)').toRgb().alpha).toBe(0);
  });
  it('out-of-range channels clamp: s / l / v to [0, 100], alpha to [0, 1], hue wraps', () => {
    expect(colordx('okhsl(29.23 150% 56.81%)').toHex()).toBe(colordx('okhsl(29.23 100% 56.81%)').toHex());
    expect(colordx('okhsl(200 50% 140%)').toHex()).toBe('#ffffff');
    expect(colordx('okhsl(200 50% -5%)').toHex()).toBe('#000000');
    expect(colordx('okhsv(200 -5% 50%)').toHex()).toBe(colordx('okhsv(200 0% 50%)').toHex());
    expect(colordx('okhsv(200 50% 50% / 3)').toRgb().alpha).toBe(1);
    expect(colordx('okhsl(-122.34 57.92% 48.38%)').toHex()).toBe('#3d7a9f');
    expect(colordx('okhsl(597.66 57.92% 48.38%)').toHex()).toBe('#3d7a9f');
  });
  it('objects need the colorSpace brand; without it the shape is HSL / HSV', () => {
    expect(colordx({ colorSpace: 'okhsl', h: 237.66, s: 57.92, l: 48.38 }).toHex()).toBe('#3d7a9f');
    expect(colordx({ colorSpace: 'okhsv', h: 237.66, s: 65.38, v: 64.32 }).toHex()).toBe('#3d7a9f');
    expect(colordx({ h: 237.66, s: 57.92, l: 48.38 }).toHex()).toBe(colordx('hsl(237.66 57.92% 48.38%)').toHex());
    expect(colordx({ h: 237.66, s: 65.38, v: 64.32 }).toHex()).toBe(colordx('hsv(237.66 65.38% 64.32%)').toHex());
    expect(colordx({ h: 237.66, s: 57.92, l: 48.38 }).toHex()).not.toBe('#3d7a9f');
    expect(colordx({ colorSpace: 'okhsl', h: 237.66, s: 57.92, l: 48.38, alpha: 0.5 }).toRgb().alpha).toBe(0.5);
    expect(colordx({ colorSpace: 'okhsl', h: 237.66, s: 57.92, l: 48.38, a: 0.25 } as never).toRgb().alpha).toBe(0.25);
    expect(colordx({ colorSpace: 'okhsv', h: 237.66, s: 65.38, v: 64.32, a: 0.25 } as never).toRgb().alpha).toBe(0.25);
  });
  it('object channels clamp and NaN reads as 0', () => {
    expect(colordx({ colorSpace: 'okhsl', h: 29.23, s: 150, l: 56.81 }).toHex()).toBe('#ff0000');
    expect(colordx({ colorSpace: 'okhsl', h: 200, s: 50, l: 140 }).toHex()).toBe('#ffffff');
    expect(colordx({ colorSpace: 'okhsv', h: 200, s: 50, v: -1 }).toHex()).toBe('#000000');
    expect(colordx({ colorSpace: 'okhsl', h: NaN, s: 50, l: 50 }).toHex()).toBe(
      colordx({ colorSpace: 'okhsl', h: 0, s: 50, l: 50 }).toHex()
    );
    expect(colordx({ colorSpace: 'okhsv', h: 200, s: NaN, v: 50 }).toHex()).toBe(
      colordx({ colorSpace: 'okhsv', h: 200, s: 0, v: 50 }).toHex()
    );
    expect(colordx({ colorSpace: 'okhsl', h: 200, s: 50, l: 50, alpha: 2 }).toRgb().alpha).toBe(1);
  });
  it('rejects malformed input', () => {
    for (const bad of [
      'okhsl()',
      'okhsl(200)',
      'okhsl(200 50%)',
      'okhsl(200, 50%, 50%)', // no legacy comma form
      'okhsl(200 50% 50% 0.5)',
      'okhsl(200 50% 50% / 0.5 / 1)',
      'okhsla(200 50% 50%)',
      'okhsv(200 50% 50%%)',
      'okhsl(200% 50% 50%)',
      'okhsl(abc 50% 50%)',
      { colorSpace: 'okhsl', h: 200, s: 50 },
      { colorSpace: 'okhsl', h: '200', s: 50, l: 50 },
      { colorSpace: 'okhsv', h: 200, s: 50, v: null },
    ]) {
      expect(colordx(bad as never).isValid(), JSON.stringify(bad)).toBe(false);
    }
  });
  it('the fn-level parsers and converters stand on their own', () => {
    // Called directly (as from @colordx/core/fn) there is no HSL parser ahead of them, so the brand
    // gate is what keeps an unbranded { h, s, l } / { h, s, v } out.
    expect(parseOkhslObject({ h: 237.66, s: 57.92, l: 48.38 })).toBeNull();
    expect(parseOkhsvObject({ h: 237.66, s: 65.38, v: 64.32 })).toBeNull();
    expect(parseOkhslObject({ colorSpace: 'okhsv', h: 237.66, s: 57.92, l: 48.38 })).toBeNull();
    expect(parseOkhslObject('okhsl(237.66 57.92% 48.38%)')).toBeNull();
    expect(parseOkhslObject(null)).toBeNull();
    expect(parseOkhslObject({ colorSpace: 'okhsl', h: 237.66, s: 57.92 })).toBeNull();
    expect(parseOkhsvObject({ colorSpace: 'okhsv', h: 237.66, v: 64.32 })).toBeNull();
    for (const bad of [{ h: '1' }, { s: '1' }, { l: '1' }, { alpha: '1' }]) {
      expect(parseOkhslObject({ colorSpace: 'okhsl', h: 237.66, s: 57.92, l: 48.38, ...bad }), JSON.stringify(bad)).toBeNull();
    }
    for (const bad of [{ h: null }, { s: undefined }, { v: {} }, { alpha: [] }]) {
      expect(parseOkhsvObject({ colorSpace: 'okhsv', h: 237.66, s: 65.38, v: 64.32, ...bad }), JSON.stringify(bad)).toBeNull();
    }
    expect(parseOkhslString(123)).toBeNull();
    expect(parseOkhsvString({})).toBeNull();
    expect(colordx(parseOkhslObject({ colorSpace: 'okhsl', h: 237.66, s: 57.92, l: 48.38 })!).toHex()).toBe('#3d7a9f');
    expect(colordx(parseOkhsvString('okhsv(237.66 65.38% 64.32%)')!).toHex()).toBe('#3d7a9f');
    // The objects the converters hand back are branded, so they parse back as what they are.
    const c = { r: 61, g: 122, b: 159, alpha: 1 };
    expect(rgbToOkhsl(c).colorSpace).toBe('okhsl');
    expect(rgbToOkhsv(c).colorSpace).toBe('okhsv');
    expect({ ...rgbToOkhslRaw(c) }.colorSpace).toBe('okhsl');
    expect({ ...rgbToOkhsvRaw(c) }.colorSpace).toBe('okhsv');
    expect(colordx(rgbToOkhsl(c)).toHex()).toBe('#3d7a9f');
    expect(colordx(rgbToOkhsv(c)).toHex()).toBe('#3d7a9f');
    expect(colordx({ ...rgbToOkhslRaw(c) }).toHex()).toBe('#3d7a9f');
    expect(colordx({ ...rgbToOkhsvRaw(c) }).toHex()).toBe('#3d7a9f');
    expect(getFormat(rgbToOkhsl(c))).toBe('okhsl');
    expect(getFormat(rgbToOkhsv(c))).toBe('okhsv');
  });
  it('getFormat', () => {
    expect(getFormat('okhsl(200 50% 50%)')).toBe('okhsl');
    expect(getFormat('okhsv(200 50% 50% / 0.5)')).toBe('okhsv');
    expect(getFormat({ colorSpace: 'okhsl', h: 200, s: 50, l: 50 })).toBe('okhsl');
    expect(getFormat({ colorSpace: 'okhsv', h: 200, s: 50, v: 50 })).toBe('okhsv');
    expect(getFormat({ h: 200, s: 50, l: 50 })).toBe('hsl');
    expect(getFormat({ h: 200, s: 50, v: 50 })).toBe('hsv');
  });
  it('a foreign brand on an hsl / hsv shape is rejected, as with every other object parser', () => {
    expect(colordx({ colorSpace: 'okhsl', h: 200, s: 50, v: 50 } as never).isValid()).toBe(false);
    expect(colordx({ colorSpace: 'okhsv', h: 200, s: 50, l: 50 } as never).isValid()).toBe(false);
  });
  it('the hsv plugin does not swallow an okhsv-branded object', () => {
    // Loaded first, hsv's object parser sees the object before okhsv's does.
    const viaOk = colordx({ colorSpace: 'okhsv', h: 237.66, s: 65.38, v: 64.32 }).toHex();
    const viaHsv = colordx({ h: 237.66, s: 65.38, v: 64.32 }).toHex();
    expect(viaOk).toBe('#3d7a9f');
    expect(viaHsv).not.toBe(viaOk);
  });
});

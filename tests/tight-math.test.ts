/**
 * Tight-tolerance math tests. The rest of the suite compares at ±0.5–1 byte, which let matrix and
 * white-point errors of ~1e-4 through (0137cf7, 9dabb0c, 07339e0). Here every quantity the math
 * defines exactly is checked at the float64 noise floor, against values derived independently in
 * this file from the CSS Color 4 definitions (primaries' xy chromaticities, white-point xy, the
 * Bradford cone matrix, the OKLab LMS matrices, the transfer-curve formulas, the gamut-mapping
 * pseudocode). Where float limits or the spec itself stop a tolerance from tightening, the
 * measured worst case is noted next to the bound.
 *
 * Tolerances are in the unit named; "byte units" means the stored gamma-encoded ×255 channel.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { linearA98ToSrgb, oklabToLinearA98, srgbLinearToA98Linear } from '../src/colorModels/a98rgb.js';
import { rgbToLabD65 } from '../src/colorModels/lab.js';
import { toe, toeInv } from '../src/colorModels/okgamut.js';
import { okhslToRgbChannels, rgbToOkhslChannels } from '../src/colorModels/okhsl.js';
import { okhsvToRgbChannels, rgbToOkhsvChannels } from '../src/colorModels/okhsv.js';
import * as ok from '../src/colorModels/oklab.js';
import { linearP3ToSrgb, oklabToLinearP3, srgbLinearToP3Linear } from '../src/colorModels/p3.js';
import {
  linearProphotoToSrgb,
  oklabToLinearProphoto,
  srgbLinearToProphotoLinear,
} from '../src/colorModels/prophoto.js';
import { linearRec2020ToSrgb, oklabToLinearRec2020, srgbLinearToRec2020Linear } from '../src/colorModels/rec2020.js';
import {
  D50_WX,
  D50_WY,
  D50_WZ,
  parseXyzD65Object,
  rgbToXyz,
  rgbToXyzD65,
  xyzD50ToLinearSrgb,
} from '../src/colorModels/xyz.js';
import { toGamutCustom, toGamutSrgbRaw } from '../src/gamut.js';
import { Colordx, colordx, extend, labToRgbChannels, oklchToRgbChannels } from '../src/index.js';
import a98rgb from '../src/plugins/a98rgb.js';
import cmyk from '../src/plugins/cmyk.js';
import cvd from '../src/plugins/cvd.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import mix from '../src/plugins/mix.js';
import okhsl from '../src/plugins/okhsl.js';
import okhsv from '../src/plugins/okhsv.js';
import p3 from '../src/plugins/p3.js';
import prophoto from '../src/plugins/prophoto.js';
import rec2020 from '../src/plugins/rec2020.js';
import srgbLinear from '../src/plugins/srgb-linear.js';
import * as T from '../src/transfer.js';

beforeAll(() => {
  extend([a98rgb, cmyk, cvd, hsv, hwb, lab, lch, mix, okhsl, okhsv, p3, prophoto, rec2020, srgbLinear]);
});

// CI runs ~4× slower than a laptop (see 5a05a81); the dense string sweep takes ~0.3 s per method locally.
const HEAVY_TIMEOUT = 60_000;

// ── Linear algebra ──────────────────────────────────────────────────────────
type V3 = [number, number, number];
type M3 = [V3, V3, V3];
const mul = (A: M3, B: M3): M3 =>
  A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j]! + r[1] * B[1][j]! + r[2] * B[2][j]!)) as M3;
const mv = (M: M3, v: readonly number[]): V3 => M.map((r) => r[0] * v[0]! + r[1] * v[1]! + r[2] * v[2]!) as V3;
const inv = ([[a, b, c], [d, e, f], [g, h, i]]: M3): M3 => {
  const A = e * i - f * h,
    B = f * g - d * i,
    C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [C / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
};
const I3: M3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const maxDiff = (A: M3, B: M3): number => Math.max(...A.flatMap((r, i) => r.map((v, j) => Math.abs(v - B[i]![j]!))));
const maxAbs = (a: readonly number[], b: readonly number[]): number =>
  Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
/** Matrix of a linear map, read column by column off the unit basis vectors. */
const matrixOf = (f: (a: number, b: number, c: number) => readonly number[]): M3 => {
  const cols = [f(1, 0, 0), f(0, 1, 0), f(0, 0, 1)];
  return [0, 1, 2].map((i) => [cols[0]![i]!, cols[1]![i]!, cols[2]![i]!]) as M3;
};

// ── CSS Color 4 definitions, derived from first principles ──────────────────
type XY = readonly [number, number];
const xyToXYZ = ([x, y]: XY): V3 => [x / y, 1, (1 - x - y) / y];
/** RGB→XYZ from the primaries' chromaticities and the white point: scale each primary so R+G+B = white. */
const rgbToXyzMatrix = (primaries: readonly [XY, XY, XY], white: XY): M3 => {
  const P = [0, 1, 2].map((i) => primaries.map((p) => xyToXYZ(p)[i]!)) as M3;
  const S = mv(inv(P), xyToXYZ(white));
  return P.map((r) => r.map((v, j) => v * S[j]!)) as M3;
};
const D65: XY = [0.3127, 0.329];
const D50: XY = [0.3457, 0.3585];
const SRGB_XYZ = rgbToXyzMatrix(
  [
    [0.64, 0.33],
    [0.3, 0.6],
    [0.15, 0.06],
  ],
  D65
);
const P3_XYZ = rgbToXyzMatrix(
  [
    [0.68, 0.32],
    [0.265, 0.69],
    [0.15, 0.06],
  ],
  D65
);
const REC2020_XYZ = rgbToXyzMatrix(
  [
    [0.708, 0.292],
    [0.17, 0.797],
    [0.131, 0.046],
  ],
  D65
);
const A98_XYZ = rgbToXyzMatrix(
  [
    [0.64, 0.33],
    [0.21, 0.71],
    [0.15, 0.06],
  ],
  D65
);
const PROPHOTO_XYZ = rgbToXyzMatrix(
  [
    [0.734699, 0.265301],
    [0.159597, 0.840403],
    [0.036598, 0.000105],
  ],
  D50
);
// Bradford cone response matrix (CSS Color 4 §chromatic adaptation / Lindbloom).
const BRADFORD: M3 = [
  [0.8951, 0.2664, -0.1614],
  [-0.7502, 1.7135, 0.0367],
  [0.0389, -0.0685, 1.0296],
];
const adapt = (from: XY, to: XY): M3 => {
  const s = mv(BRADFORD, xyToXYZ(from)),
    d = mv(BRADFORD, xyToXYZ(to));
  const D: M3 = [
    [d[0] / s[0], 0, 0],
    [0, d[1] / s[1], 0],
    [0, 0, d[2] / s[2]],
  ];
  return mul(inv(BRADFORD), mul(D, BRADFORD));
};
const D65_TO_D50 = adapt(D65, D50);
// OKLab (Ottosson), as CSS Color 4 conversions.js prints it: XYZ(D65)→LMS and LMS'→OKLab.
const XYZ_TO_LMS: M3 = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const LMS_TO_OKLAB: M3 = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];

// Transfer curves, written straight from the CSS Color 4 formulas (sign(x)·f(|x|) extension).
const odd = (f: (a: number) => number) => (x: number) => (x < 0 ? -f(-x) : f(x));
const REF = {
  srgbToLin: odd((a) => (a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4)),
  srgbFromLin: odd((a) => (a > 0.0031308 ? 1.055 * a ** (1 / 2.4) - 0.055 : 12.92 * a)),
  a98ToLin: odd((a) => a ** (563 / 256)),
  a98FromLin: odd((a) => a ** (256 / 563)),
  ppToLin: odd((a) => (a <= 16 / 512 ? a / 16 : a ** 1.8)),
  ppFromLin: odd((a) => (a >= 1 / 512 ? a ** (1 / 1.8) : 16 * a)),
  r2020ToLin: odd((a) => a ** 2.4),
  r2020FromLin: odd((a) => a ** (1 / 2.4)),
};

// Reference pipeline: 8-bit sRGB → XYZ D65 → every space, none of it through library code.
const refLinear = (rgb: readonly number[]): V3 => rgb.map((c) => REF.srgbToLin(c / 255)) as V3;
const refXyz65 = (rgb: readonly number[]): V3 => mv(SRGB_XYZ, refLinear(rgb));
const refXyz50 = (rgb: readonly number[]): V3 => mv(D65_TO_D50, refXyz65(rgb));
const refRgbSpace =
  (M: M3, gam: (x: number) => number, d50 = false) =>
  (rgb: readonly number[]) =>
    mv(inv(M), d50 ? refXyz50(rgb) : refXyz65(rgb)).map(gam) as V3;
const refP3 = refRgbSpace(P3_XYZ, REF.srgbFromLin);
const refRec2020 = refRgbSpace(REC2020_XYZ, REF.r2020FromLin);
const refA98 = refRgbSpace(A98_XYZ, REF.a98FromLin);
const refProphoto = refRgbSpace(PROPHOTO_XYZ, REF.ppFromLin, true);
const refOklabFromXyz = (xyz: V3): V3 => mv(LMS_TO_OKLAB, mv(XYZ_TO_LMS, xyz).map(Math.cbrt));
const refOklab = (rgb: readonly number[]): V3 => refOklabFromXyz(refXyz65(rgb));
const EPS = 216 / 24389,
  KAPPA = 24389 / 27;
const labF = (t: number) => (t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
const refLab = (rgb: readonly number[]): V3 => {
  const W = xyToXYZ(D50);
  const [fx, fy, fz] = refXyz50(rgb).map((v, i) => labF(v / W[i]!));
  return [116 * fy! - 16, 500 * (fx! - fy!), 200 * (fy! - fz!)];
};

// Deterministic LCG, as in fuzz.test.ts.
const lcg = (seed: number) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
};

// Library-side matrices, read off the exported conversions.
const LIB = {
  srgbToXyz65: matrixOf((r, g, b) => {
    const { x, y, z } = rgbToXyzD65({ r: r * 255, g: g * 255, b: b * 255, alpha: 1 });
    return [x / 100, y / 100, z / 100];
  }),
  srgbToXyz50: matrixOf((r, g, b) => {
    const { x, y, z } = rgbToXyz({ r: r * 255, g: g * 255, b: b * 255, alpha: 1 });
    return [x / 100, y / 100, z / 100];
  }),
  xyz50ToSrgb: matrixOf((x, y, z) => xyzD50ToLinearSrgb(x * 100, y * 100, z * 100)),
  // xyzD65ToLinearSrgb is private; recover it through the parser by undoing the stored gamma.
  xyz65ToSrgb: matrixOf((x, y, z) => {
    const c = parseXyzD65Object({ x: x * 100, y: y * 100, z: z * 100, colorSpace: 'xyz-d65' })!;
    return [T.srgbToLinear(c.r / 255), T.srgbToLinear(c.g / 255), T.srgbToLinear(c.b / 255)];
  }),
  M1: [
    [ok.M1_LR, ok.M1_LG, ok.M1_LB],
    [ok.M1_MR, ok.M1_MG, ok.M1_MB],
    [ok.M1_SR, ok.M1_SG, ok.M1_SB],
  ] as M3,
  M1I: [
    [ok.M1I_L_R, ok.M1I_M_R, ok.M1I_S_R],
    [ok.M1I_L_G, ok.M1I_M_G, ok.M1I_S_G],
    [ok.M1I_L_B, ok.M1I_M_B, ok.M1I_S_B],
  ] as M3,
  M2: [
    [ok.M2_L_L, ok.M2_M_L, ok.M2_S_L],
    [ok.M2_L_A, ok.M2_M_A, ok.M2_S_A],
    [ok.M2_L_B, ok.M2_M_B, ok.M2_S_B],
  ] as M3,
  M2I: [
    [1, ok.M2I_A_L, ok.M2I_B_L],
    [1, ok.M2I_A_M, ok.M2I_B_M],
    [1, ok.M2I_A_S, ok.M2I_B_S],
  ] as M3,
};

// Every product / comparison below measured ≤ 8.9e-16 (one or two ULPs of an O(1) entry).
const MATRIX_TOL = 2e-15;

// ── 1. Matrix inverse pairs ─────────────────────────────────────────────────
describe('1. every forward/inverse matrix pair multiplies to the identity', () => {
  const pairs: [string, M3, M3][] = [
    ['sRGB ↔ XYZ D65', LIB.srgbToXyz65, LIB.xyz65ToSrgb],
    ['sRGB ↔ XYZ D50 (Bradford composed)', LIB.srgbToXyz50, LIB.xyz50ToSrgb],
    ['sRGB ↔ Display-P3', matrixOf(srgbLinearToP3Linear), matrixOf(linearP3ToSrgb)],
    ['sRGB ↔ Rec.2020', matrixOf(srgbLinearToRec2020Linear), matrixOf(linearRec2020ToSrgb)],
    ['sRGB ↔ A98', matrixOf(srgbLinearToA98Linear), matrixOf(linearA98ToSrgb)],
    ['sRGB ↔ ProPhoto', matrixOf(srgbLinearToProphotoLinear), matrixOf(linearProphotoToSrgb)],
    ['OKLab M1 (sRGB → LMS)', LIB.M1, LIB.M1I],
    ['OKLab M2 (LMS′ → Lab)', LIB.M2, LIB.M2I],
  ];
  it.each(pairs)('%s: M·M⁻¹ = M⁻¹·M = I', (_, M, Mi) => {
    expect(maxDiff(mul(M, Mi), I3)).toBeLessThan(MATRIX_TOL);
    expect(maxDiff(mul(Mi, M), I3)).toBeLessThan(MATRIX_TOL);
  });

  it('the Bradford matrices read off the pipeline invert each other', () => {
    const B = mul(LIB.srgbToXyz50, inv(LIB.srgbToXyz65));
    const Bi = mul(LIB.srgbToXyz65, LIB.xyz50ToSrgb);
    expect(maxDiff(mul(B, Bi), I3)).toBeLessThan(MATRIX_TOL);
  });

  it('M1⁻¹ rows sum to 1 at full precision (grey stays grey), not "only to 10 digits"', () => {
    // okgamut.ts's comment says the M1⁻¹ rows sum to 1 only to 10 digits; since 0137cf7 they do
    // to 8.9e-16. The achromatic short-circuits are still worth keeping, but for 1-ULP noise.
    for (const M of [LIB.M1, LIB.M1I])
      for (const r of M) expect(Math.abs(r[0] + r[1] + r[2] - 1)).toBeLessThan(MATRIX_TOL);
  });
});

// ── 2. Spec constants, derived independently ────────────────────────────────
describe('2. matrices and white points match the CSS Color 4 definitions', () => {
  it('sRGB → XYZ D65 equals the matrix built from the sRGB primaries and D65 xy', () => {
    expect(maxDiff(LIB.srgbToXyz65, SRGB_XYZ)).toBeLessThan(MATRIX_TOL);
    expect(maxDiff(LIB.xyz65ToSrgb, inv(SRGB_XYZ))).toBeLessThan(MATRIX_TOL);
  });
  it('sRGB → XYZ D50 equals Bradford(D65→D50, from the cone matrix) · sRGB → XYZ D65', () => {
    expect(maxDiff(LIB.srgbToXyz50, mul(D65_TO_D50, SRGB_XYZ))).toBeLessThan(MATRIX_TOL);
    expect(maxDiff(LIB.xyz50ToSrgb, inv(mul(D65_TO_D50, SRGB_XYZ)))).toBeLessThan(MATRIX_TOL);
  });
  it.each([
    ['Display-P3', srgbLinearToP3Linear, linearP3ToSrgb, mul(inv(P3_XYZ), SRGB_XYZ)],
    ['Rec.2020', srgbLinearToRec2020Linear, linearRec2020ToSrgb, mul(inv(REC2020_XYZ), SRGB_XYZ)],
    ['A98', srgbLinearToA98Linear, linearA98ToSrgb, mul(inv(A98_XYZ), SRGB_XYZ)],
    [
      'ProPhoto (D50, Bradford)',
      srgbLinearToProphotoLinear,
      linearProphotoToSrgb,
      mul(inv(PROPHOTO_XYZ), mul(D65_TO_D50, SRGB_XYZ)),
    ],
  ] as const)('sRGB ↔ %s equals the primaries-derived matrix', (_, fwd, back, expected) => {
    expect(maxDiff(matrixOf(fwd), expected)).toBeLessThan(MATRIX_TOL);
    expect(maxDiff(matrixOf(back), inv(expected))).toBeLessThan(MATRIX_TOL);
  });
  it('OKLab M1 = XYZtoLMS · (primaries-derived sRGB → XYZ), M2 = LMStoOKLab, inverses exact', () => {
    expect(maxDiff(LIB.M1, mul(XYZ_TO_LMS, SRGB_XYZ))).toBeLessThan(MATRIX_TOL);
    expect(maxDiff(LIB.M2, LMS_TO_OKLAB)).toBeLessThan(MATRIX_TOL);
    expect(maxDiff(LIB.M1I, inv(mul(XYZ_TO_LMS, SRGB_XYZ)))).toBeLessThan(MATRIX_TOL);
    expect(maxDiff(LIB.M2I, inv(LMS_TO_OKLAB))).toBeLessThan(MATRIX_TOL);
  });
  it('D50 white constants equal xy 0.3457/0.3585 exactly', () => {
    const W = xyToXYZ(D50);
    expect(D50_WX).toBe(W[0] * 100);
    expect(D50_WY).toBe(100);
    expect(Math.abs(D50_WZ - W[2] * 100)).toBeLessThan(2e-14); // 82.51046025104603 vs 82.51046025104602
  });

  const c = (s: string) => colordx(s) as Colordx & Record<string, (p?: number) => Record<string, number>>;
  const vals = (o: Record<string, unknown>) => Object.values(o).slice(0, 3) as number[];
  it('white maps to every space’s white within 1e-15 relative', () => {
    const w = c('#ffffff');
    expect(
      maxAbs(
        vals(w.toXyzD65!(17)),
        xyToXYZ(D65).map((v) => v * 100)
      )
    ).toBeLessThan(3e-14);
    expect(
      maxAbs(
        vals(w.toXyz!(17)),
        xyToXYZ(D50).map((v) => v * 100)
      )
    ).toBeLessThan(3e-14);
    expect(maxAbs(vals(w.toLab!(17)), [100, 0, 0])).toBeLessThan(3e-14);
    expect(maxAbs(vals(w.toLch!(17)).slice(0, 2), [100, 0])).toBeLessThan(3e-14);
    expect(maxAbs(vals(w.toOklab!(17)), [1, 0, 0])).toBeLessThan(1e-15); // measured L = 1 + 2.2e-16, a = -5e-16
    for (const m of ['toP3', 'toRec2020', 'toA98', 'toProphoto', 'toSrgbLinear'])
      expect(maxAbs(vals(w[m]!(17)), [1, 1, 1]), m).toBeLessThan(5e-16);
    expect(vals(w.toOkhsl!(17))[2]).toBe(100);
    expect(vals(w.toOkhsv!(17))[2]).toBe(100);
  });
  it('black maps to exact zeros everywhere', () => {
    const k = c('#000000');
    for (const m of [
      'toXyz',
      'toXyzD65',
      'toLab',
      'toLch',
      'toOklab',
      'toOklch',
      'toP3',
      'toRec2020',
      'toA98',
      'toProphoto',
      'toSrgbLinear',
      'toOkhsl',
      'toOkhsv',
    ])
      expect(vals(k[m]!(17)), m).toEqual([0, 0, 0]);
  });
  it('every space’s white parses to stored sRGB 255 within 1e-12 byte units', () => {
    const W65 = xyToXYZ(D65),
      W50 = xyToXYZ(D50);
    for (const s of [
      'lab(100 0 0)',
      'lch(100 0 0)',
      'oklab(1 0 0)',
      'oklch(1 0 0)',
      `color(xyz-d65 ${W65.join(' ')})`,
      `color(xyz-d50 ${W50.join(' ')})`,
      'color(display-p3 1 1 1)',
      'color(rec2020 1 1 1)',
      'color(a98-rgb 1 1 1)',
      'color(prophoto-rgb 1 1 1)',
      'color(srgb-linear 1 1 1)',
      'okhsl(0 0% 100%)',
      'okhsv(0 0% 100%)',
    ]) {
      const { r, g, b } = colordx(s)._rawRgb();
      expect(maxAbs([r, g, b], [255, 255, 255]), s).toBeLessThan(1e-12); // worst measured 1.4e-13
    }
  });
  it('greys are exactly achromatic in Lab (D50 and D65) and OKLab', () => {
    for (let v = 0; v < 256; v++) {
      const g = c(`rgb(${v} ${v} ${v})`);
      const [, a, b] = vals(g.toLab!(17));
      expect(Math.max(Math.abs(a!), Math.abs(b!)), `lab ${v}`).toBeLessThan(1e-13); // measured 5.6e-14
      const d65 = rgbToLabD65({ r: v, g: v, b: v, alpha: 1 });
      expect(Math.max(Math.abs(d65.a), Math.abs(d65.b)), `labD65 ${v}`).toBeLessThan(1e-13);
      const [, oa, ob] = vals(g.toOklab!(17));
      expect(Math.max(Math.abs(oa!), Math.abs(ob!)), `oklab ${v}`).toBeLessThan(1e-15);
    }
  });

  // Independently computed conversion of a grid (including the primaries and secondaries).
  const grid: V3[] = [];
  for (const r of [0, 1, 7, 50, 128, 200, 254, 255])
    for (const g of [0, 3, 64, 190, 255]) for (const b of [0, 10, 128, 255]) grid.push([r, g, b]);
  // The RGB spaces are compared after linearizing both sides: their pure power curves have infinite
  // slope at 0, so a 1e-18 matrix residue on a structurally-zero channel (A98 red/blue of a pure blue)
  // encodes to 3e-9. The library's sparse matrices give the exact 0 there; the reference does not.
  it.each([
    ['toP3', (rgb: V3) => refP3(rgb).map(REF.srgbToLin), 2e-15, REF.srgbToLin],
    ['toRec2020', (rgb: V3) => refRec2020(rgb).map(REF.r2020ToLin), 2e-15, REF.r2020ToLin],
    ['toA98', (rgb: V3) => refA98(rgb).map(REF.a98ToLin), 2e-15, REF.a98ToLin],
    ['toProphoto', (rgb: V3) => refProphoto(rgb).map(REF.ppToLin), 2e-15, REF.ppToLin],
    ['toOklab', refOklab, 1e-14],
    ['toLab', refLab, 1e-12], // 0–100 scale
    ['toXyz', (rgb: V3) => refXyz50(rgb).map((v) => v * 100), 1e-12],
    ['toXyzD65', (rgb: V3) => refXyz65(rgb).map((v) => v * 100), 1e-12],
    ['toSrgbLinear', refLinear, 1e-15],
  ] as const)(
    '%s matches the first-principles pipeline on primaries and a grid',
    (m, ref, tol, lin?: (x: number) => number) => {
      for (const rgb of grid) {
        const raw = vals(
          (
            colordx({ r: rgb[0], g: rgb[1], b: rgb[2] }) as unknown as Record<
              string,
              (p: number) => Record<string, number>
            >
          )[m]!(17)
        );
        const got = lin ? raw.map(lin) : raw;
        expect(maxAbs(got, ref(rgb)), `${m} rgb(${rgb.join(' ')})`).toBeLessThan(tol);
      }
    }
  );
  it('sRGB red in the other spaces matches the published CSS Color 4 values', () => {
    const red = c('#ff0000');
    expect(maxAbs(vals(red.toP3!(17)), [0.9174875573251656, 0.20028680774084695, 0.13856059121111408])).toBeLessThan(
      1e-14
    );
    expect(maxAbs(vals(red.toA98!(17)), [0.8585916022954423, 0, 0])).toBeLessThan(1e-14); // shared red primary
    expect(maxAbs(vals(red.toOklab!(17)), refOklab([255, 0, 0]))).toBeLessThan(1e-15);
  });
});

// ── 3. Transfer functions ───────────────────────────────────────────────────
describe('3. transfer functions', () => {
  const curves = [
    ['sRGB', T.srgbToLinear, T.srgbFromLinear, REF.srgbToLin, REF.srgbFromLin],
    ['A98 (563/256)', T.a98ToLinear, T.a98FromLinear, REF.a98ToLin, REF.a98FromLin],
    ['ProPhoto (1.8, 1/512 toe)', T.prophotoToLinear, T.prophotoFromLinear, REF.ppToLin, REF.ppFromLin],
    ['Rec.2020 (pure 2.4)', T.rec2020ToLinear, T.rec2020FromLinear, REF.r2020ToLin, REF.r2020FromLin],
  ] as const;
  const xs: number[] = [];
  for (let i = -20000; i <= 20000; i++) xs.push(i / 10000); // [-2, 2]
  for (let e = -100; e <= 0; e += 0.05) xs.push(10 ** e, -(10 ** e)); // log sweep; below ~1e-140 pow underflows

  it.each(curves)(
    '%s: identical to the CSS Color 4 formula, sign(x)·f(|x|) for negatives',
    (_, to, from, rTo, rFrom) => {
      const bad = xs.filter(
        (x) => !Object.is(to(x), rTo(x)) || !Object.is(from(x), rFrom(x)) || to(-x) !== -to(x) || from(-x) !== -from(x)
      );
      expect(bad).toEqual([]);
    }
  );
  const nonMonotone = (f: (x: number) => number): number[] => {
    const out: number[] = [];
    let prev = -Infinity;
    for (let i = -200000; i <= 200000; i++) {
      const y = f(i / 100000);
      if (!(y >= prev)) out.push(i / 100000);
      prev = y;
    }
    return out;
  };
  it.each(curves)('%s: toLinear is monotone non-decreasing on [-2, 2]', (_, to) => {
    expect(nonMonotone(to)).toEqual([]);
  });
  it.each(curves.filter(([n]) => n !== 'sRGB'))(
    '%s: fromLinear is monotone non-decreasing on [-2, 2]',
    (_, __, from) => {
      expect(nonMonotone(from)).toEqual([]);
    }
  );
  it('sRGB: the IEC knees disagree by the spec’s own constants — bounded, not a library error', () => {
    // 0.04045 / 12.92 = 0.00313080495…, not 0.0031308, so the two branches of each curve meet with
    // a small step. Measured: toLinear jumps +2.33e-9 at 0.04045; fromLinear steps DOWN by 2.85e-8
    // at 0.0031308 (12.92·0.0031308 = 0.040449936 > the power branch 0.0404499075), a spec-level
    // non-monotonicity of 7e-6 byte units. Nothing reaches a byte from it.
    const kIn = 0.04045,
      kOut = 0.0031308;
    expect(Math.abs(kIn / 12.92 - ((kIn + 0.055) / 1.055) ** 2.4)).toBeLessThan(2.4e-9);
    expect(T.srgbFromLinear(kOut) - T.srgbFromLinear(kOut + 1e-15)).toBeLessThan(2.9e-8);
    expect(T.srgbFromLinear(kOut) - T.srgbFromLinear(kOut + 1e-15)).toBeGreaterThan(0); // spec, not a bug
  });
  it('ProPhoto: both knees are continuous to 1 ULP (16/512 ↔ 1/512 is 2⁻⁵ ↔ 2⁻⁹, and 2⁻⁵·¹·⁸ = 2⁻⁹)', () => {
    // Math.pow(2⁻⁵, 1.8) and Math.pow(2⁻⁹, 1/1.8) each come back 1 ULP low (…9998, …99997): pow's
    // rounding, not the curve. The toLinear knee is owned by the linear branch, so it is exact.
    expect(T.prophotoToLinear(16 / 512)).toBe(1 / 512);
    expect(Math.abs(T.prophotoFromLinear(1 / 512) - 16 / 512)).toBeLessThanOrEqual(2 ** -57);
    expect(Math.abs(T.prophotoToLinear(16 / 512 + 2 ** -57) - 1 / 512)).toBeLessThan(1e-18);
    expect(Math.abs(T.prophotoFromLinear(1 / 512 - 2 ** -62) - 16 / 512)).toBeLessThan(1e-17);
  });
  it('Lab f(t) is exactly continuous at ε = (6/29)³ (κε = 8)', () => {
    expect(Math.abs(Math.cbrt(EPS) - (KAPPA * EPS + 16) / 116)).toBeLessThan(1e-16);
    expect(KAPPA * EPS).toBe(8);
  });
  it.each(curves)('%s: inverse pair to 1e-14 relative (1e-6 inside the sRGB knee gap)', (name, to, from) => {
    let worst = 0;
    for (const x of xs) {
      if (x === 0) continue;
      worst = Math.max(worst, Math.abs(from(to(x)) - x) / Math.abs(x), Math.abs(to(from(x)) - x) / Math.abs(x));
    }
    // Measured: ProPhoto 6.5e-16, Rec.2020 2.0e-15, A98 8.7e-15 (pow's own error, amplified by 563/256).
    if (name !== 'sRGB') expect(worst).toBeLessThan(1e-14);
    else {
      // Only in (0.0031308, 0.04045/12.92] and its image does the round trip use mismatched
      // branches: measured 7.4e-7 relative (2.3e-9 absolute) — spec constants again.
      expect(worst).toBeLessThan(1e-6);
      for (const x of xs) {
        const a = Math.abs(x);
        if (a > 0.0031308 * 0.999 && a < 0.0404501) continue;
        expect(Math.abs(to(from(x)) - x) / a || 0).toBeLessThan(2e-15);
        expect(Math.abs(from(to(x)) - x) / a || 0).toBeLessThan(2e-15);
      }
    }
  });
  it('the 8-bit lookup table is bit-identical to srgbToLinear(n / 255)', () => {
    for (let n = 0; n < 256; n++) expect(T.byteToLinear(n)).toBe(T.srgbToLinear(n / 255));
  });
  it('Okhsl toe / toeInv are an exact inverse pair with toe(0) = 0, toe(1) = 1', () => {
    expect(toe(0)).toBe(0);
    expect(toe(1)).toBe(1);
    expect(toeInv(1)).toBe(1);
    let worst = 0;
    for (let i = 0; i <= 100000; i++) {
      const x = i / 100000;
      worst = Math.max(worst, Math.abs(toeInv(toe(x)) - x), Math.abs(toe(toeInv(x)) - x));
    }
    expect(worst).toBeLessThan(1e-15); // measured 4.4e-16
  });
});

// ── 4. Default strings round-trip every 8-bit color ─────────────────────────
// A full 256³ sweep of all 18 formatters was run offline (≈15 s per method): the 16 CSS formats had
// zero failures. okhsl had 7152 (253 on the pure-blue edge r = g = 0, 6899 whose unclamped s > 100)
// and okhsv 7071 (244 + 6827) — exactly the two exceptions plugins/okhsl.ts documents.
const stratifiedGrid = (): V3[] => {
  const out: V3[] = [];
  const add = (r: number, g: number, b: number) => out.push([r, g, b]);
  // Every value along each axis and diagonal, against three backgrounds.
  for (let v = 0; v < 256; v++)
    for (const o of [0, 128, 255]) {
      add(v, o, o);
      add(o, v, o);
      add(o, o, v);
      add(v, v, o);
      add(v, o, v);
      add(o, v, v);
    }
  for (let v = 0; v < 256; v++) add(v, v, v);
  // Near-black, exhaustively in 3D, where steep curves (Rec.2020 2.4, ProPhoto toe) lose a byte first.
  for (let r = 0; r <= 8; r++) for (let g = 0; g <= 8; g++) for (let b = 0; b <= 8; b++) add(r, g, b);
  // Near-white likewise.
  for (let r = 247; r < 256; r++) for (let g = 247; g < 256; g++) for (let b = 247; b < 256; b++) add(r, g, b);
  // 64³ stratified: one jittered level per 4-wide bin per channel.
  const rnd = lcg(0x5eed);
  for (let i = 0; i < 64; i++)
    for (let j = 0; j < 64; j++)
      for (let k = 0; k < 64; k++) add(i * 4 + ((rnd() * 4) | 0), j * 4 + ((rnd() * 4) | 0), k * 4 + ((rnd() * 4) | 0));
  return out;
};

describe('4. every default string round-trips every 8-bit color exactly (dense grid)', () => {
  const grid = stratifiedGrid();
  const exact = [
    'toRgbString',
    'toHslString',
    'toHsvString',
    'toHwbString',
    'toCmykString',
    'toLabString',
    'toLchString',
    'toXyzString',
    'toXyzD65String',
    'toOklabString',
    'toOklchString',
    'toP3String',
    'toRec2020String',
    'toA98String',
    'toProphotoString',
    'toSrgbLinearString',
  ];
  it.each(exact)(
    '%s',
    (m) => {
      let fails = 0;
      let first = '';
      for (const [r, g, b] of grid) {
        const c = colordx({ r, g, b }) as unknown as Record<string, () => string> & { toHex(): string };
        const s = c[m]!();
        if (colordx(s).toHex() !== c.toHex()) {
          fails++;
          first ||= `${c.toHex()} → ${s} → ${colordx(s).toHex()}`;
        }
      }
      expect(fails, first).toBe(0);
    },
    HEAVY_TIMEOUT
  );

  it.each([
    ['toOkhslString', rgbToOkhslChannels],
    ['toOkhsvString', rgbToOkhsvChannels],
  ] as const)(
    '%s: every miss is one of the two documented cases (blue edge r = g = 0, or raw s > 100)',
    (m, raw) => {
      let undocumented = 0;
      let first = '';
      for (const [r, g, b] of grid) {
        const c = colordx({ r, g, b }) as unknown as Record<string, () => string> & { toHex(): string };
        const s = c[m]!();
        if (colordx(s).toHex() === c.toHex()) continue;
        if (r === 0 && g === 0) continue;
        if (raw(r / 255, g / 255, b / 255)[1] > 100) continue;
        undocumented++;
        first ||= `${c.toHex()} → ${s} → ${colordx(s).toHex()}`;
      }
      expect(undocumented, first).toBe(0);
    },
    HEAVY_TIMEOUT
  );
});

// ── 5. Unrounded round trips ────────────────────────────────────────────────
describe('5. rgb → X → rgb at full precision holds to ~1e-11 byte units, wide gamut included', () => {
  const rnd = lcg(42);
  const srgbInputs: { r: number; g: number; b: number; alpha: number }[] = [];
  for (let i = 0; i < 4000; i++) srgbInputs.push({ r: rnd() * 255, g: rnd() * 255, b: rnd() * 255, alpha: 1 });
  // Stored unclamped: rec2020-gamut colors, oklch past Rec.2020, extreme Lab.
  const wideInputs: string[] = [];
  for (let i = 0; i < 1500; i++) wideInputs.push(`color(rec2020 ${rnd()} ${rnd()} ${rnd()})`);
  for (let i = 0; i < 500; i++) wideInputs.push(`oklch(${0.05 + rnd() * 0.9} ${rnd() * 0.5} ${rnd() * 360})`);
  for (let i = 0; i < 500; i++) wideInputs.push(`lab(${rnd() * 100} ${rnd() * 300 - 150} ${rnd() * 300 - 150})`);
  const dist = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) =>
    Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));

  // [method, colorSpace brand for the object, wide-gamut capable]
  const spaces: [string, string | undefined, boolean][] = [
    ['toLab', 'lab', true],
    ['toLch', 'lch', true],
    ['toXyz', undefined, true],
    ['toXyzD65', 'xyz-d65', true],
    ['toOklab', undefined, true],
    ['toOklch', undefined, true],
    ['toP3', 'display-p3', true],
    ['toRec2020', 'rec2020', true],
    ['toA98', 'a98-rgb', true],
    ['toProphoto', 'prophoto-rgb', true],
    ['toSrgbLinear', 'srgb-linear', true],
    ['toHsl', undefined, false],
    ['toHsv', undefined, false],
    ['toHwb', undefined, false],
    ['toCmyk', undefined, false],
  ];
  // Measured worst: 1.2e-11 (OKLab/OKLCh: cbrt + two matrices on a 255 scale), ≤ 4.4e-12 elsewhere.
  const TOL = 5e-11;
  // Imaginary colors (negative Y, e.g. oklch(0.1 0.2 223) → Lab L = -0.0024; lab(99 12 -134) →
  // OKLab L = 1.023) have a Lab/OKLab L outside the range CSS Color 4 clamps to at parse time, so
  // they cannot round-trip through those formats by spec. Only they are skipped.
  const lRange: Record<string, number> = { toLab: 100, toLch: 100, toOklab: 1, toOklch: 1 };
  const physical = (m: string, c: Colordx) => {
    const top = lRange[m.replace('String', '')];
    if (top === undefined) return true;
    const l = (c as unknown as Record<string, (p: number) => { l: number }>)[m.replace('String', '')]!(17).l;
    return l >= 0 && l <= top;
  };
  it.each(spaces)('%s object at precision 17', (m, cs, wide) => {
    const check = (c: Colordx) => {
      if (!physical(m, c)) return;
      const o = (c as unknown as Record<string, (p: number) => Record<string, unknown>>)[m]!(17);
      if (cs) o.colorSpace = cs;
      const back = colordx(o as never)._rawRgb();
      expect(dist(back, c._rawRgb()), `${m} ${JSON.stringify(o)}`).toBeLessThan(TOL);
    };
    for (const inp of srgbInputs) check(colordx(inp));
    if (wide) for (const s of wideInputs) check(colordx(s));
  });
  it.each(spaces)('%s string at precision 15', (m, _, wide) => {
    const sm = `${m}String`;
    const check = (c: Colordx) => {
      if (!physical(m, c)) return;
      const s = (c as unknown as Record<string, (p: number) => string>)[sm]!(15);
      expect(dist(colordx(s)._rawRgb(), c._rawRgb()), s).toBeLessThan(TOL); // measured ≤ 1.5e-11
    };
    for (const inp of srgbInputs) check(colordx(inp));
    if (wide) for (const s of wideInputs) check(colordx(s));
  });
  it('Okhsl / Okhsv objects round-trip wherever the raw s does not overshoot 100', () => {
    for (const inp of srgbInputs) {
      const c = colordx(inp) as Colordx & Record<string, (p: number) => Record<string, unknown>>;
      for (const [m, raw] of [
        ['toOkhsl', rgbToOkhslChannels],
        ['toOkhsv', rgbToOkhsvChannels],
      ] as const) {
        if (raw(inp.r / 255, inp.g / 255, inp.b / 255)[1] > 100) continue;
        const back = colordx(c[m]!(17) as never)._rawRgb();
        expect(dist(back, inp), m).toBeLessThan(TOL);
      }
    }
  });
  it('Okhsl / Okhsv channel functions invert each other to 1e-12, overshoot included', () => {
    for (const { r, g, b } of srgbInputs) {
      const [x, y, z] = [r / 255, g / 255, b / 255];
      expect(maxAbs(okhslToRgbChannels(...rgbToOkhslChannels(x, y, z)), [x, y, z])).toBeLessThan(1e-12); // 5.3e-14
      expect(maxAbs(okhsvToRgbChannels(...rgbToOkhsvChannels(x, y, z)), [x, y, z])).toBeLessThan(1e-12); // 4.8e-14
    }
  });
  it('channel functions agree with the parsers to 1e-11 byte units', () => {
    const r2 = lcg(9);
    for (let i = 0; i < 4000; i++) {
      const l = r2(),
        C = r2() * 0.4,
        h = r2() * 360;
      const ch = oklchToRgbChannels(l, C, h).map((v) => v * 255);
      const raw = colordx({ l, c: C, h })._rawRgb();
      expect(maxAbs(ch, [raw.r, raw.g, raw.b])).toBeLessThan(1e-11);
      const L = r2() * 100,
        A = r2() * 200 - 100,
        B = r2() * 200 - 100;
      const lc = labToRgbChannels(L, A, B).map((v) => v * 255);
      const lr = colordx({ l: L, a: A, b: B, colorSpace: 'lab' })._rawRgb();
      expect(maxAbs(lc, [lr.r, lr.g, lr.b])).toBeLessThan(1e-11); // measured 2.9e-12
    }
  });
  it('CSS percentage and angle references are exact (lab 125, lch 150, oklab/oklch 0.4, turn/grad/rad)', () => {
    const same = (a: string, b: string) =>
      expect(dist(colordx(a)._rawRgb(), colordx(b)._rawRgb()), `${a} vs ${b}`).toBe(0);
    same('lab(50 100% -100%)', 'lab(50 125 -125)');
    same('lch(50 100% 30)', 'lch(50 150 30)');
    same('oklab(50% 100% -100%)', 'oklab(0.5 0.4 -0.4)');
    same('oklch(50% 50% 30)', 'oklch(0.5 0.2 30)');
    same('color(xyz 50% 40% 30%)', 'color(xyz 0.5 0.4 0.3)');
    same('color(display-p3 50% 40% 30%)', 'color(display-p3 0.5 0.4 0.3)');
    same('oklch(0.6 0.1 0.5turn)', 'oklch(0.6 0.1 180)');
    same('oklch(0.6 0.1 200grad)', 'oklch(0.6 0.1 180)');
    same(`oklch(0.6 0.1 ${Math.PI}rad)`, 'oklch(0.6 0.1 180)');
    same('lch(60 40 -90)', 'lch(60 40 270)');
    same('hwb(0 60% 60%)', 'rgb(127.5 127.5 127.5)');
  });
});

// ── 6. Gamut mapping vs the CSS Color 4 pseudocode ──────────────────────────
// An independent implementation of https://www.w3.org/TR/css-color-4/#binsearch, using the matrices
// derived above: binary search on OKLCh chroma, JND 0.02, ε 0.0001, clip, deltaEOK, `E < JND`.
type Space = { toLin: (lab: V3) => V3; fromLin: (rgb: V3) => V3 };
const OKLAB_TO_LMS = inv(LMS_TO_OKLAB),
  LMS_TO_XYZ = inv(XYZ_TO_LMS);
const oklabToXyz = (lab: V3): V3 =>
  mv(
    LMS_TO_XYZ,
    mv(OKLAB_TO_LMS, lab).map((v) => v * v * v)
  );
const space = (toXyz: M3): Space => ({
  toLin: (lab) => mv(inv(toXyz), oklabToXyz(lab)),
  fromLin: (rgb) => refOklabFromXyz(mv(toXyz, rgb)),
});
const SPACES = {
  srgb: space(SRGB_XYZ),
  p3: space(P3_XYZ),
  rec2020: space(REC2020_XYZ),
  a98: space(A98_XYZ),
  // ProPhoto is D50: adapt back to D65 before OKLab.
  prophoto: space(mul(inv(D65_TO_D50), PROPHOTO_XYZ)),
};
const inGamut = (v: V3) => v.every((c) => c >= 0 && c <= 1);
const clip = (v: V3): V3 => v.map((c) => Math.min(1, Math.max(0, c))) as V3;
const deltaEOK = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const specGamutMap = (L: number, C: number, H: number, sp: Space): V3 => {
  if (L >= 1) return [1, 1, 1];
  if (L <= 0) return [0, 0, 0];
  const lab = (c: number): V3 => [L, c * Math.cos((H * Math.PI) / 180), c * Math.sin((H * Math.PI) / 180)];
  const origin = sp.toLin(lab(C));
  if (inGamut(origin)) return origin;
  const JND = 0.02,
    epsilon = 0.0001;
  let clipped = clip(origin);
  let E = deltaEOK(sp.fromLin(clipped), lab(C));
  if (E < JND) return clipped;
  let min = 0,
    max = C,
    minInGamut = true;
  while (max - min > epsilon) {
    const chroma = (min + max) / 2;
    const current = sp.toLin(lab(chroma));
    if (minInGamut && inGamut(current)) {
      min = chroma;
      continue;
    }
    clipped = clip(current);
    E = deltaEOK(sp.fromLin(clipped), lab(chroma));
    if (E < JND) {
      if (JND - E < epsilon) return clipped;
      minInGamut = false;
      min = chroma;
    } else max = chroma;
  }
  return clipped;
};

describe('6. gamut mapping matches an independent CSS Color 4 implementation', () => {
  const samples = (seed: number, sp: Space, n: number): V3[] => {
    const rnd = lcg(seed);
    const out: V3[] = [];
    while (out.length < n) {
      const L = 0.01 + rnd() * 0.98,
        C = 0.02 + rnd() * 0.48,
        H = rnd() * 360;
      if (!inGamut(sp.toLin([L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)])))
        out.push([L, C, H]);
    }
    return out;
  };
  // Measured ≤ 4.3e-15 on 4000 colors per space: every bisection takes the same branches.
  const TOL = 1e-12;
  const cases = [
    ['srgb', oklabToLinear3(ok.oklabToLinear)],
    ['p3', oklabToLinear3(oklabToLinearP3)],
    ['rec2020', oklabToLinear3(oklabToLinearRec2020)],
    ['a98', oklabToLinear3(oklabToLinearA98)],
    ['prophoto', oklabToLinear3(oklabToLinearProphoto)],
  ] as const;
  function oklabToLinear3(f: (l: number, a: number, b: number) => [number, number, number]) {
    return f;
  }
  it.each(cases)(
    '%s: linear result of the library’s map equals the spec algorithm on 3000 out-of-gamut colors',
    (name, toLin) => {
      const sp = SPACES[name];
      for (const [L, C, H] of samples(name.length * 7919, sp, 3000)) {
        const ref = specGamutMap(L, C, H, sp);
        const lib =
          name === 'srgb'
            ? toGamutSrgbRaw({ l: L, c: C, h: H })!.linear
            : toGamutCustom({ l: L, c: C, h: H }, toLin, (r, g, b) => sp.fromLin([r, g, b]))!.linear;
        expect(maxAbs(lib, ref), `oklch(${L} ${C} ${H})`).toBeLessThan(TOL);
      }
    },
    HEAVY_TIMEOUT
  );

  // The public entry points go through the plugin's own fromLinear and then Colordx storage. An sRGB
  // clip snaps a channel within half a byte of 0 or 255 onto it (see _makeFromLinearSrgb); a wide-gamut
  // target is stored exactly. Apply the same rule to the reference and compare the stored channels.
  const snap = (v: number) => (v >= 0 && v < 0.5 ? 0 : v > 254.5 && v <= 255 ? 255 : v);
  const toStored = (sp: Space, lin: V3): V3 =>
    mv(inv(SRGB_XYZ), mv(mv3(sp), lin)).map((v) =>
      sp === SPACES.srgb ? snap(REF.srgbFromLin(v) * 255) : REF.srgbFromLin(v) * 255
    ) as V3;
  function mv3(sp: Space): M3 {
    // Recover the space's RGB→XYZ matrix from fromLin's definition (kept in SPACE_MATRICES).
    return SPACE_MATRICES.get(sp)!;
  }
  const SPACE_MATRICES = new Map<Space, M3>([
    [SPACES.srgb, SRGB_XYZ],
    [SPACES.p3, P3_XYZ],
    [SPACES.rec2020, REC2020_XYZ],
    [SPACES.a98, A98_XYZ],
    [SPACES.prophoto, mul(inv(D65_TO_D50), PROPHOTO_XYZ)],
  ]);
  it.each([
    ['srgb', (s: string) => Colordx.toGamutSrgb(s)],
    ['p3', (s: string) => Colordx.toGamutP3(s)],
    ['rec2020', (s: string) => Colordx.toGamutRec2020(s)],
    ['a98', (s: string) => Colordx.toGamutA98(s)],
    ['prophoto', (s: string) => Colordx.toGamutProphoto(s)],
  ] as const)(
    'Colordx.toGamut %s stores the spec result (1e-9 byte units)',
    (name, map) => {
      const sp = SPACES[name];
      for (const [L, C, H] of samples(name.length * 104729, sp, 1000)) {
        const expected = toStored(sp, specGamutMap(L, C, H, sp));
        // SPACES.srgb's matrix is SRGB_XYZ, so toStored is the identity route for it.
        const { r, g, b } = map(`oklch(${L} ${C} ${H})`)._rawRgb();
        expect(maxAbs([r, g, b], expected), `${name} oklch(${L} ${C} ${H})`).toBeLessThan(1e-9);
      }
    },
    HEAVY_TIMEOUT
  );

  // An input already inside the gamut comes back flagged, with its own linear channels: callers return
  // the input as-is, and a11y's P3 quantizer reads `linear` directly.
  it('the gamut map flags an in-gamut input and hands back its own linear channels', () => {
    const lab = { l: 0.6, a: 0.05, b: -0.03, alpha: 1 };
    const own = ok.oklabToLinear(lab.l, lab.a, lab.b);
    const s = toGamutSrgbRaw(lab)!;
    expect(s.inGamut).toBe(true);
    expect([...s.linear]).toEqual(own);
    const p = toGamutCustom(lab, oklabToLinearP3, (r, g, b) => ok.linearSrgbToOklab(...linearP3ToSrgb(r, g, b)))!;
    expect(p.inGamut).toBe(true);
    expect([...p.linear]).toEqual(oklabToLinearP3(lab.l, lab.a, lab.b));
    expect(toGamutSrgbRaw({ l: 0.7, c: 0.4, h: 150 })!.inGamut).toBe(false);
  });

  it('mapSrgb() on an out-of-gamut color equals toGamutSrgb() of the same input (hex)', () => {
    for (const [L, C, H] of samples(5, SPACES.srgb, 2000)) {
      const s = `oklch(${L} ${C} ${H})`;
      expect(colordx(s).mapSrgb().toHex(), s).toBe(Colordx.toGamutSrgb(s).toHex());
    }
  });

  // README: toGamutSrgb(x) is equivalent to colordx(x).mapSrgb(), and in-gamut colors come back as-is.
  it('toGamutSrgb() leaves an in-gamut wide-format input untouched, like mapSrgb()', () => {
    const s = 'oklch(0.817463 0.142223 216.7874)'; // stored b = 254.6078, inside sRGB
    expect(Colordx.toGamutSrgb(s).toRgb(4)).toEqual(colordx(s).mapSrgb().toRgb(4));
  });
  // A color inside the target gamut but outside sRGB keeps its exact channels.
  it('toGamutP3() leaves a color already inside P3 untouched', () => {
    const lin = [T.srgbToLinear(254.8 / 255), 0.3, -0.01]; // outside sRGB (b < 0), inside P3
    const p = srgbLinearToP3Linear(lin[0]!, lin[1]!, lin[2]!).map(T.srgbFromLinear);
    const s = `color(display-p3 ${p.join(' ')})`;
    expect(p.every((v) => v >= 0 && v <= 1)).toBe(true);
    const c = colordx(s) as Colordx & { toP3(p: number): unknown };
    const m = Colordx.toGamutP3(s) as Colordx & { toP3(p: number): unknown };
    expect(m.toP3(8)).toEqual(c.toP3(8));
  });
});

// ── 7. Other exact identities found while probing ───────────────────────────
describe('7. operations that should be exact identities', () => {
  type WithMix = Colordx & {
    mix(c: unknown, t?: number): Colordx;
    mixOklab(c: unknown, t?: number): Colordx;
    mixLab(c: unknown, t?: number): Colordx;
    toP3String(p?: number): string;
  };
  it(
    'byte-level identities on a 52³ grid: lightness/chroma/hue setters with their own getter, rotate(±a), self-mix',
    () => {
      const bad: string[] = [];
      for (let r = 0; r < 256; r += 5)
        for (let g = 0; g < 256; g += 5)
          for (let b = 0; b < 256; b += 5) {
            const c = colordx({ r, g, b }) as WithMix;
            const hex = c.toHex();
            const outs = [
              c.lightness(c.lightness()),
              c.chroma(c.chroma()),
              c.hue(c.hue()),
              c.rotate(37).rotate(-37),
              c.mixOklab(c, 0.3),
              c.mixLab(c, 0.3),
            ].map((x) => x.toHex());
            if (outs.some((h) => h !== hex)) bad.push(`${hex}: ${outs.join(' ')}`);
          }
      expect(bad).toEqual([]);
    },
    HEAVY_TIMEOUT
  );

  // CSS color-mix(in oklab, X, X) is X, wide-gamut X included.
  it('mixOklab(self) keeps a wide-gamut color', () => {
    const c = colordx('color(display-p3 1 0 0)') as WithMix;
    expect(c.mixOklab(c).toP3String()).toBe('color(display-p3 1 0 0)');
  });
  it('mixLab(self) keeps a wide-gamut color', () => {
    const c = colordx('color(display-p3 1 0 0)') as WithMix;
    expect(c.mixLab(c).toP3String()).toBe('color(display-p3 1 0 0)');
  });

  it('CVD simulation keeps greys grey to the published 6-digit precision of the Machado matrices', () => {
    // Machado rows sum to 1 ± 1e-6 (e.g. protanopia row 1: 1.000001), so grey drifts by up to
    // 1.05e-4 byte units (protanopia, grey 238) — the constants' printed precision, far below a byte.
    for (const t of ['protanopia', 'deuteranopia', 'tritanopia'] as const)
      for (let v = 0; v < 256; v += 17) {
        const { r, g, b } = (colordx({ r: v, g: v, b: v }) as Colordx & { simulate(t: string): Colordx })
          .simulate(t)
          ._rawRgb();
        expect(maxAbs([r, g, b], [v, v, v]), `${t} ${v}`).toBeLessThan(2e-4);
      }
  });
});

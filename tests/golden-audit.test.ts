/**
 * Golden-value audit. Every expected value here is COMPUTED from an independent implementation
 * written from the specs, never pasted from colordx output:
 *   - matrices derived at runtime from the xy primaries / white points (CSS Color 4 §10, Bradford CAT)
 *   - transfer curves, Lab, OKLab (CSS Color 4 conversions.js matrices), gamut mapping (CSS Color 4 §13.2)
 *   - Okhsl / Okhsv: a port of Björn Ottosson's reference (ok_color.h)
 *   - CIEDE2000: Sharma, Wu & Dalal (2005), checked against their published test pairs
 *   - WCAG 2.x relative luminance / contrast ratio from the definition; APCA via apca-w3 (the reference)
 * Values are compared at colordx's printed precision: the reference rounded the way colordx rounds
 * must match exactly, except on float-noise rounding ties, where either neighbour is accepted.
 */
import { APCAcontrast, displayP3toY, sRGBtoY } from 'apca-w3';
import { describe, expect, it } from 'vitest';
import { Colordx, colordx, extend, inGamutSrgb } from '../src/index.js';
import type { AnyColor } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import a98rgb from '../src/plugins/a98rgb.js';
import cmyk from '../src/plugins/cmyk.js';
import cvd from '../src/plugins/cvd.js';
import harmonies from '../src/plugins/harmonies.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import minify from '../src/plugins/minify.js';
import mix from '../src/plugins/mix.js';
import names from '../src/plugins/names.js';
import okhsl from '../src/plugins/okhsl.js';
import okhsv from '../src/plugins/okhsv.js';
import p3 from '../src/plugins/p3.js';
import prophoto from '../src/plugins/prophoto.js';
import rec2020 from '../src/plugins/rec2020.js';
import srgbLinear from '../src/plugins/srgb-linear.js';
import tinycolor from '../src/tinycolor.js';

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Independent reference implementation
// ═════════════════════════════════════════════════════════════════════════════════════════════════
type V3 = [number, number, number];
type M3 = [V3, V3, V3];

const mulv = (m: M3, v: V3): V3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const mulm = (a: M3, b: M3): M3 =>
  [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => a[i]![0]! * b[0]![j]! + a[i]![1]! * b[1]![j]! + a[i]![2]! * b[2]![j]!)
  ) as M3;
const inv = (m: M3): M3 => {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h,
    B = -(d * i - f * g),
    C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det],
  ];
};
const xyToXYZ = (x: number, y: number): V3 => [x / y, 1, (1 - x - y) / y];
const WHITE_D65 = xyToXYZ(0.3127, 0.329);
const WHITE_D50 = xyToXYZ(0.3457, 0.3585);
const rgbToXyzFromPrimaries = (p: [number, number][], w: V3): M3 => {
  const cols = p.map(([x, y]) => xyToXYZ(x, y));
  const P: M3 = [0, 1, 2].map((r) => [cols[0]![r]!, cols[1]![r]!, cols[2]![r]!]) as M3;
  const S = mulv(inv(P), w);
  return P.map((row) => [row[0] * S[0], row[1] * S[1], row[2] * S[2]]) as M3;
};
const SRGB_TO_XYZ = rgbToXyzFromPrimaries(
  [
    [0.64, 0.33],
    [0.3, 0.6],
    [0.15, 0.06],
  ],
  WHITE_D65
);
const XYZ_TO_SRGB = inv(SRGB_TO_XYZ);
const P3_TO_XYZ = rgbToXyzFromPrimaries(
  [
    [0.68, 0.32],
    [0.265, 0.69],
    [0.15, 0.06],
  ],
  WHITE_D65
);
const REC2020_TO_XYZ = rgbToXyzFromPrimaries(
  [
    [0.708, 0.292],
    [0.17, 0.797],
    [0.131, 0.046],
  ],
  WHITE_D65
);
const A98_TO_XYZ = rgbToXyzFromPrimaries(
  [
    [0.64, 0.33],
    [0.21, 0.71],
    [0.15, 0.06],
  ],
  WHITE_D65
);
const PROPHOTO_TO_XYZD50 = rgbToXyzFromPrimaries(
  [
    [0.734699, 0.265301],
    [0.159597, 0.840403],
    [0.036598, 0.000105],
  ],
  WHITE_D50
);
const BRADFORD: M3 = [
  [0.8951, 0.2664, -0.1614],
  [-0.7502, 1.7135, 0.0367],
  [0.0389, -0.0685, 1.0296],
];
const adapt = (from: V3, to: V3): M3 => {
  const s = mulv(BRADFORD, from),
    d = mulv(BRADFORD, to);
  const D: M3 = [
    [d[0] / s[0], 0, 0],
    [0, d[1] / s[1], 0],
    [0, 0, d[2] / s[2]],
  ];
  return mulm(inv(BRADFORD), mulm(D, BRADFORD));
};
const D65_TO_D50 = adapt(WHITE_D65, WHITE_D50);
const D50_TO_D65 = adapt(WHITE_D50, WHITE_D65);

// Transfer curves (CSS Color 4 conversions.js, sign-extended)
const sgn = (f: (x: number) => number) => (x: number) => (x < 0 ? -f(-x) : f(x));
const srgbLin = sgn((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
const srgbGam = sgn((x) => (x > 0.0031308 ? 1.055 * x ** (1 / 2.4) - 0.055 : 12.92 * x));
const rec2020Lin = sgn((x) => x ** 2.4);
const rec2020Gam = sgn((x) => x ** (1 / 2.4));
const a98Lin = sgn((x) => x ** (563 / 256));
const a98Gam = sgn((x) => x ** (256 / 563));
const prophotoLin = sgn((x) => (x <= 16 / 512 ? x / 16 : x ** 1.8));
const prophotoGam = sgn((x) => (x >= 1 / 512 ? x ** (1 / 1.8) : 16 * x));

// OKLab — CSS Color 4 (conversions.js, 2023+): XYZtoLMS and LMStoOKLab, composed with the sRGB→XYZ
// matrix derived above. (Ottosson's published 10-digit sRGB matrix agrees to ~1e-10.)
const CSS_XYZ_TO_LMS: M3 = [
  [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];
const OK_M2: M3 = [
  [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];
const OK_M1: M3 = mulm(CSS_XYZ_TO_LMS, SRGB_TO_XYZ);
const OK_M1I = inv(OK_M1),
  OK_M2I = inv(OK_M2);
const linToOklab = (lin: V3): V3 => mulv(OK_M2, mulv(OK_M1, lin).map(Math.cbrt) as V3);
const oklabToLin = (lab: V3): V3 => mulv(OK_M1I, mulv(OK_M2I, lab).map((x) => x * x * x) as V3);

// XYZ (0–1 scale)
const linToXyz65 = (lin: V3): V3 => mulv(SRGB_TO_XYZ, lin);
const xyz65ToLin = (xyz: V3): V3 => mulv(XYZ_TO_SRGB, xyz);
const linToXyz50 = (lin: V3): V3 => mulv(D65_TO_D50, linToXyz65(lin));
const xyz50ToLin = (xyz: V3): V3 => xyz65ToLin(mulv(D50_TO_D65, xyz));

// CIE Lab (CSS Color 4)
const EPS = 216 / 24389,
  KAPPA = 24389 / 27;
const xyzToLab = (xyz: V3, white: V3): V3 => {
  const f = xyz.map((v, i) => {
    const t = v / white[i]!;
    return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
  });
  return [116 * f[1]! - 16, 500 * (f[0]! - f[1]!), 200 * (f[1]! - f[2]!)];
};
const labToXyz = ([L, a, b]: V3, white: V3): V3 => {
  const fy = (L + 16) / 116,
    fx = a / 500 + fy,
    fz = fy - b / 200;
  const x = fx ** 3 > EPS ? fx ** 3 : (116 * fx - 16) / KAPPA;
  const y = L > KAPPA * EPS ? fy ** 3 : L / KAPPA;
  const z = fz ** 3 > EPS ? fz ** 3 : (116 * fz - 16) / KAPPA;
  return [x * white[0], y * white[1], z * white[2]];
};
const linToLab = (lin: V3): V3 => xyzToLab(linToXyz50(lin), WHITE_D50);
const labToLin = (lab: V3): V3 => xyz50ToLin(labToXyz(lab, WHITE_D50));
const toPolar = ([l, a, b]: V3): V3 => {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [l, Math.hypot(a, b), h < 0 ? h + 360 : h];
};
const fromPolar = ([l, c, h]: V3): V3 => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];

// Wide gamut, all via XYZ D65 (ProPhoto via Bradford to D50)
const XYZ_TO_P3 = inv(P3_TO_XYZ),
  XYZ_TO_REC2020 = inv(REC2020_TO_XYZ),
  XYZ_TO_A98 = inv(A98_TO_XYZ),
  XYZD50_TO_PROPHOTO = inv(PROPHOTO_TO_XYZD50);
const linToP3Lin = (lin: V3): V3 => mulv(XYZ_TO_P3, linToXyz65(lin));
const p3LinToLin = (p: V3): V3 => xyz65ToLin(mulv(P3_TO_XYZ, p));
const linToRec2020Lin = (lin: V3): V3 => mulv(XYZ_TO_REC2020, linToXyz65(lin));
const rec2020LinToLin = (p: V3): V3 => xyz65ToLin(mulv(REC2020_TO_XYZ, p));
const linToA98Lin = (lin: V3): V3 => mulv(XYZ_TO_A98, linToXyz65(lin));
const a98LinToLin = (p: V3): V3 => xyz65ToLin(mulv(A98_TO_XYZ, p));
const linToProphotoLin = (lin: V3): V3 => mulv(XYZD50_TO_PROPHOTO, linToXyz50(lin));
const prophotoLinToLin = (p: V3): V3 => xyz50ToLin(mulv(PROPHOTO_TO_XYZD50, p));

// sRGB cylindrical models (on gamma-encoded 0–1)
const rgbToHsl = ([r, g, b]: V3): V3 => {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    l = (max + min) / 2;
  if (d === 0) return [0, 0, l * 100];
  const s = l === 0 || l === 1 ? 0 : (max - l) / Math.min(l, 1 - l);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
};
const hslToRgb = ([h, s, l]: V3): V3 => {
  s /= 100;
  l /= 100;
  h = ((h % 360) + 360) % 360;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
};
const rgbToHsv = ([r, g, b]: V3): V3 => {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const h = d === 0 ? 0 : rgbToHsl([r, g, b])[0];
  return [h, max === 0 ? 0 : (d / max) * 100, max * 100];
};
const rgbToHwb = ([r, g, b]: V3): V3 => [
  rgbToHsv([r, g, b])[0],
  Math.min(r, g, b) * 100,
  (1 - Math.max(r, g, b)) * 100,
];
const hwbToRgb = ([h, w, bl]: V3): V3 => {
  w /= 100;
  bl /= 100;
  if (w + bl >= 1) {
    const g = w / (w + bl);
    return [g, g, g];
  }
  return hslToRgb([h, 100, 50]).map((c) => c * (1 - w - bl) + w) as V3;
};
const rgbToCmyk = ([r, g, b]: V3): [number, number, number, number] => {
  const k = 1 - Math.max(r, g, b);
  if (k === 1) return [0, 0, 0, 100];
  return [((1 - r - k) / (1 - k)) * 100, ((1 - g - k) / (1 - k)) * 100, ((1 - b - k) / (1 - k)) * 100, k * 100];
};

// ── Okhsl / Okhsv: Björn Ottosson's reference (ok_color.h, MIT), with his float matrices ──
const okLab2Lin = (L: number, a: number, b: number): V3 => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_,
    m = m_ * m_ * m_,
    s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
const okLin2Lab = (r: number, g: number, b: number): V3 => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const computeMaxSaturation = (a: number, b: number): number => {
  let k0, k1, k2, k3, k4, wl, wm, ws;
  if (-1.88170328 * a - 0.80936493 * b > 1) {
    [k0, k1, k2, k3, k4, wl, wm, ws] = [
      1.19086277, 1.76576728, 0.59662641, 0.75515197, 0.56771245, 4.0767416621, -3.3077115913, 0.2309699292,
    ];
  } else if (1.81444104 * a - 1.19445276 * b > 1) {
    [k0, k1, k2, k3, k4, wl, wm, ws] = [
      0.73956515, -0.45954404, 0.08285427, 0.1254107, 0.14503204, -1.2684380046, 2.6097574011, -0.3413193965,
    ];
  } else {
    [k0, k1, k2, k3, k4, wl, wm, ws] = [
      1.35733652, -0.00915799, -1.1513021, -0.50559606, 0.00692167, -0.0041960863, -0.7034186147, 1.707614701,
    ];
  }
  let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;
  const k_l = 0.3963377774 * a + 0.2158037573 * b;
  const k_m = -0.1055613458 * a - 0.0638541728 * b;
  const k_s = -0.0894841775 * a - 1.291485548 * b;
  {
    const l_ = 1 + S * k_l,
      m_ = 1 + S * k_m,
      s_ = 1 + S * k_s;
    const l = l_ ** 3,
      m = m_ ** 3,
      s = s_ ** 3;
    const l_dS = 3 * k_l * l_ * l_,
      m_dS = 3 * k_m * m_ * m_,
      s_dS = 3 * k_s * s_ * s_;
    const l_dS2 = 6 * k_l * k_l * l_,
      m_dS2 = 6 * k_m * k_m * m_,
      s_dS2 = 6 * k_s * k_s * s_;
    const f = wl * l + wm * m + ws * s;
    const f1 = wl * l_dS + wm * m_dS + ws * s_dS;
    const f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;
    S = S - (f * f1) / (f1 * f1 - 0.5 * f * f2);
  }
  return S;
};
const findCusp = (a: number, b: number): [number, number] => {
  const S = computeMaxSaturation(a, b);
  const rgb = okLab2Lin(1, S * a, S * b);
  const L = Math.cbrt(1 / Math.max(rgb[0], rgb[1], rgb[2]));
  return [L, L * S];
};
const findGamutIntersection = (
  a: number,
  b: number,
  L1: number,
  C1: number,
  L0: number,
  cusp: [number, number]
): number => {
  let t: number;
  if ((L1 - L0) * cusp[1] - (cusp[0] - L0) * C1 <= 0) {
    t = (cusp[1] * L0) / (C1 * cusp[0] + cusp[1] * (L0 - L1));
  } else {
    t = (cusp[1] * (L0 - 1)) / (C1 * (cusp[0] - 1) + cusp[1] * (L0 - L1));
    const dL = L1 - L0,
      dC = C1;
    const k_l = 0.3963377774 * a + 0.2158037573 * b;
    const k_m = -0.1055613458 * a - 0.0638541728 * b;
    const k_s = -0.0894841775 * a - 1.291485548 * b;
    const l_dt = dL + dC * k_l,
      m_dt = dL + dC * k_m,
      s_dt = dL + dC * k_s;
    const L = L0 * (1 - t) + t * L1,
      C = t * C1;
    const l_ = L + C * k_l,
      m_ = L + C * k_m,
      s_ = L + C * k_s;
    const l = l_ ** 3,
      m = m_ ** 3,
      s = s_ ** 3;
    const ldt = 3 * l_dt * l_ * l_,
      mdt = 3 * m_dt * m_ * m_,
      sdt = 3 * s_dt * s_ * s_;
    const ldt2 = 6 * l_dt * l_dt * l_,
      mdt2 = 6 * m_dt * m_dt * m_,
      sdt2 = 6 * s_dt * s_dt * s_;
    const step = (w: V3) => {
      const r = w[0] * l + w[1] * m + w[2] * s - 1;
      const r1 = w[0] * ldt + w[1] * mdt + w[2] * sdt;
      const r2 = w[0] * ldt2 + w[1] * mdt2 + w[2] * sdt2;
      const u = r1 / (r1 * r1 - 0.5 * r * r2);
      return u >= 0 ? -r * u : Number.MAX_VALUE;
    };
    t += Math.min(
      step([4.0767416621, -3.3077115913, 0.2309699292]),
      step([-1.2684380046, 2.6097574011, -0.3413193965]),
      step([-0.0041960863, -0.7034186147, 1.707614701])
    );
  }
  return t;
};
const getSTmax = (cusp: [number, number]): [number, number] => [cusp[1] / cusp[0], cusp[1] / (1 - cusp[0])];
const getSTmid = (a_: number, b_: number): [number, number] => {
  const S =
    0.11516993 +
    1 /
      (7.4477897 +
        4.1590124 * b_ +
        a_ *
          (-2.19557347 +
            1.75198401 * b_ +
            a_ * (-2.13704948 - 10.02301043 * b_ + a_ * (-4.24894561 + 5.38770819 * b_ + 4.69891013 * a_))));
  const T =
    0.11239642 +
    1 /
      (1.6132032 -
        0.68124379 * b_ +
        a_ *
          (0.40370612 +
            0.90148123 * b_ +
            a_ * (-0.27087943 + 0.6122399 * b_ + a_ * (0.00299215 - 0.45399568 * b_ - 0.14661872 * a_))));
  return [S, T];
};
const getCs = (L: number, a_: number, b_: number): V3 => {
  const cusp = findCusp(a_, b_);
  const C_max = findGamutIntersection(a_, b_, L, 1, L, cusp);
  const ST_max = getSTmax(cusp);
  const [S_mid, T_mid] = getSTmid(a_, b_);
  const k = C_max / Math.min(L * ST_max[0], (1 - L) * ST_max[1]);
  const Ca = L * S_mid,
    Cb = (1 - L) * T_mid;
  const C_mid = 0.9 * k * Math.sqrt(Math.sqrt(1 / (1 / Ca ** 4 + 1 / Cb ** 4)));
  const Ca0 = L * 0.4,
    Cb0 = (1 - L) * 0.8;
  const C_0 = Math.sqrt(1 / (1 / Ca0 ** 2 + 1 / Cb0 ** 2));
  return [C_0, C_mid, C_max];
};
const K1 = 0.206,
  K2 = 0.03,
  K3 = (1 + K1) / (1 + K2);
const toe = (x: number) => 0.5 * (K3 * x - K1 + Math.sqrt((K3 * x - K1) ** 2 + 4 * K2 * K3 * x));
const toeInv = (x: number) => (x * x + K1 * x) / (K3 * (x + K2));

/** gamma sRGB 0–1 → Okhsl (h turns, s, l in 0–1), Ottosson's srgb_to_okhsl. */
const srgbToOkhsl = (rgb: V3): V3 => {
  const [L, a, b] = linToOklab(rgb.map(srgbLin) as V3);
  const C = Math.hypot(a, b);
  const a_ = a / C,
    b_ = b / C;
  const h = 0.5 + (0.5 * Math.atan2(-b, -a)) / Math.PI;
  const [C_0, C_mid, C_max] = getCs(L, a_, b_);
  const mid = 0.8,
    mid_inv = 1.25;
  let s: number;
  if (C < C_mid) {
    const k_1 = mid * C_0,
      k_2 = 1 - k_1 / C_mid;
    s = (C / (k_1 + k_2 * C)) * mid;
  } else {
    const k_0 = C_mid,
      k_1 = ((1 - mid) * C_mid * C_mid * mid_inv * mid_inv) / C_0,
      k_2 = 1 - k_1 / (C_max - C_mid);
    const t = (C - k_0) / (k_1 + k_2 * (C - k_0));
    s = mid + (1 - mid) * t;
  }
  return [h, s, toe(L)];
};
const okhslToSrgb = ([h, s, l]: V3): V3 => {
  if (l >= 1) return [1, 1, 1];
  if (l <= 0) return [0, 0, 0];
  const a_ = Math.cos(2 * Math.PI * h),
    b_ = Math.sin(2 * Math.PI * h);
  const L = toeInv(l);
  const [C_0, C_mid, C_max] = getCs(L, a_, b_);
  const mid = 0.8,
    mid_inv = 1.25;
  let C: number;
  if (s < mid) {
    const t = mid_inv * s,
      k_1 = mid * C_0,
      k_2 = 1 - k_1 / C_mid;
    C = (t * k_1) / (1 - k_2 * t);
  } else {
    const t = (s - mid) / (1 - mid),
      k_0 = C_mid,
      k_1 = ((1 - mid) * C_mid * C_mid * mid_inv * mid_inv) / C_0,
      k_2 = 1 - k_1 / (C_max - C_mid);
    C = k_0 + (t * k_1) / (1 - k_2 * t);
  }
  return okLab2Lin(L, C * a_, C * b_).map(srgbGam) as V3;
};
const srgbToOkhsv = (rgb: V3): V3 => {
  const [Lab, a, b] = linToOklab(rgb.map(srgbLin) as V3);
  let C = Math.hypot(a, b),
    L = Lab;
  const a_ = a / C,
    b_ = b / C;
  const h = 0.5 + (0.5 * Math.atan2(-b, -a)) / Math.PI;
  const [S_max, T] = getSTmax(findCusp(a_, b_));
  const S_0 = 0.5,
    k = 1 - S_0 / S_max;
  const t = T / (C + L * T);
  const L_v = t * L,
    C_v = t * C;
  const L_vt = toeInv(L_v),
    C_vt = (C_v * L_vt) / L_v;
  const rs = okLab2Lin(L_vt, a_ * C_vt, b_ * C_vt);
  const scale_L = Math.cbrt(1 / Math.max(rs[0], rs[1], rs[2], 0));
  L = L / scale_L;
  C = C / scale_L;
  C = (C * toe(L)) / L;
  L = toe(L);
  const v = L / L_v;
  const s = ((S_0 + T) * C_v) / (T * S_0 + T * k * C_v);
  return [h, s, v];
};
const okhsvToSrgb = ([h, s, v]: V3): V3 => {
  const a_ = Math.cos(2 * Math.PI * h),
    b_ = Math.sin(2 * Math.PI * h);
  const [S_max, T] = getSTmax(findCusp(a_, b_));
  const S_0 = 0.5,
    k = 1 - S_0 / S_max;
  const L_v = 1 - (s * S_0) / (S_0 + T - T * k * s);
  const C_v = (s * T * S_0) / (S_0 + T - T * k * s);
  let L = v * L_v,
    C = v * C_v;
  const L_vt = toeInv(L_v),
    C_vt = (C_v * L_vt) / L_v;
  const L_new = toeInv(L);
  C = (C * L_new) / L;
  L = L_new;
  const rs = okLab2Lin(L_vt, a_ * C_vt, b_ * C_vt);
  const scale_L = Math.cbrt(1 / Math.max(rs[0], rs[1], rs[2], 0));
  L *= scale_L;
  C *= scale_L;
  return okLab2Lin(L, C * a_, C * b_).map(srgbGam) as V3;
};

// ── CIEDE2000 (Sharma, Wu, Dalal 2005) ──
const ciede2000 = ([L1, a1, b1]: V3, [L2, a2, b2]: V3): number => {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1),
    C2 = Math.hypot(a2, b2);
  const Cb7 = ((C1 + C2) / 2) ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + 25 ** 7)));
  const a1p = (1 + G) * a1,
    a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1),
    C2p = Math.hypot(a2p, b2);
  const hp = (b: number, a: number) => (b === 0 && a === 0 ? 0 : (((Math.atan2(b, a) / rad) % 360) + 360) % 360);
  const h1p = hp(b1, a1p),
    h2p = hp(b2, a2p);
  const dLp = L2 - L1,
    dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2,
    Cbp = (C1p + C2p) / 2;
  let hbp: number;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Cbp7 = Cbp ** 7;
  const RC = 2 * Math.sqrt(Cbp7 / (Cbp7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp,
    SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
};

// WCAG 2.x relative luminance / contrast on bytes
const wcagLum = (rgb255: V3): number => {
  const [r, g, b] = rgb255.map((c) => srgbLin(c / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const wcagRatio = (a: V3, b: V3): number => {
  const la = wcagLum(a),
    lb = wcagLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// Rounding exactly like colordx's round() (Math.round on p*n, half toward +∞ in binary)
const rnd = (n: number, d: number) => Math.round(10 ** d * n) / 10 ** d || 0;

// ── CSS Color 4 §13.2 gamut mapping (binary search on OKLCH chroma; clip + deltaEOK < JND) ──
// Returns the clipped linear channels of the destination space.
const GM_TO: Record<string, (lin: V3) => V3> = {
  srgb: (l) => l,
  p3: linToP3Lin,
  rec2020: linToRec2020Lin,
};
const GM_FROM: Record<string, (lin: V3) => V3> = {
  srgb: (l) => l,
  p3: p3LinToLin,
  rec2020: rec2020LinToLin,
};
const gamutMap = (oklab: V3, space: string): V3 => {
  const to = (lab: V3) => GM_TO[space]!(oklabToLin(lab));
  const back = (t: V3) => linToOklab(GM_FROM[space]!(t));
  const inG = (t: V3) => t.every((x) => x >= 0 && x <= 1);
  const clip = (t: V3) => t.map((x) => Math.min(1, Math.max(0, x))) as V3;
  const dE = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const [L, C, H] = toPolar(oklab);
  if (L >= 1) return [1, 1, 1];
  if (L <= 0) return [0, 0, 0];
  const origin = to(oklab);
  if (inG(origin)) return origin;
  const JND = 0.02,
    EPS_ = 0.0001;
  let clipped = clip(origin);
  if (dE(back(clipped), oklab) < JND) return clipped;
  let min = 0,
    max = C,
    minIn = true;
  while (max - min > EPS_) {
    const chroma = (min + max) / 2;
    const cur = fromPolar([L, chroma, H]);
    const t = to(cur);
    if (minIn && inG(t)) {
      min = chroma;
      continue;
    }
    clipped = clip(t);
    const E = dE(back(clipped), cur);
    if (E < JND) {
      if (JND - E < EPS_) return clipped;
      minIn = false;
      min = chroma;
    } else max = chroma;
  }
  return clipped;
};

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Harness
// ═════════════════════════════════════════════════════════════════════════════════════════════════
extend([
  lab,
  lch,
  p3,
  rec2020,
  a98rgb,
  prophoto,
  srgbLinear,
  hsv,
  hwb,
  cmyk,
  okhsl,
  okhsv,
  a11y,
  mix,
  harmonies,
  cvd,
  minify,
  names,
]);

type Raw = { r: number; g: number; b: number; alpha: number };
const raw = (c: AnyColor | Colordx): Raw => new Colordx(c as AnyColor)._rawRgb();
const g01 = (r: Raw): V3 => [r.r / 255, r.g / 255, r.b / 255];
const clip01 = (v: V3): V3 => v.map((x) => Math.min(1, Math.max(0, x))) as V3;
const linOf = (r: Raw): V3 => g01(r).map(srgbLin) as V3;

/** True when `x` sits within float noise of a rounding boundary at `d` decimals. */
const nearTie = (x: number, d: number): boolean => {
  const s = Math.abs(x) * 10 ** d;
  return Math.abs(s - Math.floor(s) - 0.5) < 1e-6;
};
/**
 * `got` is colordx's printed value, `ref` the independent float. Away from a rounding tie the
 * reference rounded like colordx (Math.round(x·10^d)/10^d) must match exactly; on a tie either
 * neighbour is accepted. `slack` widens the window for references that are themselves only good
 * to ~1e-7 (Ottosson's float constants in Okhsl/Okhsv).
 */
const expectRounded = (got: number, ref: number, d: number, label: string, slack = 0): void => {
  if (!slack && !nearTie(ref, d)) expect(got, `${label}: ref ${ref}`).toBe(rnd(ref, d));
  else expect(Math.abs(got - ref), `${label}: ref ${ref}`).toBeLessThanOrEqual(0.5 * 10 ** -d + slack + 1e-9);
};
const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};
const expectHue = (got: number, ref: number, d: number, label: string, slack = 0): void => {
  if (!slack && !nearTie(ref, d)) {
    const e = rnd(ref, d);
    expect(got, `${label}: ref hue ${ref}`).toBe(e >= 360 ? 0 : e);
  } else expect(hueDist(got, ref), `${label}: ref hue ${ref}`).toBeLessThanOrEqual(0.5 * 10 ** -d + slack + 1e-9);
};
/** Splits a CSS function string into its name/space skeleton and its numbers. */
const NUM_RE = /(?<![a-z\d.])-?\d+(?:\.\d+)?(?:e-?\d+)?/g;
const nums = (s: string): number[] => (s.match(NUM_RE) ?? []).map(Number);
const skeleton = (s: string): string => s.replace(NUM_RE, '#');

// ── Representative inputs: the ones existing goldens use, plus primaries, greys, near-black, wide gamut
const INPUTS: string[] = [
  // existing goldens (readme / gamut / okhsl / contrast tests)
  '#ff0000',
  '#3d7a9f',
  '#ef4444',
  '#10b981',
  '#3b82f6',
  '#777777',
  '#faaaac',
  '#0069c7',
  '#2563eb',
  'oklch(0.5 0.4 180)',
  'oklch(0.2591 0.1511 28.95)',
  'oklch(0.7 0.4 145)',
  'oklch(0.6279 0.2577 29.23)',
  'oklch(0.5 0.2 240)',
  'color(display-p3 0.9176 0.2003 0.1386)',
  'color(rec2020 0.82346 0.32843 0.18034)',
  'color(a98-rgb 0.8586 0 0)',
  'color(prophoto-rgb 0.70225 0.27572 0.10355)',
  'color(srgb-linear 1 0 0)',
  // primaries / secondaries
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#00ffff',
  '#ff00ff',
  // greys and near-black / near-white
  '#000000',
  '#010101',
  '#808080',
  '#fefefe',
  '#ffffff',
  '#010000',
  '#000001',
  'rgb(1 2 3)',
  'oklch(0.01 0.01 30)',
  // wide gamut
  'color(display-p3 1 0 0)',
  'color(display-p3 0 1 0)',
  'color(rec2020 0 1 0)',
  'color(rec2020 1 0 0)',
  'lab(50 100 -100)',
  'lch(80 120 140)',
  'oklch(0.7 0.3 145)',
  'color(prophoto-rgb 0 1 0)',
  'oklab(0.6 0.3 -0.3)',
  'color(xyz-d65 0.2 0.3 0.4)',
  'color(xyz-d50 0.5 0.4 0.1)',
  // alpha
  'rgb(255 0 0 / 0.5)',
  '#3b82f680',
];

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('reference self-checks (the independent implementation against published values)', () => {
  it('derived sRGB → XYZ matrix matches the CSS Color 4 rational matrix', () => {
    // CSS Color 4 conversions.js lin_sRGB_to_XYZ, first row: 506752/1228815, 87881/245763, 12673/70218
    expect(SRGB_TO_XYZ[0][0]).toBeCloseTo(506752 / 1228815, 15);
    expect(SRGB_TO_XYZ[0][1]).toBeCloseTo(87881 / 245763, 15);
    expect(SRGB_TO_XYZ[0][2]).toBeCloseTo(12673 / 70218, 15);
    expect(SRGB_TO_XYZ[1][1]).toBeCloseTo(175762 / 245763, 15);
  });
  it('D50 white is xy 0.3457/0.3585 (Z = 0.82510…, not the ICC 0.82521)', () => {
    expect(WHITE_D50[0]).toBeCloseTo(0.3457 / 0.3585, 15);
    expect(WHITE_D50[2]).toBeCloseTo(0.2958 / 0.3585, 15);
  });
  it('Bradford D65 → D50 matches the CSS Color 4 matrix', () => {
    expect(D65_TO_D50[0][0]).toBeCloseTo(1.0479297925449969, 12);
    expect(D65_TO_D50[1][1]).toBeCloseTo(0.9904344267538799, 12);
    expect(D65_TO_D50[2][2]).toBeCloseTo(0.7518742814281371, 12);
  });
  it('OKLab of sRGB white is (1, 0, 0) and red matches Ottosson', () => {
    const w = linToOklab([1, 1, 1]);
    expect(w[0]).toBeCloseTo(1, 12);
    expect(Math.hypot(w[1], w[2])).toBeLessThan(1e-12);
    // Ottosson's sRGB matrix (10 digits) gives the same red to ~1e-9
    const r = linToOklab([1, 0, 0]);
    expect(r[0]).toBeCloseTo(0.627955, 5);
    expect(r[1]).toBeCloseTo(0.224863, 5);
    expect(r[2]).toBeCloseTo(0.125846, 5);
  });
  it('CIEDE2000 reproduces Sharma, Wu & Dalal (2005) test data', () => {
    const pairs: [V3, V3, number][] = [
      [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
      [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
      [[50, -1, 2], [50, 0, 0], 2.3669],
      [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
      [[50, 2.5, 0], [73, 25, -18], 27.1492],
      [[50, 2.5, 0], [56, -27, -3], 31.903],
      [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
      [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
      [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
    ];
    for (const [a, b, e] of pairs) expect(ciede2000(a, b)).toBeCloseTo(e, 4);
  });
  it('APCA reference (apca-w3 0.0.98G-4g) sample values', () => {
    expect(APCAcontrast(sRGBtoY([0, 0, 0]), sRGBtoY([255, 255, 255]))).toBeCloseTo(106.04, 2);
    expect(APCAcontrast(sRGBtoY([255, 255, 255]), sRGBtoY([0, 0, 0]))).toBeCloseTo(-107.88, 2);
    expect(APCAcontrast(sRGBtoY([0x88, 0x88, 0x88]), sRGBtoY([255, 255, 255]))).toBeCloseTo(63.06, 2);
  });
  it('Okhsl/Okhsv port round-trips (Ottosson reference)', () => {
    for (const c of [
      [0.2, 0.5, 0.7],
      [1, 0, 0],
      [0.9, 0.9, 0.1],
    ] as V3[]) {
      const back = okhslToSrgb(srgbToOkhsl(c));
      back.forEach((x, i) => expect(x).toBeCloseTo(c[i]!, 6));
      const back2 = okhsvToSrgb(srgbToOkhsv(c));
      back2.forEach((x, i) => expect(x).toBeCloseTo(c[i]!, 6));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('conversions: colordx output vs independent reference at printed precision', () => {
  type Check = (c: Colordx, r: Raw, label: string) => void;
  const cyl =
    (fn: (v: V3) => V3, key: [string, string, string], d: number, pick: (c: Colordx, p: number) => any): Check =>
    (c, r, label) => {
      const cl = clip01(g01(r));
      for (const p of [d, 0, 6]) {
        const v = fn(cl);
        const achro = Math.max(...cl) - Math.min(...cl) <= 1e-6; // ACHROMATIC_EPS: hue 0 by design
        const got = pick(c, p);
        if (!achro) expectHue(got[key[0]], v[0], p, `${label} ${key[0]} @${p}`);
        else expect(got[key[0]]).toBe(0);
        expectRounded(got[key[1]], achro && key[1] === 's' ? 0 : v[1], p, `${label} ${key[1]} @${p}`);
        expectRounded(got[key[2]], v[2], p, `${label} ${key[2]} @${p}`);
      }
    };
  const rect =
    (fn: (r: Raw) => number[], keys: string[], d: number, pick: (c: Colordx, p: number) => any): Check =>
    (c, r, label) => {
      for (const p of [d, 0, 6]) {
        const v = fn(r);
        const got = pick(c, p);
        keys.forEach((k, i) => expectRounded(got[k], v[i]!, p, `${label} ${k} @${p}`));
      }
    };
  const polar =
    (fn: (r: Raw) => V3, achroC: number, d: number, pick: (c: Colordx, p: number) => any): Check =>
    (c, r, label) => {
      for (const p of [d, 0, 6]) {
        const v = fn(r);
        const got = pick(c, p);
        expectRounded(got.l, v[0], p, `${label} L @${p}`);
        expectRounded(got.c, v[1], p, `${label} C @${p}`);
        if (v[1] >= achroC * 1.001) expectHue(got.h, v[2], p, `${label} H @${p}`);
      }
    };
  const wide = (fn: (lin: V3) => V3, d: number, pick: (c: Colordx, p: number) => any): Check =>
    rect((r) => fn(linOf(r)), ['r', 'g', 'b'], d, pick);

  const CHECKS: Record<string, Check> = {
    toHsl: cyl(rgbToHsl, ['h', 's', 'l'], 2, (c, p) => c.toHsl(p)),
    toHsv: cyl(rgbToHsv, ['h', 's', 'v'], 2, (c, p) => c.toHsv(p)),
    toHwb: cyl(rgbToHwb, ['h', 'w', 'b'], 2, (c, p) => c.toHwb(p)),
    toCmyk: rect(
      (r) => rgbToCmyk(clip01(g01(r))),
      ['c', 'm', 'y', 'k'],
      2,
      (c, p) => c.toCmyk(p)
    ),
    toOklab: rect(
      (r) => linToOklab(linOf(r)),
      ['l', 'a', 'b'],
      5,
      (c, p) => c.toOklab(p)
    ),
    toOklch: polar(
      (r) => toPolar(linToOklab(linOf(r))),
      0.000004,
      5,
      (c, p) => c.toOklch(p)
    ),
    toLab: rect(
      (r) => linToLab(linOf(r)),
      ['l', 'a', 'b'],
      2,
      (c, p) => c.toLab(p)
    ),
    toLch: polar(
      (r) => toPolar(linToLab(linOf(r))),
      0.0015,
      2,
      (c, p) => c.toLch(p)
    ),
    toXyz: rect(
      (r) => linToXyz50(linOf(r)).map((x) => x * 100),
      ['x', 'y', 'z'],
      2,
      (c, p) => c.toXyz(p)
    ),
    toXyzD65: rect(
      (r) => linToXyz65(linOf(r)).map((x) => x * 100),
      ['x', 'y', 'z'],
      2,
      (c, p) => c.toXyzD65(p)
    ),
    toP3: wide(
      (l) => linToP3Lin(l).map(srgbGam) as V3,
      4,
      (c, p) => c.toP3(p)
    ),
    toRec2020: wide(
      (l) => linToRec2020Lin(l).map(rec2020Gam) as V3,
      5,
      (c, p) => c.toRec2020(p)
    ),
    toA98: wide(
      (l) => linToA98Lin(l).map(a98Gam) as V3,
      4,
      (c, p) => c.toA98(p)
    ),
    toProphoto: wide(
      (l) => linToProphotoLin(l).map(prophotoGam) as V3,
      5,
      (c, p) => c.toProphoto(p)
    ),
    toSrgbLinear: wide(
      (l) => l,
      5,
      (c, p) => c.toSrgbLinear(p)
    ),
  };

  for (const input of INPUTS) {
    describe(input, () => {
      const c = colordx(input);
      const r = raw(input);
      for (const [name, check] of Object.entries(CHECKS)) it(name, () => check(c, r, `${input} ${name}`));

      it('string forms carry the same numbers as the objects', () => {
        const pairs: [string, number[], number][] = [
          [c.toOklchString(), [c.toOklch().l, c.toOklch().c], 5],
          [c.toLabString(), [c.toLab().l, c.toLab().a, c.toLab().b], 2],
          [c.toP3String(), [c.toP3().r, c.toP3().g, c.toP3().b], 4],
          [c.toRec2020String(), [c.toRec2020().r, c.toRec2020().g, c.toRec2020().b], 5],
        ];
        for (const [s, n] of pairs) expect(nums(s).slice(0, n.length), s).toEqual(n);
        // xyz strings are the 0–1 scale of the objects
        const x = linToXyz50(linOf(r)),
          x65 = linToXyz65(linOf(r));
        nums(c.toXyzString())
          .slice(0, 3)
          .forEach((v, i) => expectRounded(v, x[i]!, 5, `${input} xyz-d50[${i}]`));
        nums(c.toXyzD65String())
          .slice(0, 3)
          .forEach((v, i) => expectRounded(v, x65[i]!, 5, `${input} xyz-d65[${i}]`));
        expect(skeleton(c.toXyzString())).toMatch(/^color\(xyz-d50 # # #( \/ #)?\)$/);
      });

      it('Okhsl / Okhsv (Ottosson reference, ±1e-5 for his float constants)', () => {
        const cl = clip01(g01(r));
        const ok = linToOklab(cl.map(srgbLin) as V3);
        const C = Math.hypot(ok[1], ok[2]);
        const o = c.toOkhsl(),
          v = c.toOkhsv();
        if (C < 0.000004) {
          expect([o.h, o.s, v.h, v.s]).toEqual([0, 0, 0, 0]);
          expectRounded(o.l, toe(ok[0]) * 100, 5, `${input} okhsl l`, 1e-5);
          expectRounded(v.v, toe(ok[0]) * 100, 5, `${input} okhsv v`, 1e-5);
          return;
        }
        const hsl = srgbToOkhsl(cl),
          hsv_ = srgbToOkhsv(cl);
        expectHue(o.h, hsl[0] * 360, 5, `${input} okhsl h`, 1e-5);
        expectRounded(o.s, Math.min(100, Math.max(0, hsl[1] * 100)), 5, `${input} okhsl s`, 2e-5);
        expectRounded(o.l, hsl[2] * 100, 5, `${input} okhsl l`, 1e-5);
        expectHue(v.h, hsv_[0] * 360, 5, `${input} okhsv h`, 1e-5);
        expectRounded(v.s, Math.min(100, Math.max(0, hsv_[1] * 100)), 5, `${input} okhsv s`, 2e-5);
        expectRounded(v.v, Math.min(100, Math.max(0, hsv_[2] * 100)), 5, `${input} okhsv v`, 2e-5);
      });

      it('luminance() is WCAG 2.x relative luminance of the gamut-mapped color', () => {
        const lin = linOf(r);
        const inside = [r.r, r.g, r.b].every((x) => x >= 0 && x <= 255);
        if (!inside) return; // covered separately (see the snapping BUG below)
        const Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
        expectRounded(c.luminance(), Y, 4, `${input} luminance`);
        expectRounded(c.luminance(8), Y, 8, `${input} luminance@8`);
      });
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('parsing: CSS syntaxes resolve to the reference linear sRGB', () => {
  const lab_ = (L: number, a: number, b: number) => labToLin([L, a, b]);
  const CASES: [string, () => V3][] = [
    ['lab(54.29% 80.8 69.89)', () => lab_(54.29, 80.8, 69.89)],
    ['lab(50 40% -40%)', () => lab_(50, 50, -50)], // a/b: 100% = 125
    ['lch(50% 50% 180)', () => labToLin(fromPolar([50, 75, 180]))], // C: 100% = 150
    ['lch(60 40 0.5turn)', () => labToLin(fromPolar([60, 40, 180]))],
    ['lch(60 40 200grad)', () => labToLin(fromPolar([60, 40, 180]))],
    ['oklab(60% 25% -25%)', () => oklabToLin([0.6, 0.1, -0.1])], // a/b: 100% = 0.4
    ['oklch(70% 50% 3.14159265rad)', () => oklabToLin(fromPolar([0.7, 0.2, 179.9999998]))],
    ['oklch(1.2 0.1 30)', () => oklabToLin(fromPolar([1, 0.1, 30]))], // L clamps at parse time
    ['lab(120 0 0)', () => lab_(100, 0, 0)],
    ['color(display-p3 50% 25% 100%)', () => p3LinToLin([0.5, 0.25, 1].map(srgbLin) as V3)],
    ['color(rec2020 0.5 0.6 0.7)', () => rec2020LinToLin([0.5, 0.6, 0.7].map(rec2020Lin) as V3)],
    ['color(a98-rgb 0.5 0.6 0.7)', () => a98LinToLin([0.5, 0.6, 0.7].map(a98Lin) as V3)],
    ['color(prophoto-rgb 0.01 0.5 0.9)', () => prophotoLinToLin([0.01, 0.5, 0.9].map(prophotoLin) as V3)],
    ['color(xyz 0.3 0.4 0.5)', () => xyz65ToLin([0.3, 0.4, 0.5])],
    ['color(xyz-d50 30% 40% 50%)', () => xyz50ToLin([0.3, 0.4, 0.5])],
    ['color(srgb 1.2 -0.1 0.5)', () => [1.2, -0.1, 0.5].map(srgbLin) as V3],
    ['color(srgb-linear 0.2 0.4 0.6)', () => [0.2, 0.4, 0.6]],
  ];
  for (const [css, ref] of CASES)
    it(css, () => {
      const r = raw(css);
      const got = linOf(r);
      ref().forEach((x, i) => expect(Math.abs(got[i]! - x), `${css}[${i}] ref ${x}`).toBeLessThan(1e-9));
    });

  const SRGB: [string | object, V3][] = [
    ['hsl(210 60% 40%)', hslToRgb([210, 60, 40])],
    ['hsl(0.25turn 100% 50%)', hslToRgb([90, 100, 50])],
    ['hwb(200 20% 30%)', hwbToRgb([200, 20, 30])],
    ['hwb(200 70% 50%)', hwbToRgb([200, 70, 50])], // w + b > 100 normalises to grey
    ['rgb(50% 25% 12.5%)', [0.5, 0.25, 0.125]],
    ['device-cmyk(0.1 0.2 0.3 0.4)', [0.9 * 0.6, 0.8 * 0.6, 0.7 * 0.6]],
    [{ h: 210, s: 60, v: 40 }, hslToRgb([210, ((0.4 - 0.28) / 0.28) * 100, 28])], // v(1 − s/2) = L
    [{ colorSpace: 'okhsl', h: 250, s: 70, l: 50 }, okhslToSrgb([250 / 360, 0.7, 0.5])],
    [{ colorSpace: 'okhsv', h: 30, s: 80, v: 90 }, okhsvToSrgb([30 / 360, 0.8, 0.9])],
  ];
  for (const [inp, ref] of SRGB)
    it(JSON.stringify(inp), () => {
      const g = g01(raw(inp as AnyColor));
      // okhsl/okhsv: Ottosson's float constants limit the reference to ~1e-7
      ref.forEach((x, i) => expect(Math.abs(g[i]! - x), `${JSON.stringify(inp)}[${i}]`).toBeLessThan(2e-7));
    });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('manipulation, mixing, contrast, difference, gamut mapping', () => {
  const premix = (c1: V3, a1: number, c2: V3, a2: number, w: number): [V3, number] => {
    const alpha = a1 * (1 - w) + a2 * w;
    return [[0, 1, 2].map((i) => (c1[i]! * a1 * (1 - w) + c2[i]! * a2 * w) / alpha) as V3, alpha];
  };
  const PAIRS: [string, string, number][] = [
    ['#ff0000', '#0000ff', 0.5],
    ['#000000', '#ffffff', 0.5],
    ['#ef4444', '#10b981', 0.3],
    ['#ff000080', '#0000ff', 0.25],
    ['rgb(10 200 30 / 0.2)', 'rgb(200 20 250 / 0.9)', 0.6],
  ];

  for (const [a, b, w] of PAIRS) {
    it(`mix ${a} ${b} ${w}: premultiplied gamma-sRGB, bytes`, () => {
      const ra = raw(a),
        rb = raw(b);
      const [v, alpha] = premix([ra.r, ra.g, ra.b], ra.alpha, [rb.r, rb.g, rb.b], rb.alpha, w);
      const got = colordx(a).mix(b, w).toRgb();
      expect([got.r, got.g, got.b]).toEqual(v.map((x) => Math.round(x)));
      expect(got.alpha).toBe(rnd(alpha, 3));
    });
    for (const [name, to, back] of [
      ['mixOklab', linToOklab, oklabToLin],
      ['mixLab', linToLab, labToLin],
    ] as const)
      // Unclamped, like CSS color-mix(in oklab | lab): the result may sit outside sRGB.
      it(`${name} ${a} ${b} ${w}: premultiplied, unclamped`, () => {
        const ra = raw(a),
          rb = raw(b);
        const [v, alpha] = premix(to(linOf(ra)), ra.alpha, to(linOf(rb)), rb.alpha, w);
        const exp = back(v).map((x) => Math.sign(x) * srgbGam(Math.abs(x)) * 255);
        const got = (colordx(a) as any)[name](b, w)._rawRgb() as Raw;
        [got.r, got.g, got.b].forEach((x, i) => expect(Math.abs(x - exp[i]!), `${name} ch${i}`).toBeLessThan(1e-6));
        expect(got.alpha).toBe(rnd(alpha, 3));
      });
  }

  const CONTRAST: [string, string][] = [
    ['#ff0000', '#ffffff'],
    ['#777777', '#ffffff'],
    ['#767676', '#ffffff'],
    ['#3b82f6', '#ffffff'],
    ['#000000', '#ffffff'],
    ['#e60000', '#ffff47'],
    ['rgba(0, 0, 0, 0.5)', '#ffffff'],
    ['#10b981', '#ef4444'],
  ];
  for (const [fg, bg] of CONTRAST) {
    const composite = (): V3 => {
      const f = raw(fg),
        b = raw(bg);
      const w = f.alpha / (f.alpha + b.alpha * (1 - f.alpha));
      return [f.r * w + b.r * (1 - w), f.g * w + b.g * (1 - w), f.b * w + b.b * (1 - w)];
    };
    it(`contrast ${fg} on ${bg}: WCAG 2.x ratio (alpha composited)`, () => {
      const b = raw(bg);
      const ratio = wcagRatio(composite(), [b.r, b.g, b.b]);
      expectRounded(colordx(fg).contrast(bg), ratio, 2, `${fg}/${bg}`);
      expectRounded(colordx(fg).contrast(bg, 6), ratio, 6, `${fg}/${bg}@6`);
    });
    it(`apcaContrast ${fg} on ${bg}: apca-w3 0.1.9`, () => {
      const b = raw(bg);
      const lc = APCAcontrast(sRGBtoY(composite()), sRGBtoY([b.r, b.g, b.b])) as number;
      expectRounded(colordx(fg).apcaContrast(bg), lc, 1, `${fg}/${bg}`);
      expectRounded(colordx(fg).apcaContrast(bg, { precision: 6 }), lc, 6, `${fg}/${bg}@6`);
    });
  }

  it('apcaContrast in p3 space: apca-w3 displayP3toY on the P3 channels', () => {
    for (const [fg, bg] of [
      ['#ff0000', '#ffffff'],
      ['color(display-p3 0 0.6 0.2)', '#000000'],
      ['#3b82f6', '#ffffff'],
    ]) {
      const toP3 = (c: string) => linToP3Lin(linOf(raw(c))).map(srgbGam);
      const lc = APCAcontrast(displayP3toY(toP3(fg!)), displayP3toY(toP3(bg!))) as number;
      expectRounded(colordx(fg!).apcaContrast(bg!, { space: 'p3', precision: 4 }), lc, 4, `${fg}/${bg} p3`);
    }
  });

  it('delta(): CIEDE2000 / 100 on CIE Lab with the D65 white (sRGB-native, as culori lab65)', () => {
    const labD65 = (c: string) => xyzToLab(linToXyz65(linOf(raw(c))), WHITE_D65);
    for (const [a, b] of [
      ['#ef4444', '#10b981'],
      ['#ff0000', '#ffffff'],
      ['#3b82f6', '#2563eb'],
      ['#000', '#fff'],
      ['#808080', '#7f7f7f'],
    ]) {
      const d = ciede2000(labD65(a!), labD65(b!)) / 100;
      expectRounded(colordx(a!).delta(b!), d, 3, `${a}/${b}`);
      expectRounded(colordx(a!).delta(b!, 8), d, 8, `${a}/${b}@8`);
    }
  });

  it('rotate / harmonies / lighten / saturate follow the HSL definitions', () => {
    for (const hex of ['#3b82f6', '#ef4444', '#10b981', '#faaaac']) {
      const hsl = rgbToHsl(g01(raw(hex)));
      for (const deg of [30, 120, 180, -45, 400]) {
        const exp = hslToRgb([hsl[0] + deg, hsl[1], hsl[2]]).map((x) => x * 255);
        const got = colordx(hex).rotate(deg)._rawRgb();
        [got.r, got.g, got.b].forEach((x, i) => expect(Math.abs(x - exp[i]!)).toBeLessThan(1e-9));
      }
      const tri = colordx(hex)
        .harmonies('triadic')
        .map((c) => c.toHex());
      expect(tri).toEqual([0, 120, 240].map((d) => colordx(hex).rotate(d).toHex()));
      const li = hslToRgb([hsl[0], hsl[1], Math.min(100, hsl[2] + 10)]).map((x) => Math.round(x * 255));
      const gl = colordx(hex).lighten(0.1).toRgb();
      expect([gl.r, gl.g, gl.b]).toEqual(li);
      const sa = hslToRgb([hsl[0], Math.min(100, hsl[1] + 20), hsl[2]]).map((x) => Math.round(x * 255));
      const gs = colordx(hex).saturate(0.2).toRgb();
      expect([gs.r, gs.g, gs.b]).toEqual(sa);
    }
  });

  it('simulate(): Machado, Oliveira & Fernandes 2009 (severity 1) on linear sRGB', () => {
    const M: Record<string, number[]> = {
      protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
      deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
    };
    for (const hex of ['#ff0000', '#00ff00', '#3b82f6', '#ef4444', '#10b981'])
      for (const t of ['protanopia', 'deuteranopia'] as const) {
        const l = linOf(raw(hex));
        const m = M[t]!;
        const exp = [0, 3, 6].map(
          (i) => srgbGam(Math.min(1, Math.max(0, m[i]! * l[0] + m[i + 1]! * l[1] + m[i + 2]! * l[2]))) * 255
        );
        const got = colordx(hex).simulate(t).toRgb();
        expect([got.r, got.g, got.b], `${hex} ${t}`).toEqual(exp.map((x) => Math.round(x)));
      }
  });

  describe('CSS Color 4 gamut mapping', () => {
    const WIDE = [
      'oklch(0.5 0.4 180)',
      'oklch(0.7 0.4 145)',
      'oklch(0.6279 0.2577 29.23)',
      'oklch(0.2591 0.1511 28.95)',
      'oklch(0.9 0.3 100)',
      'oklch(0.3 0.3 270)',
      'color(display-p3 1 0 0)',
      'color(rec2020 0 1 0)',
      'lab(50 100 -100)',
      'lch(80 120 140)',
      'color(prophoto-rgb 0 1 0)',
    ];
    const oklabOf = (css: string): V3 => {
      const m = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(css);
      return m ? fromPolar([+m[1]!, +m[2]!, +m[3]!]) : linToOklab(linOf(raw(css)));
    };
    for (const css of WIDE) {
      it(`toGamutSrgb ${css}`, () => {
        const exp = gamutMap(oklabOf(css), 'srgb').map((x) => srgbGam(x) * 255);
        const got = Colordx.toGamutSrgb(css).toRgb();
        [got.r, got.g, got.b].forEach((x, i) => {
          if (!nearTie(exp[i]!, 0)) expect(x, `${css} ch${i} ref ${exp[i]}`).toBe(Math.round(exp[i]!));
        });
        // the float channels, apart from the documented half-byte snap to 0 / 255
        const r = colordx(css).mapSrgb()._rawRgb();
        [r.r, r.g, r.b].forEach((x, i) => {
          const e = exp[i]!;
          if (e >= 0.5 && e <= 254.5) expect(Math.abs(x - e), `${css} raw ch${i}`).toBeLessThan(1e-6);
        });
      });
      it(`toGamutP3 / toGamutRec2020 ${css}`, () => {
        for (const [space, fn, gam, d] of [
          ['p3', (x: string) => Colordx.toGamutP3(x).toP3(), srgbGam, 4],
          ['rec2020', (x: string) => Colordx.toGamutRec2020(x).toRec2020(), rec2020Gam, 5],
        ] as const) {
          const exp = gamutMap(oklabOf(css), space).map(gam);
          const got = fn(css);
          [got.r, got.g, got.b].forEach((x, i) => expectRounded(x, exp[i]!, d, `${css} ${space} ch${i}`));
        }
      });
    }
    it('gamut.test.ts pin: mapSrgb(oklch(0.5 0.4 180)) prints oklch(0.50903 0.09378 177.85846)', () => {
      const m = gamutMap(fromPolar([0.5, 0.4, 180]), 'srgb');
      const o = toPolar(linToOklab(m));
      const s = colordx('oklch(0.5 0.4 180)').mapSrgb().toOklchString();
      const n = nums(s);
      expectRounded(n[0]!, o[0], 5, 'L');
      expectRounded(n[1]!, o[1], 5, 'C');
      expectHue(n[2]!, o[2], 5, 'H');
    });
  });

  it('minify(): every output re-parses to the same sRGB color; wide gamut keeps oklch', () => {
    for (const css of [...INPUTS, 'rgba(10, 20, 30, 0.5)', '#11223344', 'transparent']) {
      const c = colordx(css);
      const m = c.minify({ name: true, alphaHex: true, transparent: true });
      const back = colordx(m);
      expect(back.isValid(), `${css} → ${m}`).toBe(true);
      if (inGamutSrgb(css)) expect(back.toHex(), `${css} → ${m}`).toBe(c.toHex());
      else expect(m.startsWith('oklch('), `${css} → ${m}`).toBe(true);
    }
  });

  it('tinycolor shim: getLuminance / readability are WCAG 2.x', () => {
    for (const [a, b] of [
      ['#ff0000', '#ffffff'],
      ['#777', '#fff'],
      ['#3b82f6', '#000'],
    ]) {
      const ra = raw(a!),
        rb = raw(b!);
      expect(tinycolor(a!).getLuminance()).toBeCloseTo(wcagLum([ra.r, ra.g, ra.b]), 12);
      expect(tinycolor.readability(a!, b!)).toBeCloseTo(wcagRatio([ra.r, ra.g, ra.b], [rb.r, rb.g, rb.b]), 12);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('rounding: colordx rounds half toward +∞ on the binary product (Math.round(x·10^d)/10^d)', () => {
  it('exact binary ties round up, decimal ties that are not binary-exact follow the float', () => {
    // 0.125 is exact in binary: rounds up. 1.005 is 1.00499999999999989… in binary: rounds down.
    expect(colordx({ r: 255, g: 0, b: 0, alpha: 1 }).toHsl(0).h).toBe(0);
    expect(rnd(0.125, 2)).toBe(0.13);
    expect(rnd(-0.125, 2)).toBe(-0.12);
    expect(rnd(1.005, 2)).toBe(1);
  });
  it('#faaaac hue is exactly 358.5 but prints 358 at 0 dp (float noise below the tie)', () => {
    // Independent: h = 60 · ((g − b)/d + 6) = 60 · (−2/80 + 6) = 358.5 exactly.
    expect(colordx('#faaaac').toHsl(0).h).toBe(358);
    expect(colordx('#faaaac').toHsl(2).h).toBe(358.5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
describe('apcaContrast p3 reads an exact OKLab L = 1 as white', () => {
  it('apcaContrast p3: oklab(1 -0.397818 0.4) is white (L = 1 maps to white, CSS Color 4 §13.2)', () => {
    const white = APCAcontrast(
      displayP3toY([1, 1, 1]),
      displayP3toY(linToP3Lin(linOf(raw('#67265b'))).map(srgbGam))
    ) as number;
    expect(colordx('oklab(1 -0.397818 0.4)').apcaContrast('#67265b', { space: 'p3', precision: 3 })).toBe(
      rnd(white, 3)
    );
  });
});

describe('luminance and APCA of a gamut-mapped color use the CSS gamut-mapped channels', () => {
  it('luminance() of a gamut-mapped color is the luminance of the CSS gamut-mapped channels', () => {
    const css = 'lab(97.2902 -130 -105.4177)';
    const m = gamutMap(linToOklab(linOf(raw(css))), 'srgb');
    const Y = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    expect(colordx(css).luminance()).toBe(rnd(Y, 4)); // colordx: 0.8614, reference: 0.859
  });
  it('apcaContrast() against a gamut-mapped background uses the CSS gamut-mapped channels', () => {
    const bg = 'lch(99.8177 0.597187 355.342153)';
    const m = gamutMap(linToOklab(linOf(raw(bg))), 'srgb').map((x) => srgbGam(x) * 255);
    const lc = APCAcontrast(sRGBtoY([119, 51, 255]), sRGBtoY(m)) as number;
    expect(colordx('rgb(119 51 255)').apcaContrast(bg)).toBe(rnd(lc, 1)); // colordx: 76.7, reference: 76.6
  });
});

describe('toGamut*() returns an in-gamut color as-is', () => {
  it('toGamutSrgb returns an in-gamut color as-is (oklch(0.999 0.001 100))', () => {
    const css = 'oklch(0.999 0.001 100)';
    expect(inGamutSrgb(css)).toBe(true);
    const o = toPolar(linToOklab(oklabToLin(fromPolar([0.999, 0.001, 100]))));
    const n = nums(Colordx.toGamutSrgb(css).toOklchString());
    expectRounded(n[0]!, o[0], 5, 'L');
    expectRounded(n[1]!, o[1], 5, 'C');
    expectHue(n[2]!, o[2], 5, 'H');
  });
  it('toGamutSrgb keeps an in-gamut near-black color instead of collapsing it to black', () => {
    const css = 'oklab(0.02 0.001 -0.002)';
    expect(inGamutSrgb(css)).toBe(true);
    expectRounded(Colordx.toGamutSrgb(css).toOklab().l, 0.02, 5, 'L');
  });
  it('toGamutSrgb keeps in-gamut dark / light greys (oklch(0.05 0 0), oklch(0.9995 0 0))', () => {
    expect(Colordx.toGamutSrgb('oklch(0.05 0 0)').toOklchString()).toBe(`oklch(${rnd(0.05, 5)} 0 none)`);
    expect(Colordx.toGamutSrgb('oklch(0.9995 0 0)').toOklchString()).toBe(`oklch(${rnd(0.9995, 5)} 0 none)`);
  });
  it('toGamutP3 returns an in-P3 color as-is (color(display-p3 0.9174 0.2 0.13))', () => {
    const got = Colordx.toGamutP3('color(display-p3 0.9174 0.2 0.13)').toP3();
    expect([got.r, got.g, got.b]).toEqual([0.9174, 0.2, 0.13]);
  });
  it('toGamutP3 / toGamutRec2020 of oklch(0.6279 0.2577 29.23) (inside both) match the direct conversion', () => {
    const lin = oklabToLin(fromPolar([0.6279, 0.2577, 29.23]));
    const p = Colordx.toGamutP3('oklch(0.6279 0.2577 29.23)').toP3();
    expectRounded(p.r, srgbGam(linToP3Lin(lin)[0]), 4, 'p3 r');
    const q = Colordx.toGamutRec2020('oklch(0.6279 0.2577 29.23)').toRec2020();
    expectRounded(q.r, rec2020Gam(linToRec2020Lin(lin)[0]), 5, 'rec2020 r');
  });
});

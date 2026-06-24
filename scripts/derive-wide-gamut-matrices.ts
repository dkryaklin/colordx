#!/usr/bin/env tsx
// Derivation + verification of the linear-sRGB ↔ linear-space matrices used by the
// a98rgb and prophoto color models. Run with `yarn tsx scripts/derive-wide-gamut-matrices.ts`.
//
// Provenance of the constants in src/colorModels/{a98rgb,prophoto}.ts:
//   - The space ↔ XYZ matrices and transfer functions are the CSS Color 4 reference values
//     (https://drafts.csswg.org/css-color-4/conversions.js).
//   - We compose them with the library's OWN sRGB↔XYZ-D65 (S/X) and Bradford D65↔D50 matrices
//     (from src/colorModels/xyz.ts) so the result is bit-consistent with the existing Lab/XYZ
//     pipeline. a98 is D65 (no adaptation); prophoto is D50 (Bradford baked into the matrix).
//   - Near-zero / near-one entries are snapped to exact 0/1 (a98 shares sRGB's red & blue
//     primaries, so its matrix is structurally sparse).
//
// The script asserts the derived matrices reproduce culori's a98/prophoto conversions to
// < 1e-6 across 20k random colors, then prints the constants in the lib's `const` style.

import * as culori from 'culori';

type M = number[][];
const matmul = (A: M, B: M): M => {
  const n = A.length,
    m = B[0]!.length,
    p = B.length;
  const out: M = Array.from({ length: n }, () => Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < p; k++) s += A[i]![k]! * B[k]![j]!;
      out[i]![j] = s;
    }
  return out;
};
const f = (n: number, d: number) => n / d;
const apply = (mat: M, v: number[]): number[] => [
  mat[0]![0]! * v[0]! + mat[0]![1]! * v[1]! + mat[0]![2]! * v[2]!,
  mat[1]![0]! * v[0]! + mat[1]![1]! * v[1]! + mat[1]![2]! * v[2]!,
  mat[2]![0]! * v[0]! + mat[2]![1]! * v[1]! + mat[2]![2]! * v[2]!,
];

// ── Library constants (src/colorModels/xyz.ts) ───────────────────────────────
const S: M = [
  [0.41239079926595951, 0.35758433938387796, 0.18048078840183429],
  [0.21263900587151036, 0.71516867876775592, 0.072192315360733714],
  [0.019330818715591849, 0.11919477979462599, 0.95053215224966059],
];
const X100: M = [
  [0.032409699419045213, -0.015373831775700935, -0.0049861076029300327],
  [-0.0096924363628087984, 0.018759675015077206, 0.00041555057407175612],
  [0.00055630079696993608, -0.0020397695888897657, 0.010569715142428786],
];
const invS: M = X100.map((r) => r.map((v) => v * 100)); // XYZ D65 (0–1) → linear sRGB
const D65_TO_D50: M = [
  [1.0479297925449969, 0.022946870601609652, -0.05019226628920524],
  [0.02962780877005599, 0.9904344267538799, -0.017073799063418826],
  [-0.009243040646204504, 0.015055191490298152, 0.7518742814281371],
];
const D50_TO_D65: M = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];

// ── CSS Color 4 spec matrices ────────────────────────────────────────────────
const XYZ_TO_LIN_A98: M = [
  [f(1829569, 896150), f(-506331, 896150), f(-308931, 896150)],
  [f(-851781, 878810), f(1648619, 878810), f(36519, 878810)],
  [f(16779, 1248040), f(-147721, 1248040), f(1266979, 1248040)],
];
const LIN_A98_TO_XYZ: M = [
  [f(573536, 994567), f(263643, 1420810), f(187206, 994567)],
  [f(591459, 1989134), f(6239551, 9945670), f(374412, 4972835)],
  [f(53769, 1989134), f(351524, 4972835), f(4929758, 4972835)],
];
const XYZ_TO_LIN_PP: M = [
  [1.3457868816471583, -0.25557208737979464, -0.05110186497554526],
  [-0.5446307051249019, 1.5082477428451468, 0.02052744743642139],
  [0, 0, 1.2119675456389452],
];
const LIN_PP_TO_XYZ: M = [
  [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
  [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
  [0, 0, 0.8251046025104602],
];

// ── Compose, then snap float noise to exact 0/1 ──────────────────────────────
const clean = (mat: M): M =>
  mat.map((r) => r.map((v) => (Math.abs(v) < 1e-12 ? 0 : Math.abs(v - 1) < 1e-12 ? 1 : v)));
const SR_A98 = clean(matmul(XYZ_TO_LIN_A98, S));
const A98_SR = clean(matmul(invS, LIN_A98_TO_XYZ));
const SR_PP = clean(matmul(XYZ_TO_LIN_PP, matmul(D65_TO_D50, S)));
const PP_SR = clean(matmul(invS, matmul(D50_TO_D65, LIN_PP_TO_XYZ)));

// ── Transfer functions (CSS Color 4) ─────────────────────────────────────────
const sgn = (v: number) => (v < 0 ? -1 : 1);
const a98FromLin = (n: number) => sgn(n) * Math.abs(n) ** (256 / 563);
const ppFromLin = (n: number) => {
  const a = Math.abs(n);
  return a >= 1 / 512 ? sgn(n) * a ** (1 / 1.8) : 16 * n;
};
const srgbToLin = (c: number) => {
  const a = Math.abs(c);
  const l = a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4;
  return c < 0 ? -l : l;
};

// ── Verify cleaned matrices against culori ───────────────────────────────────
const a98c = culori.converter('a98');
const ppc = culori.converter('prophoto');
const toA98 = (r: number, g: number, b: number) =>
  apply(SR_A98, [srgbToLin(r / 255), srgbToLin(g / 255), srgbToLin(b / 255)]).map(a98FromLin);
const toPP = (r: number, g: number, b: number) =>
  apply(SR_PP, [srgbToLin(r / 255), srgbToLin(g / 255), srgbToLin(b / 255)]).map(ppFromLin);

let seed = 42 >>> 0;
const rand = () => (seed = (1103515245 * seed + 12345) & 0x7fffffff) / 0x7fffffff;
let maxA98 = 0,
  maxPP = 0;
for (let i = 0; i < 20000; i++) {
  const r = Math.floor(rand() * 256),
    g = Math.floor(rand() * 256),
    b = Math.floor(rand() * 256);
  const a = toA98(r, g, b),
    ca = a98c({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 });
  maxA98 = Math.max(maxA98, Math.abs(a[0]! - ca.r), Math.abs(a[1]! - ca.g), Math.abs(a[2]! - ca.b));
  const p = toPP(r, g, b),
    cp = ppc({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 });
  maxPP = Math.max(maxPP, Math.abs(p[0]! - cp.r), Math.abs(p[1]! - cp.g), Math.abs(p[2]! - cp.b));
}
console.log(`max abs diff vs culori — a98: ${maxA98.toExponential(3)}  prophoto: ${maxPP.toExponential(3)}`);
if (maxA98 > 1e-6 || maxPP > 1e-6) {
  console.error('FAIL: derived matrices drift from culori beyond 1e-6');
  process.exit(1);
}

// ── Emit constants ───────────────────────────────────────────────────────────
const fmt = (x: number) => (x === 0 ? '0' : x.toPrecision(17).replace(/0+$/, '').replace(/\.$/, ''));
const emit = (name: string, mat: M) => {
  const rows = ['R', 'G', 'B'];
  let out = '';
  for (let i = 0; i < 3; i++)
    out += '  ' + rows.map((_, j) => `${name}_${rows[i]}${rows[j]} = ${fmt(mat[i]![j]!)}`).join(',\n  ') + ';\n';
  return out;
};
console.log('\n// linear sRGB → linear a98\n' + emit('SA9', SR_A98));
console.log('// linear a98 → linear sRGB\n' + emit('A9S', A98_SR));
console.log('// linear sRGB → linear prophoto\n' + emit('SPP', SR_PP));
console.log('// linear prophoto → linear sRGB\n' + emit('PPS', PP_SR));

import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import a98rgb from '../src/plugins/a98rgb.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import names from '../src/plugins/names.js';
import p3 from '../src/plugins/p3.js';
import prophoto from '../src/plugins/prophoto.js';
import rec2020 from '../src/plugins/rec2020.js';
import srgbLinear from '../src/plugins/srgb-linear.js';
import fixture from './fixtures/wpt-css-color.json';

beforeAll(() => extend([a98rgb, hwb, lab, lch, names, p3, prophoto, rec2020, srgbLinear]));

// The web-platform-tests css-color parsing suite as an independent spec oracle.
// tests/fixtures/wpt-css-color.json is produced by scripts/wpt-extract.ts (WPT commit and BSD-3
// notice in its header). Each case is one WPT assertion:
//
//   invalid   colordx(input).isValid() must be false.
//   valid     the input must parse, to the color the browser serializes as `expected` (the specified
//   computed  value for test_valid_value, the computed value for test_computed_value).
//
// colordx serializes differently from browsers, so nothing here compares strings. `expected` is
// parsed by the small oracle below, written from the CSS Color 4 spec (§ 18 sample code) and sharing
// no code with src/, then both sides are compared in CIE XYZ-D65:
//
//   - XYZ: |actual − expected| ≤ 1e-4 · max(1, |expected|) per component (0–1 scale; relative
//     above 1 because WPT feeds channels like color(srgb 200 200 200)).
//   - Legacy rgb()/rgba() expectations are 8-bit values the browser rounded, so those compare in
//     gamma sRGB with a tolerance of half a byte (0.5 / 255, plus float slack).
//   - Alpha: ±5e-4. colordx stores alpha at 3 dp (README § Precision), WPT has at most 3 dp.
//
// `none` resolves to 0, as it does in the browser's rendered color.

type Vec3 = [number, number, number];
interface Case {
  file: string;
  kind: 'valid' | 'invalid' | 'computed';
  property: string;
  input: string;
  expected: string | string[] | null;
}

// ─── Oracle: CSS Color 4 § 18 sample code ───────────────────────────────

const mul = (m: number[][], [x, y, z]: Vec3): Vec3 => [
  m[0]![0]! * x + m[0]![1]! * y + m[0]![2]! * z,
  m[1]![0]! * x + m[1]![1]! * y + m[1]![2]! * z,
  m[2]![0]! * x + m[2]![1]! * y + m[2]![2]! * z,
];
const invert = (m: number[][]): number[][] => {
  const [[a, b, c], [d, e, f], [g, h, i]] = m as [Vec3, Vec3, Vec3];
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

const SRGB_TO_XYZ = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
];
const XYZ_TO_SRGB = invert(SRGB_TO_XYZ);
const P3_TO_XYZ = [
  [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
  [35783 / 156275, 247089 / 357200, 198249 / 2500400],
  [0, 32229 / 714400, 5220557 / 5000800],
];
const A98_TO_XYZ = [
  [573536 / 994567, 263643 / 1420810, 187206 / 994567],
  [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
  [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
];
const REC2020_TO_XYZ = [
  [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314],
  [26158966 / 99577255, 472592308 / 697040785, 8267143 / 139408157],
  [0, 19567812 / 697040785, 295819943 / 278816314],
];
const PROPHOTO_TO_XYZ_D50 = [
  [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
  [0.2880748288194013, 0.7118352342418731, 0.00008993693872564],
  [0.0, 0.0, 0.8251046025104602],
];
const D50_TO_D65 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const OKLAB_TO_LMS = [
  [1, 0.3963377773761749, 0.215803757329903],
  [1, -0.1055613458156586, -0.0638541728258133],
  [1, -0.0894841775298119, -1.2914855480194092],
];
const LMS_TO_XYZ = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];
const D50_WHITE: Vec3 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

const signed = (f: (a: number) => number) => (v: number) => Math.sign(v) * f(Math.abs(v));
const srgbDecode = signed((a) => (a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4));
const srgbEncode = signed((a) => (a <= 0.0031308 ? a * 12.92 : 1.055 * a ** (1 / 2.4) - 0.055));
const a98Decode = signed((a) => a ** (563 / 256));
const prophotoDecode = signed((a) => (a <= 16 / 512 ? a / 16 : a ** 1.8));
// Pure 2.4 gamma: the rec2020 transfer CSS Color 4 now specifies (csswg-drafts#12574). README § rec2020
// documents that colordx follows it. WPT only round-trips rec2020 channels, so the curve cancels out.
const rec2020Decode = signed((a) => a ** 2.4);

const map3 = (v: Vec3, f: (n: number) => number): Vec3 => [f(v[0]), f(v[1]), f(v[2])];

const labToXyzD50 = ([L, a, b]: Vec3): Vec3 => {
  const k = 24389 / 27,
    e = 216 / 24389;
  const f1 = (L + 16) / 116,
    f0 = a / 500 + f1,
    f2 = f1 - b / 200;
  const x = f0 ** 3 > e ? f0 ** 3 : (116 * f0 - 16) / k;
  const y = L > k * e ? ((L + 16) / 116) ** 3 : L / k;
  const z = f2 ** 3 > e ? f2 ** 3 : (116 * f2 - 16) / k;
  return [x * D50_WHITE[0], y * D50_WHITE[1], z * D50_WHITE[2]];
};
const polar = ([l, c, h]: Vec3): Vec3 => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
const oklabToXyz = (v: Vec3): Vec3 =>
  mul(
    LMS_TO_XYZ,
    map3(mul(OKLAB_TO_LMS, v), (n) => n ** 3)
  );

// hsl / hwb → gamma sRGB, CSS Color 4 § 7.1 / § 8.1 (s, l, w, b as 0–1 fractions).
const hslToSrgb = (h: number, s: number, l: number): Vec3 => {
  h = ((h % 360) + 360) % 360;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
};
const hwbToSrgb = (h: number, w: number, b: number): Vec3 => {
  if (w + b >= 1) {
    const g = w / (w + b);
    return [g, g, g];
  }
  return map3(hslToSrgb(h, 1, 0.5), (n) => n * (1 - w - b) + w);
};

const NAMED: Record<string, [number, number, number, number]> = {
  red: [255, 0, 0, 1],
  magenta: [255, 0, 255, 1],
  transparent: [0, 0, 0, 0],
};

interface Expected {
  xyz: Vec3;
  alpha: number;
  /** A legacy rgb()/rgba() serialization, rounded by the browser to 8-bit channels. */
  bytes?: Vec3;
}

// A channel token: `none` → 0, `N%` → N / 100 · pctScale, plain number, or an angle.
const num = (token: string, pctScale = 1): number => {
  if (token === 'none') return 0;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|grad|turn)?$/i.exec(token);
  if (!m) throw new Error(`oracle: bad token ${token}`);
  const n = parseFloat(m[1]!);
  switch (m[2]?.toLowerCase()) {
    case '%':
      return (n / 100) * pctScale;
    case 'rad':
      return (n * 180) / Math.PI;
    case 'grad':
      return n * 0.9;
    case 'turn':
      return n * 360;
    default:
      return n;
  }
};

const parseExpected = (str: string): Expected => {
  const s = str.trim().toLowerCase();
  if (s in NAMED) {
    const [r, g, b, alpha] = NAMED[s]!;
    return parseExpected(`rgba(${r}, ${g}, ${b}, ${alpha})`);
  }
  const m = /^([a-z0-9-]+)\((.*)\)$/.exec(s);
  if (!m) throw new Error(`oracle: cannot parse expected ${str}`);
  const fn = m[1]!;
  const [body, alphaPart] = m[2]!.split('/').map((p) => p.trim()) as [string, string | undefined];
  let parts = body.split(/[\s,]+/).filter(Boolean);
  let alpha = alphaPart === undefined ? 1 : num(alphaPart);

  if (fn === 'rgb' || fn === 'rgba') {
    if (parts.length === 4) alpha = num(parts.pop()!);
    const bytes = parts.map((p) => num(p, 255)) as Vec3;
    const legacy = body.includes(',');
    return {
      xyz: mul(
        SRGB_TO_XYZ,
        map3(
          map3(bytes, (n) => n / 255),
          srgbDecode
        )
      ),
      alpha,
      bytes: legacy ? bytes : undefined,
    };
  }
  if (fn === 'hsl' || fn === 'hwb') {
    const [h, x, y] = [num(parts[0]!), num(parts[1]!, 100) / 100, num(parts[2]!, 100) / 100];
    const srgb = fn === 'hsl' ? hslToSrgb(h, x, y) : hwbToSrgb(h, x, y);
    return { xyz: mul(SRGB_TO_XYZ, map3(srgb, srgbDecode)), alpha };
  }
  if (fn === 'lab' || fn === 'lch') {
    const v = [num(parts[0]!, 100), num(parts[1]!, fn === 'lab' ? 125 : 150), num(parts[2]!, 125)] as Vec3;
    return { xyz: mul(D50_TO_D65, labToXyzD50(fn === 'lab' ? v : polar(v))), alpha };
  }
  if (fn === 'oklab' || fn === 'oklch') {
    const v = [num(parts[0]!, 1), num(parts[1]!, 0.4), num(parts[2]!, 0.4)] as Vec3;
    return { xyz: oklabToXyz(fn === 'oklab' ? v : polar(v)), alpha };
  }
  if (fn === 'color') {
    const space = parts.shift()!;
    const v = parts.map((p) => num(p)) as Vec3;
    const toXyz: Record<string, (v: Vec3) => Vec3> = {
      srgb: (c) => mul(SRGB_TO_XYZ, map3(c, srgbDecode)),
      'srgb-linear': (c) => mul(SRGB_TO_XYZ, c),
      'display-p3': (c) => mul(P3_TO_XYZ, map3(c, srgbDecode)),
      'display-p3-linear': (c) => mul(P3_TO_XYZ, c),
      'a98-rgb': (c) => mul(A98_TO_XYZ, map3(c, a98Decode)),
      'prophoto-rgb': (c) => mul(D50_TO_D65, mul(PROPHOTO_TO_XYZ_D50, map3(c, prophotoDecode))),
      rec2020: (c) => mul(REC2020_TO_XYZ, map3(c, rec2020Decode)),
      xyz: (c) => c,
      'xyz-d65': (c) => c,
      'xyz-d50': (c) => mul(D50_TO_D65, c),
    };
    if (!toXyz[space]) throw new Error(`oracle: unknown color space ${space}`);
    return { xyz: toXyz[space]!(v), alpha };
  }
  throw new Error(`oracle: unsupported expected function ${fn}`);
};

// ─── colordx side ───────────────────────────────────────────────────────

// colordx stores unclamped gamma sRGB; toSrgbLinear() reads it unclipped, and linear sRGB is a
// linear map of XYZ-D65, so this is colordx's color with nothing but the oracle's matrix applied.
const actualOf = (input: string) => {
  const c = colordx(input);
  const { r, g, b, alpha } = c.toSrgbLinear(15);
  return { valid: c.isValid(), xyz: mul(SRGB_TO_XYZ, [r, g, b]), alpha };
};

const XYZ_TOL = 1e-4;
const BYTE_TOL = 0.5 / 255 + 1e-7;
const ALPHA_TOL = 5e-4;

/** Returns null on a match, else a description of the mismatch. */
const mismatch = (input: string, expected: string): string | null => {
  const act = actualOf(input);
  const exp = parseExpected(expected);
  if (Math.abs(act.alpha - exp.alpha) > ALPHA_TOL) return `alpha ${act.alpha} ≠ ${exp.alpha}`;
  if (exp.bytes) {
    const srgb = map3(mul(XYZ_TO_SRGB, act.xyz), srgbEncode);
    const ok = srgb.every((v, i) => Math.abs(v - exp.bytes![i]! / 255) <= BYTE_TOL);
    return ok ? null : `sRGB ×255 [${srgb.map((v) => +(v * 255).toFixed(4))}] ≠ [${exp.bytes}]`;
  }
  const ok = act.xyz.every((v, i) => Math.abs(v - exp.xyz[i]!) <= XYZ_TOL * Math.max(1, Math.abs(exp.xyz[i]!)));
  return ok ? null : `XYZ-D65 [${act.xyz.map((v) => +v.toFixed(6))}] ≠ [${exp.xyz.map((v) => +v.toFixed(6))}]`;
};

// ─── Skips: syntax colordx does not claim to support ────────────────────
//
// Applied to valid/computed cases only. Invalid cases always run: whatever colordx does or does not
// implement, a string the spec rejects must not parse.

const SYSTEM_COLORS =
  /^(activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|visitedtext|selecteditem|selecteditemtext|accentcolor|accentcolortext)$/i;

const SKIPS: [reason: string, test: (input: string) => boolean][] = [
  // CSS value math: README never claims calc(); var() and em/cqw-relative sign() need the cascade.
  ['calc() / var() / sign() math functions', (s) => /\b(calc|var|sign)\(/i.test(s)],
  // Keywords that only resolve against an element: the inherited color, the used color-scheme,
  // or the UA/OS palette.
  ['currentcolor (needs the cascade)', (s) => /currentcolor/i.test(s)],
  ['light-dark() (needs the used color-scheme)', (s) => /light-dark\(/i.test(s)],
  ['system colors (UA/OS dependent)', (s) => SYSTEM_COLORS.test(s.trim())],
  // CSS tokenizer features: colordx parses color strings, not CSS source text, and README claims neither.
  ['CSS comments / escapes (tokenizer-level syntax)', (s) => /\/\*|\\/.test(s)],
  // A CSS Color 4 predefined space colordx has no plugin for (README lists every supported space).
  ['color(display-p3-linear …) (no plugin)', (s) => /display-p3-linear/i.test(s)],
];
const skipReason = (input: string): string | undefined => SKIPS.find(([, test]) => test(input))?.[0];

// ─── Known bugs: spec behavior asserted, marked it.fails until fixed ────

// None open. Fixed so far: half-byte hsl()/hwb() channels rounding down after float error, and
// named colors folding U+212A KELVIN SIGN to "k".
const BUGS: [bug: string, applies: (c: Case, check: 'color' | 'bytes') => boolean][] = [];
const bugOf = (c: Case, check: 'color' | 'bytes') => BUGS.find(([, applies]) => applies(c, check))?.[0];

// ─── Suite ──────────────────────────────────────────────────────────────

const cases = fixture.cases as Case[];
const files = [...new Set(cases.map((c) => c.file))];
const expectedList = (c: Case) => ([] as string[]).concat(c.expected!);
const legacyBytes = (e: string): Vec3 | undefined => parseExpected(e).bytes;

// Browsers serialize sRGB-family colors as legacy rgb() with 8-bit channels, rounded half up.
// colordx's toRgb() prints bytes too, so for those cases the bytes must match exactly.
const byteMismatch = (input: string, alts: string[]): string | null => {
  const { r, g, b } = colordx(input).toRgb();
  const want = alts.map(legacyBytes).filter((x): x is Vec3 => !!x);
  return want.some((w) => w[0] === r && w[1] === g && w[2] === b)
    ? null
    : `toRgb() [${r}, ${g}, ${b}] (unrounded [${Object.values(colordx(input).toRgb(10)).slice(0, 3)}]) ≠ ${want.map((w) => `[${w}]`).join(' | ')}`;
};

describe(`WPT css-color @ ${fixture.commit.slice(0, 12)}`, () => {
  for (const file of files) {
    describe(file, () => {
      for (const c of cases.filter((x) => x.file === file)) {
        const title = `${c.kind}: ${JSON.stringify(c.input)}${c.expected && c.expected !== c.input ? ` → ${JSON.stringify(c.expected)}` : ''}`;
        const reason = c.kind === 'invalid' ? undefined : skipReason(c.input);
        if (reason) {
          it.skip(`${title} [skip: ${reason}]`, () => {});
          continue;
        }
        const bug = bugOf(c, 'color');
        (bug ? it.fails : it)(bug ? `${title} [BUG: ${bug}]` : title, () => {
          if (c.kind === 'invalid') {
            expect(colordx(c.input).isValid(), `${JSON.stringify(c.input)} should be rejected`).toBe(false);
            return;
          }
          expect(colordx(c.input).isValid(), `${JSON.stringify(c.input)} should parse`).toBe(true);
          const errors = expectedList(c).map((e) => mismatch(c.input, e));
          if (errors.includes(null)) return;
          expect.fail(`${JSON.stringify(c.input)}: ${errors.join(' | ')}`);
        });

        if (c.kind !== 'invalid' && expectedList(c).some(legacyBytes)) {
          const byteBug = bugOf(c, 'bytes');
          (byteBug ? it.fails : it)(`${title} [8-bit]${byteBug ? ` [BUG: ${byteBug}]` : ''}`, () => {
            const err = byteMismatch(c.input, expectedList(c));
            if (err) expect.fail(`${JSON.stringify(c.input)}: ${err}`);
          });
        }
      }
    });
  }

  // Every expected string is itself a browser serialization, i.e. valid CSS: colordx must read it
  // back as the same color. This is where the oracle's parse of `expected` meets colordx's.
  describe('browser serializations parse back', () => {
    const seen = new Set<string>();
    for (const c of cases) {
      if (c.kind === 'invalid') continue;
      for (const e of expectedList(c)) {
        if (seen.has(e)) continue;
        seen.add(e);
        const reason = skipReason(e);
        if (reason) {
          it.skip(`${JSON.stringify(e)} [skip: ${reason}]`, () => {});
          continue;
        }
        it(JSON.stringify(e), () => {
          expect(colordx(e).isValid(), `${JSON.stringify(e)} should parse`).toBe(true);
          const err = mismatch(e, e);
          if (err) expect.fail(`${JSON.stringify(e)}: ${err}`);
        });
      }
    }
  });
});

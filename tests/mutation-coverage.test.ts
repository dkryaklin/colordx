// Mutation-killing battery. Each block targets a specific class of mutant that
// survived the Stryker baseline run. The point is to *pin* exact behavior at
// the contract level, not to add coverage — coverage was already ~100% when
// these mutants survived.
//
// Sections:
//   A. Object parsers — single-field invalid value rejection
//      (kills LogicalOperator mutants in `!isAnyNumber(...) || ...` chains)
//   B. Object parsers — colorSpace gate
//      (kills StringLiteral / EqualityOperator mutants on the brand check)
//   C. OKLab / OKLCH — disambiguating-key rejection
//      (kills LogicalOperator mutants in `'r' in input || 'x' in input || …`)
//   D. String parsers — alpha precisely preserved
//      (kills ConditionalExpression / ArithmeticOperator mutants in
//       `m[N] === undefined ? 1 : Number(m[N]) / (m[N+1] ? 100 : 1)`)
//   E. String parsers — gamut.ts inline parser path
//      (D again, but exercised via Colordx.toGamutP3 / toGamutRec2020 which
//       use the parallel parser inside src/gamut.ts:getRawOklab)

import { beforeAll, describe, expect, it } from 'vitest';
import { Colordx, colordx, extend } from '../src/index.js';
import cmyk from '../src/plugins/cmyk.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import p3 from '../src/plugins/p3.js';
import rec2020 from '../src/plugins/rec2020.js';

beforeAll(() => extend([hsv, hwb, lab, lch, p3, rec2020, cmyk]));

const reject = (input: unknown) => expect(colordx(input as never).isValid()).toBe(false);
const accept = (input: unknown) => expect(colordx(input as never).isValid()).toBe(true);

// ────────────────────────────────────────────────────────────────────────
// A. Per-field invalid value rejection
// ────────────────────────────────────────────────────────────────────────
//
// Each parser has a line:   if (!isAnyNumber(a) || !isAnyNumber(b) || ...) return null;
// Stryker mutates each `||` to `&&`, or replaces sub-expressions with
// false/true. The only way to pin every term is to send N inputs where each
// one has exactly ONE invalid field and the rest valid.

// NaN passes `isAnyNumber` (typeof NaN === 'number') so the parser sanitizes
// it to 0 and accepts. `undefined` for any non-alpha field is rejected by
// `isAnyNumber`, but for alpha it triggers the destructuring default (= 1)
// and is accepted. We test only values that all parsers must reject:
// non-numeric primitives ('x', null) and non-Array objects ({}, []).
const invalidValues = ['x', null, {}, []] as const;

const oneFieldInvalid = (
  name: string,
  validBase: Record<string, unknown>,
  fields: readonly string[],
  brand?: { colorSpace: string }
) =>
  describe(name, () => {
    const base = brand ? { ...validBase, ...brand } : validBase;
    for (const field of fields) {
      for (const bad of invalidValues) {
        const label = bad === null ? 'null' : JSON.stringify(bad);
        it(`${field}=${label}`, () => reject({ ...base, [field]: bad }));
      }
    }
  });

describe('A. object parsers — single-field invalid value', () => {
  oneFieldInvalid('rgb', { r: 100, g: 100, b: 100, alpha: 1 }, ['r', 'g', 'b', 'alpha']);
  oneFieldInvalid('hsl', { h: 0, s: 50, l: 50, alpha: 1 }, ['h', 's', 'l', 'alpha']);
  oneFieldInvalid('hsv', { h: 0, s: 50, v: 50, alpha: 1 }, ['h', 's', 'v', 'alpha']);
  oneFieldInvalid('hwb', { h: 0, w: 0, b: 0, alpha: 1 }, ['h', 'w', 'b', 'alpha']);
  oneFieldInvalid('cmyk', { c: 0, m: 0, y: 0, k: 0, alpha: 1 }, ['c', 'm', 'y', 'k', 'alpha']);
  oneFieldInvalid('oklab', { l: 0.5, a: 0, b: 0, alpha: 1 }, ['l', 'a', 'b', 'alpha']);
  oneFieldInvalid('oklch', { l: 0.5, c: 0, h: 0, alpha: 1 }, ['l', 'c', 'h', 'alpha']);
  oneFieldInvalid('lab', { l: 50, a: 0, b: 0, alpha: 1 }, ['l', 'a', 'b', 'alpha'], { colorSpace: 'lab' });
  oneFieldInvalid('lch', { l: 50, c: 0, h: 0, alpha: 1 }, ['l', 'c', 'h', 'alpha'], { colorSpace: 'lch' });
  oneFieldInvalid('p3', { r: 0.5, g: 0.5, b: 0.5, alpha: 1 }, ['r', 'g', 'b', 'alpha'], { colorSpace: 'display-p3' });
  oneFieldInvalid('rec2020', { r: 0.5, g: 0.5, b: 0.5, alpha: 1 }, ['r', 'g', 'b', 'alpha'], {
    colorSpace: 'rec2020',
  });
  oneFieldInvalid('xyz-d65', { x: 50, y: 50, z: 50, alpha: 1 }, ['x', 'y', 'z', 'alpha'], { colorSpace: 'xyz-d65' });
});

// ────────────────────────────────────────────────────────────────────────
// B. colorSpace brand-check
// ────────────────────────────────────────────────────────────────────────
//
// Several parsers gate on a literal colorSpace string:
//   parseLabObject:    colorSpace !== 'lab' → null
//   parseLchObject:    colorSpace !== 'lch' → null
//   parseP3Object:     colorSpace !== 'display-p3' → null
//   parseRec2020Object:colorSpace !== 'rec2020' → null
//   parseXyzD65Object: colorSpace !== 'xyz-d65' → null
// And two negative gates:
//   parseOklabObject:  colorSpace === 'lab' → null
//   parseOklchObject:  colorSpace === 'lch' → null
//
// To kill the StringLiteral / EqualityOperator mutants on these checks,
// we need (a) a positive case with the exact brand and (b) a negative case
// with a different brand or no brand at all.

describe('B. colorSpace brand gates', () => {
  // For parsers with `colorSpace !== 'X' return null;` gates: a positive
  // `accept` of the exact brand is enough to kill both StringLiteral and
  // EqualityOperator mutants — both make the parser bail, no other parser
  // matches the colorSpace shape, and the result becomes invalid.
  it('lab brand is required (and accepted)', () => accept({ colorSpace: 'lab', l: 50, a: 0, b: 0 }));
  it('lab without brand is rejected (l > 1 fails oklab guard)', () => reject({ l: 50, a: 0, b: 0 }));
  it('lab with non-lab brand is rejected', () => reject({ colorSpace: 'oklab', l: 50, a: 0, b: 0 }));

  it('lch brand is required (and accepted)', () => accept({ colorSpace: 'lch', l: 50, c: 30, h: 180 }));
  it('lch without brand is rejected', () => reject({ l: 50, c: 30, h: 180 }));
  it('lch with non-lch brand is rejected', () => reject({ colorSpace: 'oklch', l: 50, c: 30, h: 180 }));

  it('p3 brand produces a different result than unbranded rgb fallback', () => {
    // Pin: without the strict 'display-p3' brand check, parseP3Object would
    // accept any object with {r,g,b}, masking the difference between the
    // sRGB and P3 interpretations of the same numbers. parseRgbObject scales
    // 0–255; parseP3Object scales 0–1. Distinct numeric ranges → distinct
    // results when the gate works correctly.
    const rgbVal = colordx({ r: 0.5, g: 0.5, b: 0.5 } as never).toRgb();
    const p3Val = colordx({ colorSpace: 'display-p3', r: 0.5, g: 0.5, b: 0.5 } as never).toRgb();
    expect(rgbVal).not.toEqual(p3Val);
  });

  it('rec2020 brand produces a different result than unbranded rgb fallback', () => {
    const rgbVal = colordx({ r: 0.5, g: 0.5, b: 0.5 } as never).toRgb();
    const rec2020Val = colordx({ colorSpace: 'rec2020', r: 0.5, g: 0.5, b: 0.5 } as never).toRgb();
    expect(rgbVal).not.toEqual(rec2020Val);
  });

  it('xyz-d65 brand produces a different result than unbranded xyz (D50)', () => {
    // parseXyzObject (no brand) ⇒ D50; parseXyzD65Object ⇒ D65. The
    // chromatic adaptation between the two gives different sRGB outputs.
    const d50 = colordx({ x: 50, y: 50, z: 50 } as never).toRgb();
    const d65 = colordx({ colorSpace: 'xyz-d65', x: 50, y: 50, z: 50 } as never).toRgb();
    expect(d50).not.toEqual(d65);
  });

  it('oklab refuses colorSpace=lab brand and delegates to parseLabObject', () => {
    // OKLab(0.5,0,0) is mid-gray; CIE Lab(0.5,0,0) is near-black. Without
    // the `colorSpace === 'lab' return null` guard, parseOklabObject would
    // claim this input first and the lab plugin's interpretation never runs.
    const out = colordx({ colorSpace: 'lab', l: 0.5, a: 0, b: 0 } as never).toRgb();
    expect(out.r).toBeLessThan(20);
  });
  it('oklch refuses colorSpace=lch brand and delegates to parseLchObject', () => {
    const out = colordx({ colorSpace: 'lch', l: 0.5, c: 0, h: 0 } as never).toRgb();
    expect(out.r).toBeLessThan(20);
  });
});

// ────────────────────────────────────────────────────────────────────────
// C. OKLab / OKLCH — disambiguating-key rejection
// ────────────────────────────────────────────────────────────────────────
//
// parseOklabObject has:
//   if ('r' in input || 'x' in input || 'c' in input || 'h' in input) return null;
// to refuse objects that look like rgb/xyz/oklch/etc. Each `||` term must be
// individually pinned: an object with l/a/b PLUS exactly one of r/x/c/h.
// (parseOklchObject doesn't have this guard but a similar test pattern
// applies to its colorSpace='lch' guard, already covered in B.)

describe('C. oklab disambiguating-key rejection', () => {
  // l>1 case: each disambiguator key paired with otherwise-valid OKLab keys.
  // Without the guard, parseOklabObject would parse {l:0.5, a:0, b:0, c:0}
  // as OKLab even though `c` suggests OKLCH.
  for (const key of ['r', 'x', 'c', 'h'] as const) {
    it(`{l, a, b, ${key}} is not parsed as oklab`, () => {
      // Each of these objects has the oklab keys but ALSO one of the
      // disambiguators. The guard must reject so a different parser (or
      // none) handles it. Since these aren't valid for any other parser
      // either, the result must be invalid.
      const obj = { l: 0.5, a: 0, b: 0, [key]: 0 } as Record<string, number>;
      // Special case: {l, a, b, c} matches no parser. {l, a, b, h} same.
      // {l, a, b, r} gets picked up by parseRgbObject only if r is part of
      // a complete rgb triple — it isn't (no g). So all four reject.
      reject(obj);
    });
  }
});

// ────────────────────────────────────────────────────────────────────────
// D. String-parser alpha — exact value preservation
// ────────────────────────────────────────────────────────────────────────
//
// Every string parser computes alpha as:
//   const alpha = m[N] === undefined ? 1 : Number(m[N]) / (m[N+1] ? 100 : 1);
// Surviving mutants:
//   `=== undefined` → `!== undefined`   (inverts ternary)
//   `m[N] === undefined ? 1 : X` → `true ? 1 : X`   (always 1)
//   `m[N] === undefined ? 1 : X` → `false ? 1 : X`  (never 1)
//   `Number(m[N]) / (...)`        → `Number(m[N]) * (...)`
//   `m[N+1] ? 100 : 1`            → `m[N+1] ? 1 : 100` etc.
//
// Three inputs per format kill all variants:
//   1. no alpha            → expect alpha = 1
//   2. slash decimal alpha → expect alpha = 0.5  (decimal pins ÷1 vs ×1 trivially equal,
//                                                 but pins the absent-vs-present ternary)
//   3. slash percent alpha → expect alpha = 0.5  (50% only equals 0.5 if `÷100` is correct)

const alphaCases = (
  format: string,
  withAlphaDecimal: string,
  withAlphaPercent: string,
  noAlpha: string
) =>
  describe(format, () => {
    it('no alpha → alpha = 1', () => {
      const a = colordx(noAlpha).alpha();
      expect(a).toBe(1);
    });
    it('decimal alpha 0.5 → alpha = 0.5', () => {
      const a = colordx(withAlphaDecimal).alpha();
      expect(a).toBeCloseTo(0.5, 3);
    });
    it('percent alpha 50% → alpha = 0.5', () => {
      const a = colordx(withAlphaPercent).alpha();
      expect(a).toBeCloseTo(0.5, 3);
    });
  });

describe('D. string parser alpha — colordx() entry', () => {
  alphaCases('rgb', 'rgb(100 100 100 / 0.5)', 'rgb(100 100 100 / 50%)', 'rgb(100 100 100)');
  alphaCases('rgba comma', 'rgba(100, 100, 100, 0.5)', 'rgba(100, 100, 100, 50%)', 'rgba(100, 100, 100, 1)');
  alphaCases('hsl', 'hsl(180 50% 50% / 0.5)', 'hsl(180 50% 50% / 50%)', 'hsl(180 50% 50%)');
  alphaCases('hsv', 'hsv(180 50% 50% / 0.5)', 'hsv(180 50% 50% / 50%)', 'hsv(180 50% 50%)');
  alphaCases('hwb', 'hwb(180 30% 30% / 0.5)', 'hwb(180 30% 30% / 50%)', 'hwb(180 30% 30%)');
  alphaCases('lab', 'lab(50 0 0 / 0.5)', 'lab(50 0 0 / 50%)', 'lab(50 0 0)');
  alphaCases('lch', 'lch(50 30 180 / 0.5)', 'lch(50 30 180 / 50%)', 'lch(50 30 180)');
  alphaCases('oklab', 'oklab(0.5 0 0 / 0.5)', 'oklab(0.5 0 0 / 50%)', 'oklab(0.5 0 0)');
  alphaCases('oklch', 'oklch(50% 0.1 180 / 0.5)', 'oklch(50% 0.1 180 / 50%)', 'oklch(50% 0.1 180)');
  alphaCases(
    'color(display-p3)',
    'color(display-p3 0.5 0.5 0.5 / 0.5)',
    'color(display-p3 0.5 0.5 0.5 / 50%)',
    'color(display-p3 0.5 0.5 0.5)'
  );
  alphaCases(
    'color(rec2020)',
    'color(rec2020 0.5 0.5 0.5 / 0.5)',
    'color(rec2020 0.5 0.5 0.5 / 50%)',
    'color(rec2020 0.5 0.5 0.5)'
  );
  alphaCases(
    'color(xyz-d50)',
    'color(xyz-d50 50 50 50 / 0.5)',
    'color(xyz-d50 50 50 50 / 50%)',
    'color(xyz-d50 50 50 50)'
  );
  alphaCases(
    'color(xyz-d65)',
    'color(xyz-d65 50 50 50 / 0.5)',
    'color(xyz-d65 50 50 50 / 50%)',
    'color(xyz-d65 50 50 50)'
  );
  alphaCases('cmyk', 'device-cmyk(0 0 0 0 / 0.5)', 'device-cmyk(0 0 0 0 / 50%)', 'device-cmyk(0 0 0 0)');
});

// ────────────────────────────────────────────────────────────────────────
// E. String-parser alpha — gamut.ts inline parser path
// ────────────────────────────────────────────────────────────────────────
//
// src/gamut.ts has a SECOND set of regex parsers inside getRawOklab() used
// by the inGamut* / toGamut* fast path. The colordx() tests above don't
// reach this code. Exercise via Colordx.toGamutP3 / toGamutRec2020 which
// route the string through getRawOklab and preserve alpha all the way to
// the final RgbColor.

const gamutAlphaCases = (
  format: string,
  withAlphaDecimal: string,
  withAlphaPercent: string,
  noAlpha: string
) =>
  describe(format, () => {
    it('no alpha → alpha = 1 (toGamutP3 path)', () => {
      expect(Colordx.toGamutP3(noAlpha).alpha()).toBe(1);
    });
    it('decimal alpha 0.5 → alpha = 0.5 (toGamutP3 path)', () => {
      expect(Colordx.toGamutP3(withAlphaDecimal).alpha()).toBeCloseTo(0.5, 3);
    });
    it('percent alpha 50% → alpha = 0.5 (toGamutP3 path)', () => {
      expect(Colordx.toGamutP3(withAlphaPercent).alpha()).toBeCloseTo(0.5, 3);
    });
    it('no alpha → alpha = 1 (toGamutRec2020 path)', () => {
      expect(Colordx.toGamutRec2020(noAlpha).alpha()).toBe(1);
    });
    it('decimal alpha 0.5 → alpha = 0.5 (toGamutRec2020 path)', () => {
      expect(Colordx.toGamutRec2020(withAlphaDecimal).alpha()).toBeCloseTo(0.5, 3);
    });
    it('percent alpha 50% → alpha = 0.5 (toGamutRec2020 path)', () => {
      expect(Colordx.toGamutRec2020(withAlphaPercent).alpha()).toBeCloseTo(0.5, 3);
    });
  });

describe('E. string parser alpha — gamut.ts (toGamutP3 / toGamutRec2020)', () => {
  gamutAlphaCases('oklch', 'oklch(50% 0.1 180 / 0.5)', 'oklch(50% 0.1 180 / 50%)', 'oklch(50% 0.1 180)');
  gamutAlphaCases('oklab', 'oklab(0.5 0 0 / 0.5)', 'oklab(0.5 0 0 / 50%)', 'oklab(0.5 0 0)');
  gamutAlphaCases('lab', 'lab(50 0 0 / 0.5)', 'lab(50 0 0 / 50%)', 'lab(50 0 0)');
  gamutAlphaCases('lch', 'lch(50 30 180 / 0.5)', 'lch(50 30 180 / 50%)', 'lch(50 30 180)');
  gamutAlphaCases(
    'color(display-p3)',
    'color(display-p3 0.5 0.5 0.5 / 0.5)',
    'color(display-p3 0.5 0.5 0.5 / 50%)',
    'color(display-p3 0.5 0.5 0.5)'
  );
  gamutAlphaCases(
    'color(rec2020)',
    'color(rec2020 0.5 0.5 0.5 / 0.5)',
    'color(rec2020 0.5 0.5 0.5 / 50%)',
    'color(rec2020 0.5 0.5 0.5)'
  );
  gamutAlphaCases(
    'color(xyz-d50)',
    'color(xyz-d50 50 50 50 / 0.5)',
    'color(xyz-d50 50 50 50 / 50%)',
    'color(xyz-d50 50 50 50)'
  );
  gamutAlphaCases(
    'color(xyz-d65)',
    'color(xyz-d65 50 50 50 / 0.5)',
    'color(xyz-d65 50 50 50 / 50%)',
    'color(xyz-d65 50 50 50)'
  );
});

// ────────────────────────────────────────────────────────────────────────
// F. Hue unit fallback
// ────────────────────────────────────────────────────────────────────────
//
// Hue parsers do `m[6]?.toLowerCase() ?? 'deg'`. Without a unitless test,
// the 'deg' fallback can be mutated to '' or anything and still produce
// the same numeric result for any test that always specifies the unit.

describe('F. hue unit defaults to deg', () => {
  it('oklch unitless hue equals deg form', () => {
    const a = colordx('oklch(70% 0.1 200)').toRgb();
    const b = colordx('oklch(70% 0.1 200deg)').toRgb();
    expect(a).toEqual(b);
  });
  it('lch unitless hue equals deg form', () => {
    const a = colordx('lch(50 30 200)').toRgb();
    const b = colordx('lch(50 30 200deg)').toRgb();
    expect(a).toEqual(b);
  });
  it('hsl unitless hue equals deg form', () => {
    const a = colordx('hsl(200 50% 50%)').toRgb();
    const b = colordx('hsl(200deg 50% 50%)').toRgb();
    expect(a).toEqual(b);
  });
  it('hsl turn vs deg differ (sanity: ANGLE_UNITS lookup is exercised)', () => {
    const a = colordx('hsl(0.5turn 50% 50%)').toRgb();
    const b = colordx('hsl(180deg 50% 50%)').toRgb();
    expect(a).toEqual(b);
  });
  it('oklch unitless hue via toGamutP3 equals deg form', () => {
    const a = Colordx.toGamutP3('oklch(70% 0.1 200)').toRgb();
    const b = Colordx.toGamutP3('oklch(70% 0.1 200deg)').toRgb();
    expect(a).toEqual(b);
  });
  it('lch unitless hue via toGamutP3 equals deg form', () => {
    const a = Colordx.toGamutP3('lch(50 30 200)').toRgb();
    const b = Colordx.toGamutP3('lch(50 30 200deg)').toRgb();
    expect(a).toEqual(b);
  });
});

// ────────────────────────────────────────────────────────────────────────
// G. input.trim() — whitespace-tolerant string parsing
// ────────────────────────────────────────────────────────────────────────
//
// Every string parser does `RE.exec(input.trim())`. The MethodExpression
// mutator drops the .trim() call. Without explicit leading/trailing
// whitespace tests, the regex either matches with or without trim — the
// mutant is undetected. Adding `' input '` cases pins the trim.

describe('G. string parsers tolerate surrounding whitespace', () => {
  it.each([
    '  rgb(100 100 100)  ',
    '  hsl(180 50% 50%)  ',
    '  hsv(180 50% 50%)  ',
    '  hwb(180 30% 30%)  ',
    '  device-cmyk(0 0 0 0)  ',
    '  lab(50 0 0)  ',
    '  lch(50 30 180)  ',
    '  oklab(0.5 0 0)  ',
    '  oklch(50% 0.1 180)  ',
    '  color(display-p3 0.5 0.5 0.5)  ',
    '  color(rec2020 0.5 0.5 0.5)  ',
    '  color(xyz-d50 50 50 50)  ',
    '  color(xyz-d65 50 50 50)  ',
    '  #ff0000  ',
  ])('accepts %s', (input) => accept(input));

  // gamut.ts has its own inline parser for OKLCH/LCH/Lab/P3/Rec2020/XYZ-D50/D65
  // strings inside getRawOklab. Exercise via toGamutP3 to pin THAT trim().
  it.each([
    '  oklch(50% 0.1 180)  ',
    '  oklab(0.5 0 0)  ',
    '  lab(50 0 0)  ',
    '  lch(50 30 180)  ',
    '  color(display-p3 0.5 0.5 0.5)  ',
    '  color(rec2020 0.5 0.5 0.5)  ',
    '  color(xyz-d50 50 50 50)  ',
    '  color(xyz-d65 50 50 50)  ',
  ])('toGamutP3 accepts %s', (input) => {
    expect(Colordx.toGamutP3(input).isValid()).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────
// H. `/^none$/i` — case-insensitivity in legacy `none` rejection
// ────────────────────────────────────────────────────────────────────────
//
// hsl/hsv/rgb legacy comma syntax rejects `none` via /^none$/i. Existing
// reject tests use lowercase 'none', which matches with or without the
// `i` flag — the flag mutation slips through. Uppercase NONE pins it.

describe('H. legacy `none` rejection is case-insensitive', () => {
  it.each([
    'rgb(NONE, 0, 0)',
    'rgb(0, NONE, 0)',
    'rgb(0, 0, NONE)',
    'rgba(0, 0, 0, NONE)',
    'rgb(None, 0, 0)',
    'hsl(NONE, 100%, 50%)',
    'hsla(0, 100%, 50%, NONE)',
    'hsl(None, 100%, 50%)',
    'hsv(NONE, 100%, 100%)',
    'hsva(0, 100%, 100%, NONE)',
  ])('rejects %s', (input) => reject(input));
});

// ────────────────────────────────────────────────────────────────────────
// I. Regex anchor pinning — reject prefixed / suffixed strings
// ────────────────────────────────────────────────────────────────────────
//
// Stryker's StringLiteral mutator can reduce a regex template fragment
// to ''. For a regex like /^foo\(...\)$/, deleting the prefix or suffix
// piece removes the start or end anchor, allowing 'XXfoo(...)' or
// 'foo(...)YY' to match — neither original input would. Concrete reject
// tests for prefix/suffix garbage kill those mutants.

describe('I. anchored regex rejects prefix/suffix garbage', () => {
  it.each([
    'XXrgb(100 100 100)',
    'rgb(100 100 100)YY',
    'XXhsl(180 50% 50%)',
    'hsl(180 50% 50%)YY',
    'XXhsv(180 50% 50%)',
    'hsv(180 50% 50%)YY',
    'XXhwb(180 30% 30%)',
    'hwb(180 30% 30%)YY',
    'XXdevice-cmyk(0 0 0 0)',
    'device-cmyk(0 0 0 0)YY',
    'XXlab(50 0 0)',
    'lab(50 0 0)YY',
    'XXlch(50 30 180)',
    'lch(50 30 180)YY',
    'XXoklab(0.5 0 0)',
    'oklab(0.5 0 0)YY',
    'XXoklch(50% 0.1 180)',
    'oklch(50% 0.1 180)YY',
    'XXcolor(display-p3 0.5 0.5 0.5)',
    'color(display-p3 0.5 0.5 0.5)YY',
    'XXcolor(rec2020 0.5 0.5 0.5)',
    'color(rec2020 0.5 0.5 0.5)YY',
    'XXcolor(xyz-d50 50 50 50)',
    'color(xyz-d50 50 50 50)YY',
    'XXcolor(xyz-d65 50 50 50)',
    'color(xyz-d65 50 50 50)YY',
    'XX#ff0000',
    '#ff0000YY',
  ])('rejects %s', (input) => reject(input));
});

// ────────────────────────────────────────────────────────────────────────
// J. gamut.ts channel form equivalence
// ────────────────────────────────────────────────────────────────────────
//
// gamut.ts:158/159/168/169/170/177/178/186/196..207 each branch on a
// percent flag for the L/C/A/B/r/g/b channels, e.g.
//   const l = m[2] ? Number(m[1]) / 100 : Number(m[1]);
// Section D pinned alpha; this section pins channels via the same
// "decimal vs percent equals semantically" assertion exercised through
// Colordx.toGamutP3 (which routes through gamut.ts:getRawOklab).

const sameUnderToGamutP3 = (a: string, b: string) => {
  const ra = Colordx.toGamutP3(a).toRgb();
  const rb = Colordx.toGamutP3(b).toRgb();
  expect(ra).toEqual(rb);
};

describe('J. gamut.ts string parser channel forms equal', () => {
  it('oklch L: 50% ≡ 0.5', () =>
    sameUnderToGamutP3('oklch(50% 0.1 180)', 'oklch(0.5 0.1 180)'));
  it('oklch C: 40% ≡ 0.16', () =>
    // C percent is m[3] * 0.004; 40% → 0.16. Decimal 0.16 should match.
    sameUnderToGamutP3('oklch(50% 40% 180)', 'oklch(50% 0.16 180)'));
  it('oklab L: 50% ≡ 0.5', () =>
    sameUnderToGamutP3('oklab(50% 0 0)', 'oklab(0.5 0 0)'));
  it('oklab a: 40% ≡ 0.16', () =>
    sameUnderToGamutP3('oklab(0.5 40% 0)', 'oklab(0.5 0.16 0)'));
  it('oklab b: 40% ≡ 0.16', () =>
    sameUnderToGamutP3('oklab(0.5 0 40%)', 'oklab(0.5 0 0.16)'));
  it('lab a: 50% ≡ 62.5', () =>
    // CIE Lab a percent is m[3] * 1.25; 50% → 62.5.
    sameUnderToGamutP3('lab(50 50% 0)', 'lab(50 62.5 0)'));
  it('lab b: 50% ≡ 62.5', () => sameUnderToGamutP3('lab(50 0 50%)', 'lab(50 0 62.5)'));
  it('lch C: 50% ≡ 75', () =>
    // LCH C percent is m[3] * 1.5; 50% → 75.
    sameUnderToGamutP3('lch(50 50% 180)', 'lch(50 75 180)'));
  it('p3 r: 50% ≡ 0.5', () =>
    sameUnderToGamutP3('color(display-p3 50% 0.5 0.5)', 'color(display-p3 0.5 0.5 0.5)'));
  it('p3 g: 50% ≡ 0.5', () =>
    sameUnderToGamutP3('color(display-p3 0.5 50% 0.5)', 'color(display-p3 0.5 0.5 0.5)'));
  it('p3 b: 50% ≡ 0.5', () =>
    sameUnderToGamutP3('color(display-p3 0.5 0.5 50%)', 'color(display-p3 0.5 0.5 0.5)'));
  it('rec2020 r: 50% ≡ 0.5', () =>
    sameUnderToGamutP3('color(rec2020 50% 0.5 0.5)', 'color(rec2020 0.5 0.5 0.5)'));
  it('rec2020 g: 50% ≡ 0.5', () =>
    sameUnderToGamutP3('color(rec2020 0.5 50% 0.5)', 'color(rec2020 0.5 0.5 0.5)'));
  it('rec2020 b: 50% ≡ 0.5', () =>
    sameUnderToGamutP3('color(rec2020 0.5 0.5 50%)', 'color(rec2020 0.5 0.5 0.5)'));
});

// ────────────────────────────────────────────────────────────────────────
// K. gamut.ts:getRawOklab — OklabColor object validation
// ────────────────────────────────────────────────────────────────────────
//
// gamut.ts:88-91 has:
//   if (typeof c.l === 'number' && typeof c.a === 'number' && typeof c.b === 'number' && typeof c.alpha === 'number')
// Mutants flip each `&&`. To pin every term, send an OklabColor-shaped
// object to toGamutP3 with exactly one field non-numeric: the result
// should be invalid, regardless of which `&&` was mutated.

describe('K. toGamutP3 rejects OklabColor object with one non-numeric field', () => {
  for (const field of ['l', 'a', 'b', 'alpha'] as const) {
    it(`{${field}: 'x'} → invalid`, () => {
      const obj = { l: 0.5, a: 0, b: 0, alpha: 1, [field]: 'x' };
      expect(Colordx.toGamutP3(obj as never).isValid()).toBe(false);
    });
  }
});

// ────────────────────────────────────────────────────────────────────────
// L. OKLab L > 1 sentinel
// ────────────────────────────────────────────────────────────────────────
//
// parseOklabObject and parseOklchObject both have:
//   if (sanitize(l) > 1) return null;
// to refuse CIE-Lab-shaped values (L in 0..100) that arrived without the
// 'lab' brand. Without an explicit l>1 reject test, the `> 1` mutant
// (e.g. `> 0`, `>= 1`) survives.

describe('L. oklab/oklch reject l > 1 (CIE-Lab-shaped values)', () => {
  it('{l: 50, a: 0, b: 0} (no brand) is rejected by oklab', () => reject({ l: 50, a: 0, b: 0 }));
  it('{l: 50, c: 0, h: 0} (no brand) is rejected by oklch', () => reject({ l: 50, c: 0, h: 0 }));
  // Boundary: l=1.01 must reject; l=1.0 must accept.
  it('{l: 1.01, a: 0, b: 0} is rejected (just above the boundary)', () =>
    reject({ l: 1.01, a: 0, b: 0 }));
  it('{l: 1.0, a: 0, b: 0} is accepted', () => accept({ l: 1.0, a: 0, b: 0 }));
});

// ────────────────────────────────────────────────────────────────────────
// M. Legacy comma syntax — channel-type homogeneity
// ────────────────────────────────────────────────────────────────────────
//
// parseRgbString legacy branch enforces `rPct === gPct === bPct`. The
// existing tests cover all-percent and all-decimal, but not the mixed
// case that the homogeneity check actually rejects.

describe('M. rgb legacy mixed % / number is rejected', () => {
  it.each([
    'rgb(100%, 100, 100)',
    'rgb(100, 100%, 100)',
    'rgb(100, 100, 100%)',
    'rgb(100%, 100%, 100)',
    'rgb(100, 100%, 100%)',
  ])('rejects %s', (input) => reject(input));
});

// ────────────────────────────────────────────────────────────────────────
// N. parseXyzObject (D50, no brand) — validation chain
// ────────────────────────────────────────────────────────────────────────
//
// Section A only exercised the parseXyzD65Object branch (with brand).
// parseXyzObject (D50) is reached when the input has x/y/z but no
// xyz-d65 brand. This section pins its `||` chain.

describe('N. parseXyzObject (unbranded) — single-field invalid value', () => {
  for (const field of ['x', 'y', 'z'] as const) {
    for (const bad of ['x', null, NaN, {}, []] as const) {
      const label = bad === null ? 'null' : Number.isNaN(bad as number) ? 'NaN' : JSON.stringify(bad);
      it(`{${field}: ${label}, …} → invalid`, () => {
        const obj = { x: 50, y: 50, z: 50, [field]: bad };
        // Without a brand: parseXyzD65Object rejects (no brand), parseXyzObject
        // takes over. parseXyzObject uses isNumber (rejects NaN/Infinity too),
        // so the mutant `(false || !isNumber(alpha))` would fall through with
        // alpha defaulted, producing NaN-RGB → isValid=true. The
        // expect-isValid-false assertion catches that.
        expect(colordx(obj as never).isValid()).toBe(false);
      });
    }
  }
  // alpha=NaN passes the `isNumber` of x/y/z but fails alpha's own check —
  // EXCEPT under the mutant that drops the first three terms.
  it('alpha=NaN with valid x/y/z → invalid', () => {
    expect(colordx({ x: 50, y: 50, z: 50, alpha: NaN } as never).isValid()).toBe(false);
  });
});

describe('N2. parseXyzObject brand gate', () => {
  // parseXyzObject rejects only when colorSpace === 'xyz-d65'. The mutant
  // `=== ''` would erroneously reject objects with empty-string brand.
  // Original accepts; mutant rejects. accept() pins the literal.
  it('accepts {colorSpace: "", x:50, y:50, z:50}', () =>
    accept({ colorSpace: '', x: 50, y: 50, z: 50 }));
});

// ────────────────────────────────────────────────────────────────────────
// O. gamut.ts:85 — disambiguating-key rejection in OklabColor branch
// ────────────────────────────────────────────────────────────────────────
//
// gamut.ts:getRawOklab gates the OklabColor branch on:
//   'l' in obj && 'a' in obj && 'b' in obj && obj.colorSpace !== 'lab' && !('c' in obj) && !('r' in obj)
// StringLiteral mutations replace 'c' or 'r' with ''. Without these guards,
// objects like {l, a, b, c: 0} or {l, a, b, r: 0} would be misread as
// OklabColor. Assert toGamutP3 fails for those inputs (they don't match
// any other gamut.ts branch either).

describe('O. toGamutP3 rejects ambiguous {l, a, b, …} objects', () => {
  it('{l, a, b, c} is not OklabColor (c suggests OKLCH/LCH)', () => {
    expect(Colordx.toGamutP3({ l: 0.5, a: 0, b: 0, c: 0 } as never).isValid()).toBe(false);
  });
  it('{l, a, b, r} is not OklabColor (r suggests RGB-shaped)', () => {
    expect(Colordx.toGamutP3({ l: 0.5, a: 0, b: 0, r: 0 } as never).isValid()).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────
// P. gamut.ts inline parser — channel/hue scaling matches colorModels parser
// ────────────────────────────────────────────────────────────────────────
//
// gamut.ts has a parallel set of regex parsers inside getRawOklab. Their
// channel scaling (* 0.004 / * 1.25 / / 100) and hue-unit multiplication
// must agree with src/colorModels/*.ts for in-gamut inputs — toGamutP3 of
// an in-gamut color must equal the same color parsed via colordx().
//
// This wedges every channel/hue arithmetic mutation: any sign or factor
// flip in gamut.ts produces a different OKLab → different RGB, while the
// colorModels parser (untouched by the mutation) keeps the reference.

const matchesColordx = (input: string) => {
  const viaGamut = Colordx.toGamutP3(input).toRgb();
  const viaParse = colordx(input).toRgb();
  expect(viaGamut).toEqual(viaParse);
};

describe('P. gamut.ts string parser channels/hue match colordx() for in-gamut inputs', () => {
  // OKLCH — kills gamut.ts:158 (l), 159 (c), 161 (hDeg multiplier), 161 (?? 1 fallback)
  it('oklch decimal in-gamut', () => matchesColordx('oklch(50% 0.05 180)'));
  it('oklch percent C in-gamut', () => matchesColordx('oklch(50% 12% 180)'));
  it('oklch turn unit', () => matchesColordx('oklch(50% 0.05 0.5turn)'));
  it('oklch grad unit', () => matchesColordx('oklch(50% 0.05 200grad)'));
  it('oklch rad unit', () => matchesColordx('oklch(50% 0.05 3.14rad)'));
  it('oklch mixed-case Turn unit (kills toLowerCase mutation)', () =>
    matchesColordx('oklch(50% 0.05 0.5Turn)'));

  // OKLAB — kills gamut.ts:168 (l), 169 (a), 170 (b)
  it('oklab decimal in-gamut', () => matchesColordx('oklab(0.5 0.05 0)'));
  it('oklab percent L in-gamut', () => matchesColordx('oklab(50% 0.05 0)'));
  it('oklab percent a in-gamut', () => matchesColordx('oklab(0.5 12% 0)'));
  it('oklab percent b in-gamut', () => matchesColordx('oklab(0.5 0 12%)'));

  // LAB — kills gamut.ts:177 (a), 178 (b)
  it('lab decimal in-gamut', () => matchesColordx('lab(50 5 0)'));
  it('lab percent a in-gamut', () => matchesColordx('lab(50 4% 0)'));
  it('lab percent b in-gamut', () => matchesColordx('lab(50 0 4%)'));

  // LCH — kills gamut.ts:186 (c), 188 (hDeg)
  it('lch decimal in-gamut', () => matchesColordx('lch(50 6 180)'));
  it('lch percent C in-gamut', () => matchesColordx('lch(50 4% 180)'));
  it('lch turn unit', () => matchesColordx('lch(50 6 0.5turn)'));

  // P3 — kills gamut.ts:196/197/198 (r/g/b channel %)
  it('p3 decimal in-gamut', () => matchesColordx('color(display-p3 0.4 0.4 0.4)'));
  it('p3 percent r in-gamut', () => matchesColordx('color(display-p3 40% 0.4 0.4)'));
  it('p3 percent g in-gamut', () => matchesColordx('color(display-p3 0.4 40% 0.4)'));
  it('p3 percent b in-gamut', () => matchesColordx('color(display-p3 0.4 0.4 40%)'));

  // Rec2020 — kills gamut.ts:205/206/207 (r/g/b channel %)
  it('rec2020 decimal in-gamut', () => matchesColordx('color(rec2020 0.4 0.4 0.4)'));
  it('rec2020 percent r in-gamut', () => matchesColordx('color(rec2020 40% 0.4 0.4)'));
  it('rec2020 percent g in-gamut', () => matchesColordx('color(rec2020 0.4 40% 0.4)'));
  it('rec2020 percent b in-gamut', () => matchesColordx('color(rec2020 0.4 0.4 40%)'));
});

// ────────────────────────────────────────────────────────────────────────
// Q. rgbToP3 / rgbToRec2020 — colorSpace tag is correct
// ────────────────────────────────────────────────────────────────────────
//
// p3.ts:66 / rec2020.ts:67 each have a literal `colorSpace: 'display-p3'`
// (or 'rec2020') in the public converter return. Existing round-trip
// tests don't read the tag, so the StringLiteral '' mutation survives.

describe('Q. exported rgb→wide-gamut converters tag colorSpace correctly', () => {
  it('rgbToP3 returns colorSpace: "display-p3"', async () => {
    const { rgbToP3 } = await import('../src/colorModels/p3.js');
    expect(rgbToP3({ r: 100, g: 100, b: 100, alpha: 1 }).colorSpace).toBe('display-p3');
  });
  it('rgbToRec2020 returns colorSpace: "rec2020"', async () => {
    const { rgbToRec2020 } = await import('../src/colorModels/rec2020.js');
    expect(rgbToRec2020({ r: 100, g: 100, b: 100, alpha: 1 }).colorSpace).toBe('rec2020');
  });
});

// ────────────────────────────────────────────────────────────────────────
// R. CIELAB piecewise nonlinear conversion — exercise the linear branch
// ────────────────────────────────────────────────────────────────────────
//
// labToXyzValuesInto has three piecewise expressions (lab.ts:44-46):
//   out[i] = (f**3 > EPSILON ? f**3 : (116 * f - 16) / KAPPA) * W
// Existing tests almost always land in the cubic branch (mid-tone colors).
// Very dark Lab values pull fy/fx/fz below the cube-root of EPSILON,
// taking the linear branch where the `/ KAPPA` arithmetic actually runs.
// Mutant `* KAPPA` produces wildly different XYZ → different round-trip RGB.

describe('R. very dark CIELAB round-trips through the linear branch', () => {
  // lab(0 0 0) ≡ pure black. Our pipeline produces RGB (0, 0, 0) under the
  // correct linear-branch arithmetic; the `* KAPPA` mutant diverges.
  it('lab(0 0 0) round-trips to black', () => {
    expect(colordx('lab(0 0 0)').toRgb()).toEqual({ r: 0, g: 0, b: 0, alpha: 1 });
  });
  // lab(5 10 10) sits in the linear branch for L (l < 8) and exercises the
  // (116*f − 16)/KAPPA expression for the chroma-shifted x and z legs.
  it('lab(5 10 10) is in the very-dark gamut, not black or white', () => {
    const c = colordx('lab(5 10 10)').toRgb();
    expect(c.r).toBeGreaterThan(0);
    expect(c.r).toBeLessThan(50);
    expect(c.g).toBeLessThan(20);
    expect(c.b).toBeLessThan(20);
  });
});

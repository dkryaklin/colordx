/**
 * Wide fuzzing: generators that reach the inputs the narrower suites never produced.
 *
 *  1. String grammar. A fast-check generator builds color functions (every syntax colordx parses)
 *     as a *token list plus separators*, valid and invalid alike: mixed-case names, units and
 *     keywords, CSS whitespace (space, tab, LF, CR, FF) against look-alikes (NBSP, U+2028, U+3000,
 *     BOM, VT, NEL, ZWSP), every CSS <number-token> spelling, `none` in every slot, legacy comma
 *     syntax against modern, missing and extra arguments, trailing slashes, bad units, stray
 *     parens. An independent oracle — a small grammar checker over that token list, written from
 *     CSS Color 4 / CSS Syntax 3, not from src/ — decides validity, and colordx must agree. Every
 *     accepted CSS string is then compared numerically against culori as a second opinion.
 *  2. The tinycolor2 compat shim: differential fuzz against tinycolor2 on weird strings and
 *     objects, plus linear-time rejection of adversarial long inputs by every parser (core,
 *     every plugin, the shim).
 *  3. Object input: every model's object form with null / undefined / NaN / ±Infinity / strings /
 *     booleans / extra keys / both `a` and `alpha` / mismatched `colorSpace` brands.
 *
 * Known bugs are pinned with `it.fails` and a `// BUG:` line, so the suite stays green while they
 * are open and turns red (prompting removal of `.fails`) once they are fixed.
 */
import { colorsNamed, converter, parse as culoriParse } from 'culori';
import fc from 'fast-check';
import ref from 'tinycolor2';
import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend, getFormat } from '../src/index.js';
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

beforeAll(() => {
  extend([
    a11y,
    a98rgb,
    cmyk,
    cvd,
    harmonies,
    hsv,
    hwb,
    lab,
    lch,
    minify,
    mix,
    names,
    okhsl,
    okhsv,
    p3,
    prophoto,
    rec2020,
    srgbLinear,
  ]);
});

// CI runners measured ~4× slower than local; every property below runs well under 5 s locally.
const TIMEOUT = 30_000;
const toRgb = converter('rgb');

// ─── 1. String grammar ──────────────────────────────────────────────────────────────────────────

/** CSS Syntax 3 §4.2 whitespace. */
const CSS_WS = [' ', '\t', '\n', '\r', '\f'] as const;
/** Characters JS `\s` / String.trim() treat as whitespace (or that look like it) but CSS does not. */
const NON_CSS_WS = ['\u00a0', '\u2028', '\u2029', '\u3000', '\ufeff', '\v', '\u0085', '\u200b'] as const;
const isCssWs = (c: string): boolean => (CSS_WS as readonly string[]).includes(c);
const allCssWs = (s: string): boolean => [...s].every(isCssWs);

/** Whitespace run of `min`..3 CSS whitespace chars, rarely salted with one non-CSS look-alike. */
const wsArb = (min: number): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.array(fc.constantFrom<string>(...CSS_WS), { minLength: min, maxLength: 3 }),
      fc.oneof(
        { weight: 40, arbitrary: fc.constant(null) },
        { weight: 1, arbitrary: fc.tuple(fc.constantFrom(...NON_CSS_WS), fc.nat(3)) }
      )
    )
    .map(([chars, bad]) => {
      if (bad) chars.splice(bad[1] % (chars.length + 1), 0, bad[0]);
      return chars.join('');
    });

const randomCase = (s: string, bits: number): string =>
  [...s].map((ch, i) => ((bits >> (i % 30)) & 1 ? ch.toUpperCase() : ch)).join('');
const caseArb = fc.nat({ max: 2 ** 30 - 1 }).map((n) => (n % 3 === 0 ? 0 : n)); // a third all-lower

type TokKind = 'num' | 'pct' | 'none' | 'angle' | 'dim' | 'bad';
interface Tok {
  text: string;
  kind: TokKind;
  /** Number value (num), percentage value (pct), degrees (angle), 0 (none). */
  value: number;
  /** Value outside the range the numeric comparison trusts both libraries to agree on. */
  oor: boolean;
}

/** `m / 10^d` as plain decimal text, sign included. */
const plainDecimal = (m: number, d: number): string => {
  const digits = String(Math.abs(m)).padStart(d + 1, '0');
  const body = d ? `${digits.slice(0, -d)}.${digits.slice(-d)}` : digits;
  return (m < 0 ? '-' : '') + body;
};

/**
 * Every spelling of one decimal value that CSS Syntax 3 §4.3.3 reads as a <number-token>:
 * leading `+`, leading zeros, a bare leading `.`, `e` / `E` exponents with and without a sign.
 */
const numberSpelling = (m: number, d: number, form: number): string => {
  const plain = plainDecimal(m, d);
  switch (form) {
    case 1:
      return m >= 0 ? `+${plain}` : plain;
    case 2:
      return m < 0 ? `-00${plain.slice(1)}` : `00${plain}`;
    case 3:
      return plain.replace(/^(-?)0\./, '$1.');
    case 4:
      return d > 0 ? `${m}e-${d}` : `${m}e0`;
    case 5:
      return `${m}0E-${d + 1}`;
    case 6:
      return `${plainDecimal(m, d + 1)}e+1`;
    case 7:
      return m === 0 ? '-0' : `${plainDecimal(m * 10, d + 1)}E0`;
    default:
      return plain;
  }
};

/** A <number-token> spelled at random, with its value; `oor` values leave [lo, hi]. */
const numArb = (lo: number, hi: number): fc.Arbitrary<{ text: string; value: number; oor: boolean }> =>
  fc
    .tuple(
      fc.integer({ min: 0, max: 3 }),
      fc.oneof(
        { weight: 12, arbitrary: fc.double({ min: lo, max: hi, noNaN: true }).map((v) => ({ v, oor: false })) },
        { weight: 2, arbitrary: fc.constantFrom(lo, hi).map((v) => ({ v, oor: false })) },
        {
          weight: 1,
          arbitrary: fc
            .constantFrom(-1, 2, -10, 10)
            .map((k) => ({ v: k < 0 ? lo + (hi - lo) * k * 0.1 : hi + (hi - lo) * k * 0.1, oor: true })),
        }
      ),
      fc.integer({ min: 0, max: 7 })
    )
    .map(([d, { v, oor }, form]) => {
      const m = Math.round(v * 10 ** d);
      const text = numberSpelling(m, d, form);
      return { text, value: Number(text), oor };
    });

// Malformed numbers. Each one is a token CSS rejects on its own (a delim, an ident, a dimension
// with a junk unit) — none splits into two valid adjacent numbers the way `1..2` (1 then .2) does.
const BAD_NUMBERS = [
  '1.',
  '.',
  '1e',
  '1e+',
  '1E-',
  '+-1',
  '-+1',
  '--1',
  '0x1',
  '+',
  '-',
  'e2',
  '.e1',
  '1_0',
  'Infinity',
  'NaN',
  '\u0661',
  '\u00bd',
  '1\u066b5',
  '#1',
];
const BAD_NONES = ['none%', 'nonedeg', 'non', 'nones', '-none', 'n0ne', 'none1'];
const ANGLE_UNITS: Record<string, number> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 };
const BAD_UNITS = ['px', 'dg', 'degs', 'x', 'grads', 'rad2', 'deg_', 'em'];

type Slot = 'c' | 'h' | 'a'; // channel (number | % | none), hue (number | angle | none), alpha

const tokArb = (slot: Slot, lo: number, hi: number): fc.Arbitrary<Tok> =>
  fc.oneof(
    { weight: 10, arbitrary: numArb(lo, hi).map((n): Tok => ({ ...n, kind: 'num' })) },
    {
      weight: slot === 'h' ? 1 : 8,
      arbitrary: numArb(0, 100).map((n): Tok => ({ ...n, text: `${n.text}%`, kind: 'pct' })),
    },
    {
      weight: 3,
      arbitrary: caseArb.map((c): Tok => ({ text: randomCase('none', c), kind: 'none', value: 0, oor: false })),
    },
    {
      weight: slot === 'h' ? 8 : 1,
      arbitrary: fc
        .tuple(numArb(-400, 400), fc.constantFrom(...Object.keys(ANGLE_UNITS)), caseArb)
        .map(([n, u, c]): Tok => ({
          text: n.text + randomCase(u, c),
          kind: 'angle',
          value: n.value * ANGLE_UNITS[u]!,
          oor: false,
        })),
    },
    {
      weight: 1,
      arbitrary: fc
        .tuple(numArb(lo, hi), fc.constantFrom(...BAD_UNITS))
        .map(([n, u]): Tok => ({ ...n, text: n.text + u, kind: 'dim' })),
    },
    {
      weight: 1,
      arbitrary: fc
        .constantFrom(...BAD_NUMBERS, ...BAD_NONES)
        .map((t): Tok => ({ text: t, kind: 'bad', value: 0, oor: false })),
    }
  );

interface FnSpec {
  id: string;
  names: string[];
  /** `color()` predefined space ident. */
  space?: string;
  slots: ('c' | 'h')[];
  /** Number-form range of each slot. */
  ranges: [number, number][];
  /** Which legacy comma grammar the function has, if any. */
  legacy?: 'rgb' | 'hsl';
  /** Reference value of 100% per slot (for the culori string we pass numbers straight through). */
  culori: boolean;
}

const rgbRange: [number, number] = [0, 255];
const unit: [number, number] = [0, 1];
const pctR: [number, number] = [0, 100];
const hueR: [number, number] = [-720, 720];
const COLOR_SPACES = [
  'srgb',
  'srgb-linear',
  'display-p3',
  'a98-rgb',
  'prophoto-rgb',
  'rec2020',
  'xyz',
  'xyz-d50',
  'xyz-d65',
];

const FNS: FnSpec[] = [
  {
    id: 'rgb',
    names: ['rgb', 'rgba'],
    slots: ['c', 'c', 'c'],
    ranges: [rgbRange, rgbRange, rgbRange],
    legacy: 'rgb',
    culori: true,
  },
  {
    id: 'hsl',
    names: ['hsl', 'hsla'],
    slots: ['h', 'c', 'c'],
    ranges: [hueR, pctR, pctR],
    legacy: 'hsl',
    culori: true,
  },
  { id: 'hwb', names: ['hwb'], slots: ['h', 'c', 'c'], ranges: [hueR, pctR, pctR], culori: true },
  {
    id: 'lab',
    names: ['lab'],
    slots: ['c', 'c', 'c'],
    ranges: [
      [0, 100],
      [-125, 125],
      [-125, 125],
    ],
    culori: true,
  },
  { id: 'lch', names: ['lch'], slots: ['c', 'c', 'h'], ranges: [[0, 100], [0, 150], hueR], culori: true },
  { id: 'oklab', names: ['oklab'], slots: ['c', 'c', 'c'], ranges: [unit, [-0.4, 0.4], [-0.4, 0.4]], culori: true },
  { id: 'oklch', names: ['oklch'], slots: ['c', 'c', 'h'], ranges: [unit, [0, 0.4], hueR], culori: true },
  ...COLOR_SPACES.map((space): FnSpec => ({
    id: `color(${space})`,
    names: ['color'],
    space,
    slots: ['c', 'c', 'c'],
    ranges: [unit, unit, unit],
    // culori still encodes rec2020 with the BT.2020 camera curve; colordx follows the 2.4 gamma
    // CSS Color 4 adopted (README, rec2020 plugin), so there is no second opinion to ask.
    culori: space !== 'rec2020',
  })),
  // Library-defined syntaxes (README): hsv() mirrors hsl() including its comma form; okhsl() and
  // okhsv() are modern-only; device-cmyk() is CSS Color 5 (4 channels, numbers are 0–1).
  {
    id: 'hsv',
    names: ['hsv', 'hsva'],
    slots: ['h', 'c', 'c'],
    ranges: [hueR, pctR, pctR],
    legacy: 'hsl',
    culori: false,
  },
  { id: 'okhsl', names: ['okhsl'], slots: ['h', 'c', 'c'], ranges: [hueR, pctR, pctR], culori: false },
  { id: 'okhsv', names: ['okhsv'], slots: ['h', 'c', 'c'], ranges: [hueR, pctR, pctR], culori: false },
  {
    id: 'device-cmyk',
    names: ['device-cmyk'],
    slots: ['c', 'c', 'c', 'c'],
    ranges: [unit, unit, unit, unit],
    culori: false,
  },
];

interface Sep {
  pre: string;
  mark: '' | ',' | '/';
  post: string;
}

interface Built {
  fn: FnSpec;
  str: string;
  name: string;
  nameOk: boolean;
  spaceOk: boolean;
  wsRuns: string[]; // every whitespace run that must be CSS whitespace (may be empty)
  nameGap: string; // between the name and `(` — must be empty
  spaceGap: string; // between the color() space ident and the first channel — must be 1+ CSS ws
  toks: Tok[];
  seps: Sep[]; // seps[i] sits between toks[i] and toks[i + 1]
  trailingSlash: boolean;
  close: string; // what follows the last token and whitespace — must be exactly ')'
}

const NAME_MUTANTS = (n: string): string[] => [`${n}x`, n.slice(0, -1), `${n}a`, `_${n}`, n.replace(/(.)$/, '$1$1')];
const BAD_SPACES = ['srgb2', 'display_p3', 'p3', 'xyz-d60', 'rgb', 'srgb-lin', 'displayp3', 'a98rgb', '--srgb'];

const builtArb: fc.Arbitrary<Built> = fc
  .record({
    fnIdx: fc.nat({ max: FNS.length - 1 }),
    nameIdx: fc.nat({ max: 1 }),
    nameCase: caseArb,
    nameMutant: fc.oneof({ weight: 25, arbitrary: fc.constant(-1) }, { weight: 1, arbitrary: fc.nat({ max: 4 }) }),
    spaceCase: caseArb,
    spaceMutant: fc.oneof(
      { weight: 25, arbitrary: fc.constant(-1) },
      { weight: 1, arbitrary: fc.nat({ max: BAD_SPACES.length - 1 }) }
    ),
    lead: fc.oneof(fc.constant(''), wsArb(0)),
    trail: fc.oneof(fc.constant(''), wsArb(0)),
    nameGap: fc.oneof({ weight: 30, arbitrary: fc.constant('') }, { weight: 1, arbitrary: wsArb(1) }),
    afterOpen: fc.oneof(fc.constant(''), wsArb(0)),
    spaceGap: fc.oneof({ weight: 30, arbitrary: wsArb(1) }, { weight: 1, arbitrary: fc.constant('') }),
    beforeClose: fc.oneof(fc.constant(''), wsArb(0)),
    style: fc.oneof(
      { weight: 6, arbitrary: fc.constant('modern' as const) },
      { weight: 3, arbitrary: fc.constant('legacy' as const) },
      { weight: 1, arbitrary: fc.constant('mixed' as const) }
    ),
    countDelta: fc.oneof(
      { weight: 14, arbitrary: fc.constant(0) },
      { weight: 1, arbitrary: fc.constant(-1) },
      { weight: 1, arbitrary: fc.constant(1) }
    ),
    hasAlpha: fc.boolean(),
    trailingSlash: fc.oneof({ weight: 30, arbitrary: fc.constant(false) }, { weight: 1, arbitrary: fc.constant(true) }),
    close: fc.oneof(
      { weight: 30, arbitrary: fc.constant(')') },
      { weight: 1, arbitrary: fc.constantFrom('', '))', ')x', ');', ') )', ')/') }
    ),
    sepWs: fc.array(fc.tuple(wsArb(1), wsArb(0), wsArb(0), fc.boolean()), { minLength: 6, maxLength: 6 }),
    seed: fc.array(fc.nat(), { minLength: 1, maxLength: 1 }),
  })
  .chain((r) => {
    const fn = FNS[r.fnIdx]!;
    const n = fn.slots.length + r.countDelta;
    const chanArbs = Array.from({ length: Math.max(0, n) }, (_, i) => {
      const slot = fn.slots[Math.min(i, fn.slots.length - 1)]!;
      const range = fn.ranges[Math.min(i, fn.ranges.length - 1)]!;
      return tokArb(slot, range[0], range[1]);
    });
    return fc.tuple(fc.constant(r), fc.tuple(...chanArbs), tokArb('a', -0.5, 1.5));
  })
  .map(([r, chans, alphaTok]): Built => {
    const fn = FNS[r.fnIdx]!;
    const baseName = fn.names[r.nameIdx % fn.names.length]!;
    const plainName = r.nameMutant < 0 ? baseName : NAME_MUTANTS(baseName)[r.nameMutant]!;
    const nameOk = fn.names.includes(plainName); // `rgb` + `a` is still a name
    const name = randomCase(plainName, r.nameCase);
    const spaceOk = !fn.space || r.spaceMutant < 0;
    const toks: Tok[] = [...chans];
    const seps: Sep[] = [];
    const sepFor = (i: number, isAlpha: boolean): Sep => {
      const [req, pre, post, coin] = r.sepWs[i % 6]!;
      const legacy = r.style === 'legacy' || (r.style === 'mixed' && coin);
      if (legacy) return { pre, mark: ',', post };
      return isAlpha ? { pre, mark: '/', post } : { pre: req, mark: '', post: '' };
    };
    for (let i = 1; i < toks.length; i++) seps.push(sepFor(i - 1, false));
    if (r.hasAlpha && toks.length > 0) {
      seps.push(sepFor(toks.length - 1, true));
      toks.push(alphaTok);
    }
    // A mixed style must actually mix: force the first separator to the other form.
    if (r.style === 'mixed' && seps.length >= 2 && seps.every((s) => s.mark === ','))
      seps[0] = { pre: ' ', mark: '', post: '' };
    if (r.style === 'mixed' && seps.length >= 2 && seps.every((s) => s.mark !== ','))
      seps[0] = { pre: '', mark: ',', post: ' ' };

    let body = '';
    toks.forEach((t, i) => {
      if (i > 0) {
        const s = seps[i - 1]!;
        body += s.pre + s.mark + s.post;
      }
      body += t.text;
    });
    const spaceIdent = fn.space ? randomCase(spaceOk ? fn.space : BAD_SPACES[r.spaceMutant]!, r.spaceCase) : '';
    const open = fn.space
      ? `${name}${r.nameGap}(${r.afterOpen}${spaceIdent}${r.spaceGap}`
      : `${name}${r.nameGap}(${r.afterOpen}`;
    const slash = r.trailingSlash ? ' /' : '';
    const str = `${r.lead}${open}${body}${slash}${r.beforeClose}${r.close}${r.trail}`;
    const wsRuns = [r.lead, r.trail, r.afterOpen, r.beforeClose, ...seps.flatMap((s) => [s.pre, s.post])];
    if (fn.space) wsRuns.push(r.spaceGap);
    return {
      fn,
      str,
      name,
      nameOk,
      spaceOk,
      wsRuns,
      nameGap: r.nameGap,
      spaceGap: fn.space ? r.spaceGap : ' ',
      toks,
      seps,
      trailingSlash: r.trailingSlash,
      close: r.close,
    };
  });

/**
 * The oracle. Reads the token list the generator produced — never the string, never src/ —
 * and applies CSS Color 4 §4–§10 (plus the README's rules for the library-defined hsv(), okhsl(),
 * okhsv(), device-cmyk()):
 *  - modern: exactly N channels separated by whitespace, optional `/ alpha`; channel = number |
 *    percentage | none, hue = number | angle | none, alpha = number | percentage | none;
 *  - legacy (rgb/rgba, hsl/hsla, hsv/hsva only): comma-separated, no `none`; rgb channels all
 *    numbers or all percentages; hsl hue = number | angle, saturation and lightness percentages;
 *    optional 4th comma-separated alpha = number | percentage;
 *  - no whitespace between the name and `(`, 1+ whitespace after a color() space ident,
 *    whitespace is only the five CSS whitespace characters, nothing after `)`.
 */
const oracle = (b: Built): boolean => {
  const { fn, toks, seps } = b;
  if (!b.nameOk || !b.spaceOk || b.nameGap !== '' || b.close !== ')' || b.trailingSlash) return false;
  if (!b.wsRuns.every(allCssWs)) return false;
  if (fn.space && (b.spaceGap === '' || !allCssWs(b.spaceGap))) return false;
  if (toks.length === 0) return false;
  const isChan = (t: Tok, slot: 'c' | 'h'): boolean =>
    slot === 'c'
      ? t.kind === 'num' || t.kind === 'pct' || t.kind === 'none'
      : t.kind === 'num' || t.kind === 'angle' || t.kind === 'none';
  const isAlpha = (t: Tok): boolean => t.kind === 'num' || t.kind === 'pct' || t.kind === 'none';
  const k = fn.slots.length;

  if (seps.some((s) => s.mark === ',')) {
    if (!fn.legacy || !seps.every((s) => s.mark === ',')) return false;
    if (toks.length !== k && toks.length !== k + 1) return false;
    if (toks.some((t) => t.kind === 'none')) return false;
    const chans = toks.slice(0, k);
    if (fn.legacy === 'rgb') {
      if (!(chans.every((t) => t.kind === 'num') || chans.every((t) => t.kind === 'pct'))) return false;
    } else {
      if (!(chans[0]!.kind === 'num' || chans[0]!.kind === 'angle')) return false;
      if (chans[1]!.kind !== 'pct' || chans[2]!.kind !== 'pct') return false;
    }
    return toks.length === k || isAlpha(toks[k]!);
  }

  // Modern: an empty separator never appears (the generator always puts 1+ chars there), so a
  // separator is either whitespace or a `/`, and only the last one may be the `/`.
  const slashAt = seps.findIndex((s) => s.mark === '/');
  if (slashAt !== -1 && slashAt !== seps.length - 1) return false;
  if (seps.some((s) => s.mark === '' && s.pre === '')) return false;
  const chans = slashAt === -1 ? toks : toks.slice(0, -1);
  if (chans.length !== k) return false;
  if (!chans.every((t, i) => isChan(t, fn.slots[i]!))) return false;
  return slashAt === -1 || isAlpha(toks[toks.length - 1]!);
};

/** The same color spelled the plain way for culori: lower-case, modern, degrees, `none` as 0. */
const canonical = (b: Built): { css: string; alpha: number } | null => {
  const { fn, toks } = b;
  const k = fn.slots.length;
  const chans = toks.slice(0, k);
  const a = toks[k];
  const text = (t: Tok): string => (t.kind === 'pct' ? `${t.value}%` : t.kind === 'none' ? '0' : String(t.value));
  const alpha = a ? (a.kind === 'pct' ? a.value / 100 : a.kind === 'none' ? 0 : a.value) : 1;
  const body = chans.map(text).join(' ');
  const name = fn.names[0]!;
  const css = fn.space ? `color(${fn.space} ${body})` : `${name}(${body})`;
  return { css, alpha: Math.min(1, Math.max(0, alpha)) };
};

describe('string grammar fuzz — colordx agrees with an independent CSS Color 4 oracle', () => {
  it(
    'isValid() and getFormat() match the oracle on ~50/50 valid/invalid color functions',
    () => {
      let valid = 0;
      fc.assert(
        fc.property(builtArb, (b) => {
          const expected = oracle(b);
          if (expected) valid++;
          const c = colordx(b.str);
          expect(c.isValid(), JSON.stringify(b.str)).toBe(expected);
          expect(getFormat(b.str) !== undefined, JSON.stringify(b.str)).toBe(expected);
        }),
        { seed: 0xc01d, numRuns: 6000 }
      );
      // Sanity: the generator is not degenerate in either direction.
      expect(valid).toBeGreaterThan(1200);
      expect(valid).toBeLessThan(4800);
    },
    TIMEOUT
  );

  it(
    'every accepted CSS color reads the same channels and alpha as culori',
    () => {
      let compared = 0;
      fc.assert(
        fc.property(builtArb, (b) => {
          if (!b.fn.culori || !oracle(b)) return;
          const canon = canonical(b)!;
          const c = colordx(b.str);
          expect(c.alpha(), b.str).toBeCloseTo(canon.alpha, 3);
          if (b.toks.some((t) => t.oor)) return;
          const ref = culoriParse(canon.css);
          expect(ref, canon.css).toBeDefined();
          const e = toRgb(ref!);
          const { r, g, b: bl } = c._rawRgb();
          const ours = [r / 255, g / 255, bl / 255];
          let theirs = [e.r, e.g, e.b];
          // rgb()/hsl()/hwb() clamp at parsed-value time; culori keeps the raw values, so compare
          // what both display. Everything else is compared unclamped where culori stays sane.
          const clip = (v: number): number => Math.min(1, Math.max(0, v));
          if (b.fn.id === 'rgb' || b.fn.id === 'hsl' || b.fn.id === 'hwb') {
            theirs = theirs.map(clip);
            for (let i = 0; i < 3; i++) ours[i] = clip(ours[i]!);
          } else if (!theirs.every((v) => Number.isFinite(v) && v > -0.5 && v < 1.5)) return;
          compared++;
          for (let i = 0; i < 3; i++)
            expect(Math.abs(ours[i]! - theirs[i]!), `${b.str} vs ${canon.css} [${i}]`).toBeLessThan(2e-3);
        }),
        { seed: 0xbeef, numRuns: 8000 }
      );
      expect(compared).toBeGreaterThan(1000);
    },
    TIMEOUT
  );
});

describe('string grammar fuzz — hex and keywords', () => {
  const HEX = '0123456789abcdefABCDEF';
  // Replacement characters that are never hex digits and never CSS whitespace (a space at the end
  // would just be trailing whitespace and shorten the digit run instead of breaking it).
  const NOT_HEX = ['g', 'G', 'x', '-', '#', '\u00a0', '\u0663', '\uff10', '.', '+'];
  const hexArb = fc.record({
    lead: fc.oneof(fc.constant(''), wsArb(0)),
    trail: fc.oneof(fc.constant(''), wsArb(0)),
    len: fc.oneof(
      { weight: 8, arbitrary: fc.constantFrom(3, 4, 6, 8) },
      { weight: 2, arbitrary: fc.constantFrom(0, 1, 2, 5, 7, 9, 10, 12) }
    ),
    digits: fc.array(fc.constantFrom(...HEX), { minLength: 12, maxLength: 12 }),
    bad: fc.oneof(
      { weight: 10, arbitrary: fc.constant(null) },
      { weight: 1, arbitrary: fc.tuple(fc.constantFrom(...NOT_HEX), fc.nat()) }
    ),
    hash: fc.oneof(
      { weight: 20, arbitrary: fc.constant('#') },
      { weight: 1, arbitrary: fc.constantFrom('', '##', '\uff03', '# ') }
    ),
  });

  it(
    'hex of every length, case and padding: valid exactly for #rgb, #rgba, #rrggbb, #rrggbbaa',
    () => {
      fc.assert(
        fc.property(hexArb, ({ lead, trail, len, digits, bad, hash }) => {
          const ds = digits.slice(0, len);
          if (bad && len > 0) ds[bad[1] % len] = bad[0];
          const str = `${lead}${hash}${ds.join('')}${trail}`;
          const expected =
            hash === '#' && [3, 4, 6, 8].includes(len) && !(bad && len > 0) && allCssWs(lead) && allCssWs(trail);
          const c = colordx(str);
          expect(c.isValid(), JSON.stringify(str)).toBe(expected);
          if (!expected) return;
          const hex = ds.join('').toLowerCase();
          const full = len <= 4 ? [...hex].map((h) => h + h).join('') : hex;
          const byte = (i: number): number => parseInt(full.slice(i * 2, i * 2 + 2), 16);
          expect(c.toRgb(), str).toEqual({
            r: byte(0),
            g: byte(1),
            b: byte(2),
            alpha: full.length === 8 ? Math.round((byte(3) / 255) * 1000) / 1000 : 1,
          });
        }),
        { seed: 0x4e8, numRuns: 3000 }
      );
    },
    TIMEOUT
  );

  const NAMED = Object.keys(colorsNamed);
  const nameArb = fc.record({
    name: fc.constantFrom(...NAMED, 'transparent'),
    caseBits: caseArb,
    lead: fc.oneof(fc.constant(''), wsArb(0)),
    trail: fc.oneof(fc.constant(''), wsArb(0)),
    mutant: fc.oneof({ weight: 12, arbitrary: fc.constant(-1) }, { weight: 1, arbitrary: fc.nat({ max: 4 }) }),
    at: fc.nat(),
  });

  it(
    'named colors and transparent: any ASCII case, CSS-whitespace padding only, whole word only',
    () => {
      fc.assert(
        fc.property(nameArb, ({ name, caseBits, lead, trail, mutant, at }) => {
          let word = randomCase(name, caseBits);
          const i = 1 + (at % (word.length - 1));
          // Mutants: a space inside, a digit for a letter, an extra letter, a non-ASCII look-alike.
          if (mutant === 0) word = `${word.slice(0, i)} ${word.slice(i)}`;
          if (mutant === 1) word = `${word.slice(0, i)}1${word.slice(i + 1)}`;
          if (mutant === 2) word = `${word}q`;
          if (mutant === 3) word = word.replace(/e/i, '\u0435'); // Cyrillic small ie
          if (mutant === 4) word = `${word}\u200b`;
          const str = lead + word + trail;
          const expected = (mutant === -1 || (mutant === 3 && !/e/i.test(name))) && allCssWs(lead) && allCssWs(trail);
          const c = colordx(str);
          expect(c.isValid(), JSON.stringify(str)).toBe(expected);
          if (!expected) return;
          if (name === 'transparent') return void expect(c.toRgb()).toEqual({ r: 0, g: 0, b: 0, alpha: 0 });
          const n = colorsNamed[name as keyof typeof colorsNamed] as number;
          expect(c.toRgb(), str).toEqual({ r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, alpha: 1 });
        }),
        { seed: 0x11a, numRuns: 3000 }
      );
    },
    TIMEOUT
  );

  // CSS keywords are ASCII case-insensitive (CSS Syntax 3 §2.1 / CSS Values 4 §2.3), so the Kelvin
  // sign U+212A, which String#toLowerCase() folds to ASCII `k`, must not match a keyword letter.
  it.each(['\u212ahaki', 'blac\u212a', 'dar\u212ablue', 'pin\u212a', 's\u212ayblue'])(
    'a Kelvin sign is not the letter k: %j',
    (s) => expect(colordx(s).isValid()).toBe(false)
  );

  it('currentcolor, system colors and CSS-wide keywords are not colors colordx can resolve', () => {
    for (const s of [
      'currentcolor',
      'currentColor',
      'CURRENTCOLOR',
      'Canvas',
      'CanvasText',
      'ButtonFace',
      'Highlight',
      'inherit',
      'initial',
      'unset',
      'revert',
      'none',
    ])
      expect(colordx(s).isValid(), s).toBe(false);
  });
});

describe('string grammar — divergences from CSS tokenization (pinned, see the report)', () => {
  // CSS Syntax 3 lets comments stand anywhere whitespace can, and CSS Color 4's grammar is written
  // over tokens, so juxtaposed tokens need no whitespace between them when tokenization already
  // splits them (`1+2` is two <number-token>s). colordx scans characters and wants whitespace.
  // Neither form shows up in real stylesheets' serialized colors; pinned so a change is deliberate.
  it.each([
    ['comment between channels', 'rgb(1/**/2 3)'],
    ['comment after the paren', 'rgb(/**/1 2 3)'],
    ['comment before the function', '/* x */rgb(1 2 3)'],
    ['signed numbers need no whitespace', 'rgb(1+2+3)'],
    ['percentages need no whitespace', 'rgb(10%20%30%)'],
    ['leading-dot numbers need no whitespace', 'rgb(.5.5.5)'],
    ['a second dot starts a new number', 'rgb(1..2 3)'],
    ['CSS Color 5 legacy device-cmyk() comma form', 'device-cmyk(0, 1, 1, 0)'],
  ])('%s: %s is rejected', (_label, s) => expect(colordx(s).isValid()).toBe(false));
});

// ─── 2. tinycolor2 compat shim ──────────────────────────────────────────────────────────────────

const SHIM_FN = ['rgb', 'rgba', 'hsl', 'hsla', 'hsv', 'hsva', 'RGB', 'Hsl', 'HSVA', 'rgB'];
const SHIM_OPEN = ['(', ' ', '( ', '(\t', ' (', '((', '', '\n('];
// No `/`: the shim splits channels on it (for `rgb(255 0 0 / 0.5)`), so `rgb(1 / 2 / 3)` is valid
// here and invalid in tinycolor2 — pinned with the other divergences below.
const SHIM_SEP = [', ', ',', ' ', '\t', ' , ', ',,', '  ', '\n', ',\t'];
// Omitted on purpose (documented differences, README "Migrating from tinycolor2"): percentages
// above 100 (tinycolor2 wraps, the shim clamps) and CSS angle units (tinycolor2 rejects them).
const SHIM_TOK = [
  '255',
  '0',
  '1',
  '1.0',
  '.5',
  '0.5',
  '50%',
  '100%',
  '1e2',
  '-5',
  '+5',
  '360',
  '1.5',
  '5.',
  'abc',
  '10px',
  '1.0%',
  '120',
  '0%',
  '255.5',
  '-0',
  '00.5',
  '1%',
  '0.25',
  '99.9%',
  '-0.5',
];
const SHIM_CLOSE = [')', '', ' )', '\t)', ')\n'];
const SHIM_WS = ['', ' ', '\t', '\n', '\u00a0', '\u2028', '\ufeff', '\u3000', '\v'];

const shimStringArb = fc
  .record({
    lead: fc.constantFrom(...SHIM_WS),
    fn: fc.constantFrom(...SHIM_FN),
    open: fc.constantFrom(...SHIM_OPEN),
    toks: fc.array(fc.constantFrom(...SHIM_TOK), { minLength: 2, maxLength: 3 }),
    seps: fc.array(fc.constantFrom(...SHIM_SEP), { minLength: 2, maxLength: 2 }),
    close: fc.constantFrom(...SHIM_CLOSE),
    trail: fc.constantFrom(...SHIM_WS),
  })
  .map(({ lead, fn, open, toks, seps, close, trail }) => {
    let s = lead + fn + open;
    toks.forEach((t, i) => (s += (i ? seps[i - 1] : '') + t));
    return s + close + trail;
  });

const hexishArb = fc
  .record({
    ws: fc.constantFrom(...SHIM_WS),
    hash: fc.constantFrom('#', '', '##'),
    digits: fc.array(fc.constantFrom(...'0123456789abcdefABCDEFgx '), { minLength: 0, maxLength: 9 }),
    name: fc.constantFrom('', ...Object.keys(colorsNamed).slice(0, 40), 'burntsienna', 'transparent', 'TRANSPARENT'),
  })
  .map(({ ws, hash, digits, name }) =>
    name ? `${ws}${name.toUpperCase()}${ws}` : `${ws}${hash}${digits.join('')}${ws}`
  );

const shimAgrees = (input: unknown): void => {
  const ours = tinycolor(input as never);
  const theirs = ref(input as never);
  const label = JSON.stringify(input);
  expect(ours.isValid(), label).toBe(theirs.isValid());
  if (!theirs.isValid()) return;
  const [a, b] = [ours.toRgb(), theirs.toRgb()];
  // One byte: tinycolor2 truncates fractional percentages, the shim keeps them (README).
  for (const k of ['r', 'g', 'b'] as const) expect(Math.abs(a[k] - b[k]), `${label} ${k}`).toBeLessThanOrEqual(1);
  expect(a.a, label).toBeCloseTo(b.a, 3);
  expect(ours.getFormat(), label).toBe(theirs.getFormat());
};

describe('tinycolor compat — differential fuzz against tinycolor2', () => {
  it(
    'weird color-function strings: same validity, rgb within one byte, same alpha and format',
    () => {
      fc.assert(
        fc.property(shimStringArb, (s) => {
          const n = s.split(/[\s,/()]+/).filter((t) => t && !/^(rgb|hsl|hsv)a?$/i.test(t)).length;
          // Documented: rgba()/hsla()/hsva() with three components are valid here, invalid there
          // (bgrins/TinyColor#274).
          if (n === 3 && /^[\s\u00a0\u2028\ufeff\u3000\v]*(rgb|hsl|hsv)a/i.test(s)) return;
          shimAgrees(s);
        }),
        { seed: 0x71c, numRuns: 4000 }
      );
    },
    TIMEOUT
  );

  it(
    'hex, bare hex and names with any padding and case',
    () => fc.assert(fc.property(hexishArb, shimAgrees), { seed: 0x7e4, numRuns: 3000 }),
    TIMEOUT
  );

  const shimValue = fc.constantFrom<unknown>(
    0,
    1,
    0.5,
    255,
    100,
    360,
    -1,
    256,
    '1.0',
    '50%',
    '100%',
    '1e2',
    '180foo',
    ' 5',
    '5 ',
    '',
    'x',
    null,
    undefined,
    NaN,
    Infinity,
    -Infinity,
    true,
    false,
    '0x10',
    '.5',
    '5.',
    '-5%',
    '1.0%',
    1e-7,
    '1e-7',
    0.9999
  );
  it(
    'objects with junk values: same validity, rgb within one byte, same alpha and format',
    () => {
      const shapes = [
        ['r', 'g', 'b'],
        ['h', 's', 'l'],
        ['h', 's', 'v'],
        ['r', 'g', 'b', 'h', 's', 'l'],
        ['h', 's', 'v', 'l'],
      ];
      fc.assert(
        fc.property(
          fc.constantFrom(...shapes),
          fc.array(shimValue, { minLength: 7, maxLength: 7 }),
          fc.boolean(),
          (keys, vals, withA) => {
            const o: Record<string, unknown> = {};
            keys.forEach((k, i) => (o[k] = vals[i]));
            if (withA) o.a = vals[6];
            shimAgrees(o);
          }
        ),
        { seed: 0x0b1, numRuns: 4000 }
      );
    },
    TIMEOUT
  );

  // Divergences the fuzz turned up that neither the README nor tinycolor.test.ts lists. tinycolor.test.ts
  // says validity must match tinycolor2 exactly; pinned here as current behaviour, see the report.
  it.each<[string, unknown]>([
    // tinycolor2's matchers are `[\s|\(]+` / `[,|\s]+`: the `|` inside a character class is a literal pipe.
    ['a pipe as separator', 'rgb|255|0|0'],
    ['a pipe inside the parens', 'hsl(120|50%|50%)'],
    // tinycolor2's matchers are unanchored at the end, so anything after the closing paren is ignored.
    ['text after the closing paren', 'rgb(255, 0, 0)x'],
    ['a second closing paren', 'rgb(255, 0, 0))'],
    // tinycolor2 tests channels with a regex `exec`, which stringifies an array.
    ['an array channel', { r: [255], g: 0, b: 0 }],
  ])('%s: tinycolor2 accepts %j, the shim rejects it', (_label, input) => {
    expect(ref(input as never).isValid()).toBe(true);
    expect(tinycolor(input as never).isValid()).toBe(false);
  });
  it('spin() with no, NaN or infinite amount leaves the color alone; tinycolor2 turns it black (NaN hue)', () => {
    for (const amount of [undefined, NaN, Infinity]) {
      expect(
        ref('#f00')
          .spin(amount as never)
          .toHexString()
      ).toBe('#000000');
      expect(
        tinycolor('#f00')
          .spin(amount as never)
          .toHexString()
      ).not.toBe('#000000');
    }
  });

  it.each([
    ['a slash between channels', 'rgb(255 / 0 / 0)'],
    ['a slash before the last channel', 'hsl(120, 50% / 50%)'],
  ])('%s: the shim accepts %j, tinycolor2 rejects it', (_label, input) => {
    expect(ref(input).isValid()).toBe(false);
    expect(tinycolor(input).isValid()).toBe(true);
  });
});

// Rejection (and acceptance) must stay linear in the input length: see parse-linear-time.test.ts.
const LENGTH = 64_000;
const BUDGET_MS = 500;
const timeOf = (f: () => unknown): number => {
  const t = performance.now();
  f();
  return performance.now() - t;
};
const SP = ' '.repeat(LENGTH);
const DIGITS = '1'.repeat(LENGTH);
const ALL_FNS = [
  'rgb(',
  'rgba(',
  'hsl(',
  'hsla(',
  'hsv(',
  'hwb(',
  'lab(',
  'lch(',
  'oklab(',
  'oklch(',
  'okhsl(',
  'okhsv(',
  'device-cmyk(',
  'color(',
  'color(srgb ',
  'color(srgb-linear ',
  'color(display-p3 ',
  'color(a98-rgb ',
  'color(prophoto-rgb ',
  'color(rec2020 ',
  'color(xyz ',
  'color(xyz-d50 ',
  'color(xyz-d65 ',
];
const adversarial = (f: string): [string, string][] => [
  ['trailing whitespace then junk', `${f}1 2 3)${SP}!`],
  ['leading whitespace then junk', `${SP}${f}1 2 3)!`],
  ['whitespace between every channel', `${f}1${SP}2${SP}3${SP}!`],
  ['repeated signs', `${f}${'+-'.repeat(LENGTH / 2)}1 2 3)`],
  ['nested parens', `${f}${'('.repeat(LENGTH)}`],
  ['closing parens', `${f}1 2 3${')'.repeat(LENGTH)}`],
  ['long digit run in alpha', `${f}1 2 3 / ${DIGITS}!`],
  ['long fraction', `${f}0.${DIGITS}x`],
  ['long exponent', `${f}1e${DIGITS}x`],
  ['too many channels', `${f}${'1 '.repeat(LENGTH / 2)})`],
  ['too many commas', `${f}${'1,'.repeat(LENGTH / 2)})`],
  ['repeated slashes', `${f}1 2 3${' /'.repeat(LENGTH / 2)})`],
  ['repeated none', `${f}${'none '.repeat(LENGTH / 5)})`],
  ['repeated units', `${f}1${'deg'.repeat(LENGTH / 3)} 2 3)`],
  ['repeated percent signs', `${f}1${'%'.repeat(LENGTH)} 2 3)`],
  ['repeated e', `${f}1${'e'.repeat(LENGTH)} 2 3)`],
];

describe('every parser rejects adversarial long input in linear time', () => {
  it('core and every plugin parser', () => {
    for (const f of [...ALL_FNS, '#', 'transparent', 'red']) {
      for (const [label, s] of adversarial(f)) {
        const ms = timeOf(() => {
          colordx(s).isValid();
          getFormat(s);
        });
        expect(ms, `${f} ${label}`).toBeLessThan(BUDGET_MS);
      }
    }
    for (const s of [
      `transparent${SP}x`,
      `${SP}transparent${SP}x`,
      `red${SP}x`,
      `${SP}#fff${SP}x`,
      `${'\u00a0'.repeat(LENGTH)}red`,
    ]) {
      expect(
        timeOf(() => colordx(s).isValid()),
        JSON.stringify(s.slice(0, 12))
      ).toBeLessThan(BUDGET_MS);
    }
  }, 120_000);

  it('the tinycolor shim on the same inputs', () => {
    for (const f of ['rgb(', 'hsl(', 'hsv(', 'rgba(', '#']) {
      for (const [label, s] of adversarial(f))
        expect(
          timeOf(() => tinycolor(s).isValid()),
          `${f} ${label}`
        ).toBeLessThan(BUDGET_MS);
    }
  }, 120_000);

  // The shim once matched color functions with `^(rgba?|hsla?|hsva?)[\s(]+([^)]*)\)?$`, whose two
  // groups both claim a whitespace/paren run, so a run followed by `)x` backtracked in O(n²): 64k
  // spaces took ~2 s. Run at a quarter / half of LENGTH against a 100 ms budget; linear code takes ~1 ms.
  const Q = ' '.repeat(LENGTH / 4);
  it.each([
    ['whitespace run then `)x`', `rgb${' '.repeat(LENGTH / 2)})x`],
    ['paren run then `)x`', `hsl${'('.repeat(LENGTH / 2)})x`],
    ['whitespace inside the parens then `)x`', `rgb(${Q}1${Q}2${Q}3${Q})x`],
  ])('the tinycolor shim: %s', (_label, s) => expect(timeOf(() => tinycolor(s).isValid())).toBeLessThan(100), 120_000);
});

// ─── 3. Object input ────────────────────────────────────────────────────────────────────────────

interface ObjModel {
  id: string;
  keys: string[];
  brand?: string;
  /** Sane finite range per key. */
  ranges: [number, number][];
  /** `a` is an alias for alpha (false where `a` is a Lab / OKLab channel). */
  alias: boolean;
  /** Index of a hue key, if any. */
  hue?: number;
  /** OKLab/OKLCh: `l > 1` is rejected (README, "Two object-only rules"). */
  lMax1?: boolean;
}
const OBJ_MODELS: ObjModel[] = [
  { id: 'rgb', keys: ['r', 'g', 'b'], ranges: [rgbRange, rgbRange, rgbRange], alias: true },
  { id: 'hsl', keys: ['h', 's', 'l'], ranges: [[0, 360], pctR, pctR], alias: true, hue: 0 },
  { id: 'hsv', keys: ['h', 's', 'v'], ranges: [[0, 360], pctR, pctR], alias: true, hue: 0 },
  { id: 'hwb', keys: ['h', 'w', 'b'], ranges: [[0, 360], pctR, pctR], alias: true, hue: 0 },
  { id: 'oklab', keys: ['l', 'a', 'b'], ranges: [unit, [-0.4, 0.4], [-0.4, 0.4]], alias: false, lMax1: true },
  { id: 'oklch', keys: ['l', 'c', 'h'], ranges: [unit, [0, 0.4], [0, 360]], alias: true, hue: 2, lMax1: true },
  {
    id: 'lab',
    keys: ['l', 'a', 'b'],
    brand: 'lab',
    ranges: [
      [0, 100],
      [-125, 125],
      [-125, 125],
    ],
    alias: false,
  },
  {
    id: 'lch',
    keys: ['l', 'c', 'h'],
    brand: 'lch',
    ranges: [
      [0, 100],
      [0, 150],
      [0, 360],
    ],
    alias: true,
    hue: 2,
  },
  { id: 'xyz', keys: ['x', 'y', 'z'], ranges: [pctR, pctR, pctR], alias: true },
  { id: 'xyz-d65', keys: ['x', 'y', 'z'], brand: 'xyz-d65', ranges: [pctR, pctR, pctR], alias: true },
  { id: 'cmyk', keys: ['c', 'm', 'y', 'k'], ranges: [pctR, pctR, pctR, pctR], alias: true },
  ...['display-p3', 'rec2020', 'a98-rgb', 'prophoto-rgb', 'srgb-linear'].map((brand): ObjModel => ({
    id: brand,
    keys: ['r', 'g', 'b'],
    brand,
    ranges: [unit, unit, unit],
    alias: true,
  })),
  { id: 'okhsl', keys: ['h', 's', 'l'], brand: 'okhsl', ranges: [[0, 360], pctR, pctR], alias: true, hue: 0 },
  { id: 'okhsv', keys: ['h', 's', 'v'], brand: 'okhsv', ranges: [[0, 360], pctR, pctR], alias: true, hue: 0 },
];

const SPECIAL_NUMS = [NaN, Infinity, -Infinity, 1e308, -1e308, -0, 5e-324, 1e-9, Number.MAX_SAFE_INTEGER, -1];
const NON_NUMBERS: unknown[] = [
  null,
  '1',
  '',
  '0.5',
  true,
  false,
  {},
  [],
  [1],
  1n,
  new Number(1),
  Symbol('x'),
  () => 1,
];

const buildObj = (
  m: ObjModel,
  vals: unknown[],
  alpha: { kind: 'none' | 'alpha' | 'a' | 'both'; v: unknown; w?: unknown }
): Record<string, unknown> => {
  const o: Record<string, unknown> = {};
  m.keys.forEach((k, i) => (o[k] = vals[i]));
  if (m.brand) o.colorSpace = m.brand;
  if (alpha.kind === 'alpha') o.alpha = alpha.v;
  if (alpha.kind === 'a' && m.alias) o.a = alpha.v;
  if (alpha.kind === 'both') {
    o.alpha = alpha.v;
    if (m.alias) o.a = alpha.w;
  }
  return o;
};

const saneArb = (m: ObjModel): fc.Arbitrary<number[]> =>
  fc.tuple(...m.ranges.map(([lo, hi]) => fc.double({ min: lo, max: hi, noNaN: true })));

/** Every output a valid color has to produce without a NaN, and every string parses back. */
const assertSaneOutputs = (c: ReturnType<typeof colordx>, label: string): void => {
  const objs: object[] = [
    c.toRgb(),
    c.toRgb(3),
    c.toHsl(),
    c.toOklab(),
    c.toOklch(),
    c.toLab(),
    c.toLch(),
    c.toXyz(),
    c.toXyzD65(),
    c.toP3(),
    c.toRec2020(),
    c.toA98(),
    c.toProphoto(),
    c.toSrgbLinear(),
    c.toHsv(),
    c.toHwb(),
    c.toCmyk(),
    c.toOkhsl(),
    c.toOkhsv(),
  ];
  for (const o of objs) {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'colorSpace') continue;
      expect(Number.isFinite(v), `${label} ${k}=${String(v)} in ${JSON.stringify(o)}`).toBe(true);
    }
    expect((o as { alpha: number }).alpha).toBeGreaterThanOrEqual(0);
    expect((o as { alpha: number }).alpha).toBeLessThanOrEqual(1);
  }
  const strs = [
    c.toHex(),
    c.toRgbString(),
    c.toHslString(),
    c.toOklabString(),
    c.toOklchString(),
    c.toLabString(),
    c.toLchString(),
    c.toXyzString(),
    c.toXyzD65String(),
    c.toP3String(),
    c.toRec2020String(),
    c.toA98String(),
    c.toProphotoString(),
    c.toSrgbLinearString(),
    c.toHsvString(),
    c.toHwbString(),
    c.toCmykString(),
    c.toOkhslString(),
    c.toOkhsvString(),
    c.minify(),
  ];
  for (const s of strs) {
    expect(s, label).not.toMatch(/NaN|Infinity|undefined/);
    expect(colordx(s).isValid(), `${label} -> ${s}`).toBe(true);
  }
};

const show = (o: unknown): string =>
  JSON.stringify(o, (_k, v) =>
    typeof v === 'number' && !Number.isFinite(v) ? String(v) : typeof v === 'bigint' ? `${v}n` : v
  );

describe('object input fuzz', () => {
  it(
    'every model: sane finite channels with any alpha spelling parse, and parse to sane output',
    () => {
      fc.assert(
        fc.property(
          fc
            .nat({ max: OBJ_MODELS.length - 1 })
            .chain((i) => fc.tuple(fc.constant(OBJ_MODELS[i]!), saneArb(OBJ_MODELS[i]!))),
          fc.constantFrom('none', 'alpha', 'a', 'both'),
          fc.double({ min: 0, max: 1, noNaN: true }),
          ([m, vals], kind, a) => {
            const o = buildObj(m, vals, { kind: kind as 'none', v: a, w: 0.123 });
            const c = colordx(o as never);
            expect(c.isValid(), show(o)).toBe(true);
            expect(getFormat(o as never), show(o)).toBeDefined();
            const expectedAlpha = kind === 'none' || (kind === 'a' && !m.alias) ? 1 : a;
            expect(c.alpha(), show(o)).toBeCloseTo(expectedAlpha, 3);
            assertSaneOutputs(c, show(o));
          }
        ),
        { seed: 0x0b1ec7, numRuns: 1500 }
      );
    },
    TIMEOUT
  );

  it(
    'every model: a non-number in any channel is invalid, never a throw',
    () => {
      fc.assert(
        fc.property(
          fc
            .nat({ max: OBJ_MODELS.length - 1 })
            .chain((i) => fc.tuple(fc.constant(OBJ_MODELS[i]!), saneArb(OBJ_MODELS[i]!))),
          fc.nat(),
          fc.constantFrom(...NON_NUMBERS, undefined),
          ([m, vals], at, junk) => {
            const v: unknown[] = [...vals];
            v[at % m.keys.length] = junk;
            const o = buildObj(m, v, { kind: 'none', v: 1 });
            let valid: boolean | undefined;
            expect(() => (valid = colordx(o as never).isValid()), show(o)).not.toThrow();
            expect(valid, show(o)).toBe(false);
          }
        ),
        { seed: 0x5e7, numRuns: 1500 }
      );
    },
    TIMEOUT
  );

  it(
    'every model: a non-number alpha (either spelling) is invalid; alpha: undefined defaults to 1; alpha wins over a',
    () => {
      fc.assert(
        fc.property(
          fc
            .nat({ max: OBJ_MODELS.length - 1 })
            .chain((i) => fc.tuple(fc.constant(OBJ_MODELS[i]!), saneArb(OBJ_MODELS[i]!))),
          fc.constantFrom(...NON_NUMBERS),
          fc.constantFrom('alpha', 'a', 'both-junk-a', 'both-junk-alpha', 'undefined-alpha', 'undefined-a'),
          ([m, vals], junk, mode) => {
            const o = buildObj(m, vals, { kind: 'none', v: 1 });
            let expectValid: boolean;
            let expectAlpha = 1;
            if (mode === 'alpha') [o.alpha, expectValid] = [junk, false];
            else if (mode === 'a')
              [o.a, expectValid] = [junk, !m.alias]; // on Lab/OKLab `a` is a channel: covered above
            else if (mode === 'both-junk-a') [o.alpha, o.a, expectValid, expectAlpha] = [0.25, junk, true, 0.25];
            else if (mode === 'both-junk-alpha') [o.alpha, o.a, expectValid] = [junk, 0.25, false];
            else if (mode === 'undefined-alpha') [o.alpha, expectValid] = [undefined, true];
            else [o.a, expectValid] = [undefined, !m.alias ? false : true];
            if (!m.alias && (mode === 'a' || mode === 'undefined-a')) return; // `a` replaced a Lab channel
            if (!m.alias && mode === 'both-junk-a') return;
            const c = colordx(o as never);
            expect(c.isValid(), `${mode} ${show(o)}`).toBe(expectValid);
            if (expectValid) expect(c.alpha(), show(o)).toBeCloseTo(expectAlpha, 3);
          }
        ),
        { seed: 0xa1fa, numRuns: 1500 }
      );
    },
    TIMEOUT
  );

  it(
    'every model: NaN / ±Infinity / huge / -0 / denormal channels give a finite color that formats and parses back',
    () => {
      fc.assert(
        fc.property(
          fc
            .nat({ max: OBJ_MODELS.length - 1 })
            .chain((i) => fc.tuple(fc.constant(OBJ_MODELS[i]!), saneArb(OBJ_MODELS[i]!))),
          fc.array(fc.tuple(fc.nat(), fc.constantFrom(...SPECIAL_NUMS)), { minLength: 1, maxLength: 3 }),
          fc.oneof(fc.constant(undefined), fc.constantFrom(...SPECIAL_NUMS)),
          ([m, vals], specials, alpha) => {
            const v: number[] = [...vals];
            for (const [at, x] of specials) v[at % m.keys.length] = x;
            const o = buildObj(m, v, alpha === undefined ? { kind: 'none', v: 1 } : { kind: 'alpha', v: alpha });
            const c = colordx(o as never);
            // Documented: an OKLab/OKLCh object with l > 1 (after NaN reads as 0) is rejected.
            const l = v[0]!;
            const expected = !(m.lMax1 && (l === l ? l : 0) > 1 + 1e-9);
            expect(c.isValid(), show(o)).toBe(expected);
            if (expected) assertSaneOutputs(c, show(o));
          }
        ),
        { seed: 0x1f1, numRuns: 1500 }
      );
    },
    TIMEOUT
  );

  it(
    'every model: NaN in a channel reads exactly as 0, and an infinite hue exactly as 0° (README)',
    () => {
      fc.assert(
        fc.property(
          fc
            .nat({ max: OBJ_MODELS.length - 1 })
            .chain((i) => fc.tuple(fc.constant(OBJ_MODELS[i]!), saneArb(OBJ_MODELS[i]!))),
          fc.nat(),
          fc.constantFrom(NaN, Infinity, -Infinity),
          ([m, vals], at, special) => {
            const i = at % m.keys.length;
            if (special !== special ? false : m.hue !== i) return; // ±Infinity only on a hue
            const withSpecial = [...vals];
            withSpecial[i] = special;
            const withZero = [...vals];
            withZero[i] = 0;
            const a = colordx(buildObj(m, withSpecial, { kind: 'none', v: 1 }) as never);
            const b = colordx(buildObj(m, withZero, { kind: 'none', v: 1 }) as never);
            expect(a._rawRgb(), show(buildObj(m, withSpecial, { kind: 'none', v: 1 }))).toEqual(b._rawRgb());
          }
        ),
        { seed: 0x0a0, numRuns: 1500 }
      );
    },
    TIMEOUT
  );

  it(
    'every model: NaN alpha reads as 0, and extra unrelated keys change nothing',
    () => {
      fc.assert(
        fc.property(
          fc
            .nat({ max: OBJ_MODELS.length - 1 })
            .chain((i) => fc.tuple(fc.constant(OBJ_MODELS[i]!), saneArb(OBJ_MODELS[i]!))),
          fc.dictionary(
            fc.constantFrom('foo', 'mode', 'format', 'space', 'A', 'ALPHA', 'alpha2', 'toJSON', 'hex', 'name'),
            fc.constantFrom<unknown>(1, 'x', null, {})
          ),
          ([m, vals], extra) => {
            const base = colordx(buildObj(m, vals, { kind: 'none', v: 1 }) as never);
            const withExtra = colordx({ ...buildObj(m, vals, { kind: 'none', v: 1 }), ...extra } as never);
            expect(withExtra._rawRgb(), show(extra)).toEqual(base._rawRgb());
            const nanAlpha = colordx(buildObj(m, vals, { kind: 'alpha', v: NaN }) as never);
            expect(nanAlpha.isValid()).toBe(true);
            expect(nanAlpha.alpha()).toBe(0);
          }
        ),
        { seed: 0xe7a, numRuns: 800 }
      );
    },
    TIMEOUT
  );

  it('a colorSpace brand never throws, and a mismatched known brand is never read as the branded space', () => {
    const brands = [
      'lab',
      'lch',
      'xyz-d65',
      'xyz-d50',
      'display-p3',
      'rec2020',
      'a98-rgb',
      'prophoto-rgb',
      'srgb-linear',
      'okhsl',
      'okhsv',
      'srgb',
      'oklab',
      'foo',
      '',
      1,
      null,
    ];
    for (const m of OBJ_MODELS) {
      for (const brand of brands) {
        const o = {
          ...buildObj(
            m,
            m.ranges.map(([lo, hi]) => (lo + hi) / 2),
            { kind: 'none', v: 1 }
          ),
          colorSpace: brand,
        };
        const c = colordx(o as never);
        if (c.isValid()) assertSaneOutputs(c, show(o));
        // A shape that does not carry the brand's keys must not be read as that space: a Lab brand
        // on { h, s, l } is not Lab. (What it *is* read as — see the divergence table below.)
        const fmt = getFormat(o as never);
        const brandFormat: Record<string, string> = { 'display-p3': 'p3', 'xyz-d50': 'xyz' };
        if (fmt && typeof brand === 'string' && brand !== m.brand && (brandFormat[brand] ?? brand) !== m.id) {
          const target = brandFormat[brand] ?? brand;
          const keysMatch = OBJ_MODELS.some(
            (x) => (x.brand === brand || x.id === target) && x.keys.join() === m.keys.join()
          );
          if (!keysMatch) expect(fmt, show(o)).not.toBe(brandFormat[brand] ?? brand);
        }
      }
    }
  });

  // An object whose brand names a *different* space is a mistake, not the unbranded model: every
  // unbranded object parser rejects a known brand, the way parseRgbBody always did for the
  // wide-gamut rgb brands.
  it.each<[string, Record<string, unknown>]>([
    ['{ r, g, b } branded lab', { r: 10, g: 20, b: 30, colorSpace: 'lab' }],
    ['{ r, g, b } branded xyz-d65', { r: 10, g: 20, b: 30, colorSpace: 'xyz-d65' }],
    ['{ h, s, l } branded okhsv', { h: 10, s: 20, l: 30, colorSpace: 'okhsv' }],
    ['{ h, s, v } branded okhsl', { h: 10, s: 20, v: 30, colorSpace: 'okhsl' }],
    ['{ h, w, b } branded lch', { h: 10, w: 20, b: 30, colorSpace: 'lch' }],
    ['{ c, m, y, k } branded display-p3', { c: 10, m: 20, y: 30, k: 40, colorSpace: 'display-p3' }],
    ['{ x, y, z } branded lab', { x: 10, y: 20, z: 30, colorSpace: 'lab' }],
    ['{ l, a, b } branded lch', { l: 0.5, a: 0.1, b: 0.1, colorSpace: 'lch' }],
    ['{ l, c, h } branded xyz-d65', { l: 0.5, c: 0.1, h: 30, colorSpace: 'xyz-d65' }],
  ])('%s is rejected', (_label, o) => {
    expect(getFormat(o as never)).toBeUndefined();
    expect(colordx(o as never).isValid()).toBe(false);
  });

  it('a colorSpace the library does not know stays ignored', () => {
    expect(getFormat({ r: 10, g: 20, b: 30, colorSpace: 'srgb' } as never)).toBe('rgb');
    expect(getFormat({ h: 10, s: 20, l: 30, colorSpace: 'hsl' } as never)).toBe('hsl');
  });
});

describe('string and object forms of every model agree', () => {
  // The object scales differ from the CSS ones (XYZ objects are 0–100, color(xyz …) is 0–1;
  // device-cmyk() numbers are 0–1, CMYK objects 0–100), which is exactly where a factor slips.
  type Pair = [string, (v: number[]) => string, (v: number[]) => Record<string, unknown>, [number, number][]];
  const A: [number, number] = [0, 1];
  const PAIRS: Pair[] = [
    [
      'rgb',
      (v) => `rgb(${v[0]} ${v[1]} ${v[2]} / ${v[3]})`,
      (v) => ({ r: v[0], g: v[1], b: v[2], alpha: v[3] }),
      [rgbRange, rgbRange, rgbRange, A],
    ],
    [
      'hsl',
      (v) => `hsl(${v[0]} ${v[1]}% ${v[2]}% / ${v[3]})`,
      (v) => ({ h: v[0], s: v[1], l: v[2], alpha: v[3] }),
      [hueR, pctR, pctR, A],
    ],
    [
      'hsv',
      (v) => `hsv(${v[0]}deg ${v[1]}% ${v[2]}% / ${v[3]})`,
      (v) => ({ h: v[0], s: v[1], v: v[2], alpha: v[3] }),
      [hueR, pctR, pctR, A],
    ],
    [
      'hwb',
      (v) => `hwb(${v[0]} ${v[1]}% ${v[2]}% / ${v[3]})`,
      (v) => ({ h: v[0], w: v[1], b: v[2], alpha: v[3] }),
      [hueR, pctR, pctR, A],
    ],
    [
      'okhsl',
      (v) => `okhsl(${v[0]} ${v[1]}% ${v[2]}% / ${v[3]})`,
      (v) => ({ h: v[0], s: v[1], l: v[2], alpha: v[3], colorSpace: 'okhsl' }),
      [hueR, pctR, pctR, A],
    ],
    [
      'okhsv',
      (v) => `okhsv(${v[0]} ${v[1]} ${v[2]} / ${v[3]})`,
      (v) => ({ h: v[0], s: v[1], v: v[2], alpha: v[3], colorSpace: 'okhsv' }),
      [hueR, pctR, pctR, A],
    ],
    [
      'lab',
      (v) => `lab(${v[0]}% ${v[1]} ${v[2]} / ${v[3]})`,
      (v) => ({ l: v[0], a: v[1], b: v[2], alpha: v[3], colorSpace: 'lab' }),
      [[0, 100], [-125, 125], [-125, 125], A],
    ],
    [
      'lch',
      (v) => `lch(${v[0]} ${v[1]} ${v[2]} / ${v[3]})`,
      (v) => ({ l: v[0], c: v[1], h: v[2], alpha: v[3], colorSpace: 'lch' }),
      [[0, 100], [0, 150], hueR, A],
    ],
    [
      'oklab',
      (v) => `oklab(${v[0]} ${v[1]} ${v[2]} / ${v[3]})`,
      (v) => ({ l: v[0], a: v[1], b: v[2], alpha: v[3] }),
      [unit, [-0.4, 0.4], [-0.4, 0.4], A],
    ],
    [
      'oklch',
      (v) => `oklch(${v[0]} ${v[1]} ${v[2]} / ${v[3]})`,
      (v) => ({ l: v[0], c: v[1], h: v[2], alpha: v[3] }),
      [unit, [0, 0.4], hueR, A],
    ],
    [
      'xyz-d50',
      (v) => `color(xyz-d50 ${v[0]! / 100} ${v[1]! / 100} ${v[2]! / 100} / ${v[3]})`,
      (v) => ({ x: v[0], y: v[1], z: v[2], alpha: v[3] }),
      [pctR, pctR, pctR, A],
    ],
    [
      'xyz-d65',
      (v) => `color(xyz-d65 ${v[0]}% ${v[1]}% ${v[2]}% / ${v[3]})`,
      (v) => ({ x: v[0], y: v[1], z: v[2], alpha: v[3], colorSpace: 'xyz-d65' }),
      [pctR, pctR, pctR, A],
    ],
    [
      'cmyk',
      (v) => `device-cmyk(${v[0]}% ${v[1]! / 100} ${v[2]}% ${v[3]! / 100} / ${v[4]})`,
      (v) => ({ c: v[0], m: v[1], y: v[2], k: v[3], alpha: v[4] }),
      [pctR, pctR, pctR, pctR, A],
    ],
    ...['display-p3', 'rec2020', 'a98-rgb', 'prophoto-rgb', 'srgb-linear'].map((cs): Pair => [
      cs,
      (v) => `color(${cs} ${v[0]} ${v[1]! * 100}% ${v[2]} / ${v[3]})`,
      (v) => ({ r: v[0], g: v[1], b: v[2], alpha: v[3], colorSpace: cs }),
      [unit, unit, unit, A],
    ]),
  ];

  it(
    'the same channels spelled as a CSS string and as an object parse to the same stored color',
    () => {
      fc.assert(
        fc.property(
          fc
            .nat({ max: PAIRS.length - 1 })
            .chain((i) =>
              fc.tuple(
                fc.constant(PAIRS[i]!),
                fc.tuple(
                  ...PAIRS[i]![3].map(([lo, hi]) => fc.integer({ min: lo * 1000, max: hi * 1000 }).map((n) => n / 1000))
                )
              )
            ),
          ([[, str, obj], v]) => {
            const [a, b] = [colordx(str(v)), colordx(obj(v) as never)];
            expect(a.isValid() && b.isValid(), str(v)).toBe(true);
            const [x, y] = [a._rawRgb(), b._rawRgb()];
            for (const k of ['r', 'g', 'b'] as const)
              expect(Math.abs(x[k] - y[k]), `${str(v)} ${k}`).toBeLessThan(1e-6);
            expect(x.alpha, str(v)).toBe(y.alpha);
          }
        ),
        { seed: 0x5a1f, numRuns: 3000 }
      );
    },
    TIMEOUT
  );
});

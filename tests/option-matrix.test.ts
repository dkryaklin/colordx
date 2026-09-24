/**
 * Option × input-class matrix.
 *
 * The v7 bugs hid in cells no test visited: mix() was only ever fed opaque colors,
 * apcaContrast({ space: 'p3' }) never saw a brighter-than-white color, minify({ alphaHex }) never
 * saw an alpha whose byte is ff or 00. This file crosses every public method that takes options
 * with every class of input that behaves differently somewhere:
 *
 *   opaque sRGB · translucent (alpha 0, 0.001, 0.5, 0.999) · achromatic (greys, near-grey OKLCh /
 *   Lab) · wide gamut (P3 / Rec.2020 / A98 / ProPhoto corners) · out of range (color(srgb 1.1 …),
 *   negative channels, huge chroma) · near-black · white · `none` channels
 *
 * and checks, in every cell: no throw, no NaN, a valid color out, output that parses back, alpha
 * preserved or composed per spec, and the method's own algebra (idempotence, identity, endpoints,
 * symmetry, premultiplied alpha per CSS color-mix()).
 *
 * Bugs are pinned at the bottom with `it.fails` and a `// BUG:` line.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Colordx, colordx, extend, inGamutSrgb } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import a98rgb, { inGamutA98 } from '../src/plugins/a98rgb.js';
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
import p3, { inGamutP3 } from '../src/plugins/p3.js';
import prophoto, { inGamutProphoto } from '../src/plugins/prophoto.js';
import rec2020, { inGamutRec2020 } from '../src/plugins/rec2020.js';
import srgbLinear from '../src/plugins/srgb-linear.js';

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

const TIMEOUT = 30_000;

const CLASSES: Record<string, string[]> = {
  opaque: ['#ff0000', '#3d7a9f', 'rgb(12 200 99)', 'hsl(200 50% 40%)', '#00ff00', '#0000ff', '#c06060'],
  translucent: [
    'rgb(255 0 0 / 0)',
    'rgb(0 128 255 / 0.001)',
    '#3d7a9f80',
    'hsl(120 100% 25% / 0.999)',
    'oklch(0.7 0.1 30 / 0.5)',
    'rgb(255 255 255 / 0)',
    'rgb(0 0 0 / 0)',
    '#ff000001',
  ],
  achromatic: [
    '#808080',
    '#777',
    'oklch(0.5 0 0)',
    'oklch(0.5 0.00001 120)',
    'lab(50 0.001 -0.001)',
    'color(srgb 0.5 0.5 0.5)',
    'oklab(0.7 1e-7 -1e-7)',
    'hsl(0 0% 50%)',
    'lch(50 0.0001 200)',
  ],
  wideGamut: [
    'color(display-p3 1 0 0)',
    'color(display-p3 0 1 0)',
    'color(display-p3 0 0 1)',
    'color(rec2020 1 0 0)',
    'color(rec2020 0 1 0)',
    'color(rec2020 0 0 1)',
    'oklch(0.7 0.35 150)',
    'color(prophoto-rgb 0 1 0)',
    'color(a98-rgb 0 1 0)',
    'color(display-p3 1 1 0 / 0.5)',
  ],
  outOfRange: [
    'color(srgb 1.1 1.1 1.1)',
    'color(srgb -0.1 0.5 1.2)',
    'color(srgb-linear 2 2 2)',
    'color(xyz 1.5 1.5 1.5)',
    'color(display-p3 -0.2 1.3 0)',
    'lab(50 200 -200)',
    'oklch(0.5 1 0)',
    'color(srgb -1 -1 -1)',
    'color(srgb 1.1 1.1 1.1 / 0.5)',
  ],
  nearBlack: ['#010101', 'oklch(0.001 0.001 0)', 'rgb(0 0 1)', 'lab(0.1 0 0)', 'color(srgb 0.0001 0 0)', '#000'],
  white: [
    '#fff',
    'oklch(1 0 0)',
    'lab(100 0 0)',
    'color(srgb 1 1 1)',
    'color(xyz-d65 0.9505 1 1.089)',
    'hsl(0 0% 100%)',
  ],
  none: [
    'rgb(none none none)',
    'oklch(none none none)',
    'hsl(none 50% 50%)',
    'rgb(255 0 0 / none)',
    'lch(50 none 30)',
    'color(display-p3 1 none 0)',
    'oklab(none 0.1 none / none)',
  ],
};
const CLASS_ENTRIES = Object.entries(CLASSES);
const PARTNERS = [
  '#0000ff',
  'rgb(255 255 0 / 0.5)',
  'rgb(0 0 0 / 0)',
  'color(display-p3 0 1 0)',
  'oklch(0.5 0 0)',
  'color(srgb 1.1 1.1 1.1)',
  '#fff',
  'rgb(none 0 0 / none)',
  'hsl(300 100% 50% / 0.25)',
];

const c = (x: string): Colordx => colordx(x);
const isSrgb = (x: string): boolean => inGamutSrgb(x);
const round3 = (n: number): number => Math.round(n * 1000) / 1000;
/** `{ space }` without an explicit `space: undefined` (exactOptionalPropertyTypes). */
const sp = (space: 'srgb' | 'p3' | undefined): { space?: 'srgb' | 'p3' } => (space ? { space } : {});
const bytesClose = (a: Colordx, b: Colordx, tol = 1): boolean => {
  const [x, y] = [a.toRgb(), b.toRgb()];
  return Math.abs(x.r - y.r) <= tol && Math.abs(x.g - y.g) <= tol && Math.abs(x.b - y.b) <= tol;
};

/** No NaN / ±Infinity / -0 anywhere in a formatted object; hue in [0, 360); alpha in [0, 1]. */
const assertCleanObject = (o: Record<string, unknown>, label: string): void => {
  for (const [k, v] of Object.entries(o)) {
    if (k === 'colorSpace') continue;
    expect(typeof v, `${label}.${k}`).toBe('number');
    expect(Number.isFinite(v as number), `${label}.${k} = ${String(v)}`).toBe(true);
    expect(Object.is(v, -0), `${label}.${k} is -0`).toBe(false);
    if (k === 'h') {
      expect(v as number, `${label}.h`).toBeGreaterThanOrEqual(0);
      expect(v as number, `${label}.h`).toBeLessThan(360);
    }
  }
  const alpha = o.alpha as number;
  expect(alpha >= 0 && alpha <= 1, `${label}.alpha = ${alpha}`).toBe(true);
};

/** A formatted string: no NaN / exponent / -0, parses back as a valid color. */
const assertCleanString = (s: string, label: string): void => {
  expect(s, label).not.toMatch(/NaN|Infinity|undefined|(^|[ (,])-0([ ,)%]|$)/);
  if (!s.startsWith('#')) expect(s, `${label} uses exponent notation`).not.toMatch(/\d[eE][-+]?\d/);
  expect(colordx(s).isValid(), `${label} -> ${s}`).toBe(true);
};

/** A color out of any method: valid, and every formatter clean. */
const assertCleanColor = (x: Colordx, label: string): void => {
  expect(x).toBeInstanceOf(Colordx);
  expect(x.isValid(), label).toBe(true);
  assertCleanObject(x.toRgb() as never, `${label} toRgb`);
  assertCleanObject(x.toOklch() as never, `${label} toOklch`);
  assertCleanString(x.toHex(), `${label} toHex`);
  assertCleanString(x.toOklchString(), `${label} toOklchString`);
  assertCleanString(x.toP3String(), `${label} toP3String`);
};

// toX(precision): every object / string formatter at every precision 0..10 and its default.
const OBJECT_FORMATTERS = [
  'toRgb',
  'toHsl',
  'toHsv',
  'toHwb',
  'toOklab',
  'toOklch',
  'toLab',
  'toLch',
  'toXyz',
  'toXyzD65',
  'toP3',
  'toRec2020',
  'toA98',
  'toProphoto',
  'toSrgbLinear',
  'toCmyk',
  'toOkhsl',
  'toOkhsv',
] as const;
const STRING_FORMATTERS = [
  'toHslString',
  'toHsvString',
  'toHwbString',
  'toOklabString',
  'toOklchString',
  'toLabString',
  'toLchString',
  'toXyzString',
  'toXyzD65String',
  'toP3String',
  'toRec2020String',
  'toA98String',
  'toProphotoString',
  'toSrgbLinearString',
  'toCmykString',
  'toOkhslString',
  'toOkhsvString',
] as const;
const PRECISIONS = [undefined, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
type Fmt = (p?: number) => unknown;

describe.each(CLASS_ENTRIES)('option matrix — %s', (_cls, inputs) => {
  it(
    'toX(precision) for precision 0..10: finite, no -0, hue in [0, 360), alpha kept, strings parse back',
    () => {
      for (const x of inputs) {
        const col = c(x);
        expect(col.isValid(), x).toBe(true);
        for (const p of PRECISIONS) {
          for (const f of OBJECT_FORMATTERS) {
            const o = (col as unknown as Record<string, Fmt>)[f]!.call(col, p) as Record<string, unknown>;
            assertCleanObject(o, `${x} ${f}(${p})`);
            expect(o.alpha, `${x} ${f}(${p}).alpha`).toBe(col.alpha());
          }
          for (const f of STRING_FORMATTERS) {
            const s = (col as unknown as Record<string, Fmt>)[f]!.call(col, p) as string;
            assertCleanString(s, `${x} ${f}(${p})`);
            expect(colordx(s).alpha(), `${x} ${f}(${p}) alpha`).toBe(col.alpha());
          }
        }
        for (const s of [
          col.toHex(),
          col.toHex8(),
          col.toRgbString(),
          col.toRgbString({ legacy: true }),
          col.toString(),
        ]) {
          assertCleanString(s, x);
        }
      }
    },
    TIMEOUT
  );

  it('default-precision strings round-trip to the same displayed color', () => {
    for (const x of inputs) {
      const col = c(x);
      for (const f of STRING_FORMATTERS) {
        const s = (col as unknown as Record<string, Fmt>)[f]!.call(col) as string;
        // Documented (README "Parsing"): an OKLab L outside [0, 1] or a Lab L below 0 is printed
        // faithfully but clamped when parsed back, so those strings are not expected to round-trip.
        const { l } = col.toOklab(9);
        if ((l > 1 || l < 0) && /^(oklab|oklch)/.test(s)) continue;
        const L = col.toLab(9).l;
        if ((L < 0 || L > 100) && /^(lab|lch)/.test(s)) continue;
        // Documented (README, okhsl and okhsv plugins): pure blues (r = g = 0) do not round-trip.
        if (/^okhs[lv]/.test(s) && col.toRgb().r === 0 && col.toRgb().g === 0) continue;
        expect(bytesClose(colordx(s), col), `${x} ${f} -> ${s}: ${colordx(s).toHex()} vs ${col.toHex()}`).toBe(true);
      }
    }
  });

  it(
    'mix / mixOklab / mixLab: alpha per color-mix(), endpoints, self-mix identity, sRGB premultiplication, symmetry',
    () => {
      const RATIOS = [0, 0.25, 0.5, 1, -0.5, 1.5, NaN];
      for (const x of inputs) {
        const a = c(x);
        for (const y of [...PARTNERS, x]) {
          const b = c(y);
          for (const m of ['mix', 'mixOklab', 'mixLab'] as const) {
            for (const t of RATIOS) {
              const label = `${x}.${m}(${y}, ${t})`;
              const out = a[m](y, t);
              assertCleanColor(out, label);
              const w = t > 0 ? (t < 1 ? t : 1) : 0;
              expect(out.alpha(), `${label} alpha`).toBeCloseTo(round3(a.alpha() * (1 - w) + b.alpha() * w), 3);
              // t = 0 is the first color, t = 1 the second (unless it is fully transparent: no color).
              if (w === 0) expect(bytesClose(out, a), `${label} = self`).toBe(true);
              if (w === 1 && b.alpha() > 0) expect(bytesClose(out, b), `${label} = other`).toBe(true);
              if (y === x) expect(bytesClose(out, a), `${label} self-mix`).toBe(true);
              // Symmetry: a.mix(b, t) and b.mix(a, 1 - t) are the same color.
              if (t === t) expect(bytesClose(out, b[m](x, 1 - t)), `${label} symmetric`).toBe(true);
            }
          }
          // CSS color-mix(in srgb): premultiply, interpolate, un-premultiply — computed independently.
          if (isSrgb(x) && isSrgb(y)) {
            for (const t of [0.25, 0.5, 0.75]) {
              const [p, q] = [a.toRgb(2), b.toRgb(2)];
              const alpha = p.alpha * (1 - t) + q.alpha * t;
              const out = a.mix(y, t).toRgb();
              if (alpha === 0) continue;
              for (const k of ['r', 'g', 'b'] as const) {
                const e = (p[k] * p.alpha * (1 - t) + q[k] * q.alpha * t) / alpha;
                expect(Math.abs(out[k] - e), `${x}.mix(${y}, ${t}).${k}: ${out[k]} vs ${e}`).toBeLessThanOrEqual(1);
              }
            }
          }
        }
      }
    },
    TIMEOUT
  );

  it('tints / shades / tones / palette: counts, first = self, last = target, all valid', () => {
    for (const x of inputs) {
      const a = c(x);
      for (const count of [0, 1, 2, 3, 5, 11, -1, NaN]) {
        const runs: [string, Colordx[], string][] = [
          ['tints', a.tints(count), '#ffffff'],
          ['shades', a.shades(count), '#000000'],
          ['tones', a.tones(count), '#808080'],
          ['palette', a.palette(count, 'rgb(0 0 255 / 0.5)'), 'rgb(0 0 255 / 0.5)'],
        ];
        for (const [name, out, target] of runs) {
          const label = `${x}.${name}(${count})`;
          const expected = count >= 1 ? count : 0;
          expect(out.length, label).toBe(expected);
          out.forEach((o, i) => assertCleanColor(o, `${label}[${i}]`));
          if (expected >= 1) expect(bytesClose(out[0]!, a), `${label}[0]`).toBe(true);
          if (expected >= 2) {
            expect(bytesClose(out[expected - 1]!, c(target)), `${label}[last]`).toBe(true);
            expect(out[expected - 1]!.alpha(), `${label}[last] alpha`).toBe(c(target).alpha());
          }
        }
      }
    }
  });

  it('harmonies: every type, right count, the 0° entry is the input untouched, hues offset, alpha kept', () => {
    const TYPES = {
      complementary: [0, 180],
      analogous: [-30, 0, 30],
      'split-complementary': [0, 150, 210],
      triadic: [0, 120, 240],
      tetradic: [0, 90, 180, 270],
      rectangle: [0, 60, 180, 240],
      'double-split-complementary': [-30, 0, 30, 150, 210],
    } as const;
    for (const x of inputs) {
      const a = c(x);
      for (const [type, offsets] of Object.entries(TYPES)) {
        const out = a.harmonies(type as keyof typeof TYPES);
        expect(out.length, `${x} ${type}`).toBe(offsets.length);
        offsets.forEach((deg, i) => {
          const h = out[i]!;
          assertCleanColor(h, `${x} ${type}[${i}]`);
          expect(h.alpha(), `${x} ${type}[${i}] alpha`).toBe(a.alpha());
          if (deg === 0) expect(h.toOklchString(10), `${x} ${type} 0°`).toBe(a.toOklchString(10));
          // Hue offsets on the sRGB-clipped HSL hue, for colors saturated enough to have one.
          if (a.toHsl().s > 20 && a.toHsl().l > 10 && a.toHsl().l < 90) {
            const d = ((((h.hue() - a.hue() - deg) % 360) + 540) % 360) - 180;
            expect(Math.abs(d), `${x} ${type}[${i}] hue`).toBeLessThan(1);
          }
        });
      }
    }
  });

  it(
    'minify: all 64 option combinations parse back to the same color, and minify is idempotent',
    () => {
      const KEYS = ['hex', 'rgb', 'hsl', 'alphaHex', 'transparent', 'name'] as const;
      for (const x of inputs) {
        const a = c(x);
        const wide = !isSrgb(x);
        for (let bits = -1; bits < 64; bits++) {
          const opts = bits < 0 ? undefined : Object.fromEntries(KEYS.map((k, i) => [k, !!(bits & (1 << i))]));
          const out = a.minify(opts);
          const label = `${x}.minify(${JSON.stringify(opts)}) = ${out}`;
          expect(out.length, label).toBeGreaterThan(0);
          const back = colordx(out);
          expect(back.isValid(), label).toBe(true);
          // Pinned in the bugs block below: an OKLab L > 1 is clamped when the oklch() string is
          // read back, and the no-candidate fallback to toHex() rounds alpha to a byte.
          const lOutside = a.toOklab(9).l > 1 + 1e-6 || a.toOklab(9).l < -1e-6;
          const fallback = opts !== undefined && !opts.rgb && !opts.hsl;
          if (wide && lOutside) continue;
          if (wide) {
            // Wide gamut stays oklch(), rounded to 5 dp (README) — so the same color to that precision.
            const [p, q] = [back.toOklab(9), a.toOklab(9)];
            for (const k of ['l', 'a', 'b'] as const) expect(Math.abs(p[k] - q[k]), `${label} ${k}`).toBeLessThan(2e-5);
          } else {
            expect(back.toRgb().r, label).toBe(a.toRgb().r);
            expect(back.toRgb().g, label).toBe(a.toRgb().g);
            expect(back.toRgb().b, label).toBe(a.toRgb().b);
          }
          // alphaHex is lossless to 2 decimals (README); everything else keeps alpha exactly.
          expect(Math.abs(back.alpha() - a.alpha()), `${label} alpha`).toBeLessThanOrEqual(
            opts?.alphaHex || fallback ? 0.005 : 0
          );
          // Idempotence: minifying the minified color gives the same color back.
          const again = back.minify(opts);
          expect(bytesClose(colordx(again), back, 0), `${label} -> ${again}`).toBe(true);
          expect(Math.abs(colordx(again).alpha() - back.alpha()), `${label} -> ${again} alpha`).toBeLessThanOrEqual(
            opts?.alphaHex || fallback ? 0.005 : 0
          );
          // Never longer than the hex the user would otherwise write, when hex is a candidate.
          if (!wide && a.alpha() === 1 && (opts?.hex ?? true))
            expect(out.length, label).toBeLessThanOrEqual(a.toHex().length);
        }
      }
    },
    TIMEOUT
  );

  it('cvd simulate: every type gives an in-gamut valid color, keeps alpha, keeps greys grey', () => {
    for (const x of inputs) {
      const a = c(x);
      for (const type of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
        const out = a.simulate(type);
        assertCleanColor(out, `${x} ${type}`);
        expect(out.alpha(), `${x} ${type} alpha`).toBe(a.alpha());
        expect(inGamutSrgb(out.toSrgbLinearString(10)), `${x} ${type} in gamut`).toBe(true);
        const g = a.mapSrgb().toRgb();
        if (Math.max(g.r, g.g, g.b) - Math.min(g.r, g.g, g.b) <= 0) {
          const o = out.toRgb();
          expect(
            Math.max(o.r, o.g, o.b) - Math.min(o.r, o.g, o.b),
            `${x} ${type} grey stays grey: ${out.toHex()}`
          ).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('gamut: containment hierarchy, toGamut* lands inside, identity when already inside, map/clamp idempotent, alpha kept', () => {
    const SPACES = [
      ['srgb', inGamutSrgb, (x: string) => Colordx.toGamutSrgb(x), (o: Colordx) => o.toSrgbLinearString(12)],
      ['p3', inGamutP3, (x: string) => Colordx.toGamutP3(x), (o: Colordx) => o.toP3String(12)],
      ['rec2020', inGamutRec2020, (x: string) => Colordx.toGamutRec2020(x), (o: Colordx) => o.toRec2020String(12)],
      ['a98', inGamutA98, (x: string) => Colordx.toGamutA98(x), (o: Colordx) => o.toA98String(12)],
      ['prophoto', inGamutProphoto, (x: string) => Colordx.toGamutProphoto(x), (o: Colordx) => o.toProphotoString(12)],
    ] as const;
    for (const x of inputs) {
      const a = c(x);
      if (inGamutSrgb(x)) for (const [name, inG] of SPACES) expect(inG(x), `${x} in sRGB but not ${name}`).toBe(true);
      // Not checked: P3 ⊂ Rec.2020. The P3 red primary (0.680, 0.320) sits just outside Rec.2020's
      // red–green edge (culori agrees: color(display-p3 1 0 0) is rec2020 b ≈ -0.005), so the
      // README's "sRGB ⊂ Display-P3 ⊂ Rec.2020" is only approximately true.
      for (const [name, inG, toG, str] of SPACES) {
        const out = toG(x);
        const label = `${x} toGamut ${name}`;
        assertCleanColor(out, label);
        expect(out.alpha(), `${label} alpha`).toBe(a.alpha());
        expect(inG(str(out)), `${label}: ${str(out)} not inside`).toBe(true);
        // CSS Color 4 §13.2.2 maps L <= 0 to black and L >= 1 to white before the in-gamut test,
        // so identity only holds strictly inside.
        const L = a.toOklab(9).l;
        if (inG(x) && L > 1e-6 && L < 1 - 1e-6) {
          expect(out.toHex8(), `${label} identity`).toBe(a.toHex8());
          const [p, q] = [out.toOklab(9), a.toOklab(9)];
          // _makeFromLinearSrgb snaps channels within half a byte of 0 / 255 (by design, colordx.ts).
          for (const k of ['l', 'a', 'b'] as const)
            expect(Math.abs(p[k] - q[k]), `${label} identity ${k}`).toBeLessThan(2e-3);
        }
      }
      const mapped = a.mapSrgb();
      expect(mapped.toHex8(), `${x} mapSrgb = toGamutSrgb`).toBe(Colordx.toGamutSrgb(x).toHex8());
      expect(mapped.mapSrgb().toOklchString(10), `${x} mapSrgb idempotent`).toBe(mapped.toOklchString(10));
      const clamped = a.clampSrgb();
      expect(clamped.toHex8(), `${x} clampSrgb prints what hex prints`).toBe(a.toHex8());
      expect(inGamutSrgb(clamped.toSrgbLinearString(12)), `${x} clampSrgb inside`).toBe(true);
      expect(clamped.clampSrgb(), `${x} clampSrgb idempotent`).toBe(clamped);
    }
  });

  it('over(): source-over alpha, opaque fg / bg / transparent fg shortcuts, independent formula', () => {
    for (const x of inputs) {
      const fg = c(x);
      for (const y of PARTNERS) {
        const bg = c(y);
        const out = fg.over(y);
        const label = `${x}.over(${y})`;
        assertCleanColor(out, label);
        const af = fg.alpha(),
          ab = bg.alpha();
        const alpha = af + ab * (1 - af);
        expect(out.alpha(), `${label} alpha`).toBeCloseTo(alpha, 3);
        if (af === 1) expect(out.toOklchString(10), `${label} opaque fg`).toBe(fg.toOklchString(10));
        if (ab === 1) expect(out.alpha(), `${label} opaque bg`).toBe(1);
        if (alpha > 0) {
          const [f, b, o] = [fg._rawRgb(), bg._rawRgb(), out._rawRgb()];
          for (const k of ['r', 'g', 'b'] as const) {
            const e = (f[k] * af + b[k] * ab * (1 - af)) / alpha;
            expect(Math.abs(o[k] - e), `${label}.${k}`).toBeLessThan(0.5);
          }
        }
      }
    }
  });

  it('delta(): zero on itself, symmetric, finite and non-negative at every precision', () => {
    for (const x of inputs) {
      const a = c(x);
      expect(a.delta(x), `${x} delta self`).toBe(0);
      for (const y of PARTNERS) {
        for (const p of [undefined, 0, 1, 3, 5, 10]) {
          const d = a.delta(y, p);
          expect(Number.isFinite(d) && d >= 0, `${x}.delta(${y}, ${p}) = ${d}`).toBe(true);
          expect(Object.is(d, -0)).toBe(false);
        }
        expect(Math.abs(a.delta(y, 10) - c(y).delta(x, 10)), `${x} <-> ${y}`).toBeLessThan(1e-6);
      }
    }
  });

  it('a11y: contrast / isReadable / readableScore / apcaContrast / isReadableApca agree with each other in every space', () => {
    for (const x of inputs) {
      const a = c(x);
      const lum = a.luminance(10);
      expect(lum >= 0 && lum <= 1, `${x} luminance ${lum}`).toBe(true);
      for (const y of PARTNERS) {
        const ratio = a.contrast(y, 12);
        const label = `${x} on ${y}`;
        expect(ratio >= 1 && ratio <= 21, `${label} contrast ${ratio}`).toBe(true);
        for (const p of [0, 1, 2, 5, 10])
          expect(Number.isFinite(a.contrast(y, p)), `${label} contrast(${p})`).toBe(true);
        if (a.alpha() === 1 && c(y).alpha() === 1)
          expect(Math.abs(ratio - c(y).contrast(x, 12)), `${label} symmetric`).toBeLessThan(1e-9);
        expect(a.isReadable(y), label).toBe(ratio >= 4.5);
        expect(a.isReadable(y, { size: 'large' }), label).toBe(ratio >= 3);
        expect(a.isReadable(y, { level: 'AAA' }), label).toBe(ratio >= 7);
        expect(a.isReadable(y, { level: 'AAA', size: 'large' }), label).toBe(ratio >= 4.5);
        expect(a.readableScore(y), label).toBe(
          ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'fail'
        );
        for (const space of [undefined, 'srgb', 'p3'] as const) {
          const lc = a.apcaContrast(y, { ...sp(space), precision: 12 });
          expect(Number.isFinite(lc) && Math.abs(lc) < 110, `${label} apca ${space} = ${lc}`).toBe(true);
          for (const p of [0, 1, 3])
            expect(Number.isFinite(a.apcaContrast(y, { ...sp(space), precision: p }))).toBe(true);
          expect(a.isReadableApca(y, sp(space)), `${label} ${space}`).toBe(Math.abs(lc) >= 75);
          expect(a.isReadableApca(y, { ...sp(space), size: 'large' }), `${label} ${space} large`).toBe(
            Math.abs(lc) >= 60
          );
        }
      }
    }
  });

  it(
    'fixContrast / minReadable: a result passes its gate, keeps alpha; null only when neither black nor white passes',
    () => {
      const OPTS = [
        undefined,
        { wcag: 3 },
        { wcag: 7 },
        { apca: 60 },
        { apca: 75, space: 'p3' as const },
        { wcag: 4.5, apca: 60 },
        { wcag: 21 },
      ];
      for (const x of inputs) {
        const a = c(x);
        for (const y of [
          '#fff',
          '#000',
          '#777',
          'rgb(0 0 0 / 0)',
          'color(display-p3 0 1 0)',
          'color(srgb 1.1 1.1 1.1)',
        ]) {
          for (const opts of OPTS) {
            const label = `${x}.fixContrast(${y}, ${JSON.stringify(opts)})`;
            const wcag = opts?.wcag ?? (opts?.apca === undefined ? 4.5 : undefined);
            const apca = opts?.apca;
            const space = opts?.space;
            // `eps` keeps the independent check off the exact threshold, where rounding to 12 dp
            // can land either side of the unrounded value fixContrast compares.
            const passes = (z: Colordx, eps = 0): boolean =>
              (wcag === undefined || z.contrast(y, 12) >= wcag + eps) &&
              (apca === undefined || Math.abs(z.apcaContrast(y, { ...sp(space), precision: 12 })) >= apca + eps);
            const out = a.fixContrast(y, opts);
            if (passes(a, 1e-9)) expect(out, `${label} already passes`).toBe(a);
            if (out === null) {
              const extremes = [
                colordx({ r: 0, g: 0, b: 0, alpha: a.alpha() }),
                colordx({ r: 255, g: 255, b: 255, alpha: a.alpha() }),
              ];
              expect(
                extremes.some((z) => passes(z, 1e-9)),
                `${label} null although black or white passes`
              ).toBe(false);
              continue;
            }
            assertCleanColor(out, label);
            expect(passes(out, -1e-9), `${label} = ${out.toHex()} does not pass`).toBe(true);
            expect(out.alpha(), `${label} alpha`).toBe(a.alpha());
          }
          const mr = a.minReadable(y);
          assertCleanColor(mr, `${x}.minReadable(${y})`);
          expect(mr.contrast(y, 12) >= 4.5 || mr === a, `${x}.minReadable(${y}) = ${mr.toHex()}`).toBe(true);
        }
      }
    },
    TIMEOUT
  );
});

// ─── Bugs the matrix found ───────────────────────────────────────────────────────────────────────

describe('option matrix — fixed bugs', () => {
  // A brighter-than-white (darker-than-black) color has OKLab L > 1 (< 0), which CSS clamps at
  // parsed-value time, so minify() prints it as color(srgb …) instead of oklch(). Both print 5
  // decimals, so the read-back agrees to that precision (relative, since channels here reach 4.6).
  it.each([
    'color(srgb 1.1 1.1 1.1)',
    'color(srgb-linear 2 2 2)',
    'color(xyz 1.5 1.5 1.5)',
    'color(srgb 1 1 1.001)',
    'color(srgb -1 -1 -1)',
  ])('minify() of %s parses back to the same color', (x) => {
    const back = colordx(colordx(x).minify());
    const [p, q] = [back.toSrgbLinear(12), colordx(x).toSrgbLinear(12)];
    for (const k of ['r', 'g', 'b'] as const)
      expect(Math.abs(p[k] - q[k])).toBeLessThan(1e-4 * Math.max(1, Math.abs(q[k])));
  });

  // With no candidate format left, minify() falls back to hex, unless hex would round a visible
  // alpha to 00 (fully transparent); then it keeps the legacy rgba().
  it.each([
    { hex: false, rgb: false, hsl: false },
    { rgb: false, hsl: false },
  ])('minify(%j) keeps a visible alpha visible', (opts) => {
    const out = colordx('rgb(0 128 255 / 0.001)').minify(opts);
    expect(colordx(out).alpha()).toBeGreaterThan(0);
  });

  // CSS color-mix(in oklab | lab, …) is unbounded, so a wide-gamut color survives mixing with itself.
  it.each([
    ['mixOklab', 0],
    ['mixOklab', 0.5],
    ['mixLab', 0],
    ['mixLab', 0.5],
  ] as const)('%s(self, %s) of a Display-P3 red stays Display-P3 red', (m, t) => {
    const red = 'color(display-p3 1 0 0)';
    expect(colordx(red)[m](red, t).toP3String()).toBe('color(display-p3 1 0 0)');
  });
});

describe('option matrix — known bugs (it.fails until fixed)', () => {
  // BUG: a fractional count is truncated by Array.from but still used as the divisor, so the last
  // stop is not the target: palette(2.5, '#00f') → ['#ff0000', '#5500aa'] (t = 1/1.5).
  it.fails('palette(2.5) ends on the target', () => {
    const out = colordx('#f00').palette(2.5, '#00f');
    expect(out[out.length - 1]!.toHex()).toBe('#0000ff');
  });

  // BUG: tints/shades/tones/palette(Infinity) throw RangeError: Invalid array length (from Array.from).
  it.fails('tints(Infinity) does not throw', () => {
    expect(() => colordx('#f00').tints(Infinity)).not.toThrow();
  });

  // BUG: round() computes 10 ** precision, so a precision of NaN, Infinity or >= 309 turns every
  // channel into NaN, which `|| 0` then folds to 0: toOklch(NaN) of #3d7a9f is { l: 0, c: 0, h: 0 }
  // and toHslString(Infinity) is 'hsl(0 0% 0%)' — black, silently. (Precision is caller input.)
  it.fails.each([NaN, Infinity, 400])('toOklch(%s) does not silently become black', (p) => {
    expect(colordx('#3d7a9f').toOklch(p).l).toBeGreaterThan(0.5);
  });
});

// ─── Divergences, maybe intentional ───────────────────────────────────────────────────────────────

describe('option matrix — divergences (pinned as current behaviour)', () => {
  it('mix() clips a wide-gamut color to sRGB bytes; CSS color-mix(in srgb) is unbounded', () => {
    const red = 'color(display-p3 1 0 0)';
    expect(colordx(red).mix(red, 0).toP3String()).toBe('color(display-p3 0.9175 0.2003 0.1386)');
  });

  it('the Display-P3 red primary is outside Rec.2020 (README says sRGB ⊂ Display-P3 ⊂ Rec.2020)', () => {
    expect(inGamutP3('color(display-p3 1 0 0)')).toBe(true);
    expect(inGamutRec2020('color(display-p3 1 0 0)')).toBe(false);
  });

  it('harmonies() with an unknown type throws a TypeError rather than a descriptive error', () => {
    expect(() => colordx('#f00').harmonies('nope' as never)).toThrow(TypeError);
  });

  it('a11y on a color outside sRGB judges the gamut-mapped color, not the naive clip the browser shows', () => {
    // oklch(1 0.4 30) maps to white (L = 1) for WCAG, so it "passes" 21:1 on black, while toHex()
    // — what a browser renders on an sRGB screen — is #ff3306, about 6:1 on black.
    const x = colordx('oklch(1 0.4 30)');
    expect(x.contrast('#000')).toBe(21);
    expect(colordx(x.toHex()).contrast('#000')).toBeLessThan(7);
  });
});

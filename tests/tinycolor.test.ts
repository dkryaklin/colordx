/**
 * tinycolor2 compat — differential tests against the real tinycolor2 (a devDependency).
 *
 * Strings, formats, validity, names and readability must match exactly. Manipulations may
 * differ by at most 1 per RGB channel: tinycolor2 truncates percentages to two decimals when
 * it re-parses HSL between operations, colordx keeps full precision.
 */
import fc from 'fast-check';
import ref from 'tinycolor2';
import { describe, expect, it } from 'vitest';
import { Colordx } from '../src/index.js';
import tinycolor, { type TinyColor } from '../src/tinycolor.js';

const R = (input?: unknown, opts?: ref.ConstructorOptions): TinyColor & ref.Instance =>
  ref(input as never, opts) as unknown as TinyColor & ref.Instance;

const channelDiff = (a: string, b: string): number => {
  const x = R(a).toRgb();
  const y = R(b).toRgb();
  return Math.max(Math.abs(x.r - y.r), Math.abs(x.g - y.g), Math.abs(x.b - y.b));
};
const expectWithin1 = (ours: TinyColor, theirs: TinyColor): void => {
  expect(channelDiff(ours.toHexString(), theirs.toHexString())).toBeLessThanOrEqual(1);
  expect(ours.getAlpha()).toBeCloseTo(theirs.getAlpha(), 3);
};

const hexArb = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, '0')}`);
const alphaArb = fc.integer({ min: 0, max: 100 }).map((n) => n / 100);
const amountArb = fc.integer({ min: 0, max: 100 });
const ratioArb = fc.integer({ min: 0, max: 1000 }).map((n) => n / 1000);
const rgbaArb = fc.record(
  {
  r: fc.integer({ min: 0, max: 255 }),
  g: fc.integer({ min: 0, max: 255 }),
  b: fc.integer({ min: 0, max: 255 }),
  a: alphaArb,
  },
  { noNullPrototype: true }
);

const FORMATS = ['rgb', 'prgb', 'hex', 'hex6', 'hex3', 'hex4', 'hex8', 'name', 'hsl', 'hsv'] as const;

const INPUTS: unknown[] = [
  // hex, with and without '#', 3/4/6/8 digits
  '#f00',
  '#ff0000',
  'f00',
  'FF0000',
  '#ff000080',
  '#f008',
  'ff000080',
  // names
  'red',
  'RED',
  ' Red ',
  'transparent',
  'burntsienna',
  'aqua',
  'cyan',
  // rgb strings incl. tinycolor2's permissive forms
  'rgb(255, 0, 0)',
  'rgb(255 0 0)',
  'rgb 255 0 0',
  'rgba(255, 0, 0, 0.5)',
  'rgba 255, 0, 0, .5',
  'rgb(100%, 50%, 0%)',
  'rgb(1.0, 0, 0)',
  'rgb(300, -5, 0)',
  // hsl / hsv strings
  'hsl(0, 100%, 50%)',
  'hsl 120 100% 50%',
  'hsla(200, 50%, 40%, 0.3)',
  'hsl(0, 1, 0.5)',
  'hsv(0, 100%, 100%)',
  'hsva(300, 50%, 80%, 0.25)',
  // objects
  { r: 255, g: 0, b: 0 },
  { r: 255, g: 0, b: 0, a: 0.5 },
  { r: '100%', g: '0%', b: '50%' },
  { r: '100%', g: '0%', b: '50%', a: 0.5 },
  { r: 1, g: 0, b: 0 },
  { r: '1.0', g: 0, b: 0 },
  { r: 12.6, g: 200.4, b: 0.49 },
  { h: 0, s: 100, l: 50 },
  { h: 0, s: 1, l: 0.5 },
  { h: 120, s: '100%', l: '50%', a: 0.2 },
  { h: 370, s: 50, l: 50 },
  { h: -10, s: 50, l: 50 },
  { h: 200, s: 100, v: 100 },
  { h: 200, s: 0.5, v: 0.5, a: 0.5 },
  { h: 200, s: 100, v: 100, l: 50 },
  // alpha out of range becomes 1
  { r: 255, g: 0, b: 0, a: 2 },
  { r: 255, g: 0, b: 0, a: -1 },
  { r: 255, g: 0, b: 0, a: 'x' },
  // invalid
  '',
  'nope',
  '#12',
  '#1234567',
  'rgb(1, 2)',
  { r: 'a', g: 0, b: 0 },
  { r: NaN, g: 0, b: 0 },
  {},
  null,
  undefined,
  42,
  [],
];

describe('tinycolor compat — parsing and output match tinycolor2', () => {
  it.each(INPUTS.map((i) => [JSON.stringify(i) ?? String(i), i]))('%s', (_label, input) => {
    const ours = tinycolor(input as never);
    const theirs = R(input);
    expect(ours.isValid()).toBe(theirs.isValid());
    expect(ours.getFormat()).toBe(theirs.getFormat());
    expect(ours.toHexString()).toBe(theirs.toHexString());
    expect(ours.toHexString(true)).toBe(theirs.toHexString(true));
    expect(ours.toHex8String()).toBe(theirs.toHex8String());
    expect(ours.toHex8String(true)).toBe(theirs.toHex8String(true));
    expect(ours.toHex()).toBe(theirs.toHex());
    expect(ours.toHex8()).toBe(theirs.toHex8());
    expect(ours.toRgbString()).toBe(theirs.toRgbString());
    expect(ours.toPercentageRgbString()).toBe(theirs.toPercentageRgbString());
    expect(ours.toPercentageRgb()).toEqual(theirs.toPercentageRgb());
    expect(ours.toHslString()).toBe(theirs.toHslString());
    expect(ours.toHsvString()).toBe(theirs.toHsvString());
    expect(ours.toName()).toBe(theirs.toName());
    expect(ours.toFilter()).toBe(theirs.toFilter());
    expect(ours.toString()).toBe(theirs.toString());
    for (const f of FORMATS) expect(ours.toString(f)).toBe(theirs.toString(f));
    expect(ours.toRgb()).toEqual(theirs.toRgb());
    expect(ours.isDark()).toBe(theirs.isDark());
    expect(ours.isLight()).toBe(theirs.isLight());
    expect(ours.getBrightness()).toBeCloseTo(theirs.getBrightness(), 6);
    expect(ours.getLuminance()).toBeCloseTo(theirs.getLuminance(), 6);
    expect(ours.getAlpha()).toBeCloseTo(theirs.getAlpha(), 3);
    const h1 = ours.toHsl();
    const h2 = theirs.toHsl();
    expect(h1.h).toBeCloseTo(h2.h, 6);
    expect(h1.s).toBeCloseTo(h2.s, 6);
    expect(h1.l).toBeCloseTo(h2.l, 6);
    const v1 = ours.toHsv();
    const v2 = theirs.toHsv();
    expect(v1.h).toBeCloseTo(v2.h, 6);
    expect(v1.s).toBeCloseTo(v2.s, 6);
    expect(v1.v).toBeCloseTo(v2.v, 6);
    expect(ours.clone().toString()).toBe(theirs.clone().toString());
  });

  it('random rgb objects match exactly', () => {
    fc.assert(
      fc.property(rgbaArb, (rgba) => {
        const ours = tinycolor(rgba);
        const theirs = R(rgba);
        expect(ours.toHex8String()).toBe(theirs.toHex8String());
        expect(ours.toHslString()).toBe(theirs.toHslString());
        expect(ours.toHsvString()).toBe(theirs.toHsvString());
        expect(ours.toString()).toBe(theirs.toString());
      })
    );
  });

  it('hsl and hsv objects round-trip like tinycolor2 (fractions at or below 1)', () => {
    fc.assert(
      fc.property(hexArb, (hex) => {
        expect(tinycolor(tinycolor(hex).toHsl()).toHexString()).toBe(hex);
        expect(tinycolor(tinycolor(hex).toHsv()).toHexString()).toBe(hex);
        expect(tinycolor(R(hex).toHsl()).toHexString()).toBe(hex);
        expect(R(tinycolor(hex).toHsl()).toHexString()).toBe(hex);
      })
    );
  });

  it('CSS angle units on the hue convert to degrees (tinycolor2 rejects them; parseFloat would read 0.5turn as 0.5deg)', () => {
    const cyan = tinycolor('hsl(180, 100%, 50%)').toRgbString();
    for (const input of [
      'hsl(0.5turn 100% 50%)',
      'hsl(0.5turn, 100%, 50%)',
      'hsl(180deg, 100%, 50%)',
      'hsl(200grad 100% 50%)',
      `hsl(${Math.PI}rad 100% 50%)`,
      'hsv(0.5TURN, 100%, 100%)',
      { h: '0.5turn', s: 1, l: 0.5 },
      { h: '200grad', s: 1, v: 1 },
    ]) {
      expect(tinycolor(input).toRgbString(), String(input)).toBe(cyan);
      expect(tinycolor(input).isValid()).toBe(true);
    }
    // negative angles clamp to 0 like tinycolor2's bound01 does for plain degrees
    expect(tinycolor('hsl(-0.25turn 100% 50%)').toRgbString()).toBe(R({ h: -90, s: 1, l: 0.5 }).toRgbString());
    // a unit alone is not a number
    expect(tinycolor('hsl(turn, 100%, 50%)').isValid()).toBe(false);
  });

  it('string tokens must be whole CSS numbers, like tinycolor2 (parseFloat would read `1e2` as 1)', () => {
    expect(R('hsl(1e2, 100%, 50%)').isValid()).toBe(false);
    expect(tinycolor('hsl(1e2, 100%, 50%)').isValid()).toBe(false);
    // tinycolor2 is unanchored at the end: the last token's numeric prefix is used, the rest ignored
    expect(R('rgb(0, 0, 1e2)').toRgbString()).toBe('rgb(0, 0, 1)');
    expect(tinycolor('rgb(0, 0, 1e2)').toRgbString()).toBe('rgb(0, 0, 1)');
    for (const t of ['180foo', '1e2', '0x10', '180.', '3e', '2..5', 'e5', '--5', '5-', '5%%', '1-1']) {
      for (const s of [`hsl(${t}, 100%, 50%)`, `rgb(${t}, 0, 0)`, `rgb(0, ${t}, 0)`, `rgb(0, 0, ${t})`, `hsv(0, ${t}, 100%)`]) {
        expect(tinycolor(s).isValid(), s).toBe(R(s).isValid());
        if (R(s).isValid()) expect(tinycolor(s).toRgbString(), s).toBe(R(s).toRgbString());
      }
    }
    const tokenArb = fc.string({
      unit: fc.constantFrom('0', '1', '9', '.', '%', '+', '-', 'e', 'x', 'f'),
      minLength: 1,
      maxLength: 6,
    });
    fc.assert(
      fc.property(tokenArb, fc.constantFrom('rgb', 'hsl', 'hsv'), fc.integer({ min: 0, max: 2 }), (t, fn, pos) => {
        // tinycolor2's bound01 wraps a percentage above 100 modulo the channel max (900% → 140); the shim clamps
        if (/^[-+]?(?:\d*\.\d+|\d+)%/.test(t) && parseFloat(t) > 100) return;
        const parts = fn === 'rgb' ? ['0', '0', '0'] : ['0', '50%', '50%'];
        parts[pos] = t;
        const s = `${fn}(${parts.join(', ')})`;
        expect(tinycolor(s).isValid(), s).toBe(R(s).isValid());
        if (R(s).isValid()) expect(tinycolor(s).toRgbString(), s).toBe(R(s).toRgbString());
      }),
      { numRuns: 500 }
    );
  });

  it('getOriginalInput returns the input untouched', () => {
    const obj = { r: 1, g: 2, b: 3 };
    expect(tinycolor(obj).getOriginalInput()).toBe(obj);
    expect(tinycolor(' Red ').getOriginalInput()).toBe(' Red ');
  });

  it('opts.format overrides the detected format', () => {
    expect(tinycolor('#f00', { format: 'hsl' }).toString()).toBe(R('#f00', { format: 'hsl' }).toString());
    expect(tinycolor('#f00', { format: 'hsl' }).getFormat()).toBe('hsl');
  });

  it('toFilter matches, including gradientType and a second color', () => {
    expect(tinycolor('#ff000080', { gradientType: true }).toFilter('#00f')).toBe(
      R('#ff000080', { gradientType: true }).toFilter('#00f')
    );
  });
});

describe('tinycolor compat — manipulations stay within 1/255 of tinycolor2', () => {
  const ops = {
    lighten: (c: TinyColor, n?: number) => c.lighten(n),
    darken: (c: TinyColor, n?: number) => c.darken(n),
    saturate: (c: TinyColor, n?: number) => c.saturate(n),
    desaturate: (c: TinyColor, n?: number) => c.desaturate(n),
    brighten: (c: TinyColor, n?: number) => c.brighten(n),
    spin: (c: TinyColor, n?: number) => c.spin(n ?? 0),
  } as const;

  for (const [name, op] of Object.entries(ops)) {
    it(`${name}(amount)`, () => {
      fc.assert(
        fc.property(hexArb, alphaArb, fc.option(amountArb, { nil: undefined }), (hex, a, amount) => {
          const ours = tinycolor(hex).setAlpha(a);
          const theirs = R(hex).setAlpha(a);
          expectWithin1(op(ours, amount) as TinyColor, op(theirs, amount));
        })
      );
    });
  }

  it('spin with negative and wrapped amounts', () => {
    fc.assert(
      fc.property(hexArb, fc.integer({ min: -720, max: 720 }), (hex, deg) => {
        expectWithin1(tinycolor(hex).spin(deg), R(hex).spin(deg));
      })
    );
  });

  it('greyscale', () => {
    fc.assert(fc.property(hexArb, (hex) => expectWithin1(tinycolor(hex).greyscale(), R(hex).greyscale())));
  });

  it('brighten matches exactly (pure RGB arithmetic)', () => {
    fc.assert(
      fc.property(hexArb, amountArb, (hex, n) => {
        expect(tinycolor(hex).brighten(n).toHexString()).toBe(R(hex).brighten(n).toHexString());
      })
    );
  });

  it('chains', () => {
    fc.assert(
      fc.property(hexArb, amountArb, amountArb, (hex, a, b) => {
        expectWithin1(tinycolor(hex).lighten(a).saturate(b).spin(90), R(hex).lighten(a).saturate(b).spin(90));
      })
    );
  });

  it('mutates the instance and returns it, like tinycolor2', () => {
    const c = tinycolor('#f00');
    const out = c.lighten(20);
    expect(out).toBe(c);
    expect(c.toHexString()).toBe(R('#f00').lighten(20).toHexString());
    expect(c.setAlpha(0.5)).toBe(c);
    expect(c.getAlpha()).toBe(0.5);
  });

  it('setAlpha outside [0, 1] becomes 1, like tinycolor2', () => {
    for (const a of [2, -1, NaN, 'x']) {
      expect(tinycolor('#f00').setAlpha(a).getAlpha()).toBe(R('#f00').setAlpha(a as number).getAlpha());
    }
  });
});

describe('tinycolor compat — combinations', () => {
  it('complement / triad / tetrad / splitcomplement', () => {
    fc.assert(
      fc.property(hexArb, alphaArb, (hex, a) => {
        const ours = tinycolor(hex).setAlpha(a);
        const theirs = R(hex).setAlpha(a);
        expectWithin1(ours.complement(), theirs.complement());
        for (const fn of ['triad', 'tetrad', 'splitcomplement'] as const) {
          const o = ours[fn]();
          const t = theirs[fn]();
          expect(o.length).toBe(t.length);
          o.forEach((c, i) => expectWithin1(c, t[i]!));
        }
      })
    );
  });

  it('analogous(results, slices)', () => {
    fc.assert(
      fc.property(
        hexArb,
        fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }),
        fc.option(fc.integer({ min: 1, max: 60 }), { nil: undefined }),
        (hex, results, slices) => {
          const o = tinycolor(hex).analogous(results, slices);
          const t = R(hex).analogous(results, slices);
          expect(o.length).toBe(t.length);
          o.forEach((c, i) => expectWithin1(c, t[i]!));
        }
      )
    );
  });

  it('monochromatic(results)', () => {
    fc.assert(
      fc.property(hexArb, fc.option(fc.integer({ min: 1, max: 12 }), { nil: undefined }), (hex, results) => {
        const o = tinycolor(hex).monochromatic(results);
        const t = R(hex).monochromatic(results);
        expect(o.length).toBe(t.length);
        o.forEach((c, i) => expectWithin1(c, t[i]!));
      })
    );
  });

  it('analogous / monochromatic terminate on a negative, fractional or non-finite count (bgrins/TinyColor#280)', () => {
    // tinycolor2's `--results` / `results--` loops never reach 0 here and run out of memory.
    const c = tinycolor('#3d7a9f');
    expect(c.analogous(-1)).toHaveLength(1);
    expect(c.analogous(0.5)).toHaveLength(1);
    expect(c.analogous(2.5).map((x) => x.toHexString())).toEqual(c.analogous(2).map((x) => x.toHexString()));
    expect(c.analogous(Infinity)).toHaveLength(6);
    expect(c.analogous(NaN)).toHaveLength(6);
    expect(c.monochromatic(-1)).toHaveLength(1);
    expect(c.monochromatic(0.5)).toHaveLength(1);
    expect(c.monochromatic(1.5).map((x) => x.toHexString())).toEqual(c.monochromatic(1).map((x) => x.toHexString()));
    expect(c.monochromatic(Infinity)).toHaveLength(6);
    // `slices` only sets the step; it never drives a loop
    expect(c.analogous(3, -1)).toHaveLength(3);
    expect(c.analogous(3, 0.5)).toHaveLength(3);
  });

  it('first element of triad/tetrad/splitcomplement/analogous is the instance itself', () => {
    const c = tinycolor('#3d7a9f');
    expect(c.triad()[0]).toBe(c);
    expect(c.tetrad()[0]).toBe(c);
    expect(c.splitcomplement()[0]).toBe(c);
    expect(c.analogous()[0]).toBe(c);
  });
});

describe('tinycolor compat — statics', () => {
  it('equals', () => {
    expect(tinycolor.equals('#f00', 'red')).toBe(true);
    expect(tinycolor.equals('#f00', 'rgba(255, 0, 0, 0.999)')).toBe(ref.equals('#f00', 'rgba(255, 0, 0, 0.999)'));
    expect(tinycolor.equals('#f00', '#00f')).toBe(false);
    expect(tinycolor.equals('#f00')).toBe(false);
    expect(tinycolor.equals()).toBe(false);
  });

  it('mix matches exactly', () => {
    fc.assert(
      fc.property(hexArb, hexArb, alphaArb, fc.option(amountArb, { nil: undefined }), (a, b, alpha, amount) => {
        const x = tinycolor.mix(tinycolor(a).setAlpha(alpha), b, amount);
        const y = ref.mix(R(a).setAlpha(alpha), b, amount);
        expect(x.toHex8String()).toBe(y.toHex8String());
      })
    );
  });

  it('readability / isReadable / mostReadable', () => {
    fc.assert(
      fc.property(hexArb, hexArb, hexArb, (a, b, c) => {
        expect(tinycolor.readability(a, b)).toBeCloseTo(ref.readability(a, b), 6);
        for (const level of ['AA', 'AAA', undefined] as const) {
          for (const size of ['small', 'large', undefined] as const) {
            const o = level === undefined && size === undefined ? undefined : { level, size };
            expect(tinycolor.isReadable(a, b, o)).toBe(ref.isReadable(a, b, o));
            for (const includeFallbackColors of [true, false, undefined]) {
              const args = { ...o, includeFallbackColors };
              expect(tinycolor.mostReadable(a, [b, c], args).toHexString()).toBe(
                ref.mostReadable(a, [b, c], args).toHexString()
              );
            }
          }
        }
      })
    );
  });

  it('isReadable accepts lower-case / mixed-case level and size', () => {
    const o = { level: 'aaa', size: 'LARGE' } as unknown as tinycolor.WCAG2Options;
    expect(tinycolor.isReadable('#777', '#fff', o)).toBe(ref.isReadable('#777', '#fff', o));
  });

  it('fromRatio', () => {
    fc.assert(
      fc.property(ratioArb, ratioArb, (x, y) => {
        expect(tinycolor.fromRatio({ r: x, g: y, b: 1, a: 0.5 }).toHex8String()).toBe(
          ref.fromRatio({ r: x, g: y, b: 1, a: 0.5 }).toHex8String()
        );
        // HSL goes through tinycolor2's percentage truncation, so allow the documented 1/255.
        expectWithin1(
          tinycolor.fromRatio({ h: x * 360, s: y, l: 0.4 }),
          ref.fromRatio({ h: x * 360, s: y, l: 0.4 }) as unknown as TinyColor
        );
      })
    );
    expect(tinycolor.fromRatio('#f00').toHexString()).toBe('#ff0000');
    expect(tinycolor.fromRatio({ r: '50%', g: 0, b: 0 }).toHexString()).toBe(
      ref.fromRatio({ r: '50%', g: 0, b: 0 } as never).toHexString()
    );
  });

  it('random returns a valid rgb color', () => {
    const c = tinycolor.random();
    expect(c.isValid()).toBe(true);
    expect(c.getFormat()).toBe(ref.random().getFormat());
  });

  it('names and hexNames', () => {
    expect(tinycolor.names.red).toBe('ff0000');
    expect(tinycolor.names.burntsienna).toBe('ea7e5d');
    expect(tinycolor.hexNames['00ffff']).toBe('cyan');
    expect(tinycolor.hexNames.ff00ff).toBe('magenta');
    expect(tinycolor.hexNames['808080']).toBe('grey');
    expect(Object.keys(tinycolor.names).sort()).toEqual(Object.keys(ref.names).sort());
    for (const name of Object.keys(ref.names)) {
      expect(tinycolor(name).toHexString()).toBe(R(name).toHexString());
      // tinycolor2 never finds rebeccapurple (it stores it unshortened, then looks up the short form).
      expect(tinycolor(name).toName()).toBe(name === 'rebeccapurple' ? name : R(name).toName());
    }
  });
});

describe('tinycolor compat — construction', () => {
  it('passes an existing instance through, like tinycolor2', () => {
    const c = tinycolor('#f00');
    expect(tinycolor(c)).toBe(c);
  });

  it('works with `new` too', () => {
    const c = new (tinycolor as unknown as new (i: string) => TinyColor)('#f00');
    expect(Object.getPrototypeOf(c)).toBe(Object.getPrototypeOf(tinycolor('#000')));
    expect(c.toHexString()).toBe('#ff0000');
  });

  it('clone() is independent', () => {
    const a = tinycolor('#f00');
    const c = a.clone();
    a.lighten(50);
    expect(c.toHexString()).toBe('#ff0000');
  });

  it('invalid input is black, isValid false, format false', () => {
    const c = tinycolor('nope');
    expect(c.isValid()).toBe(false);
    expect(c.toHexString()).toBe('#000000');
    expect(c.getFormat()).toBe(false);
    expect(c.toString()).toBe('#000000');
  });

  it('toColordx exposes the immutable Colordx underneath', () => {
    const c = tinycolor('#f00').setAlpha(0.5);
    const d = c.toColordx();
    expect(d).toBeInstanceOf(Colordx);
    expect(d.toOklchString()).toBe(new Colordx('rgba(255, 0, 0, 0.5)').toOklchString());
    c.lighten(50);
    expect(d.toHex()).toBe('#ff000080'); // the Colordx handed out earlier is unaffected
  });
});

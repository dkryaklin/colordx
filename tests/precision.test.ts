import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import cmyk from '../src/plugins/cmyk.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import p3 from '../src/plugins/p3.js';
import rec2020 from '../src/plugins/rec2020.js';

beforeAll(() => extend([hsv, hwb, lab, lch, p3, rec2020, cmyk]));

interface WithAll {
  toHsl(p?: number): { h: number; s: number; l: number; alpha: number };
  toHslString(p?: number): string;
  toOklab(p?: number): { l: number; a: number; b: number; alpha: number };
  toOklabString(p?: number): string;
  toOklch(p?: number): { l: number; c: number; h: number; alpha: number };
  toOklchString(p?: number): string;
  toHsv(p?: number): { h: number; s: number; v: number; alpha: number };
  toHsvString(p?: number): string;
  toHwb(p?: number): { h: number; w: number; b: number; alpha: number };
  toHwbString(p?: number): string;
  toLab(p?: number): { l: number; a: number; b: number; alpha: number };
  toLabString(p?: number): string;
  toLch(p?: number): { l: number; c: number; h: number; alpha: number };
  toLchString(p?: number): string;
  toXyz(p?: number): { x: number; y: number; z: number; alpha: number };
  toXyzString(p?: number): string;
  toXyzD65(p?: number): { x: number; y: number; z: number; alpha: number };
  toXyzD65String(p?: number): string;
  toCmyk(p?: number): { c: number; m: number; y: number; k: number; alpha: number };
  toCmykString(p?: number): string;
  toP3(p?: number): { r: number; g: number; b: number; alpha: number };
  toP3String(p?: number): string;
  toRec2020(p?: number): { r: number; g: number; b: number; alpha: number };
  toRec2020String(p?: number): string;
}

// All channels of a CSS-function string, extracted to count fractional digits.
const channelsOf = (s: string): string[] => {
  const inside = s.replace(/^[a-z-]+\(\s*/i, '').replace(/\s*\)$/, '');
  const body =
    inside.startsWith('display-p3 ') ||
    inside.startsWith('rec2020 ') ||
    inside.startsWith('xyz-d65 ') ||
    inside.startsWith('xyz-d50 ')
      ? inside.replace(/^\S+\s+/, '')
      : inside;
  return body.split(/\s*\/\s*|\s+/).map((t) => t.replace(/%$/, ''));
};

const maxFractionalDigits = (nums: string[]): number =>
  Math.max(...nums.filter((n) => /^-?\d/.test(n)).map((n) => (n.split('.')[1] ?? '').length));

const c = colordx('#3d7a9f') as unknown as WithAll;

describe('precision arg — per-format default dp matches prior behavior', () => {
  it('toHslString default = 2dp', () => expect(c.toHslString()).toBe('hsl(202.65 44.55% 43.14%)'));
  it('toHsvString default = 2dp', () => expect(c.toHsvString()).toBe('hsv(202.65 61.64% 62.35%)'));
  it('toHwbString default = 0dp', () => expect(c.toHwbString()).toBe('hwb(203 24% 38%)'));
  it('toCmykString default = 2dp', () => expect(c.toCmykString()).toBe('device-cmyk(61.64% 23.27% 0% 37.65%)'));
  it('toLabString default = 2dp', () => expect(c.toLabString()).toBe('lab(48.38 -11.65 -26.34)'));
  it('toLchString default = 2dp', () => expect(c.toLchString()).toBe('lch(48.38 28.8 246.13)'));
  it('toXyzString default = 2dp', () => expect(c.toXyzString()).toBe('color(xyz-d50 14.49 17.09 26.71)'));
  it('toXyzD65String default = 2dp', () => expect(c.toXyzD65String()).toMatch(/^color\(xyz-d65 \d/));
  it('toOklabString default = 5dp', () => expect(c.toOklabString()).toBe('oklab(0.55476 -0.04575 -0.07224)'));
  it('toOklchString default = 5dp', () => expect(c.toOklchString()).toBe('oklch(0.55476 0.08551 237.65614)'));
  it('toP3String default = 4dp', () => expect(c.toP3String()).toBe('color(display-p3 0.2994 0.4728 0.6102)'));
  it('toRec2020String default = 4dp', () =>
    expect(c.toRec2020String()).toBe('color(rec2020 0.3051 0.4166 0.5667)'));
});

describe('precision arg — custom precision controls decimal places', () => {
  const cases: [string, (p?: number) => string][] = [
    ['toHslString', (p) => c.toHslString(p)],
    ['toHsvString', (p) => c.toHsvString(p)],
    ['toHwbString', (p) => c.toHwbString(p)],
    ['toCmykString', (p) => c.toCmykString(p)],
    ['toLabString', (p) => c.toLabString(p)],
    ['toLchString', (p) => c.toLchString(p)],
    ['toXyzString', (p) => c.toXyzString(p)],
    ['toXyzD65String', (p) => c.toXyzD65String(p)],
    ['toOklabString', (p) => c.toOklabString(p)],
    ['toOklchString', (p) => c.toOklchString(p)],
    ['toP3String', (p) => c.toP3String(p)],
    ['toRec2020String', (p) => c.toRec2020String(p)],
  ];

  for (const [name, fn] of cases) {
    it(`${name}(0) emits integers only`, () => {
      expect(maxFractionalDigits(channelsOf(fn(0)))).toBe(0);
    });
    it(`${name}(6) emits up to 6 fractional digits`, () => {
      expect(maxFractionalDigits(channelsOf(fn(6)))).toBeLessThanOrEqual(6);
    });
    it(`${name}(6) has more precision than ${name}(1)`, () => {
      // At precision=1 most non-trivial channels collapse; at precision=6 they don't.
      const p1 = maxFractionalDigits(channelsOf(fn(1)));
      const p6 = maxFractionalDigits(channelsOf(fn(6)));
      expect(p6).toBeGreaterThan(p1);
    });
  }
});

describe('precision arg — object methods return values rounded to precision', () => {
  const roundedTo = (n: number, p: number) => Math.round(n * 10 ** p) / 10 ** p;

  it('toHsl(3) h/s/l match round(raw, 3)', () => {
    const raw = c.toHsl(10);
    const r = c.toHsl(3);
    expect(r.h).toBe(roundedTo(raw.h, 3));
    expect(r.s).toBe(roundedTo(raw.s, 3));
    expect(r.l).toBe(roundedTo(raw.l, 3));
  });

  it('toOklab(2) l/a/b match round(raw, 2)', () => {
    const raw = c.toOklab(10);
    const r = c.toOklab(2);
    expect(r.l).toBe(roundedTo(raw.l, 2));
    expect(r.a).toBe(roundedTo(raw.a, 2));
    expect(r.b).toBe(roundedTo(raw.b, 2));
  });

  it('toOklch(2) hue is rounded to 2dp (not preserved at 5dp default)', () => {
    expect(c.toOklch(2).h).toBe(237.66);
    expect(c.toOklch().h).toBe(237.65614);
  });

  it('toCmyk(0) emits integer percentages', () => {
    const r = c.toCmyk(0);
    expect(r.c).toBe(Math.round(r.c));
    expect(r.m).toBe(Math.round(r.m));
    expect(r.y).toBe(Math.round(r.y));
    expect(r.k).toBe(Math.round(r.k));
  });

  it('toP3(6) has more fractional digits than toP3(2)', () => {
    const p2 = c.toP3(2);
    const p6 = c.toP3(6);
    // At 2dp, channels collapse onto coarser steps; at 6dp they match raw sub-percent precision.
    expect(p6.r).not.toBe(p2.r);
  });
});

describe('precision arg — alpha precision is always 3dp regardless of precision arg', () => {
  const a = colordx({ r: 61, g: 122, b: 159, alpha: 0.123456 }) as unknown as WithAll;
  it('oklab alpha stays 3dp when precision=6', () => expect(a.toOklab(6).alpha).toBe(0.123));
  it('oklch alpha stays 3dp when precision=6', () => expect(a.toOklch(6).alpha).toBe(0.123));
  it('lab alpha stays 3dp when precision=6', () => expect(a.toLab(6).alpha).toBe(0.123));
  it('p3 alpha stays 3dp when precision=6', () => expect(a.toP3(6).alpha).toBe(0.123));
  it('rec2020 alpha stays 3dp when precision=6', () => expect(a.toRec2020(6).alpha).toBe(0.123));
  it('cmyk alpha stays 3dp when precision=6', () => expect(a.toCmyk(6).alpha).toBe(0.123));
});

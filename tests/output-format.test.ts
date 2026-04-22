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

// Format-stability tests. Every string-output method is pinned literally for one
// opaque and one translucent canonical input. Any change to the emitted format
// (commas vs spaces, percent signs, separator characters, decimal precision) must
// surface as a failure here so it can't drift in silently.

const opaque = colordx('#3d7a9f');
const alpha = colordx({ r: 61, g: 122, b: 159, alpha: 0.5 });

interface WithStrings {
  toRgbString(options?: { legacy?: boolean }): string;
  toHslString(): string;
  toOklabString(): string;
  toOklchString(): string;
  toHwbString(): string;
  toHsvString(): string;
  toLabString(): string;
  toLchString(): string;
  toCmykString(): string;
  toP3String(): string;
}

const o = opaque as unknown as WithStrings;
const a = alpha as unknown as WithStrings;

describe('output format — opaque', () => {
  it('toHex', () => expect(opaque.toHex()).toBe('#3d7a9f'));
  it('toRgbString', () => expect(o.toRgbString()).toBe('rgb(61 122 159)'));
  it('toHslString', () => expect(o.toHslString()).toBe('hsl(202.65 44.55% 43.14%)'));
  it('toHsvString', () => expect(o.toHsvString()).toBe('hsv(202.65 61.64% 62.35%)'));
  it('toHwbString', () => expect(o.toHwbString()).toBe('hwb(203 24% 38%)'));
  it('toOklabString', () => expect(o.toOklabString()).toBe('oklab(0.5548 -0.0457 -0.0722)'));
  it('toOklchString', () => expect(o.toOklchString()).toBe('oklch(0.5548 0.0855 237.6561)'));
  it('toLabString', () => expect(o.toLabString()).toBe('lab(48.38 -11.65 -26.34)'));
  it('toLchString', () => expect(o.toLchString()).toBe('lch(48.38 28.8 246.13)'));
  it('toCmykString', () => expect(o.toCmykString()).toBe('device-cmyk(61.64% 23.27% 0% 37.65%)'));
  it('toP3String', () => expect(o.toP3String()).toBe('color(display-p3 0.2994 0.4728 0.6102)'));
});

describe('output format — with alpha (slash syntax)', () => {
  it('toHex', () => expect(alpha.toHex()).toBe('#3d7a9f80'));
  it('toRgbString', () => expect(a.toRgbString()).toBe('rgb(61 122 159 / 0.5)'));
  it('toHslString', () => expect(a.toHslString()).toBe('hsl(202.65 44.55% 43.14% / 0.5)'));
  it('toHsvString', () => expect(a.toHsvString()).toBe('hsv(202.65 61.64% 62.35% / 0.5)'));
  it('toHwbString', () => expect(a.toHwbString()).toBe('hwb(203 24% 38% / 0.5)'));
  it('toOklabString', () => expect(a.toOklabString()).toBe('oklab(0.5548 -0.0457 -0.0722 / 0.5)'));
  it('toOklchString', () => expect(a.toOklchString()).toBe('oklch(0.5548 0.0855 237.6561 / 0.5)'));
  it('toLabString', () => expect(a.toLabString()).toBe('lab(48.38 -11.65 -26.34 / 0.5)'));
  it('toLchString', () => expect(a.toLchString()).toBe('lch(48.38 28.8 246.13 / 0.5)'));
  it('toCmykString', () => expect(a.toCmykString()).toBe('device-cmyk(61.64% 23.27% 0% 37.65% / 0.5)'));
  it('toP3String', () => expect(a.toP3String()).toBe('color(display-p3 0.2994 0.4728 0.6102 / 0.5)'));
});

// Sentinel pin: if anyone re-introduces legacy comma syntax for rgb/hsl/hsv,
// these explicit assertions catch it (the assertions above do too, but these
// state the no-comma rule directly so the intent is searchable).
describe('output format — no legacy comma syntax', () => {
  it('toRgbString never contains a comma', () => expect(o.toRgbString()).not.toMatch(/,/));
  it('toHslString never contains a comma', () => expect(o.toHslString()).not.toMatch(/,/));
  it('toHsvString never contains a comma', () => expect(o.toHsvString()).not.toMatch(/,/));
  it('toRgbString with alpha never contains a comma', () => expect(a.toRgbString()).not.toMatch(/,/));
  it('toHslString with alpha never contains a comma', () => expect(a.toHslString()).not.toMatch(/,/));
  it('rgb output never uses the rgba() function name', () => expect(a.toRgbString()).not.toMatch(/^rgba/));
  it('hsl output never uses the hsla() function name', () => expect(a.toHslString()).not.toMatch(/^hsla/));
  it('hsv output never uses the hsva() function name', () => expect(a.toHsvString()).not.toMatch(/^hsva/));
});

// Pin: lab/lch L must NOT carry a `%` (CSS Color 4 allows either; we picked the shorter form).
describe('output format — lab/lch L without %', () => {
  it('toLabString L is bare number', () => expect(o.toLabString()).toMatch(/^lab\(\d+(\.\d+)? /));
  it('toLchString L is bare number', () => expect(o.toLchString()).toMatch(/^lch\(\d+(\.\d+)? /));
});

describe('toRgbString legacy option — CSS Color 3 comma syntax', () => {
  it('opaque: rgb(r, g, b)', () => expect(o.toRgbString({ legacy: true })).toBe('rgb(61, 122, 159)'));
  it('with alpha: rgba(r, g, b, a)', () =>
    expect(a.toRgbString({ legacy: true })).toBe('rgba(61, 122, 159, 0.5)'));
  it('alpha=0 still uses rgba()', () => {
    const a0 = colordx({ r: 0, g: 0, b: 0, alpha: 0 }) as unknown as WithStrings;
    expect(a0.toRgbString({ legacy: true })).toBe('rgba(0, 0, 0, 0)');
  });
  it('legacy: false behaves like default modern syntax', () => {
    expect(o.toRgbString({ legacy: false })).toBe(o.toRgbString());
    expect(a.toRgbString({ legacy: false })).toBe(a.toRgbString());
  });
  it('the library still parses its own legacy output back', () => {
    expect(colordx(o.toRgbString({ legacy: true })).toHex()).toBe(opaque.toHex());
    expect(colordx(a.toRgbString({ legacy: true })).toHex8()).toBe(alpha.toHex8());
  });
  it('default (no options) remains modern', () => {
    expect(o.toRgbString()).toBe('rgb(61 122 159)');
    expect(a.toRgbString()).toBe('rgb(61 122 159 / 0.5)');
  });
});

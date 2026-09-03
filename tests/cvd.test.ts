import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import cvd, { type CvdType } from '../src/plugins/cvd.js';
import lab from '../src/plugins/lab.js';
import fixture from './fixtures/daltonlens.json';

// Reference values generated with daltonlens 0.1 (Python): Simulator_Machado2009 at severity 1.0 for
// protan/deutan, Simulator_Brettel1997(LMSModel_sRGB_SmithPokorny75) for tritan. See thresholds.md.
const types: CvdType[] = ['protanopia', 'deuteranopia', 'tritanopia'];
const ref = fixture as unknown as Record<'input' | CvdType, [number, number, number][]>;

beforeAll(() => extend([cvd, lab]));

describe('cvd plugin: parity with DaltonLens', () => {
  for (const type of types) {
    it(`${type} matches within one byte on ${ref.input.length} colors`, () => {
      ref.input.forEach(([r, g, b], i) => {
        const got = colordx({ r, g, b }).simulate(type).toRgb();
        const [er, eg, eb] = ref[type][i]!;
        expect(Math.abs(got.r - er)).toBeLessThanOrEqual(1);
        expect(Math.abs(got.g - eg)).toBeLessThanOrEqual(1);
        expect(Math.abs(got.b - eb)).toBeLessThanOrEqual(1);
      });
    });
  }

  it('pins the classic primaries', () => {
    expect(colordx('#ff0000').simulate('protanopia').toHex()).toBe('#6d5f00');
    expect(colordx('#ff0000').simulate('deuteranopia').toHex()).toBe('#a39000');
    expect(colordx('#0000ff').simulate('tritanopia').toHex()).toBe('#006087');
  });
});

describe('cvd plugin: properties', () => {
  it('leaves greys alone', () => {
    for (const hex of ['#000000', '#808080', '#ffffff'])
      for (const type of types) expect(colordx(hex).simulate(type).toHex()).toBe(hex);
  });

  it('keeps alpha', () => {
    expect(colordx('rgba(255, 0, 0, 0.5)').simulate('protanopia').alpha()).toBe(0.5);
  });

  it('maps wide-gamut input into sRGB first', () => {
    const wide = 'oklch(0.8 0.3 145)';
    const mapped = colordx(wide).mapSrgb();
    expect(colordx(wide).simulate('deuteranopia').toHex()).toBe(mapped.simulate('deuteranopia').toHex());
  });

  it('rejects an unknown type', () => {
    expect(() => colordx('#f00').simulate('achromatopsia' as CvdType)).toThrow(RangeError);
  });

  it('tritan is continuous across the half-plane split', () => {
    // linear (0.50, 0.70, 0) lies on the plane; these two neighbours straddle it
    const a = colordx('#bcda00').simulate('tritanopia');
    const b = colordx('#bcdb00').simulate('tritanopia');
    expect(a.delta(b, 6) * 100).toBeLessThan(1);
  });

  it('pinned status pairs collapse per thresholds.md (ΔE2000 >= 15 normal, < 15 simulated, any one type)', () => {
    const collapses = (a: string, b: string) =>
      colordx(a).delta(b, 6) * 100 >= 15 &&
      types.some((type) => colordx(a).simulate(type).delta(colordx(b).simulate(type), 6) * 100 < 15);
    const pinned: [string, string, string, boolean][] = [
      ['Bootstrap', '#dc3545', '#198754', true],
      ['Material', '#d32f2f', '#388e3c', true],
      ['Tailwind', '#f97316', '#22c55e', true],
      ['Tailwind', '#eab308', '#22c55e', true],
      ['Okabe-Ito', '#d55e00', '#009e73', false],
      ['IBM', '#dc267f', '#648fff', false],
      ['Teal/orange', '#0d9488', '#f97316', false],
      ['Bootstrap', '#ffc107', '#198754', false],
    ];
    for (const [name, a, b, expected] of pinned) expect(collapses(a, b), `${name} ${a}/${b}`).toBe(expected);
  });
});

describe('delta() precision', () => {
  it('rounds to 3 decimals by default and accepts a precision', () => {
    expect(colordx('#ef4444').delta('#10b981')).toBe(0.715);
    expect(colordx('#ef4444').delta('#10b981', 5)).toBe(0.71465);
    expect(colordx('#ef4444').delta(colordx('#10b981'), 5)).toBe(0.71465);
  });
});

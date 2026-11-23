import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
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
      for (const type of [...types, 'achromatopsia'] as CvdType[])
        for (const severity of [1, 0.5, 0.25]) expect(colordx(hex).simulate(type, severity).toHex()).toBe(hex);
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
    expect(() => colordx('#f00').simulate('tetrachromacy' as CvdType)).toThrow(
      new RangeError('simulate: unknown type "tetrachromacy"')
    );
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

describe('cvd plugin: severity', () => {
  const all: CvdType[] = ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];
  const SAMPLES = ['#ff0000', '#00ff00', '#0000ff', '#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6'];
  const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const enc = (v: number): number => {
    const c = Math.min(1, Math.max(0, v));
    return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255);
  };
  const apply = (m: number[], hex: string): [number, number, number] => {
    const { r, g, b } = colordx(hex).toRgb();
    const [lr, lg, lb] = [lin(r / 255), lin(g / 255), lin(b / 255)];
    return [
      enc(m[0]! * lr + m[1]! * lg + m[2]! * lb),
      enc(m[3]! * lr + m[4]! * lg + m[5]! * lb),
      enc(m[6]! * lr + m[7]! * lg + m[8]! * lb),
    ];
  };
  const bytes = (c: ReturnType<typeof colordx>): [number, number, number] => {
    const { r, g, b } = c.toRgb();
    return [r, g, b];
  };

  // Machado, Oliveira & Fernandes 2009, the published matrices at severity 0.5.
  const PROT_05 = [0.458064, 0.679578, -0.137642, 0.092785, 0.846313, 0.060902, -0.007494, -0.016807, 1.024301];
  const DEUT_05 = [0.547494, 0.607765, -0.155259, 0.181692, 0.781742, 0.036566, -0.01041, 0.027275, 0.983136];

  it('defaults to full severity', () => {
    for (const hex of SAMPLES)
      for (const type of all) expect(colordx(hex).simulate(type, 1).toHex()).toBe(colordx(hex).simulate(type).toHex());
  });

  it('returns the color unchanged at severity 0', () => {
    for (const hex of SAMPLES) for (const type of all) expect(colordx(hex).simulate(type, 0).toHex()).toBe(hex);
  });

  it('uses the published Machado matrix at a tabulated severity', () => {
    for (const hex of SAMPLES) {
      expect(bytes(colordx(hex).simulate('protanopia', 0.5))).toEqual(apply(PROT_05, hex));
      expect(bytes(colordx(hex).simulate('deuteranopia', 0.5))).toEqual(apply(DEUT_05, hex));
    }
  });

  it('interpolates between the tabulated Machado matrices', () => {
    const PROT_04 = [0.539009, 0.579343, -0.118352, 0.082546, 0.866121, 0.051332, -0.007136, -0.011959, 1.019095];
    const mid = PROT_04.map((v, i) => (v + PROT_05[i]!) / 2);
    for (const hex of SAMPLES) expect(bytes(colordx(hex).simulate('protanopia', 0.45))).toEqual(apply(mid, hex));
  });

  it('moves steadily from the color to its full simulation', () => {
    for (const type of all) {
      const full = colordx('#ff0000').simulate(type);
      let last = Infinity;
      for (const severity of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
        const d = colordx('#ff0000').simulate(type, severity).delta(full, 6);
        expect(d).toBeLessThanOrEqual(last);
        last = d;
      }
      expect(last).toBe(0);
    }
  });

  it('blends tritanopia and achromatopsia with the color in linear light, before clipping', () => {
    let checked = 0;
    for (const type of ['tritanopia', 'achromatopsia'] as CvdType[]) {
      for (const hex of SAMPLES) {
        const full = bytes(colordx(hex).simulate(type));
        // A channel the full simulation clipped hides how far outside [0, 1] it went.
        if (full.some((v) => v === 0 || v === 255)) continue;
        const from = bytes(colordx(hex)).map((v) => lin(v / 255));
        const to = full.map((v) => lin(v / 255));
        const half = bytes(colordx(hex).simulate(type, 0.5));
        half.forEach((v, i) => expect(Math.abs(v - enc((from[i]! + to[i]!) / 2))).toBeLessThanOrEqual(1));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('blends achromatopsia exactly like the half-strength luminance matrix', () => {
    const Y = [0.2126, 0.7152, 0.0722];
    const half = [0, 1, 2].flatMap((row) => Y.map((y, col) => y / 2 + (row === col ? 0.5 : 0)));
    for (const hex of SAMPLES) expect(bytes(colordx(hex).simulate('achromatopsia', 0.5))).toEqual(apply(half, hex));
  });

  it('clamps severity to [0, 1] and reads NaN as 0', () => {
    for (const type of all) {
      expect(colordx('#3b82f6').simulate(type, 5).toHex()).toBe(colordx('#3b82f6').simulate(type).toHex());
      expect(colordx('#3b82f6').simulate(type, -5).toHex()).toBe('#3b82f6');
      expect(colordx('#3b82f6').simulate(type, NaN).toHex()).toBe('#3b82f6');
    }
  });
});

describe('cvd plugin: achromatopsia', () => {
  it('gives a grey with the relative luminance of the color', () => {
    extend([a11y]);
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#3b82f6', '#f59e0b']) {
      const grey = colordx(hex).simulate('achromatopsia');
      const { r, g, b } = grey.toRgb();
      expect(r).toBe(g);
      expect(g).toBe(b);
      expect(grey.luminance(2)).toBeCloseTo(colordx(hex).luminance(2), 2);
    }
  });

  it('pins the primaries', () => {
    expect(colordx('#ff0000').simulate('achromatopsia').toHex()).toBe('#7f7f7f');
    expect(colordx('#00ff00').simulate('achromatopsia').toHex()).toBe('#dcdcdc');
    expect(colordx('#0000ff').simulate('achromatopsia').toHex()).toBe('#4c4c4c');
  });

  it('keeps alpha and maps wide-gamut input first', () => {
    expect(colordx('rgba(255, 0, 0, 0.5)').simulate('achromatopsia', 0.5).alpha()).toBe(0.5);
    const wide = 'oklch(0.8 0.3 145)';
    expect(colordx(wide).simulate('achromatopsia').toHex()).toBe(colordx(wide).mapSrgb().simulate('achromatopsia').toHex());
  });
});

import { describe, expect, it } from 'vitest';
import { Colordx, colordx, extend, inGamutSrgb, nearest } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import a98rgb, { inGamutA98 } from '../src/plugins/a98rgb.js';
import lab from '../src/plugins/lab.js';
import mix from '../src/plugins/mix.js';
import p3, { inGamutP3 } from '../src/plugins/p3.js';
import prophoto, { inGamutProphoto } from '../src/plugins/prophoto.js';
import rec2020, { inGamutRec2020 } from '../src/plugins/rec2020.js';

extend([a11y, a98rgb, lab, mix, p3, prophoto, rec2020]);

const inputs = [
  '#ff0000',
  'oklch(0.5 0.1 30)',
  'oklch(0.64 0.27 29)',
  'oklch(0.7 0.25 150)',
  'oklch(0.5 0.4 180)',
  'oklch(1.000716 0.1804 203.47)',
  'oklch(-0.0006 0.41 207)',
  'lab(50 100 0)',
  'color(display-p3 1 0 0)',
  'color(rec2020 0 1 0)',
];

const gamuts = [
  { name: 'sRGB', inGamut: inGamutSrgb, toGamut: (c: string | Colordx) => Colordx.toGamutSrgb(c) },
  { name: 'P3', inGamut: inGamutP3, toGamut: (c: string | Colordx) => Colordx.toGamutP3(c) },
  { name: 'Rec.2020', inGamut: inGamutRec2020, toGamut: (c: string | Colordx) => Colordx.toGamutRec2020(c) },
  { name: 'A98', inGamut: inGamutA98, toGamut: (c: string | Colordx) => Colordx.toGamutA98(c) },
  { name: 'ProPhoto', inGamut: inGamutProphoto, toGamut: (c: string | Colordx) => Colordx.toGamutProphoto(c) },
];

describe('gamut helpers accept a Colordx instance', () => {
  for (const { name, inGamut, toGamut } of gamuts) {
    it(`inGamut ${name}: an instance reads like its source`, () => {
      for (const s of inputs) expect(inGamut(colordx(s)), s).toBe(inGamut(s));
    });

    it(`toGamut ${name}: an instance maps like its source`, () => {
      for (const s of inputs) expect(toGamut(colordx(s)).toHex(), s).toBe(toGamut(s).toHex());
    });

    it(`toGamut ${name}: the result of mapping an instance is in gamut`, () => {
      for (const s of inputs) expect(inGamut(toGamut(colordx(s))), s).toBe(true);
    });

    it(`${name}: an invalid instance is in no gamut and maps to an invalid color`, () => {
      expect(inGamut(colordx('not-a-color'))).toBe(false);
      expect(toGamut(colordx('not-a-color')).isValid()).toBe(false);
    });
  }

  it('mapSrgb() and Colordx.toGamutSrgb(instance) agree', () => {
    const c = colordx('oklch(0.5 0.4 180)');
    expect(Colordx.toGamutSrgb(c).toOklchString()).toBe(c.mapSrgb().toOklchString());
  });
});

describe('two-color methods accept a Colordx instance', () => {
  const a = '#3b82f6';
  const b = 'oklch(0.5 0.4 180)';

  it('reads an instance like its source', () => {
    expect(colordx(a).isEqual(colordx(a))).toBe(true);
    expect(colordx(a).mixLab(colordx(b)).toHex()).toBe(colordx(a).mixLab(b).toHex());
    expect(
      colordx(a)
        .palette(3, colordx(b))
        .map((c) => c.toHex())
    ).toEqual(
      colordx(a)
        .palette(3, b)
        .map((c) => c.toHex())
    );
    expect(nearest(colordx(b), ['#f00', '#0f0'])).toBe(nearest(b, ['#f00', '#0f0']));
    const candidates = [colordx('#f00'), colordx('#00f')];
    expect(nearest(a, candidates)).toBe(candidates[1]);
  });

  it('names an invalid instance without printing its private fields', () => {
    expect(() => colordx(a).contrast(colordx('nope'))).toThrow(
      new RangeError('contrast: the Colordx passed in is invalid')
    );
    expect(() => nearest(colordx('nope'), [a])).toThrow(new RangeError('nearest: the Colordx passed in is invalid'));
  });
});

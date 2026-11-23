import {
  converter,
  fixupHueDecreasing,
  fixupHueIncreasing,
  fixupHueLonger,
  fixupHueShorter,
  interpolate,
} from 'culori';
import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import mix from '../src/plugins/mix.js';
import type { HueMethod } from '../src/plugins/mix.js';

beforeAll(() => extend([mix]));

const FIXUPS: Record<HueMethod, (hues: number[]) => number[]> = {
  shorter: fixupHueShorter,
  longer: fixupHueLonger,
  increasing: fixupHueIncreasing,
  decreasing: fixupHueDecreasing,
};
const COLORS = [
  '#ff0000',
  '#0000ff',
  '#00ff00',
  '#3498db',
  '#fedcba',
  '#123456',
  '#808080',
  '#ffffff',
  '#000000',
  '#8a2be2',
  '#ffff00',
];
const toOklch = converter('oklch');
const cartesian = (c: { l: number; c?: number; h?: number }): [number, number, number] => {
  const h = ((c.h ?? 0) * Math.PI) / 180;
  return [c.l, (c.c ?? 0) * Math.cos(h), (c.c ?? 0) * Math.sin(h)];
};

describe('mixOklch: parity with culori', () => {
  for (const method of Object.keys(FIXUPS) as HueMethod[]) {
    it(`${method} hue matches culori's oklch interpolation`, () => {
      let worst = 0;
      for (const a of COLORS) {
        for (const b of COLORS) {
          for (const t of [0, 0.25, 0.5, 0.8, 1]) {
            const ref = interpolate([a, b], 'oklch', { h: { fixup: FIXUPS[method] } })(t);
            const got = toOklch(colordx(a).mixOklch(b, t, { hue: method }).toOklchString(12))!;
            const [l1, a1, b1] = cartesian(ref);
            const [l2, a2, b2] = cartesian(got);
            worst = Math.max(worst, Math.hypot(l1 - l2, a1 - a2, b1 - b2));
          }
        }
      }
      expect(worst).toBeLessThan(1e-9);
    });
  }
});

describe('mixOklch: hue methods', () => {
  const red = colordx('#ff0000');
  const hue = (method?: HueMethod) => red.mixOklch('#0000ff', 0.5, method && { hue: method }).toOklch(3).h;

  it('takes the shorter arc by default', () => {
    expect(hue()).toBe(326.643);
    expect(hue('shorter')).toBe(326.643);
  });

  it('takes the other arc with longer', () => {
    expect(hue('longer')).toBe(146.643);
  });

  it('only ever raises the hue with increasing, and lowers it with decreasing', () => {
    expect(hue('increasing')).toBe(146.643);
    expect(hue('decreasing')).toBe(326.643);
    const back = colordx('#0000ff');
    expect(back.mixOklch('#ff0000', 0.5, { hue: 'increasing' }).toOklch(3).h).toBe(326.643);
    expect(back.mixOklch('#ff0000', 0.5, { hue: 'decreasing' }).toOklch(3).h).toBe(146.643);
  });

  it('does not turn a full circle between two equal hues, whatever the method', () => {
    for (const method of Object.keys(FIXUPS) as HueMethod[]) {
      expect(red.mixOklch('#ff0000', 0.5, { hue: method }).toHex()).toBe('#ff0000');
    }
  });

  it('throws a RangeError naming an unknown method', () => {
    expect(() => red.mixOklch('#0000ff', 0.5, { hue: 'sideways' as HueMethod })).toThrow(
      new RangeError('mixOklch: unknown hue method "sideways"')
    );
  });
});

describe('mixOklch: lightness, chroma and alpha', () => {
  it('keeps chroma through the mix, where mixOklab cuts across the middle', () => {
    const polar = colordx('#ff0000').mixOklch('#0000ff').toOklch(4);
    const flat = colordx('#ff0000').mixOklab('#0000ff').toOklch(4);
    expect(polar.c).toBe(0.2854);
    expect(flat.c).toBeLessThan(0.2);
    expect(polar.l).toBe(flat.l);
  });

  it('returns each end at ratio 0 and 1, and clamps the ratio', () => {
    expect(colordx('#ff0000').mixOklch('#0000ff', 0).toHex()).toBe('#ff0000');
    expect(colordx('#ff0000').mixOklch('#0000ff', 1).toHex()).toBe('#0000ff');
    expect(colordx('#ff0000').mixOklch('#0000ff', -3).toHex()).toBe('#ff0000');
    expect(colordx('#ff0000').mixOklch('#0000ff', 7).toHex()).toBe('#0000ff');
  });

  it('gives an achromatic color the hue of the other one', () => {
    expect(colordx('#808080').mixOklch('#0000ff').toOklch(3).h).toBe(colordx('#0000ff').toOklch(3).h);
    expect(colordx('#0000ff').mixOklch('#ffffff').toOklch(3).h).toBe(colordx('#0000ff').toOklch(3).h);
    expect(colordx('#000000').mixOklch('#ffffff').toHex()).toBe('#636363');
  });

  it('premultiplies lightness and chroma by alpha but not hue, like color-mix()', () => {
    const mixed = colordx('rgba(255, 0, 0, 0)').mixOklch('#0000ff');
    const blue = colordx('#0000ff').toOklch(5);
    expect(mixed.alpha()).toBe(0.5);
    expect(mixed.toOklch(5).l).toBe(blue.l);
    expect(mixed.toOklch(5).c).toBe(blue.c);
    expect(mixed.toOklch(3).h).toBe(326.643);
  });

  it('keeps a wide-gamut result unclamped', () => {
    expect(colordx('oklch(0.7 0.3 150)').mixOklch('oklch(0.7 0.3 210)').toOklchString()).toBe('oklch(0.7 0.3 180)');
  });

  it('throws a RangeError on an invalid color', () => {
    expect(() => colordx('#f00').mixOklch('nope')).toThrow(new RangeError('mixOklch: "nope" is not a valid color'));
    expect(() => colordx('nope').mixOklch('#f00')).toThrow(new RangeError('mixOklch: this color is invalid'));
  });
});

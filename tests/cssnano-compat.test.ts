/**
 * cssnano compatibility tests.
 *
 * postcss-colormin and postcss-minify-gradients use @colordx/core to:
 *   1. Detect whether a CSS token is a color (isValid).
 *   2. Parse modern CSS color formats (oklch, oklab, hwb, space-separated rgb/hsl).
 *   3. Produce lossless output — the chosen representation must round-trip back to
 *      the same 8-bit RGB bytes it came from.
 *   4. Output HSL with sufficient decimal precision to avoid byte-level rounding loss.
 *
 * Each test is annotated with the cssnano file it covers.
 */
import { describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import hwb from '../src/plugins/hwb.js';
import minify from '../src/plugins/minify.js';
import names from '../src/plugins/names.js';

// Mirror the plugin set cssnano's minifyColor loads
extend([hwb, names, minify]);

const min = (input: string, options?: Parameters<ReturnType<typeof colordx>['minify']>[0]): string =>
  (colordx(input) as any).minify({ alphaHex: false, transparent: true, name: true, ...options });

// postcss-minify-gradients/src/isColorStop.js calls colordx(value).isValid()
// to decide whether a gradient token is a color stop.

describe('cssnano — color recognition (isValid)', () => {
  describe('valid: hex', () => {
    it('#fff', () => expect(colordx('#fff').isValid()).toBe(true));
    it('#ff0000', () => expect(colordx('#ff0000').isValid()).toBe(true));
    it('#ff000080', () => expect(colordx('#ff000080').isValid()).toBe(true));
  });

  describe('valid: legacy functional', () => {
    it('rgb(255,0,0)', () => expect(colordx('rgb(255,0,0)').isValid()).toBe(true));
    it('rgba(255,0,0,0.5)', () => expect(colordx('rgba(255,0,0,0.5)').isValid()).toBe(true));
    it('hsl(0,100%,50%)', () => expect(colordx('hsl(0,100%,50%)').isValid()).toBe(true));
    it('hsla(0,100%,50%,0.5)', () => expect(colordx('hsla(0,100%,50%,0.5)').isValid()).toBe(true));
  });

  describe('valid: CSS Color 4 space-separated syntax', () => {
    it('rgb(255 0 0)', () => expect(colordx('rgb(255 0 0)').isValid()).toBe(true));
    it('rgb(255 0 0 / 0.5)', () => expect(colordx('rgb(255 0 0 / 0.5)').isValid()).toBe(true));
    it('hsl(0 100% 50%)', () => expect(colordx('hsl(0 100% 50%)').isValid()).toBe(true));
    it('hsl(0 100% 50% / 0.5)', () => expect(colordx('hsl(0 100% 50% / 0.5)').isValid()).toBe(true));
  });

  describe('valid: modern color spaces (previously broken with colord)', () => {
    it('oklch(0.5 0.2 240)', () => expect(colordx('oklch(0.5 0.2 240)').isValid()).toBe(true));
    it('oklab(0.5 0.1 -0.2)', () => expect(colordx('oklab(0.5 0.1 -0.2)').isValid()).toBe(true));
    it('hwb(120 0% 0%)', () => expect(colordx('hwb(120 0% 0%)').isValid()).toBe(true));
    it('lch(50 100 30)', () => expect(colordx('lch(50 100 30)').isValid()).toBe(false)); // lch plugin not loaded
  });

  describe('valid: named + special', () => {
    it('red', () => expect(colordx('red').isValid()).toBe(true));
    it('transparent', () => expect(colordx('transparent').isValid()).toBe(true));
  });

  describe('invalid: CSS keywords that are not colors', () => {
    it('inherit', () => expect(colordx('inherit').isValid()).toBe(false));
    it('currentColor', () => expect(colordx('currentColor').isValid()).toBe(false));
    it('none', () => expect(colordx('none').isValid()).toBe(false));
    it('notacolor', () => expect(colordx('notacolor').isValid()).toBe(false));
    it('empty string', () => expect(colordx('').isValid()).toBe(false));
  });
});

// postcss-colormin passes the whole color string to minifyColor, which calls
// colordx(str).toHex() / toRgb() / toHsl() to find the shortest sRGB form.
// These tests verify that modern syntax parses to the correct sRGB values.

describe('cssnano — modern CSS format parsing', () => {
  describe('space-separated rgb() — minify() output matches cssnano', () => {
    it('rgb(255 0 0) → red', () => expect(min('rgb(255 0 0)')).toBe('red'));
    it('rgb(0 0 0) → #000', () => expect(min('rgb(0 0 0)')).toBe('#000'));
    it('rgb(255 255 255) → #fff', () => expect(min('rgb(255 255 255)')).toBe('#fff'));
    it('rgb(255 0 0 / 0.5) → rgba(255,0,0,.5)', () => expect(min('rgb(255 0 0 / 0.5)')).toBe('rgba(255,0,0,.5)'));
    it('rgb(255 0 0 / 50%) → rgba(255,0,0,.5)', () => expect(min('rgb(255 0 0 / 50%)')).toBe('rgba(255,0,0,.5)'));
  });

  describe('space-separated hsl() — minify() output matches cssnano', () => {
    it('hsl(0 100% 50%) → red', () => expect(min('hsl(0 100% 50%)')).toBe('red'));
    it('hsl(0 100% 50% / 0.5) → rgba(255,0,0,.5)', () => expect(min('hsl(0 100% 50% / 0.5)')).toBe('rgba(255,0,0,.5)'));
  });

  describe('oklch — minify() produces shortest sRGB form', () => {
    // red in oklch — 'red' (3) is shorter than '#f00' (4)
    it('oklch(0.6279 0.2577 29.23) → red', () => expect(min('oklch(0.6279 0.2577 29.23)')).toBe('red'));
  });

  // Hex would clip these, and a wide-gamut display renders the original, so they stay oklch().
  describe('outside sRGB — minify() keeps the color as oklch()', () => {
    it('oklch(0.5 0.2 240) → oklch(.5 .2 240)', () => expect(min('oklch(0.5 0.2 240)')).toBe('oklch(.5 .2 240)'));
    it('keeps alpha', () => expect(min('oklch(0.5 0.2 240 / 0.5)')).toBe('oklch(.5 .2 240 / .5)'));
    it('oklab(0.5 0.4 0) → oklch(.5 .4 0)', () => expect(min('oklab(0.5 0.4 0)')).toBe('oklch(.5 .4 0)'));
    it('never picks hex, rgb, hsl or a name', () => {
      for (const s of ['oklch(0.7 0.3 150)', 'oklab(0.5 0.4 0)', 'color(srgb 1.2 0 0)']) {
        expect(min(s)).toMatch(/^oklch\(/);
      }
    });
  });

  describe('oklab — minify() produces shortest sRGB form', () => {
    it('oklab(0.5 0.1 -0.2) → #7532d0', () => expect(min('oklab(0.5 0.1 -0.2)')).toBe('#7532d0'));
  });

  describe('hwb — minify() produces shortest sRGB form', () => {
    it('hwb(120 0% 0%) → #0f0', () => expect(min('hwb(120 0% 0%)')).toBe('#0f0'));
    it('hwb(0 0% 0%) → red', () => expect(min('hwb(0 0% 0%)')).toBe('red'));
    it('hwb(240 0% 0%) → #00f', () => expect(min('hwb(240 0% 0%)')).toBe('#00f'));
  });
});

// postcss-colormin calls minify() and the result must parse back to the same
// 8-bit RGB bytes as the input. These catch regressions that cause cssnano to
// produce lossy output for real-world CSS.
//
// Reference: https://github.com/cssnano/cssnano/issues/1515

describe('cssnano — lossless round-trip via minify()', () => {
  const cases: [string, number, number, number][] = [
    // bootstrap-v4.2.1 — previously rounded to integer HSL, breaking round-trip
    ['rgba(130, 138, 145, 0.5)', 130, 138, 145],
    ['rgba(216, 217, 219, 0.5)', 216, 217, 219],
    ['rgba(108, 117, 125, 0.5)', 108, 117, 125],
    // foundation-v6.5.3 — near-white but not 100% lightness
    ['rgba(254, 254, 254, 0.25)', 254, 254, 254],
    // picnic-v6.4.0 — 7% HSL rounds to rgb(18) ≠ rgb(17)
    ['rgba(17, 17, 17, 0.1)', 17, 17, 17],
    ['rgba(17, 17, 17, 0.2)', 17, 17, 17],
    ['rgba(17, 17, 17, 0.3)', 17, 17, 17],
    ['rgba(17, 17, 17, 0.6)', 17, 17, 17],
    // modern space-separated syntax (cssnano issue #1515)
    ['rgb(143 101 98 / 43%)', 143, 101, 98],
    ['rgba(221, 221, 221, 0.5)', 221, 221, 221],
  ];

  for (const [input, expectedR, expectedG, expectedB] of cases) {
    it(`${input} — minify() round-trips to same RGB bytes`, () => {
      const result = min(input);
      const { r, g, b } = colordx(result).toRgb();
      expect(r).toBe(expectedR);
      expect(g).toBe(expectedG);
      expect(b).toBe(expectedB);
    });
  }
});

// cssnano compares hsl/hsla output length against hex/rgba to pick the shortest.
// Integer HSL (e.g. 87%) can round-trip to the wrong byte; decimal HSL (86.7%)
// is both more accurate and can still be shorter than rgba.

describe('cssnano — HSL decimal precision', () => {
  // 221/255 = 86.666...% → must be 86.7%, not 87% (87% → 221.85 → rounds to 222)
  it('rgba(221,221,221) HSL lightness is 86.7%, not 87%', () => {
    expect(colordx('rgb(221, 221, 221)').toHsl().l).toBeCloseTo(86.7, 1);
  });

  // semantic-ui: 100/255 = 39.215...% → must be 39.2%, not 39% (39% → 99.45 → rounds to 99)
  it('rgb(100,100,100) HSL lightness is 39.2%, not 39%', () => {
    expect(colordx('rgb(100, 100, 100)').toHsl().l).toBeCloseTo(39.2, 1);
  });

  // semantic-ui: 225/255 = 88.235...% → must be 88.2%, not 88%
  it('rgb(225,225,225) HSL lightness is 88.2%, not 88%', () => {
    expect(colordx('rgb(225, 225, 225)').toHsl().l).toBeCloseTo(88.2, 1);
  });

  // foundation: 254/255 = 99.608...% → must not be rounded to 100%
  it('rgb(254,254,254) HSL lightness is ~99.6%, not 100%', () => {
    expect(colordx('rgb(254, 254, 254)').toHsl().l).toBeLessThan(100);
    expect(colordx('rgb(254, 254, 254)').toHsl().l).toBeGreaterThan(99.5);
  });
});


describe('cssnano — hsl() with an inexact half-byte channel stays hsl()', () => {
  it('hsl(220,80%,50%) → hsl(220,80%,50%) (green 93.50000000000013)', () =>
    expect(min('hsl(220, 80%, 50%)')).toBe('hsl(220,80%,50%)'));
  it('hsl(320,80%,50%) → hsl(320,80%,50%) (blue 161.50000000000006)', () =>
    expect(min('hsl(320, 80%, 50%)')).toBe('hsl(320,80%,50%)'));
  it('hsl(134,50%,50%) → hsl(134,50%,50%) (blue 93.50000000000001)', () =>
    expect(min('hsl(134, 50%, 50%)')).toBe('hsl(134,50%,50%)'));
  it('hsla keeps its alpha', () => expect(min('hsla(220, 80%, 50%, 0.5)')).toBe('hsla(220,80%,50%,.5)'));
  it('the gate wins over hsl: false, since hex would already have picked a side', () =>
    expect(min('hsl(220, 80%, 50%)', { hsl: false })).toBe('hsl(220,80%,50%)'));
  it('an exact tie still minifies to bytes: WPT pins it to round half up in every engine', () => {
    expect(min('hsl(270, 100%, 50%)')).toBe('#8000ff');
    expect(min('hsl(20, 100%, 55%)')).toBe('#ff661a');
    expect(min('hsl(270, 80%, 50%)')).toBe('#801ae6');
    expect(min('hsl(0, 0%, 50%)')).toBe('gray');
    expect(min('rgba(50%, 50%, 50%, 0.5)', { hsl: false })).toBe('rgba(128,128,128,.5)');
    expect(min('hwb(120 30% 50%)')).toBe('#4d804d');
    expect(min('hwb(120 33% 50%)')).toBe('#548054');
  });
  it('a color whose channels are not ties still minifies to hex / name', () => {
    expect(min('hsl(0, 100%, 50%)')).toBe('red');
    expect(min('hsl(210, 100%, 40%)')).toBe('#06c');
    expect(min('hsl(0, 0%, 50.2%)')).toBe('gray');
  });
  it('hwb(2 8% 32%) → rgb(173.4,25.5,20.4) when no hsl() is exact', () => {
    expect(min('hwb(2 8% 32%)')).toBe('rgb(173.4,25.5,20.4)');
    expect(min('hwb(2 8% 32% / 0.5)')).toBe('rgba(173.4,25.5,20.4,.5)');
    expect(min('hwb(2 0% 0%)')).toBe('hsl(2,100%,50%)');
  });
  it('the kept hsl() or rgb() parses back to the very same channels', () => {
    for (const s of ['hsl(220, 80%, 50%)', 'hsl(320, 80%, 50%)', 'hsla(220, 80%, 50%, 0.5)'])
      expect(colordx(min(s))._rawRgb()).toEqual(colordx(s)._rawRgb());
    for (const s of ['hwb(2 8% 32%)', 'hwb(2 8% 32% / 0.5)', 'hwb(2 0% 0%)']) {
      const a = colordx(min(s))._rawRgb(), b = colordx(s)._rawRgb();
      for (const k of ['r', 'g', 'b', 'alpha'] as const) expect(Math.abs(a[k] - b[k]), `${s} ${k}`).toBeLessThan(5e-5);
    }
  });
  it('every inexact-tie hwb() on a grid minifies to an hsl() or rgb() that is exact to 5e-5', () => {
    let gated = 0;
    for (let h = 0; h < 360; h += 8)
      for (let w = 0; w <= 100; w += 6)
        for (let b = 0; b + w <= 100; b += 6) {
          const c = colordx(`hwb(${h} ${w}% ${b}%)`);
          const { r, g, b: bb } = c._rawRgb();
          const inexact = (v: number) => { const d = Math.abs(v - Math.floor(v) - 0.5); return d > 0 && d < 1e-3; };
          if (![r, g, bb].some(inexact)) continue;
          gated++;
          const out = min(c.toHwbString());
          expect(out).toMatch(/^(hsl|rgb)\(/);
          const o = colordx(out)._rawRgb();
          expect(Math.max(Math.abs(o.r - r), Math.abs(o.g - g), Math.abs(o.b - bb)), out).toBeLessThan(5e-5);
        }
    expect(gated).toBeGreaterThan(50);
  });
});

// IE11 / pre-2019 browser safety: minify() must never emit CSS Color 4 modern
// space syntax (rgb(r g b), slash-alpha, `none` keyword). cssnano pipelines feed
// this output directly into output CSS where legacy browsers must still parse it.
// These assertions sweep a variety of sRGB colors and pin that rule.

describe('cssnano — minify() output is IE11-safe (no modern CSS Color 4 syntax)', () => {
  const inputs = [
    '#ff0000',
    '#123456',
    '#abcdef',
    'rgb(255 0 0 / 0.5)',
    'rgb(143 101 98 / 43%)',
    'hsl(220 80% 50%)',
    'hsl(0 100% 50% / 0.25)',
    'oklch(0.5 0.2 240)',
    'hwb(120 0% 0%)',
    'rgba(130, 138, 145, 0.5)',
    'rgba(255, 255, 255, 0)', // transparent
  ];

  for (const input of inputs) {
    it(`${input} — output contains no slash separator or space-only channel list`, () => {
      const out = min(input);
      // Slash-alpha would indicate modern CSS Color 4 form.
      expect(out).not.toMatch(/\//);
      // `rgb(` or `hsl(` without a comma would indicate modern space syntax; accept only
      // if no rgb/hsl open-paren is present at all (hex / name / transparent outputs).
      const isFnForm = /^(rgba?|hsla?)\(/i.test(out);
      if (isFnForm) expect(out).toMatch(/,/);
      // The `none` keyword is CSS Color 4-only and not legacy-safe.
      expect(out).not.toMatch(/\bnone\b/i);
    });
  }
});

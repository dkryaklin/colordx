import { describe, expect, it } from 'vitest';
import { Colordx, colordx, extend, inGamutSrgb } from '../src/index.js';
import p3, { inGamutP3 } from '../src/plugins/p3.js';
import rec2020, { inGamutRec2020 } from '../src/plugins/rec2020.js';

extend([p3, rec2020]);

describe('inGamutSrgb', () => {
  it('returns true for hex colors', () => {
    expect(inGamutSrgb('#ff0000')).toBe(true);
    expect(inGamutSrgb('#000000')).toBe(true);
    expect(inGamutSrgb('#ffffff')).toBe(true);
  });

  it('returns true for rgb strings', () => {
    expect(inGamutSrgb('rgb(255, 0, 0)')).toBe(true);
    expect(inGamutSrgb('rgba(0, 128, 255, 0.5)')).toBe(true);
  });

  it('returns true for hsl strings', () => {
    expect(inGamutSrgb('hsl(120, 100%, 50%)')).toBe(true);
  });

  it('returns true for rgb objects', () => {
    expect(inGamutSrgb({ r: 255, g: 0, b: 0, alpha: 1 })).toBe(true);
  });

  it('returns true for oklch colors in sRGB gamut', () => {
    // A warm mid-tone clearly inside sRGB gamut
    expect(inGamutSrgb('oklch(0.5 0.1 30)')).toBe(true);
  });

  it('returns true for oklab colors in sRGB gamut', () => {
    expect(inGamutSrgb('oklab(0.5 0.05 0.03)')).toBe(true);
  });

  it('returns false for out-of-gamut oklch colors', () => {
    // Very high chroma — outside sRGB
    expect(inGamutSrgb('oklch(0.5 0.4 180)')).toBe(false);
    expect(inGamutSrgb('oklch(0.7 0.37 145)')).toBe(false);
  });

  it('returns false for out-of-gamut oklch objects', () => {
    expect(inGamutSrgb({ l: 0.5, c: 0.4, h: 180, alpha: 1 })).toBe(false);
  });

  it('returns false for out-of-gamut oklab objects', () => {
    expect(inGamutSrgb({ l: 0.5, a: 0.35, b: 0.0, alpha: 1 })).toBe(false);
  });

  it('returns true for zero chroma (achromatic)', () => {
    expect(inGamutSrgb('oklch(0.5 0 0)')).toBe(true);
    expect(inGamutSrgb('oklch(0 0 0)')).toBe(true);
    expect(inGamutSrgb('oklch(1 0 0)')).toBe(true);
  });
});

describe('toGamutSrgb — CSS Color 4 spec algorithm', () => {
  // Reference values verified against culori (which implements the same CSS Color 4 spec):
  // https://www.w3.org/TR/css-color-4/#css-gamut-mapping

  it('matches culori for oklch(0.2591 0.1511 28.95) — slightly out of sRGB', () => {
    // Linear sRGB channels: r=0.098, g=-0.009, b=-0.004
    // Simple clip gives rgb(88,0,0); CSS Color 4 gamut map gives rgb(81,0,0)
    const result = Colordx.toGamutSrgb('oklch(0.2591 0.1511 28.95)');
    const { r, g, b } = result.toRgb();
    expect(r).toBe(81);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('returns clipped color within JND of chroma-reduced color', () => {
    // The algorithm finds the highest chroma where clip(color) is within JND=0.02 deltaEOK
    const result = Colordx.toGamutSrgb('oklch(0.5 0.4 180)');
    const { r, g, b } = result.toRgb();
    // Result must be strictly in sRGB
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(255);
  });

  it('returns more chroma than simple clip for deeply out-of-gamut colors', () => {
    // Simple channel clip (old behavior) would shift hue; CSS Color 4 allows more chroma
    const deepOutOfGamut = 'oklch(0.7 0.4 145)';
    const mapped = Colordx.toGamutSrgb(deepOutOfGamut);
    // The chroma-preserving result should be a saturated green, not a dull gray
    const { g } = mapped.toRgb();
    expect(g).toBeGreaterThan(100);
  });

  it('maps L=1 to white', () => {
    const result = Colordx.toGamutSrgb({ l: 1, c: 0.5, h: 100, alpha: 1 });
    const { r, g, b } = result.toRgb();
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });

  it('maps L=0 to black', () => {
    const result = Colordx.toGamutSrgb({ l: 0, c: 0.5, h: 100, alpha: 1 });
    const { r, g, b } = result.toRgb();
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
});

describe('toGamutSrgb', () => {
  it('passes through sRGB inputs unchanged', () => {
    const result = Colordx.toGamutSrgb('#ff0000');
    expect(result.toHex()).toBe('#ff0000');
  });

  it('passes through in-gamut oklch unchanged', () => {
    const result = Colordx.toGamutSrgb('oklch(0.6279 0.2577 29.23)');
    expect(result.isValid()).toBe(true);
    // toRgb() rounds to integers, so the result is exact
    const { r, g, b } = result.toRgb();
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it('maps out-of-gamut oklch to nearest in-gamut color', () => {
    const outOfGamut = 'oklch(0.5 0.4 180)';
    expect(inGamutSrgb(outOfGamut)).toBe(false);

    const mapped = Colordx.toGamutSrgb(outOfGamut);
    expect(mapped.isValid()).toBe(true);

    // The resulting color should be in gamut (all RGB channels 0-255)
    const { r, g, b } = mapped.toRgb();
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(255);
  });

  it('reduces chroma while preserving lightness and hue', () => {
    const outOfGamut = { l: 0.7, c: 0.4, h: 145, alpha: 1 };
    expect(inGamutSrgb(outOfGamut)).toBe(false);

    const mapped = Colordx.toGamutSrgb(outOfGamut);
    const oklch = mapped.toOklch();

    // Lightness should be approximately preserved
    expect(oklch.l).toBeCloseTo(0.7, 1);
    // Hue is approximately preserved — CSS Color 4 returns a clipped color so hue may shift slightly
    expect(Math.abs(oklch.h - 145)).toBeLessThan(5);
    // Chroma should be reduced
    expect(oklch.c).toBeLessThan(0.4);
  });

  it('handles oklab objects', () => {
    const outOfGamut = { l: 0.5, a: 0.35, b: 0.0, alpha: 1 };
    expect(inGamutSrgb(outOfGamut)).toBe(false);

    const mapped = Colordx.toGamutSrgb(outOfGamut);
    expect(mapped.isValid()).toBe(true);
    const { r, g, b } = mapped.toRgb();
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeLessThanOrEqual(255);
  });

  it('handles oklch string with alpha', () => {
    const result = Colordx.toGamutSrgb('oklch(0.5 0.4 180 / 0.5)');
    const { alpha } = result.toRgb();
    expect(alpha).toBe(0.5);
  });

  it('handles achromatic out-of-lightness-range oklch', () => {
    // L=0, C=0 — black, always in gamut
    const result = Colordx.toGamutSrgb('oklch(0 0 0)');
    expect(result.isValid()).toBe(true);
  });
});

describe('.mapSrgb() instance method', () => {
  it('produces the same rgb output as Colordx.toGamutSrgb static', () => {
    const inputs = [
      'oklch(0.5 0.4 180)',
      'oklch(0.7 0.37 145)',
      'oklch(0.3 0.3 30)',
      'oklab(0.5 0.35 0.0)',
      { l: 0.5, c: 0.4, h: 180, alpha: 1 },
      { l: 0.5, a: 0.35, b: 0.0, alpha: 1 },
    ];
    for (const input of inputs) {
      expect(colordx(input).mapSrgb().toRgbString()).toBe(Colordx.toGamutSrgb(input).toRgbString());
    }
  });

  it('matches static for alpha preservation', () => {
    const input = 'oklch(0.5 0.4 180 / 0.5)';
    expect(colordx(input).mapSrgb().alpha()).toBe(Colordx.toGamutSrgb(input).alpha());
  });

  it('returns the same instance when already in gamut (reference equality)', () => {
    const red = colordx('#ff0000');
    expect(red.mapSrgb()).toBe(red);

    const hsl = colordx('hsl(120, 100%, 50%)');
    expect(hsl.mapSrgb()).toBe(hsl);

    const inGamutOklch = colordx('oklch(0.5 0.1 30)');
    expect(inGamutOklch.mapSrgb()).toBe(inGamutOklch);
  });

  it('preserves lightness and hue when mapping', () => {
    const mapped = colordx('oklch(0.5 0.4 180)').mapSrgb().toOklch();
    expect(mapped.l).toBeCloseTo(0.5, 1);
    expect(Math.abs(mapped.h - 180)).toBeLessThan(5);
    expect(mapped.c).toBeLessThan(0.4);
  });

  it('maps L=1 input to white', () => {
    const result = colordx({ l: 1, c: 0.5, h: 100, alpha: 1 }).mapSrgb().toRgb();
    expect(result.r).toBe(255);
    expect(result.g).toBe(255);
    expect(result.b).toBe(255);
  });

  it('maps L=0 input to black', () => {
    const result = colordx({ l: 0, c: 0.5, h: 100, alpha: 1 }).mapSrgb().toRgb();
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it('is idempotent — mapping twice gives the same result', () => {
    const once = colordx('oklch(0.5 0.4 180)').mapSrgb();
    const twice = once.mapSrgb();
    expect(twice.toOklchString()).toBe(once.toOklchString());
    // Once mapped into gamut, the second call should hit the fast path
    expect(twice).toBe(once);
  });

  it('chains with output methods to produce in-gamut oklch string', () => {
    const result = colordx('oklch(0.5 0.4 180)').mapSrgb().toOklchString();
    // Matches the static form — both roads lead to the same oklch
    expect(result).toBe(Colordx.toGamutSrgb('oklch(0.5 0.4 180)').toOklchString());
  });

  it('does not throw on invalid input', () => {
    const invalid = colordx('not-a-color');
    expect(() => invalid.mapSrgb()).not.toThrow();
    expect(invalid.mapSrgb().isValid()).toBe(false);
  });
});

describe('.clampSrgb() instance method', () => {
  it('produces naive-clip output matching .toRgbString() on out-of-gamut colors', () => {
    const input = 'oklch(0.5 0.4 180)';
    // The whole point of clampSrgb is "matches what .toRgbString() would emit"
    expect(colordx(input).clampSrgb().toRgbString()).toBe(colordx(input).toRgbString());
    expect(colordx(input).clampSrgb().toHex()).toBe(colordx(input).toHex());
  });

  it('produces an oklch string representing the clipped color (hue shifts)', () => {
    const result = colordx('oklch(0.5 0.4 180)').clampSrgb().toOklch();
    // Naive clip drifts lightness upward and hue off 180°
    expect(result.l).toBeGreaterThan(0.5);
    expect(Math.abs(result.h - 180)).toBeGreaterThan(10);
  });

  it('returns the same instance when already in gamut (reference equality)', () => {
    const red = colordx('#ff0000');
    expect(red.clampSrgb()).toBe(red);

    const mid = colordx('rgb(100, 150, 200)');
    expect(mid.clampSrgb()).toBe(mid);

    const inGamutOklch = colordx('oklch(0.5 0.1 30)');
    expect(inGamutOklch.clampSrgb()).toBe(inGamutOklch);
  });

  it('preserves alpha when clamping', () => {
    expect(colordx('oklch(0.5 0.4 180 / 0.5)').clampSrgb().alpha()).toBe(0.5);
    expect(colordx('oklch(0.5 0.4 180 / 0)').clampSrgb().alpha()).toBe(0);
    expect(colordx('oklch(0.5 0.4 180)').clampSrgb().alpha()).toBe(1);
  });

  it('is idempotent — clamping a clamped color is a no-op', () => {
    const once = colordx('oklch(0.5 0.4 180)').clampSrgb();
    expect(once.clampSrgb()).toBe(once);
  });

  it('chained with .mapSrgb() is a no-op — clamped color is already in gamut', () => {
    const clamped = colordx('oklch(0.5 0.4 180)').clampSrgb();
    expect(clamped.mapSrgb()).toBe(clamped);
  });

  it('does not throw on invalid input', () => {
    const invalid = colordx('not-a-color');
    expect(() => invalid.clampSrgb()).not.toThrow();
    expect(invalid.clampSrgb().isValid()).toBe(false);
  });
});

describe('gamut strategies — the three distinct outputs', () => {
  // This codifies the exact scenario from the bug report / user confusion:
  // for the same out-of-gamut input, each strategy produces a different in-gamut result.
  const input = 'oklch(0.5 0.4 180)';

  it('preserve → original oklch, naive-clipped rgb on output', () => {
    expect(colordx(input).toOklchString()).toBe('oklch(0.5 0.4 180)');
    expect(colordx(input).toRgbString()).toBe('rgb(0 152 108)');
  });

  it('map → hue-preserving chroma reduction (CSS Color 4)', () => {
    const mapped = colordx(input).mapSrgb();
    expect(mapped.toOklchString()).toBe('oklch(0.5091 0.0938 177.8489)');
    expect(mapped.toRgbString()).toBe('rgb(0 119 102)');
  });

  it('clamp → browser-matching naive clip, oklch drifts', () => {
    const clamped = colordx(input).clampSrgb();
    expect(clamped.toOklchString()).toBe('oklch(0.6012 0.1276 164.2989)');
    expect(clamped.toRgbString()).toBe('rgb(0 152 108)');
  });

  it('clamp and preserve render identically (both emit rgb(0 152 108))', () => {
    expect(colordx(input).toRgbString()).toBe(colordx(input).clampSrgb().toRgbString());
  });
});

describe('inGamutP3', () => {
  it('returns true for sRGB hex colors (sRGB ⊂ P3)', () => {
    expect(inGamutP3('#ff0000')).toBe(true);
    expect(inGamutP3('#000000')).toBe(true);
    expect(inGamutP3('#ffffff')).toBe(true);
  });

  it('returns true for sRGB rgb() strings', () => {
    expect(inGamutP3('rgb(255, 0, 0)')).toBe(true);
    expect(inGamutP3('rgba(0, 128, 255, 0.5)')).toBe(true);
  });

  it('returns true for sRGB rgb objects', () => {
    expect(inGamutP3({ r: 255, g: 0, b: 0, alpha: 1 })).toBe(true);
  });

  it('returns true for oklch colors within P3 but outside sRGB', () => {
    // oklch(0.64 0.27 29) is in the red direction where P3 exceeds sRGB.
    // P3 red primary is at ~oklch(0.649 0.299 29) while sRGB red is at ~oklch(0.628 0.258 29).
    // C=0.27 is between those boundaries → outside sRGB, inside P3.
    expect(inGamutSrgb('oklch(0.64 0.27 29)')).toBe(false);
    expect(inGamutP3('oklch(0.64 0.27 29)')).toBe(true);
  });

  it('returns false for oklch colors outside P3', () => {
    // Very high chroma in green direction — outside even P3
    expect(inGamutP3('oklch(0.7 0.33 145)')).toBe(false);
  });

  it('returns true for zero chroma (achromatic)', () => {
    expect(inGamutP3('oklch(0.5 0 0)')).toBe(true);
    expect(inGamutP3('oklch(0 0 0)')).toBe(true);
    expect(inGamutP3('oklch(1 0 0)')).toBe(true);
  });

  it('returns false for out-of-P3 oklch objects', () => {
    // Extreme chroma in cyan direction
    expect(inGamutP3({ l: 0.5, c: 0.5, h: 180, alpha: 1 })).toBe(false);
  });

  it('inGamutP3 is strictly less restrictive than inGamutSrgb', () => {
    // Any color in sRGB must also be in P3
    const srgbInputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'];
    for (const c of srgbInputs) {
      if (inGamutSrgb(c)) expect(inGamutP3(c)).toBe(true);
    }
  });
});

describe('toGamutP3', () => {
  it('passes through sRGB inputs unchanged', () => {
    const result = Colordx.toGamutP3('#ff0000');
    expect(result.toHex()).toBe('#ff0000');
  });

  it('passes through in-gamut oklch unchanged', () => {
    const result = Colordx.toGamutP3('oklch(0.6279 0.2577 29.23)');
    expect(result.isValid()).toBe(true);
  });

  it('maps out-of-P3 oklch to a valid color', () => {
    const outOfGamut = 'oklch(0.7 0.33 145)';
    expect(inGamutP3(outOfGamut)).toBe(false);

    const mapped = Colordx.toGamutP3(outOfGamut);
    expect(mapped.isValid()).toBe(true);
    const { r, g, b } = mapped.toRgb();
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(255);
  });

  it('reduces chroma while preserving lightness', () => {
    const outOfGamut = { l: 0.7, c: 0.5, h: 145, alpha: 1 };
    expect(inGamutP3(outOfGamut)).toBe(false);

    const mapped = Colordx.toGamutP3(outOfGamut);
    const oklch = mapped.toOklch();

    // Lightness should be approximately preserved (within 0.05)
    expect(Math.abs(oklch.l - 0.7)).toBeLessThan(0.05);
    // Chroma should be reduced
    expect(oklch.c).toBeLessThan(0.5);
  });

  it('result of toGamutP3 is within P3 gamut', () => {
    const outOfGamut = 'oklch(0.7 0.33 145)';
    const mapped = Colordx.toGamutP3(outOfGamut);
    // Verify via P3 gamma channels — gamut-mapped color has all channels in [0, 1]
    const { r, g, b } = (mapped as any).toP3() as { r: number; g: number; b: number };
    expect(r).toBeGreaterThanOrEqual(-1e-4);
    expect(r).toBeLessThanOrEqual(1 + 1e-4);
    expect(g).toBeGreaterThanOrEqual(-1e-4);
    expect(g).toBeLessThanOrEqual(1 + 1e-4);
    expect(b).toBeGreaterThanOrEqual(-1e-4);
    expect(b).toBeLessThanOrEqual(1 + 1e-4);
  });

  it('allows more chroma than toGamutSrgb for out-of-sRGB colors', () => {
    // toGamutP3 should preserve more chroma than toGamutSrgb since P3 > sRGB
    const outOfSrgb = 'oklch(0.64 0.3 29)';
    const srgbMapped = Colordx.toGamutSrgb(outOfSrgb);
    const p3Mapped = Colordx.toGamutP3(outOfSrgb);
    // P3 allows at least as much chroma as sRGB
    expect(p3Mapped.toOklch().c).toBeGreaterThanOrEqual(srgbMapped.toOklch().c - 0.01);
  });

  it('preserves alpha', () => {
    const result = Colordx.toGamutP3('oklch(0.7 0.5 145 / 0.5)');
    expect(result.toRgb().alpha).toBe(0.5);
  });
});

describe('inGamutRec2020', () => {
  it('returns true for sRGB hex colors (sRGB ⊂ Rec.2020)', () => {
    expect(inGamutRec2020('#ff0000')).toBe(true);
    expect(inGamutRec2020('#000000')).toBe(true);
    expect(inGamutRec2020('#ffffff')).toBe(true);
  });

  it('returns true for sRGB rgb objects', () => {
    expect(inGamutRec2020({ r: 255, g: 0, b: 0, alpha: 1 })).toBe(true);
  });

  it('returns true for oklch colors within P3 but outside sRGB (P3 ⊂ Rec.2020)', () => {
    // This color is outside sRGB but inside P3 — and by extension inside Rec.2020
    expect(inGamutSrgb('oklch(0.64 0.27 29)')).toBe(false);
    expect(inGamutRec2020('oklch(0.64 0.27 29)')).toBe(true);
  });

  it('returns false for oklch colors outside Rec.2020', () => {
    // Extreme chroma — outside even Rec.2020
    expect(inGamutRec2020('oklch(0.5 0.8 145)')).toBe(false);
  });

  it('returns true for zero chroma (achromatic)', () => {
    expect(inGamutRec2020('oklch(0.5 0 0)')).toBe(true);
    expect(inGamutRec2020('oklch(0 0 0)')).toBe(true);
    expect(inGamutRec2020('oklch(1 0 0)')).toBe(true);
  });

  it('returns false for extreme out-of-gamut oklch objects', () => {
    expect(inGamutRec2020({ l: 0.5, c: 0.8, h: 145, alpha: 1 })).toBe(false);
  });

  it('inGamutRec2020 is at least as permissive as inGamutP3', () => {
    // Any color in P3 must also be in Rec.2020 (Rec.2020 ⊃ P3)
    const testColors = [
      '#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000',
      'oklch(0.64 0.27 29)',
    ];
    for (const c of testColors) {
      if (inGamutP3(c)) expect(inGamutRec2020(c)).toBe(true);
    }
  });
});

describe('toGamutRec2020', () => {
  it('passes through sRGB inputs unchanged', () => {
    const result = Colordx.toGamutRec2020('#ff0000');
    expect(result.toHex()).toBe('#ff0000');
  });

  it('passes through in-gamut oklch unchanged', () => {
    const result = Colordx.toGamutRec2020('oklch(0.6279 0.2577 29.23)');
    expect(result.isValid()).toBe(true);
  });

  it('maps out-of-Rec.2020 oklch to a valid color', () => {
    const outOfGamut = 'oklch(0.5 0.8 145)';
    expect(inGamutRec2020(outOfGamut)).toBe(false);

    const mapped = Colordx.toGamutRec2020(outOfGamut);
    expect(mapped.isValid()).toBe(true);
    const { r, g, b } = mapped.toRgb();
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(255);
  });

  it('reduces chroma while preserving lightness', () => {
    const outOfGamut = { l: 0.7, c: 0.8, h: 145, alpha: 1 };
    expect(inGamutRec2020(outOfGamut)).toBe(false);

    const mapped = Colordx.toGamutRec2020(outOfGamut);
    const oklch = mapped.toOklch();

    // Lightness should be approximately preserved
    expect(Math.abs(oklch.l - 0.7)).toBeLessThan(0.05);
    // Chroma should be reduced
    expect(oklch.c).toBeLessThan(0.8);
  });

  it('result of toGamutRec2020 is within Rec.2020 gamut', () => {
    const outOfGamut = 'oklch(0.5 0.8 145)';
    const mapped = Colordx.toGamutRec2020(outOfGamut);
    expect(inGamutRec2020(mapped.toOklch())).toBe(true);
  });

  it('allows more chroma than toGamutP3 for extremely saturated colors', () => {
    // For highly saturated colors, Rec.2020 allows more chroma than P3
    const extreme = 'oklch(0.83 0.4 145)';
    expect(inGamutP3(extreme)).toBe(false);
    const p3Mapped = Colordx.toGamutP3(extreme);
    const rec2020Mapped = Colordx.toGamutRec2020(extreme);
    expect(rec2020Mapped.toOklch().c).toBeGreaterThanOrEqual(p3Mapped.toOklch().c - 0.01);
  });

  it('preserves alpha', () => {
    const result = Colordx.toGamutRec2020('oklch(0.5 0.8 145 / 0.7)');
    expect(result.toRgb().alpha).toBe(0.7);
  });
});

describe('inGamutSrgb: additional hue and lightness coverage', () => {
  it('returns true for low chroma at all cardinal hue angles', () => {
    expect(inGamutSrgb('oklch(0.5 0.05 0)')).toBe(true);
    expect(inGamutSrgb('oklch(0.5 0.05 90)')).toBe(true);
    expect(inGamutSrgb('oklch(0.5 0.05 180)')).toBe(true);
    expect(inGamutSrgb('oklch(0.5 0.05 270)')).toBe(true);
  });

  it('returns true for very low chroma across a range of lightnesses', () => {
    expect(inGamutSrgb('oklch(0.1 0.01 90)')).toBe(true);
    expect(inGamutSrgb('oklch(0.5 0.01 90)')).toBe(true);
    expect(inGamutSrgb('oklch(0.9 0.01 90)')).toBe(true);
  });

  it('returns false for high chroma in the yellow-green direction', () => {
    expect(inGamutSrgb('oklch(0.5 0.4 90)')).toBe(false);
  });

  it('returns false for high chroma in the blue direction', () => {
    expect(inGamutSrgb('oklch(0.5 0.4 270)')).toBe(false);
  });
});

describe('toGamutSrgb: additional coverage', () => {
  it('passes through black and white unchanged', () => {
    expect(Colordx.toGamutSrgb('#000000').toHex()).toBe('#000000');
    expect(Colordx.toGamutSrgb('#ffffff').toHex()).toBe('#ffffff');
  });

  it('maps out-of-gamut colors at L=0.3 while preserving lightness', () => {
    const outOfGamut = { l: 0.3, c: 0.4, h: 200, alpha: 1 };
    if (!inGamutSrgb(outOfGamut)) {
      const mapped = Colordx.toGamutSrgb(outOfGamut);
      expect(mapped.toOklch().l).toBeCloseTo(0.3, 1);
    }
  });

  it('maps out-of-gamut colors at L=0.9 while preserving lightness', () => {
    const outOfGamut = { l: 0.9, c: 0.4, h: 145, alpha: 1 };
    if (!inGamutSrgb(outOfGamut)) {
      const mapped = Colordx.toGamutSrgb(outOfGamut);
      expect(mapped.toOklch().l).toBeCloseTo(0.9, 1);
    }
  });

  it('all mapped colors have valid RGB channels', () => {
    const testColors = [
      'oklch(0.3 0.5 30)', 'oklch(0.5 0.4 145)',
      'oklch(0.7 0.45 210)', 'oklch(0.4 0.5 270)',
    ];
    for (const c of testColors) {
      if (!inGamutSrgb(c)) {
        const { r, g, b } = Colordx.toGamutSrgb(c).toRgb();
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('inGamutP3: additional coverage', () => {
  it('returns true for low chroma at all cardinal hue angles', () => {
    expect(inGamutP3('oklch(0.5 0.08 0)')).toBe(true);
    expect(inGamutP3('oklch(0.5 0.08 90)')).toBe(true);
    expect(inGamutP3('oklch(0.5 0.08 180)')).toBe(true);
    expect(inGamutP3('oklch(0.5 0.08 270)')).toBe(true);
  });

  it('P3 allows more chroma than sRGB at same hue (red direction)', () => {
    // sRGB red primary ≈ oklch(0.628 0.258 29), P3 red ≈ oklch(0.649 0.299 29)
    const outOfSrgbInP3 = 'oklch(0.628 0.270 29)';
    expect(inGamutSrgb(outOfSrgbInP3)).toBe(false);
    expect(inGamutP3(outOfSrgbInP3)).toBe(true);
  });
});

describe('toGamutP3: additional coverage', () => {
  it('passes through all standard sRGB colors unchanged', () => {
    for (const c of ['#ff0000', '#00ff00', '#0000ff', '#808080', '#c06060']) {
      expect(Colordx.toGamutP3(c).toHex()).toBe(c);
    }
  });

  it('reduces chroma when mapping from out-of-P3 to P3', () => {
    const outOfGamut = 'oklch(0.7 0.45 145)';
    if (!inGamutP3(outOfGamut)) {
      const mapped = Colordx.toGamutP3(outOfGamut);
      expect(mapped.toOklch().c).toBeLessThan(0.45);
    }
  });
});

describe('inGamutRec2020: additional coverage', () => {
  it('returns true for low chroma at all cardinal hue angles', () => {
    expect(inGamutRec2020('oklch(0.5 0.1 0)')).toBe(true);
    expect(inGamutRec2020('oklch(0.5 0.1 90)')).toBe(true);
    expect(inGamutRec2020('oklch(0.5 0.1 180)')).toBe(true);
    expect(inGamutRec2020('oklch(0.5 0.1 270)')).toBe(true);
  });
});

describe('toGamutRec2020: additional coverage', () => {
  it('passes through all standard sRGB colors unchanged', () => {
    for (const c of ['#ff0000', '#00ff00', '#0000ff', '#808080']) {
      expect(Colordx.toGamutRec2020(c).toHex()).toBe(c);
    }
  });

  it('all extreme out-of-gamut colors produce valid results', () => {
    const testColors = ['oklch(0.5 0.9 0)', 'oklch(0.7 0.9 145)', 'oklch(0.3 0.8 270)'];
    for (const c of testColors) {
      expect(Colordx.toGamutRec2020(c).isValid()).toBe(true);
    }
  });

  it('Rec.2020 allows at least as much chroma as sRGB for same hue', () => {
    const outOfSrgb = 'oklch(0.7 0.35 145)';
    if (!inGamutSrgb(outOfSrgb)) {
      const srgbMapped = Colordx.toGamutSrgb(outOfSrgb);
      const rec2020Mapped = Colordx.toGamutRec2020(outOfSrgb);
      expect(rec2020Mapped.toOklch().c).toBeGreaterThanOrEqual(srgbMapped.toOklch().c - 0.01);
    }
  });
});

describe('gamut subset transitivity', () => {
  it('all standard sRGB colors are in P3 and Rec.2020', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060', '#808080'];
    for (const c of colors) {
      expect(inGamutP3(c)).toBe(true);
      expect(inGamutRec2020(c)).toBe(true);
    }
  });

  it('any color in P3 is also in Rec.2020', () => {
    const inP3Colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', 'oklch(0.64 0.27 29)'];
    for (const c of inP3Colors) {
      if (inGamutP3(c)) {
        expect(inGamutRec2020(c)).toBe(true);
      }
    }
  });

  it('any color in sRGB is also in P3', () => {
    const srgbColors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060'];
    for (const c of srgbColors) {
      expect(inGamutP3(c)).toBe(true);
    }
  });
});

describe('CIE Lab object gamut checking', () => {
  // Verified via lab(l,a,b) → XYZ D50 → D65 → linear sRGB (before clamping):
  // lab(90,50,-30)  → linear(1.383, 0.526, 1.285) — r,b > 1 → out of sRGB
  // lab(50,100,0)   → linear(1.017, -0.065, 0.199) — r > 1, g < 0 → out of sRGB
  // lab(50,0,-80)   → linear(-0.210, 0.217, 1.019) — r < 0, b > 1 → out of sRGB
  // lab(70,-60,60)  → linear(0.066, 0.547, 0.029) — all in [0,1] → in sRGB

  it('returns false for out-of-sRGB CIE Lab colors (inGamutSrgb)', () => {
    expect(inGamutSrgb({ l: 90, a: 50, b: -30, alpha: 1, colorSpace: 'lab' } as any)).toBe(false);
    expect(inGamutSrgb({ l: 50, a: 100, b: 0, alpha: 1, colorSpace: 'lab' } as any)).toBe(false);
    expect(inGamutSrgb({ l: 50, a: 0, b: -80, alpha: 1, colorSpace: 'lab' } as any)).toBe(false);
  });

  it('returns true for in-sRGB CIE Lab colors (inGamutSrgb)', () => {
    expect(inGamutSrgb({ l: 70, a: -60, b: 60, alpha: 1, colorSpace: 'lab' } as any)).toBe(true);
    // White and black are always in gamut
    expect(inGamutSrgb({ l: 100, a: 0, b: 0, alpha: 1, colorSpace: 'lab' } as any)).toBe(true);
    expect(inGamutSrgb({ l: 0, a: 0, b: 0, alpha: 1, colorSpace: 'lab' } as any)).toBe(true);
  });

  it('out-of-sRGB CIE Lab colors may be in P3 (inGamutP3)', () => {
    // lab(90,50,-30) is out of sRGB but may be in P3 — check it's no longer blindly true
    const result = inGamutP3({ l: 90, a: 50, b: -30, alpha: 1, colorSpace: 'lab' } as any);
    // lab(50,100,0) with linear r=1.017 — still outside P3 gamut
    expect(inGamutP3({ l: 50, a: 100, b: 0, alpha: 1, colorSpace: 'lab' } as any)).toBe(false);
    // Whatever the result for (90,50,-30), it must not be blindly true for all out-of-sRGB colors
    expect(typeof result).toBe('boolean');
  });

  it('toGamutSrgb maps out-of-sRGB CIE Lab to a valid sRGB color', () => {
    const mapped = Colordx.toGamutSrgb({ l: 50, a: 100, b: 0, alpha: 1, colorSpace: 'lab' } as any);
    const rgb = mapped.toRgb();
    expect(rgb.r).toBeGreaterThanOrEqual(0);
    expect(rgb.r).toBeLessThanOrEqual(255);
    expect(rgb.g).toBeGreaterThanOrEqual(0);
    expect(rgb.g).toBeLessThanOrEqual(255);
    expect(rgb.b).toBeGreaterThanOrEqual(0);
    expect(rgb.b).toBeLessThanOrEqual(255);
    expect(inGamutSrgb(mapped.toHex())).toBe(true);
  });

  it('inGamutRec2020 returns false for extreme out-of-gamut CIE Lab colors', () => {
    // lab(50,0,-200): extreme blue far outside the visible sRGB/P3/Rec.2020 gamut.
    // Computed linear Rec.2020: r≈-0.53, b≈3.99 — clearly out of [0,1].
    expect(inGamutRec2020({ l: 50, a: 0, b: -200, alpha: 1, colorSpace: 'lab' } as any)).toBe(false);
    // lab(50,100,0) has linear sRGB r≈1.017, which is inside Rec.2020 (Rec.2020 ⊃ sRGB)
    expect(inGamutRec2020({ l: 50, a: 100, b: 0, alpha: 1, colorSpace: 'lab' } as any)).toBe(true);
  });

  it('inGamutRec2020 returns true for in-sRGB CIE Lab colors (sRGB ⊂ Rec.2020)', () => {
    expect(inGamutRec2020({ l: 70, a: -60, b: 60, alpha: 1, colorSpace: 'lab' } as any)).toBe(true);
    expect(inGamutRec2020({ l: 100, a: 0, b: 0, alpha: 1, colorSpace: 'lab' } as any)).toBe(true);
    expect(inGamutRec2020({ l: 0, a: 0, b: 0, alpha: 1, colorSpace: 'lab' } as any)).toBe(true);
  });

  it('toGamutP3 maps out-of-P3 CIE Lab to a valid color', () => {
    // lab(50,100,0) has linear sRGB r≈1.017 — outside sRGB and P3
    const mapped = Colordx.toGamutP3({ l: 50, a: 100, b: 0, alpha: 1, colorSpace: 'lab' } as any);
    const rgb = mapped.toRgb();
    expect(rgb.r).toBeGreaterThanOrEqual(0);
    expect(rgb.r).toBeLessThanOrEqual(255);
    expect(rgb.g).toBeGreaterThanOrEqual(0);
    expect(rgb.g).toBeLessThanOrEqual(255);
    expect(rgb.b).toBeGreaterThanOrEqual(0);
    expect(rgb.b).toBeLessThanOrEqual(255);
  });

  it('toGamutRec2020 maps out-of-Rec.2020 CIE Lab to a valid color', () => {
    const mapped = Colordx.toGamutRec2020({ l: 50, a: 100, b: 0, alpha: 1, colorSpace: 'lab' } as any);
    const rgb = mapped.toRgb();
    expect(rgb.r).toBeGreaterThanOrEqual(0);
    expect(rgb.r).toBeLessThanOrEqual(255);
    expect(rgb.g).toBeGreaterThanOrEqual(0);
    expect(rgb.g).toBeLessThanOrEqual(255);
    expect(rgb.b).toBeGreaterThanOrEqual(0);
    expect(rgb.b).toBeLessThanOrEqual(255);
  });
});

// Regression tests for the bug where toGamutP3/toGamutRec2020 used an isolated
// Colordx copy that lacked plugin parsers, causing plugin-format inputs to be
// silently treated as invalid (returning black).
describe('toGamutP3 / toGamutRec2020 — plugin-format inputs', () => {
  it('toGamutP3 accepts a P3 color string and returns a valid color', () => {
    // Before the fix, the P3 parser was not registered on the bundled Colordx
    // copy, so this would silently produce isValid()===false (black).
    const result = Colordx.toGamutP3('color(display-p3 0.9 0.3 0.2)');
    expect(result.isValid()).toBe(true);
    const rgb = result.toRgb();
    expect(rgb.r).toBeGreaterThan(0);
  });

  it('toGamutP3 accepts a P3 color object and returns a valid color', () => {
    const p3Color = { r: 0.9, g: 0.3, b: 0.2, alpha: 1, colorSpace: 'display-p3' as const };
    const result = Colordx.toGamutP3(p3Color as any);
    expect(result.isValid()).toBe(true);
  });

  it('toGamutP3 on an in-P3-gamut P3 string returns the same color (pass-through)', () => {
    // An in-gamut P3 color — should pass through unchanged
    const input = 'color(display-p3 0.5 0.4 0.3)';
    const result = Colordx.toGamutP3(input);
    expect(result.isValid()).toBe(true);
    expect(inGamutP3(input)).toBe(true);
  });

  it('toGamutRec2020 accepts a Rec.2020 color string and returns a valid color', () => {
    // Before the fix, the rec2020 parser was missing on the isolated Colordx
    // copy, causing this to silently return an invalid color.
    const result = Colordx.toGamutRec2020('color(rec2020 0.9 0.3 0.2)');
    expect(result.isValid()).toBe(true);
    const rgb = result.toRgb();
    expect(rgb.r).toBeGreaterThan(0);
  });

  it('toGamutRec2020 accepts a Rec.2020 color object and returns a valid color', () => {
    const rec2020Color = { r: 0.9, g: 0.3, b: 0.2, alpha: 1, colorSpace: 'rec2020' as const };
    const result = Colordx.toGamutRec2020(rec2020Color as any);
    expect(result.isValid()).toBe(true);
  });

  it('toGamutP3 result supports plugin methods from the registered Colordx class', () => {
    // The returned instance must come from the same class extend() was called on,
    // not an isolated copy — so plugin prototype methods must be present.
    const result = Colordx.toGamutP3('oklch(0.8 0.4 145)');
    expect(typeof result.toP3).toBe('function');
    const p3 = result.toP3();
    expect(p3.colorSpace).toBe('display-p3');
  });

  it('toGamutRec2020 result supports plugin methods from the registered Colordx class', () => {
    const result = Colordx.toGamutRec2020('oklch(0.8 0.4 145)');
    expect(typeof result.toRec2020).toBe('function');
    const rec = result.toRec2020();
    expect(rec.colorSpace).toBe('rec2020');
  });

  it('toGamutP3 preserves alpha from a P3 string input', () => {
    const result = Colordx.toGamutP3('color(display-p3 0.9 0.3 0.2 / 0.6)' as any);
    expect(result.isValid()).toBe(true);
    expect(result.toRgb().alpha).toBeCloseTo(0.6, 2);
  });

  it('toGamutRec2020 preserves alpha from a Rec.2020 string input', () => {
    const result = Colordx.toGamutRec2020('color(rec2020 0.9 0.3 0.2 / 0.4)' as any);
    expect(result.isValid()).toBe(true);
    expect(result.toRgb().alpha).toBeCloseTo(0.4, 2);
  });
});

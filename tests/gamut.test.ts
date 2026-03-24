import { describe, expect, it } from 'vitest';
import { inGamutP3, inGamutRec2020, inGamutSrgb, toGamutP3, toGamutRec2020, toGamutSrgb } from '../src/gamut.js';

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
    expect(inGamutSrgb({ r: 255, g: 0, b: 0, a: 1 })).toBe(true);
  });

  it('returns true for oklch colors in sRGB gamut', () => {
    // Pure red in oklch — should be in gamut
    expect(inGamutSrgb('oklch(0.6279 0.2577 29.23)')).toBe(true);
  });

  it('returns true for oklab colors in sRGB gamut', () => {
    expect(inGamutSrgb('oklab(0.6279 0.2249 0.1257)')).toBe(true);
  });

  it('returns false for out-of-gamut oklch colors', () => {
    // Very high chroma — outside sRGB
    expect(inGamutSrgb('oklch(0.5 0.4 180)')).toBe(false);
    expect(inGamutSrgb('oklch(0.7 0.37 145)')).toBe(false);
  });

  it('returns false for out-of-gamut oklch objects', () => {
    expect(inGamutSrgb({ l: 0.5, c: 0.4, h: 180, a: 1 })).toBe(false);
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

describe('toGamutSrgb', () => {
  it('passes through sRGB inputs unchanged', () => {
    const result = toGamutSrgb('#ff0000');
    expect(result.toHex()).toBe('#ff0000');
  });

  it('passes through in-gamut oklch unchanged', () => {
    const result = toGamutSrgb('oklch(0.6279 0.2577 29.23)');
    expect(result.isValid()).toBe(true);
    // Should match red closely
    const { r, g, b } = result.toRgb();
    expect(r).toBeCloseTo(255, -1);
    expect(g).toBeCloseTo(0, -1);
    expect(b).toBeCloseTo(0, -1);
  });

  it('maps out-of-gamut oklch to nearest in-gamut color', () => {
    const outOfGamut = 'oklch(0.5 0.4 180)';
    expect(inGamutSrgb(outOfGamut)).toBe(false);

    const mapped = toGamutSrgb(outOfGamut);
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
    const outOfGamut = { l: 0.7, c: 0.4, h: 145, a: 1 };
    expect(inGamutSrgb(outOfGamut)).toBe(false);

    const mapped = toGamutSrgb(outOfGamut);
    const oklch = mapped.toOklch();

    // Lightness and hue should be approximately preserved
    expect(oklch.l).toBeCloseTo(0.7, 1);
    expect(oklch.h).toBeCloseTo(145, 0);
    // Chroma should be reduced
    expect(oklch.c).toBeLessThan(0.4);
  });

  it('handles oklab objects', () => {
    const outOfGamut = { l: 0.5, a: 0.35, b: 0.0, alpha: 1 };
    expect(inGamutSrgb(outOfGamut)).toBe(false);

    const mapped = toGamutSrgb(outOfGamut);
    expect(mapped.isValid()).toBe(true);
    const { r, g, b } = mapped.toRgb();
    expect(r).toBeLessThanOrEqual(255);
    expect(g).toBeLessThanOrEqual(255);
    expect(b).toBeLessThanOrEqual(255);
  });

  it('handles oklch string with alpha', () => {
    const result = toGamutSrgb('oklch(0.5 0.4 180 / 0.5)');
    const { a } = result.toRgb();
    expect(a).toBeCloseTo(0.5, 2);
  });

  it('handles achromatic out-of-lightness-range oklch', () => {
    // L=0, C=0 — black, always in gamut
    const result = toGamutSrgb('oklch(0 0 0)');
    expect(result.isValid()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Display-P3 gamut
// ---------------------------------------------------------------------------

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
    expect(inGamutP3({ r: 255, g: 0, b: 0, a: 1 })).toBe(true);
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
    expect(inGamutP3({ l: 0.5, c: 0.5, h: 180, a: 1 })).toBe(false);
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
    const result = toGamutP3('#ff0000');
    expect(result.toHex()).toBe('#ff0000');
  });

  it('passes through in-gamut oklch unchanged', () => {
    const result = toGamutP3('oklch(0.6279 0.2577 29.23)');
    expect(result.isValid()).toBe(true);
  });

  it('maps out-of-P3 oklch to a valid color', () => {
    const outOfGamut = 'oklch(0.7 0.33 145)';
    expect(inGamutP3(outOfGamut)).toBe(false);

    const mapped = toGamutP3(outOfGamut);
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
    const outOfGamut = { l: 0.7, c: 0.5, h: 145, a: 1 };
    expect(inGamutP3(outOfGamut)).toBe(false);

    const mapped = toGamutP3(outOfGamut);
    const oklch = mapped.toOklch();

    // Lightness should be approximately preserved (within 0.05)
    expect(Math.abs(oklch.l - 0.7)).toBeLessThan(0.05);
    // Chroma should be reduced
    expect(oklch.c).toBeLessThan(0.5);
  });

  it('result of toGamutP3 is within P3 gamut', () => {
    const outOfGamut = 'oklch(0.7 0.33 145)';
    const mapped = toGamutP3(outOfGamut);
    // Mapped color is sRGB (subset of P3), so always in P3
    expect(inGamutP3(mapped.toOklch())).toBe(true);
  });

  it('allows more chroma than toGamutSrgb for out-of-sRGB colors', () => {
    // toGamutP3 should preserve more chroma than toGamutSrgb since P3 > sRGB
    const outOfSrgb = 'oklch(0.64 0.3 29)';
    const srgbMapped = toGamutSrgb(outOfSrgb);
    const p3Mapped = toGamutP3(outOfSrgb);
    // P3 allows at least as much chroma as sRGB
    expect(p3Mapped.toOklch().c).toBeGreaterThanOrEqual(srgbMapped.toOklch().c - 0.01);
  });

  it('preserves alpha', () => {
    const result = toGamutP3('oklch(0.7 0.5 145 / 0.5)');
    expect(result.toRgb().a).toBeCloseTo(0.5, 2);
  });
});

// ---------------------------------------------------------------------------
// Rec.2020 gamut
// ---------------------------------------------------------------------------

describe('inGamutRec2020', () => {
  it('returns true for sRGB hex colors (sRGB ⊂ Rec.2020)', () => {
    expect(inGamutRec2020('#ff0000')).toBe(true);
    expect(inGamutRec2020('#000000')).toBe(true);
    expect(inGamutRec2020('#ffffff')).toBe(true);
  });

  it('returns true for sRGB rgb objects', () => {
    expect(inGamutRec2020({ r: 255, g: 0, b: 0, a: 1 })).toBe(true);
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
    expect(inGamutRec2020({ l: 0.5, c: 0.8, h: 145, a: 1 })).toBe(false);
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
    const result = toGamutRec2020('#ff0000');
    expect(result.toHex()).toBe('#ff0000');
  });

  it('passes through in-gamut oklch unchanged', () => {
    const result = toGamutRec2020('oklch(0.6279 0.2577 29.23)');
    expect(result.isValid()).toBe(true);
  });

  it('maps out-of-Rec.2020 oklch to a valid color', () => {
    const outOfGamut = 'oklch(0.5 0.8 145)';
    expect(inGamutRec2020(outOfGamut)).toBe(false);

    const mapped = toGamutRec2020(outOfGamut);
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
    const outOfGamut = { l: 0.7, c: 0.8, h: 145, a: 1 };
    expect(inGamutRec2020(outOfGamut)).toBe(false);

    const mapped = toGamutRec2020(outOfGamut);
    const oklch = mapped.toOklch();

    // Lightness should be approximately preserved
    expect(Math.abs(oklch.l - 0.7)).toBeLessThan(0.05);
    // Chroma should be reduced
    expect(oklch.c).toBeLessThan(0.8);
  });

  it('result of toGamutRec2020 is within Rec.2020 gamut', () => {
    const outOfGamut = 'oklch(0.5 0.8 145)';
    const mapped = toGamutRec2020(outOfGamut);
    expect(inGamutRec2020(mapped.toOklch())).toBe(true);
  });

  it('allows more chroma than toGamutP3 for extremely saturated colors', () => {
    // For highly saturated colors, Rec.2020 allows more chroma than P3
    const extreme = 'oklch(0.83 0.4 145)';
    expect(inGamutP3(extreme)).toBe(false);
    const p3Mapped = toGamutP3(extreme);
    const rec2020Mapped = toGamutRec2020(extreme);
    expect(rec2020Mapped.toOklch().c).toBeGreaterThanOrEqual(p3Mapped.toOklch().c - 0.01);
  });

  it('preserves alpha', () => {
    const result = toGamutRec2020('oklch(0.5 0.8 145 / 0.7)');
    expect(result.toRgb().a).toBeCloseTo(0.7, 2);
  });
});

// ---------------------------------------------------------------------------
// Extended corner cases
// ---------------------------------------------------------------------------

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
    expect(toGamutSrgb('#000000').toHex()).toBe('#000000');
    expect(toGamutSrgb('#ffffff').toHex()).toBe('#ffffff');
  });

  it('maps out-of-gamut colors at L=0.3 while preserving lightness', () => {
    const outOfGamut = { l: 0.3, c: 0.4, h: 200, a: 1 };
    if (!inGamutSrgb(outOfGamut)) {
      const mapped = toGamutSrgb(outOfGamut);
      expect(mapped.toOklch().l).toBeCloseTo(0.3, 1);
    }
  });

  it('maps out-of-gamut colors at L=0.9 while preserving lightness', () => {
    const outOfGamut = { l: 0.9, c: 0.4, h: 145, a: 1 };
    if (!inGamutSrgb(outOfGamut)) {
      const mapped = toGamutSrgb(outOfGamut);
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
        const { r, g, b } = toGamutSrgb(c).toRgb();
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
      expect(toGamutP3(c).toHex()).toBe(c);
    }
  });

  it('reduces chroma when mapping from out-of-P3 to P3', () => {
    const outOfGamut = 'oklch(0.7 0.45 145)';
    if (!inGamutP3(outOfGamut)) {
      const mapped = toGamutP3(outOfGamut);
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
      expect(toGamutRec2020(c).toHex()).toBe(c);
    }
  });

  it('all extreme out-of-gamut colors produce valid results', () => {
    const testColors = ['oklch(0.5 0.9 0)', 'oklch(0.7 0.9 145)', 'oklch(0.3 0.8 270)'];
    for (const c of testColors) {
      expect(toGamutRec2020(c).isValid()).toBe(true);
    }
  });

  it('Rec.2020 allows at least as much chroma as sRGB for same hue', () => {
    const outOfSrgb = 'oklch(0.7 0.35 145)';
    if (!inGamutSrgb(outOfSrgb)) {
      const srgbMapped = toGamutSrgb(outOfSrgb);
      const rec2020Mapped = toGamutRec2020(outOfSrgb);
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

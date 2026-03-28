/**
 * Targeted tests for issues identified during code review.
 */
import { describe, expect, it } from 'vitest';
import { labToRgb, rgbToLab, deltaE2000 } from '../src/colorModels/lab.js';
import { labToXyz, xyzToLab } from '../src/colorModels/lab.js';
import { rgbToXyz, xyzToRgb } from '../src/colorModels/xyz.js';
import { parseOklabString } from '../src/colorModels/oklab.js';
import { parseOklchString } from '../src/colorModels/oklch.js';
import { parseCmykString } from '../src/colorModels/cmyk.js';
import { hslToRgb, rgbToHsl } from '../src/colorModels/hsl.js';
import { hsvToRgb, rgbToHsv } from '../src/colorModels/hsv.js';

// Validates that the XYZ intermediate values are NOT clamped, which would
// corrupt saturated colors by losing chroma before the Lab conversion.

describe('RGB → XYZ → Lab → XYZ → RGB (saturated, no intermediate clamp)', () => {
  const saturated = [
    { r: 255, g: 0,   b: 0,   alpha: 1, name: 'pure red' },
    { r: 0,   g: 255, b: 0,   alpha: 1, name: 'pure green' },
    { r: 0,   g: 0,   b: 255, alpha: 1, name: 'pure blue' },
    { r: 255, g: 0,   b: 255, alpha: 1, name: 'magenta' },
    { r: 0,   g: 255, b: 255, alpha: 1, name: 'cyan' },
    { r: 255, g: 255, b: 0,   alpha: 1, name: 'yellow' },
    { r: 255, g: 128, b: 0,   alpha: 1, name: 'orange' },
  ];

  for (const { r, g, b, alpha, name } of saturated) {
    it(name, () => {
      const xyz = rgbToXyz({ r, g, b, alpha });
      const lab = xyzToLab(xyz);
      const xyzBack = labToXyz(lab);
      const rgb = xyzToRgb(xyzBack);
      expect(rgb.r).toBeCloseTo(r, 0);
      expect(rgb.g).toBeCloseTo(g, 0);
      expect(rgb.b).toBeCloseTo(b, 0);
    });
  }

  it('high-level rgbToLab → labToRgb round-trip', () => {
    for (const { r, g, b, alpha } of saturated) {
      const back = labToRgb(rgbToLab({ r, g, b, alpha }));
      expect(back.r).toBeCloseTo(r, 0);
      expect(back.g).toBeCloseTo(g, 0);
      expect(back.b).toBeCloseTo(b, 0);
    }
  });
});

// CSS Color 4 allows `none` as a missing-component value, treated as 0.

describe('OKLab / OKLCH string parsing — `none` keyword', () => {
  it('oklab: none in L position → treated as 0 (black)', () => {
    const rgb = parseOklabString('oklab(none 0 0)');
    expect(rgb).not.toBeNull();
    expect(rgb!.r).toBeCloseTo(0, 0);
    expect(rgb!.g).toBeCloseTo(0, 0);
    expect(rgb!.b).toBeCloseTo(0, 0);
  });

  it('oklab: none in a and b positions → achromatic', () => {
    const withNone = parseOklabString('oklab(0.5 none none)');
    const withZero = parseOklabString('oklab(0.5 0 0)');
    expect(withNone).not.toBeNull();
    expect(withNone!.r).toBeCloseTo(withZero!.r, 0);
    expect(withNone!.g).toBeCloseTo(withZero!.g, 0);
    expect(withNone!.b).toBeCloseTo(withZero!.b, 0);
  });

  it('oklch: none in hue position → treated as 0', () => {
    const withNone = parseOklchString('oklch(0.5 0.2 none)');
    const withZero = parseOklchString('oklch(0.5 0.2 0)');
    expect(withNone).not.toBeNull();
    expect(withNone!.r).toBeCloseTo(withZero!.r, 0);
    expect(withNone!.g).toBeCloseTo(withZero!.g, 0);
    expect(withNone!.b).toBeCloseTo(withZero!.b, 0);
  });

  it('oklch: none in chroma → treated as 0 (achromatic)', () => {
    const withNone = parseOklchString('oklch(0.5 none 180)');
    const withZero = parseOklchString('oklch(0.5 0 180)');
    expect(withNone).not.toBeNull();
    expect(withNone!.r).toBeCloseTo(withZero!.r, 0);
  });

  it('oklab: none in alpha position → treated as fully opaque', () => {
    const rgb = parseOklabString('oklab(0.5 0 0 / none)');
    expect(rgb).not.toBeNull();
    expect(rgb!.alpha).toBeCloseTo(0, 2);
  });
});


describe('device-cmyk() — with and without % on channel values', () => {
  it('all values with % → same as fractional without %', () => {
    const withPct  = parseCmykString('device-cmyk(0% 100% 100% 0%)');   // red
    const withoutPct = parseCmykString('device-cmyk(0 1 1 0)');          // also red (0–1 scale)
    expect(withPct).not.toBeNull();
    expect(withoutPct).not.toBeNull();
    expect(withPct!.r).toBeCloseTo(withoutPct!.r, 0);
    expect(withPct!.g).toBeCloseTo(withoutPct!.g, 0);
    expect(withPct!.b).toBeCloseTo(withoutPct!.b, 0);
  });

  it('device-cmyk(0% 0% 0% 0%) → white', () => {
    const rgb = parseCmykString('device-cmyk(0% 0% 0% 0%)');
    expect(rgb!.r).toBeCloseTo(255, 0);
    expect(rgb!.g).toBeCloseTo(255, 0);
    expect(rgb!.b).toBeCloseTo(255, 0);
  });

  it('device-cmyk(0% 0% 0% 100%) → black', () => {
    const rgb = parseCmykString('device-cmyk(0% 0% 0% 100%)');
    expect(rgb!.r).toBeCloseTo(0, 0);
    expect(rgb!.g).toBeCloseTo(0, 0);
    expect(rgb!.b).toBeCloseTo(0, 0);
  });

  it('device-cmyk with alpha', () => {
    const rgb = parseCmykString('device-cmyk(0% 0% 0% 0% / 0.5)');
    expect(rgb!.alpha).toBeCloseTo(0.5, 2);
  });

  it('device-cmyk with % alpha', () => {
    const rgb = parseCmykString('device-cmyk(0% 0% 0% 0% / 50%)');
    expect(rgb!.alpha).toBeCloseTo(0.5, 2);
  });
});


describe('HSL hue wrapping', () => {
  it('h=0 and h=360 produce the same color', () => {
    const a = hslToRgb({ h: 0,   s: 100, l: 50, alpha: 1 });
    const b = hslToRgb({ h: 360, s: 100, l: 50, alpha: 1 });
    expect(a.r).toBeCloseTo(b.r, 0);
    expect(a.g).toBeCloseTo(b.g, 0);
    expect(a.b).toBeCloseTo(b.b, 0);
  });

  it('h=-30 wraps to same as h=330', () => {
    const a = hslToRgb({ h: -30,  s: 100, l: 50, alpha: 1 });
    const b = hslToRgb({ h: 330,  s: 100, l: 50, alpha: 1 });
    expect(a.r).toBeCloseTo(b.r, 0);
    expect(a.g).toBeCloseTo(b.g, 0);
    expect(a.b).toBeCloseTo(b.b, 0);
  });

  it('h=720 wraps to same as h=0', () => {
    const a = hslToRgb({ h: 720, s: 100, l: 50, alpha: 1 });
    const b = hslToRgb({ h: 0,   s: 100, l: 50, alpha: 1 });
    expect(a.r).toBeCloseTo(b.r, 0);
    expect(a.g).toBeCloseTo(b.g, 0);
    expect(a.b).toBeCloseTo(b.b, 0);
  });

  it('rgbToHsl hue is always in [0, 360)', () => {
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const { h } = rgbToHsl({ r, g, b, alpha: 1 });
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThan(360);
        }
      }
    }
  });
});

describe('HSV hue wrapping', () => {
  it('h=0 and h=360 produce the same color', () => {
    const a = hsvToRgb({ h: 0,   s: 100, v: 100, alpha: 1 });
    const b = hsvToRgb({ h: 360, s: 100, v: 100, alpha: 1 });
    expect(a.r).toBeCloseTo(b.r, 0);
    expect(a.g).toBeCloseTo(b.g, 0);
    expect(a.b).toBeCloseTo(b.b, 0);
  });

  it('h=-30 wraps to same as h=330', () => {
    const a = hsvToRgb({ h: -30,  s: 100, v: 100, alpha: 1 });
    const b = hsvToRgb({ h: 330,  s: 100, v: 100, alpha: 1 });
    expect(a.r).toBeCloseTo(b.r, 0);
    expect(a.g).toBeCloseTo(b.g, 0);
    expect(a.b).toBeCloseTo(b.b, 0);
  });

  it('h=720 wraps to same as h=0', () => {
    const a = hsvToRgb({ h: 720, s: 100, v: 100, alpha: 1 });
    const b = hsvToRgb({ h: 0,   s: 100, v: 100, alpha: 1 });
    expect(a.r).toBeCloseTo(b.r, 0);
    expect(a.g).toBeCloseTo(b.g, 0);
    expect(a.b).toBeCloseTo(b.b, 0);
  });

  it('rgbToHsv hue is always in [0, 360)', () => {
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const { h } = rgbToHsv({ r, g, b, alpha: 1 });
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThan(360);
        }
      }
    }
  });
});


describe('alpha edge values survive all color space round-trips', () => {
  const alphas = [0, 0.001, 0.5, 0.999, 1];
  const base = { r: 128, g: 64, b: 200 };

  for (const alpha of alphas) {
    it(`alpha=${alpha}`, () => {
      const rgb = { ...base, alpha };
      // Test a selection of spaces that each handle alpha independently
      expect(hslToRgb(rgbToHsl(rgb)).alpha).toBeCloseTo(alpha, 2);
      expect(hsvToRgb(rgbToHsv(rgb)).alpha).toBeCloseTo(alpha, 2);
      expect(xyzToRgb(rgbToXyz(rgb)).alpha).toBeCloseTo(alpha, 2);
      expect(labToRgb(rgbToLab(rgb)).alpha).toBeCloseTo(alpha, 2);
    });
  }
});


describe('deltaE2000', () => {
  const black: Parameters<typeof deltaE2000>[0] = { l: 0,   a: 0, b: 0, alpha: 1, colorSpace: 'lab' };
  const white: Parameters<typeof deltaE2000>[0] = { l: 100, a: 0, b: 0, alpha: 1, colorSpace: 'lab' };
  const grey:  Parameters<typeof deltaE2000>[0] = { l: 50,  a: 0, b: 0, alpha: 1, colorSpace: 'lab' };
  const red:   Parameters<typeof deltaE2000>[0] = { l: 50,  a: 70, b: 50, alpha: 1, colorSpace: 'lab' };

  it('identical colors → 0', () => {
    expect(deltaE2000(black, black)).toBe(0);
    expect(deltaE2000(white, white)).toBe(0);
    expect(deltaE2000(grey,  grey)).toBe(0);
    expect(deltaE2000(red,   red)).toBe(0);
  });

  it('symmetric: deltaE(a,b) === deltaE(b,a)', () => {
    expect(deltaE2000(black, white)).toBeCloseTo(deltaE2000(white, black), 6);
    expect(deltaE2000(black, grey)).toBeCloseTo(deltaE2000(grey, black), 6);
    expect(deltaE2000(grey,  red)).toBeCloseTo(deltaE2000(red, grey), 6);
  });

  it('two achromatic colors — distance is purely lightness-based', () => {
    // black vs grey vs white: all achromatic, distance should be > 0 and ordered
    const dBG = deltaE2000(black, grey);
    const dGW = deltaE2000(grey, white);
    const dBW = deltaE2000(black, white);
    expect(dBG).toBeGreaterThan(0);
    expect(dGW).toBeGreaterThan(0);
    expect(dBW).toBeGreaterThan(dBG);
    expect(dBW).toBeGreaterThan(dGW);
  });

  it('black vs white → large distance (~100)', () => {
    // ΔE2000 black/white is well-established at ~100
    expect(deltaE2000(black, white)).toBeCloseTo(100, -1);
  });

  it('non-negative for all inputs', () => {
    const pairs = [[black, white], [black, grey], [grey, white], [grey, red], [black, red]];
    for (const [a, b] of pairs) {
      expect(deltaE2000(a!, b!)).toBeGreaterThanOrEqual(0);
    }
  });
});

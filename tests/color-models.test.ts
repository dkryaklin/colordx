import { describe, it, expect, beforeAll } from 'vitest';
import { colordx, extend } from '../src/index.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';

beforeAll(() => extend([hsv, hwb]));
import { xyzD50ToLinearSrgb } from '../src/colorModels/xyz.js';

const inputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060'];

describe('toHwb round-trip', () => {
  it.each(inputs)('%s', (input) => {
    expect(colordx(input).toHwb()).toEqual(colordx(colordx(input).toHwb()).toHwb());
  });
});

describe('toHwbString', () => {
  it('round-trips opaque colors', () => {
    expect(colordx(colordx('#ff0000').toHwbString()).toHex()).toBe('#ff0000');
    expect(colordx(colordx('#ffffff').toHwbString()).toHex()).toBe('#ffffff');
    expect(colordx(colordx('#000000').toHwbString()).toHex()).toBe('#000000');
  });

  it('includes alpha in string when < 1', () => {
    const str = colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }).toHwbString();
    expect(str).toMatch(/\/ 0\.5/);
    expect(colordx(str).alpha()).toBeCloseTo(0.5, 2);
  });
});

describe('HWB string parsing', () => {
  it('parses hwb string opaque', () => {
    expect(colordx('hwb(0 0% 0%)').toHex()).toBe('#ff0000');
    expect(colordx('hwb(120 0% 0%)').toHex()).toBe('#00ff00');
    expect(colordx('hwb(240 0% 0%)').toHex()).toBe('#0000ff');
    expect(colordx('hwb(0 100% 0%)').toHex()).toBe('#ffffff');
    expect(colordx('hwb(0 0% 100%)').toHex()).toBe('#000000');
  });

  it('parses hwb string with alpha', () => {
    expect(colordx('hwb(0 0% 0% / 0.5)').alpha()).toBe(0.5);
  });
});

describe('HWB object parsing', () => {
  it('round-trips', () => {
    const hwb = colordx('#ff0000').toHwb();
    expect(colordx(hwb).toHex()).toBe('#ff0000');
  });

  it('handles full black (b=100)', () => {
    expect(colordx({ h: 0, w: 0, b: 100, alpha: 1 }).toHex()).toBe('#000000');
  });
});

describe('toOklab round-trip', () => {
  it.each(inputs)('%s', (input) => {
    const oklab = colordx(input).toOklab();
    const rgb = colordx(oklab).toRgb();
    const orig = colordx(input).toRgb();
    expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
  });
});

describe('toOklabString alpha', () => {
  it('includes alpha in string when < 1', () => {
    const str = colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }).toOklabString();
    expect(str).toMatch(/\/ 0\.5/);
    expect(colordx(str).alpha()).toBeCloseTo(0.5, 2);
  });
});

describe('toOklabString round-trip', () => {
  it.each(inputs)('%s', (input) => {
    const str = colordx(input).toOklabString();
    expect(str).toMatch(/^oklab\(/);
    const rgb = colordx(str).toRgb();
    const orig = colordx(input).toRgb();
    expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
  });
});

describe('OKLab string parsing', () => {
  it('parses oklab string opaque', () => {
    // oklab(1 0 0) = white (L=1, a=0, b=0)
    const white = colordx('oklab(1 0 0)').toRgb();
    expect(white.r).toBeCloseTo(255, -1);
    expect(white.g).toBeCloseTo(255, -1);
    expect(white.b).toBeCloseTo(255, -1);
  });

  it('parses oklab string with alpha', () => {
    const result = colordx('oklab(1 0 0 / 0.5)');
    expect(result.alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses oklab string with alpha percentage', () => {
    const result = colordx('oklab(1 0 0 / 50%)');
    expect(result.alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses oklab string with percentage L', () => {
    // 100% L = 1.0
    const a = colordx('oklab(100% 0 0)').toRgb();
    const b = colordx('oklab(1 0 0)').toRgb();
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
  });

  it('parses oklab string with percentage a/b', () => {
    // 100% a = 0.4, so 25% a = 0.1
    const result = colordx('oklab(0.5 25% 0)');
    const expected = colordx('oklab(0.5 0.1 0)');
    expect(result.toHex()).toBe(expected.toHex());
  });

  it('round-trips through toOklabString', () => {
    for (const input of inputs) {
      const str = colordx(input).toOklabString();
      const result = colordx(str).toRgb();
      const orig = colordx(input).toRgb();
      expect(Math.abs(result.r - orig.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.g - orig.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.b - orig.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('OKLab object parsing', () => {
  it('round-trips', () => {
    const oklab = colordx('#ff0000').toOklab();
    const result = colordx(oklab).toRgb();
    const orig = colordx('#ff0000').toRgb();
    expect(Math.abs(result.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.b - orig.b)).toBeLessThanOrEqual(1);
  });

  it('parses OKLab object with alpha', () => {
    const oklab = { ...colordx('#ff0000').toOklab(), alpha: 0.5 };
    expect(colordx(oklab).alpha()).toBe(0.5);
  });
});

describe('toOklch round-trip', () => {
  it.each(inputs)('%s', (input) => {
    const oklch = colordx(input).toOklch();
    const rgb = colordx(oklch).toRgb();
    const orig = colordx(input).toRgb();
    expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
  });
});

describe('toOklchString alpha', () => {
  it('includes alpha in string when < 1', () => {
    const str = colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }).toOklchString();
    expect(str).toMatch(/\/ 0\.5/);
    expect(colordx(str).alpha()).toBeCloseTo(0.5, 2);
  });
});

describe('toOklchString round-trip', () => {
  it.each(inputs)('%s', (input) => {
    const str = colordx(input).toOklchString();
    expect(str).toMatch(/^oklch\(/);
    const rgb = colordx(str).toRgb();
    const orig = colordx(input).toRgb();
    expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
  });
});

describe('OKLch string parsing', () => {
  it('parses oklch string: oklch(0.5 0.2 240)', () => {
    const result = colordx('oklch(0.5 0.2 240)');
    expect(result.isValid()).toBe(true);
    const rgb = result.toRgb();
    // Should produce a valid bluish color
    expect(rgb.b).toBeGreaterThan(rgb.r);
  });

  it('parses oklch string with alpha', () => {
    const result = colordx('oklch(0.5 0.2 240 / 0.5)');
    expect(result.alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses oklch string with alpha percentage', () => {
    const result = colordx('oklch(0.5 0.2 240 / 50%)');
    expect(result.alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses oklch string with percentage L', () => {
    const a = colordx('oklch(50% 0.2 240)').toRgb();
    const b = colordx('oklch(0.5 0.2 240)').toRgb();
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
  });

  it('parses oklch string with percentage C (100% = 0.4)', () => {
    const a = colordx('oklch(0.5 50% 240)').toRgb();
    const b = colordx('oklch(0.5 0.2 240)').toRgb();
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
  });

  it('round-trips through toOklchString', () => {
    for (const input of inputs) {
      const str = colordx(input).toOklchString();
      const result = colordx(str).toRgb();
      const orig = colordx(input).toRgb();
      expect(Math.abs(result.r - orig.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.g - orig.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.b - orig.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('OKLch object parsing', () => {
  it('round-trips', () => {
    const oklch = colordx('#ff0000').toOklch();
    const result = colordx(oklch).toRgb();
    const orig = colordx('#ff0000').toRgb();
    expect(Math.abs(result.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.b - orig.b)).toBeLessThanOrEqual(1);
  });

  it('parses OKLch object with alpha', () => {
    const oklch = { ...colordx('#ff0000').toOklch(), alpha: 0.5 };
    expect(colordx(oklch).alpha()).toBe(0.5);
  });
});

describe('OKLab value ranges', () => {
  it('black has L=0', () => {
    const oklab = colordx('#000000').toOklab();
    expect(oklab.l).toBeCloseTo(0, 3);
    expect(oklab.a).toBeCloseTo(0, 3);
    expect(oklab.b).toBeCloseTo(0, 3);
  });

  it('white has L close to 1', () => {
    const oklab = colordx('#ffffff').toOklab();
    expect(oklab.l).toBeCloseTo(1, 2);
    expect(oklab.a).toBeCloseTo(0, 3);
    expect(oklab.b).toBeCloseTo(0, 3);
  });

  it('L is between 0 and 1 for all test inputs', () => {
    for (const input of inputs) {
      const { l } = colordx(input).toOklab();
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
  });
});

describe('OKLch value ranges', () => {
  it('black has L=0, C=0', () => {
    const oklch = colordx('#000000').toOklch();
    expect(oklch.l).toBeCloseTo(0, 3);
    expect(oklch.c).toBeCloseTo(0, 3);
  });

  it('white has L close to 1, C close to 0', () => {
    const oklch = colordx('#ffffff').toOklch();
    expect(oklch.l).toBeCloseTo(1, 2);
    expect(oklch.c).toBeCloseTo(0, 3);
  });

  it('H is 0-360 for all test inputs with non-zero chroma', () => {
    for (const input of inputs) {
      const { h, c } = colordx(input).toOklch();
      if (c > 0.001) {
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
      }
    }
  });
});

// Extended inputs: midtones and saturated colors beyond the basic 6
const extendedInputs = ['#ff8800', '#8800ff', '#00ffff', '#ff00ff', '#808080', '#3b82f6'];

describe('toHwb: extended inputs round-trip', () => {
  it.each(extendedInputs)('%s', (input) => {
    expect(colordx(input).toHwb()).toEqual(colordx(colordx(input).toHwb()).toHwb());
  });
});

describe('HWB: additional edge cases', () => {
  it('w=50%, b=0% gives halfway-to-white tint (pink for red hue)', () => {
    const result = colordx('hwb(0 50% 0%)').toRgb();
    expect(result.r).toBe(255);
    expect(result.g).toBeCloseTo(128, 0);
    expect(result.b).toBeCloseTo(128, 0);
  });

  it('w=0%, b=50% gives halfway-to-black shade (dark red)', () => {
    const result = colordx('hwb(0 0% 50%)').toRgb();
    expect(result.r).toBeCloseTo(128, 0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it('green hue (120) in hwb', () => {
    expect(colordx('hwb(120 0% 0%)').toHex()).toBe('#00ff00');
  });

  it('blue hue (240) in hwb', () => {
    expect(colordx('hwb(240 0% 0%)').toHex()).toBe('#0000ff');
  });

  it('cyan hue (180) in hwb', () => {
    expect(colordx('hwb(180 0% 0%)').toHex()).toBe('#00ffff');
  });

  it('magenta hue (300) in hwb', () => {
    expect(colordx('hwb(300 0% 0%)').toHex()).toBe('#ff00ff');
  });

  it('w=100% at any hue produces white', () => {
    expect(colordx('hwb(120 100% 0%)').toHex()).toBe('#ffffff');
    expect(colordx('hwb(240 100% 0%)').toHex()).toBe('#ffffff');
  });

  it('b=100% at any hue produces black', () => {
    expect(colordx('hwb(120 0% 100%)').toHex()).toBe('#000000');
    expect(colordx('hwb(240 0% 100%)').toHex()).toBe('#000000');
  });

  it('toHwbString round-trips for midtone colors within ±1 per channel', () => {
    // HWB default precision=0 (integer W/B) may lose sub-integer precision → allow ±1
    for (const c of extendedInputs) {
      const back = colordx(colordx(c).toHwbString()).toRgb();
      const orig = colordx(c).toRgb();
      expect(Math.abs(back.r - orig.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - orig.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - orig.b)).toBeLessThanOrEqual(1);
    }
  });
});

describe('OKLab: extended inputs round-trip', () => {
  it.each(extendedInputs)('%s', (input) => {
    const oklab = colordx(input).toOklab();
    const rgb = colordx(oklab).toRgb();
    const orig = colordx(input).toRgb();
    expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
  });
});

describe('OKLab: axis directions', () => {
  it('red has positive a (reddish direction)', () => {
    expect(colordx('#ff0000').toOklab().a).toBeGreaterThan(0);
  });

  it('green has negative a (greenish direction)', () => {
    expect(colordx('#00ff00').toOklab().a).toBeLessThan(0);
  });

  it('blue has negative b (bluish direction)', () => {
    expect(colordx('#0000ff').toOklab().b).toBeLessThan(0);
  });

  it('yellow has positive b (yellowish direction)', () => {
    expect(colordx('#ffff00').toOklab().b).toBeGreaterThan(0);
  });

  it('achromatic colors have a and b near 0', () => {
    for (const c of ['#000000', '#808080', '#ffffff']) {
      const { a, b } = colordx(c).toOklab();
      expect(Math.abs(a)).toBeLessThan(0.01);
      expect(Math.abs(b)).toBeLessThan(0.01);
    }
  });

  it('all extended inputs have L in [0, 1]', () => {
    for (const c of extendedInputs) {
      const { l } = colordx(c).toOklab();
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
  });
});

describe('OKLch: extended inputs round-trip', () => {
  it.each(extendedInputs)('%s', (input) => {
    const oklch = colordx(input).toOklch();
    const rgb = colordx(oklch).toRgb();
    const orig = colordx(input).toRgb();
    expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
  });
});

describe('OKLch: chroma and hue properties', () => {
  it('achromatic grays have C near 0', () => {
    for (const c of ['#808080', '#444444', '#cccccc']) {
      expect(colordx(c).toOklch().c).toBeCloseTo(0, 2);
    }
  });

  it('chromatic colors have higher C than gray', () => {
    const chromaGray = colordx('#808080').toOklch().c;
    for (const c of ['#ff0000', '#00ff00', '#0000ff']) {
      expect(colordx(c).toOklch().c).toBeGreaterThan(chromaGray + 0.1);
    }
  });

  it('oklch hue=0 and hue=360 produce same color', () => {
    const a = colordx('oklch(0.6279 0.2577 0)').toRgb();
    const b = colordx('oklch(0.6279 0.2577 360)').toRgb();
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
  });

  it('C=0 produces an achromatic (gray) color', () => {
    const result = colordx('oklch(0.5 0 0)').toRgb();
    expect(Math.abs(result.r - result.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(result.g - result.b)).toBeLessThanOrEqual(2);
  });

  it('H is in [0, 360) for extended chromatic inputs', () => {
    for (const c of extendedInputs) {
      const { h, c: chroma } = colordx(c).toOklch();
      if (chroma > 0.01) {
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
      }
    }
  });
});

describe('hsl() space-syntax without % on s/l (CSS Color 4)', () => {
  // CSS Color 4 modern space syntax allows bare numbers (0-100) for s and l
  it('parses hsl with bare numbers for s and l', () => {
    expect(colordx('hsl(0 100 50)').isValid()).toBe(true);
    expect(colordx('hsl(0 100 50)').toHex()).toBe('#ff0000');
  });

  it('parses hsl space-syntax bare numbers with alpha', () => {
    expect(colordx('hsl(0 100 50 / 0.5)').isValid()).toBe(true);
    expect(colordx('hsl(0 100 50 / 0.5)').alpha()).toBeCloseTo(0.5, 2);
  });

  it('still requires % in legacy comma syntax', () => {
    expect(colordx('hsl(0, 100, 50)').isValid()).toBe(false);
  });

  it('bare numbers produce same result as % equivalents', () => {
    const withPct = colordx('hsl(120 50% 25%)').toRgb();
    const withNum = colordx('hsl(120 50 25)').toRgb();
    expect(withNum).toEqual(withPct);
  });
});

describe('hwb() w+b overflow normalization (CSS spec)', () => {
  // When w + b >= 100, CSS spec says normalize proportionally to sum to 100%
  it('normalizes when w + b > 100 — produces grey', () => {
    // hwb(0 70% 70%) → normalized to hwb(0 50% 50%) → rgb(128, 128, 128)
    const c = colordx('hwb(0 70% 70%)');
    expect(c.isValid()).toBe(true);
    const { r, g, b } = c.toRgb();
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('hwb(0 70% 70%) normalizes to same as hwb(0 50% 50%)', () => {
    const normalized = colordx('hwb(0 50% 50%)').toRgb();
    const overflow = colordx('hwb(0 70% 70%)').toRgb();
    expect(overflow.r).toBe(normalized.r);
    expect(overflow.g).toBe(normalized.g);
    expect(overflow.b).toBe(normalized.b);
  });

  it('hwb(0 100% 100%) → grey (equal proportions)', () => {
    const { r, g, b } = colordx('hwb(0 100% 100%)').toRgb();
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('hwb with unequal overflow preserves ratio', () => {
    // hwb(0 25% 75%) sum=100 — no normalization needed, is pure black
    // hwb(0 50% 150%) sum=200 — normalized to hwb(0 25% 75%) → same result
    const base = colordx('hwb(0 25% 75%)').toRgb();
    const overflow = colordx('hwb(0 50% 150%)').toRgb();
    expect(overflow.r).toBe(base.r);
    expect(overflow.g).toBe(base.g);
    expect(overflow.b).toBe(base.b);
  });
});

describe('hex parsing', () => {
  it('requires # prefix — bare 3-digit hex is not a valid color', () => {
    expect(colordx('999').isValid()).toBe(false);
    expect(colordx('fff').isValid()).toBe(false);
    expect(colordx('abc').isValid()).toBe(false);
    expect(colordx('0a1b2c').isValid()).toBe(false);
  });

  it('accepts # prefix', () => {
    expect(colordx('#999').isValid()).toBe(true);
    expect(colordx('#fff').isValid()).toBe(true);
    expect(colordx('#ff0000').isValid()).toBe(true);
  });
});

describe('rgb() percentage channels', () => {
  it('parses all-percentage rgb', () => {
    const c = colordx('rgb(100%,100%,100%)');
    expect(c.isValid()).toBe(true);
    expect(c.toHex()).toBe('#ffffff');
  });

  it('parses all-percentage rgba with alpha', () => {
    const c = colordx('rgba(100%, 64.7%, 0%, .5)');
    expect(c.isValid()).toBe(true);
    expect(c.toRgb()).toMatchObject({ r: 255, g: 165, b: 0, alpha: 0.5 });
  });

  it('parses space-syntax percentage rgb', () => {
    const c = colordx('rgb(100% 0% 0%)');
    expect(c.isValid()).toBe(true);
    expect(c.toHex()).toBe('#ff0000');
  });

  it('rejects mixed percentage and number channels', () => {
    expect(colordx('rgb(50%,23,54)').isValid()).toBe(false);
    expect(colordx('rgb(255,50%,0)').isValid()).toBe(false);
  });

  it('parses modern space-syntax with percentage alpha', () => {
    const c = colordx('rgb(143 101 98 / 43%)');
    expect(c.isValid()).toBe(true);
    expect(c.toRgb()).toMatchObject({ r: 143, g: 101, b: 98, alpha: 0.43 });
  });
});

// Deferred-rounding precision: channels are stored as floats internally and
// rounded only at output (toRgb/toRgbString/toNumber). Tests below verify:
//   1. toHsl/toHsv values are exact when the input maps to a clean percentage
//   2. toRgb() still returns integers regardless of the conversion path

describe('hslToRgb deferred-rounding precision', () => {
  it('hsl(0, 0%, 50%) → toHsl gives l=50 exactly (no 128/255 drift)', () => {
    // 50% → 127.5 stored → 127.5/255 = 0.5 → l=50 exactly
    expect(colordx('hsl(0, 0%, 50%)').toHsl().l).toBe(50);
  });

  it('hsl(30, 100%, 50%) → toHsl gives h=30 exactly', () => {
    // g = 127.5 stored → gn = 0.5 exactly → hue math gives 30° exactly
    expect(colordx('hsl(30, 100%, 50%)').toHsl().h).toBe(30);
  });

  it('hsl(120, 50%, 50%) → toHsl gives all three channels exactly', () => {
    const { h, s, l } = colordx('hsl(120, 50%, 50%)').toHsl();
    expect(h).toBe(120);
    expect(s).toBe(50);
    expect(l).toBe(50);
  });

  it('hsl(0, 0%, 50%) → toRgb still returns integers', () => {
    const { r, g, b } = colordx('hsl(0, 0%, 50%)').toRgb();
    expect(Number.isInteger(r)).toBe(true);
    expect(Number.isInteger(g)).toBe(true);
    expect(Number.isInteger(b)).toBe(true);
  });
});

describe('hsvToRgb deferred-rounding precision', () => {
  it('hsv(0, 0%, 50%) → toHsv gives v=50 exactly', () => {
    // vn=0.5 → r=g=b=127.5 stored → v = max/255 = 0.5 → v=50 exactly
    expect(colordx({ h: 0, s: 0, v: 50 }).toHsv().v).toBe(50);
  });

  it('hsv(180, 50%, 80%) → toRgb returns integers', () => {
    const { r, g, b } = colordx({ h: 180, s: 50, v: 80 }).toRgb();
    expect(Number.isInteger(r)).toBe(true);
    expect(Number.isInteger(g)).toBe(true);
    expect(Number.isInteger(b)).toBe(true);
  });
});

describe('CSS Color 4 none keyword — oklch', () => {
  it('none in chroma is treated as 0 (achromatic)', () => {
    const withNone = colordx('oklch(0.5 none 200)').toRgb();
    const withZero = colordx('oklch(0.5 0 200)').toRgb();
    expect(withNone.r).toBe(withZero.r);
    expect(withNone.g).toBe(withZero.g);
    expect(withNone.b).toBe(withZero.b);
  });

  it('none in lightness is treated as 0 (black)', () => {
    const withNone = colordx('oklch(none 0.2 200)').toRgb();
    const withZero = colordx('oklch(0 0.2 200)').toRgb();
    expect(withNone.r).toBe(withZero.r);
    expect(withNone.g).toBe(withZero.g);
    expect(withNone.b).toBe(withZero.b);
  });

  it('none in hue is treated as 0', () => {
    const withNone = colordx('oklch(0.5 0.2 none)').toRgb();
    const withZero = colordx('oklch(0.5 0.2 0)').toRgb();
    expect(withNone.r).toBe(withZero.r);
    expect(withNone.g).toBe(withZero.g);
    expect(withNone.b).toBe(withZero.b);
  });

  it('none in alpha is treated as 0 (fully transparent)', () => {
    const result = colordx('oklch(0.5 0.2 200 / none)');
    expect(result.isValid()).toBe(true);
    expect(result.alpha()).toBe(0);
  });

  it('none is case-insensitive (NONE, None)', () => {
    expect(colordx('oklch(0.5 NONE 200)').isValid()).toBe(true);
    expect(colordx('oklch(0.5 None 200)').isValid()).toBe(true);
  });

  it('all channels none is valid and produces black', () => {
    const result = colordx('oklch(none none none)');
    expect(result.isValid()).toBe(true);
    expect(result.toRgb()).toMatchObject({ r: 0, g: 0, b: 0 });
  });

  it('none with percentage L still resolves correctly', () => {
    const withNone = colordx('oklch(50% none 200)').toRgb();
    const withZero = colordx('oklch(50% 0 200)').toRgb();
    expect(withNone.r).toBe(withZero.r);
    expect(withNone.g).toBe(withZero.g);
    expect(withNone.b).toBe(withZero.b);
  });
});

describe('CSS Color 4 none keyword — oklab', () => {
  it('none in a channel is treated as 0', () => {
    const withNone = colordx('oklab(0.5 none 0)').toRgb();
    const withZero = colordx('oklab(0.5 0 0)').toRgb();
    expect(withNone.r).toBe(withZero.r);
    expect(withNone.g).toBe(withZero.g);
    expect(withNone.b).toBe(withZero.b);
  });

  it('none in b channel is treated as 0', () => {
    const withNone = colordx('oklab(0.5 0 none)').toRgb();
    const withZero = colordx('oklab(0.5 0 0)').toRgb();
    expect(withNone.r).toBe(withZero.r);
    expect(withNone.g).toBe(withZero.g);
    expect(withNone.b).toBe(withZero.b);
  });

  it('none in lightness is treated as 0 (black)', () => {
    const withNone = colordx('oklab(none 0 0)').toRgb();
    const withZero = colordx('oklab(0 0 0)').toRgb();
    expect(withNone.r).toBe(withZero.r);
    expect(withNone.g).toBe(withZero.g);
    expect(withNone.b).toBe(withZero.b);
  });

  it('none in alpha is treated as 0 (fully transparent)', () => {
    const result = colordx('oklab(0.5 0 0 / none)');
    expect(result.isValid()).toBe(true);
    expect(result.alpha()).toBe(0);
  });

  it('none is case-insensitive (NONE, None)', () => {
    expect(colordx('oklab(0.5 NONE 0)').isValid()).toBe(true);
    expect(colordx('oklab(0.5 None 0)').isValid()).toBe(true);
  });

  it('all channels none produces black', () => {
    const result = colordx('oklab(none none none)');
    expect(result.isValid()).toBe(true);
    expect(result.toRgb()).toMatchObject({ r: 0, g: 0, b: 0 });
  });
});

describe('oklabToRgb deferred-rounding precision', () => {
  it('oklab achromatic → toRgb returns integers', () => {
    const { r, g, b } = colordx('oklab(0.5 0 0)').toRgb();
    expect(Number.isInteger(r)).toBe(true);
    expect(Number.isInteger(g)).toBe(true);
    expect(Number.isInteger(b)).toBe(true);
  });

  it('oklab round-trip through toHsl loses no extra precision vs hex path', () => {
    // hex #808080 → toHsl should give same result as oklab-parsed equivalent
    const fromHex = colordx('#808080').toHsl();
    const fromOklab = colordx(colordx('#808080').toOklab()).toHsl();
    expect(Math.abs(fromOklab.l - fromHex.l)).toBeLessThanOrEqual(0.5);
  });

  it('oklabToRgb → toOklab round-trip stays within floating-point tolerance', () => {
    const original = colordx('#3b82f6').toOklab();
    const roundtripped = colordx(original).toOklab();
    expect(Math.abs(roundtripped.l - original.l)).toBeLessThan(0.001);
    expect(Math.abs(roundtripped.a - original.a)).toBeLessThan(0.001);
    expect(Math.abs(roundtripped.b - original.b)).toBeLessThan(0.001);
  });
});

describe('xyzD50ToLinearSrgb', () => {
  it('returns linear sRGB values outside [0,1] without clamping for out-of-gamut XYZ', () => {
    // D50 white point → linear sRGB should be exactly [1, 1, 1]
    const [r, g, b] = xyzD50ToLinearSrgb(96.42956752983539, 100, 82.51046025104603);
    expect(r).toBeCloseTo(1, 4);
    expect(g).toBeCloseTo(1, 4);
    expect(b).toBeCloseTo(1, 4);
  });

  it('returns [0, 0, 0] for XYZ black', () => {
    const [r, g, b] = xyzD50ToLinearSrgb(0, 0, 0);
    expect(r).toBeCloseTo(0, 6);
    expect(g).toBeCloseTo(0, 6);
    expect(b).toBeCloseTo(0, 6);
  });

  it('returns unclamped values > 1 for out-of-sRGB XYZ coordinates', () => {
    // P3 red primary in XYZ D50 ≈ (47.5, 22.9, 1.6) — gives r > 1 in linear sRGB.
    // The function must NOT clamp: raw out-of-gamut values are required by callers
    // like gamut.ts that need to detect out-of-gamut colors.
    const [rp3] = xyzD50ToLinearSrgb(47.5, 22.9, 1.6);
    expect(rp3).toBeGreaterThan(1);
  });

  it('sRGB red primary roundtrip: sRGB red → XYZ → linear sRGB = [1, 0, 0]', () => {
    // sRGB red linear = [1, 0, 0]; forward: sRGB→XYZ D65→D50; reverse: D50→D65→linear sRGB
    // XYZ D50 of sRGB red ≈ (43.61, 22.25, 1.39) — from CSS Color 4 matrix
    const [r, g, b] = xyzD50ToLinearSrgb(43.60654, 22.24884, 1.38956);
    expect(r).toBeCloseTo(1, 3);
    expect(g).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0, 3);
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import cmyk from '../src/plugins/cmyk.js';
import delta from '../src/plugins/delta.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';

beforeAll(() => {
  extend([lab, lch, cmyk, delta]);
});

const inputs = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#c06060'];

describe('toLab round-trip', () => {
  it.each(inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lab = (colordx(input) as any).toLab();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (colordx(lab) as any).toHex();
    expect(result).toBe(colordx(input).toHex());
  });
});

describe('toXyz round-trip', () => {
  it.each(inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xyz = (colordx(input) as any).toXyz();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (colordx(xyz) as any).toHex();
    expect(result).toBe(colordx(input).toHex());
  });
});

describe('toLch round-trip', () => {
  it.each(inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lch = (colordx(input) as any).toLch();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (colordx(lch) as any).toHex();
    expect(result).toBe(colordx(input).toHex());
  });
});

describe('LCH string parsing', () => {
  it('round-trips through toLchString', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx((colordx('#ff0000') as any).toLchString()).toHex()).toBe('#ff0000');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx((colordx('#0000ff') as any).toLchString()).toHex()).toBe('#0000ff');
  });

  it('parses lch string with alpha as percentage', () => {
    expect(colordx('lch(50% 50 180 / 50%)').alpha()).toBeCloseTo(0.5, 2);
  });

  it('parses lch string with alpha decimal', () => {
    expect(colordx('lch(50% 50 180 / 0.5)').alpha()).toBeCloseTo(0.5, 2);
  });
});

describe('toCmyk round-trip', () => {
  it.each(inputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx((colordx(input) as any).toCmyk()).toHex()).toBe(colordx(input).toHex());
  });
});

describe('CMYK black (k=100 edge case)', () => {
  it('pure black has c=m=y=0, k=100', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#000000') as any).toCmyk()).toEqual({ c: 0, m: 0, y: 0, k: 100, a: 1 });
  });
});

describe('CMYK string parsing', () => {
  it('parses device-cmyk string with percentages', () => {
    expect(colordx('device-cmyk(0% 100% 100% 0%)').toHex()).toBe('#ff0000');
    expect(colordx('device-cmyk(100% 0% 100% 0%)').toHex()).toBe('#00ff00');
    expect(colordx('device-cmyk(100% 100% 0% 0%)').toHex()).toBe('#0000ff');
  });

  it('parses device-cmyk string with fractional values', () => {
    expect(colordx('device-cmyk(0 1 1 0)').toHex()).toBe('#ff0000');
  });

  it('parses device-cmyk string with alpha', () => {
    expect(colordx('device-cmyk(0% 100% 100% 0% / 0.5)').alpha()).toBe(0.5);
    expect(colordx('device-cmyk(0% 100% 100% 0% / 50%)').alpha()).toBeCloseTo(0.5, 2);
  });

  it('round-trips through toCmykString', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx((colordx('#ff0000') as any).toCmykString()).toHex()).toBe('#ff0000');
  });
});

describe('delta', () => {
  it('same color returns 0', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#ff0000') as any).delta('#ff0000')).toBe(0);
  });

  it('defaults to white', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = colordx('#000000') as any;
    expect(d.delta()).toBeCloseTo(d.delta('#fff'), 5);
  });

  it('black vs white is max distance', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#000000') as any).delta('#ffffff')).toBeGreaterThan(0.9);
  });

  it('different colors have non-zero delta', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#ff0000') as any).delta('#0000ff')).toBeGreaterThan(0);
  });

  it('achromatic color1 covers h1p=0 branch (a1p=0 && b1=0)', () => {
    // Gray has a=0, b=0 in Lab → h1p short-circuits to 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#808080') as any).delta('#ff0000')).toBeGreaterThan(0);
  });

  it('blue color1 covers negative hue angle branch', () => {
    // Blue has negative Lab b → atan2 returns negative angle → h1p < 0 → h1p + 360
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#0000ff') as any).delta('#ff0000')).toBeGreaterThan(0);
  });

  it('blue vs yellow covers absDh > 180 && h2 <= h1 branch', () => {
    // Blue h≈306°, yellow h≈100° → |306-100|=206>180, h2(100)<=h1(306) → dhp+=360
    // Also h1+h2=406>=360 → Hm-360 branch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#0000ff') as any).delta('#ffff00')).toBeGreaterThan(0);
  });
});

describe('Lab object parsing edge cases', () => {
  it('rejects Lab object when "r" key is present (avoids RGB collision)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx({ l: 50, a: 25, b: -10, alpha: 1, r: 255 } as any).isValid()).toBe(false);
  });

  it('rejects Lab object when alpha is NaN', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx({ l: 50, a: 25, b: -10, alpha: NaN } as any).isValid()).toBe(false);
  });
});

describe('LCH object parsing edge cases', () => {
  it('rejects LCH object with NaN alpha', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx({ l: 50, c: 30, h: 180, a: NaN } as any).isValid()).toBe(false);
  });
});

describe('toCmykString with alpha', () => {
  it('includes alpha in output when color has alpha < 1', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const str = (colordx({ r: 255, g: 0, b: 0, a: 0.5 }) as any).toCmykString();
    expect(str).toMatch(/\/ 0\.5/);
  });
});

const extendedInputs = ['#ff8800', '#8800ff', '#00ffff', '#ff00ff', '#808080'];

describe('toLab: extended inputs round-trip', () => {
  it.each(extendedInputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lab = (colordx(input) as any).toLab();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx(lab) as any).toHex()).toBe(colordx(input).toHex());
  });
});

describe('Lab value properties', () => {
  it('L* for white is near 100', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#ffffff') as any).toLab().l).toBeCloseTo(100, 0);
  });

  it('L* for black is near 0', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx('#000000') as any).toLab().l).toBeCloseTo(0, 0);
  });

  it('L* increases from dark to light grays', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lDark = (colordx('#333333') as any).toLab().l;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lMid = (colordx('#808080') as any).toLab().l;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lLight = (colordx('#cccccc') as any).toLab().l;
    expect(lMid).toBeGreaterThan(lDark);
    expect(lLight).toBeGreaterThan(lMid);
  });

  it('a* and b* are near 0 for achromatic colors', () => {
    for (const c of ['#000000', '#808080', '#ffffff']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lab = (colordx(c) as any).toLab();
      expect(Math.abs(lab.a)).toBeLessThan(1);
      expect(Math.abs(lab.b)).toBeLessThan(1);
    }
  });
});

describe('toLch: extended inputs round-trip', () => {
  it.each(extendedInputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lch = (colordx(input) as any).toLch();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((colordx(lch) as any).toHex()).toBe(colordx(input).toHex());
  });
});

describe('LCH value properties', () => {
  it('C* for achromatic grays is near 0', () => {
    for (const c of ['#000000', '#808080', '#ffffff']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((colordx(c) as any).toLch().c).toBeCloseTo(0, 0);
    }
  });

  it('H for LCH is in [0, 360) for chromatic colors', () => {
    for (const c of [...inputs, ...extendedInputs]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lch = (colordx(c) as any).toLch();
      if (lch.c > 1) {
        expect(lch.h).toBeGreaterThanOrEqual(0);
        expect(lch.h).toBeLessThan(360);
      }
    }
  });
});

describe('CMYK: extended inputs round-trip', () => {
  it.each(extendedInputs)('%s', (input) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(colordx((colordx(input) as any).toCmyk()).toHex()).toBe(colordx(input).toHex());
  });
});

describe('CMYK: known primary values', () => {
  it('white has c=m=y=k=0', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmyk = (colordx('#ffffff') as any).toCmyk();
    expect(cmyk.c).toBe(0);
    expect(cmyk.m).toBe(0);
    expect(cmyk.y).toBe(0);
    expect(cmyk.k).toBe(0);
  });

  it('pure red is c=0, m=100, y=100, k=0', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmyk = (colordx('#ff0000') as any).toCmyk();
    expect(cmyk.c).toBe(0);
    expect(cmyk.m).toBe(100);
    expect(cmyk.y).toBe(100);
    expect(cmyk.k).toBe(0);
  });

  it('pure green (#00ff00) is c=100, m=0, y=100, k=0', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmyk = (colordx('#00ff00') as any).toCmyk();
    expect(cmyk.c).toBe(100);
    expect(cmyk.m).toBe(0);
    expect(cmyk.y).toBe(100);
    expect(cmyk.k).toBe(0);
  });

  it('pure blue is c=100, m=100, y=0, k=0', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmyk = (colordx('#0000ff') as any).toCmyk();
    expect(cmyk.c).toBe(100);
    expect(cmyk.m).toBe(100);
    expect(cmyk.y).toBe(0);
    expect(cmyk.k).toBe(0);
  });
});

describe('delta: additional cases', () => {
  it('is approximately symmetric (delta(a,b) ≈ delta(b,a))', () => {
    const ab = (colordx('#ff0000') as any).delta('#0000ff');
    const ba = (colordx('#0000ff') as any).delta('#ff0000');
    expect(Math.abs(ab - ba)).toBeLessThan(0.01);
  });

  it('returns 0 for same color', () => {
    expect((colordx('#00ff00') as any).delta('#00ff00')).toBe(0);
    expect((colordx('#808080') as any).delta('#808080')).toBe(0);
  });

  it('is very small for barely-different colors', () => {
    expect((colordx('#ff0000') as any).delta('#fe0000')).toBeLessThan(0.05);
  });

  it('is large for black vs white', () => {
    expect((colordx('#ffffff') as any).delta('#000000')).toBeGreaterThan(0.5);
  });

  it('delta is non-negative for all color pairs', () => {
    const pairs: [string, string][] = [
      ['#ff0000', '#0000ff'],
      ['#ffffff', '#000000'],
      ['#808080', '#ffffff'],
      ['#ff8800', '#0000ff'],
    ];
    for (const [a, b] of pairs) {
      expect((colordx(a) as any).delta(b)).toBeGreaterThanOrEqual(0);
    }
  });
});

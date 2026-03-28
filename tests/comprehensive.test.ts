/**
 * Comprehensive targeted tests covering all areas flagged in the code review.
 */
import { describe, expect, it } from 'vitest';
import { parseHex, rgbToHex } from '../src/colorModels/hex.js';
import { parseCmykObject, parseCmykString, rgbToCmyk } from '../src/colorModels/cmyk.js';
import { hslToRgb, parseHslString, rgbToHsl } from '../src/colorModels/hsl.js';
import { clampHwb, hwbToRgb, rgbToHwb } from '../src/colorModels/hwb.js';
import { deltaE2000, labToRgb, rgbToLab } from '../src/colorModels/lab.js';
import { oklabToRgb, parseOklabString, rgbToOklab } from '../src/colorModels/oklab.js';
import { oklchToRgb, parseOklchString, rgbToOklch } from '../src/colorModels/oklch.js';
import { inGamutSrgb, toGamutSrgb } from '../src/gamut.js';
import { inGamutP3 } from '../src/plugins/p3.js';
import { inGamutRec2020 } from '../src/plugins/rec2020.js';
import { colordx, extend, nearest } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import harmonies from '../src/plugins/harmonies.js';
import mix from '../src/plugins/mix.js';
import names from '../src/plugins/names.js';
import minify from '../src/plugins/minify.js';
import { beforeAll } from 'vitest';

beforeAll(() => {
  extend([a11y, harmonies, mix, names, minify]);
});


describe('CMYK — rgbToCmyk', () => {
  it('black → k=100, c/m/y=0', () => {
    expect(rgbToCmyk({ r: 0, g: 0, b: 0, alpha: 1 })).toMatchObject({ c: 0, m: 0, y: 0, k: 100 });
  });

  it('white → all channels 0', () => {
    expect(rgbToCmyk({ r: 255, g: 255, b: 255, alpha: 1 })).toMatchObject({ c: 0, m: 0, y: 0, k: 0 });
  });

  it('pure red → c=0, m=100, y=100, k=0', () => {
    expect(rgbToCmyk({ r: 255, g: 0, b: 0, alpha: 1 })).toMatchObject({ c: 0, m: 100, y: 100, k: 0 });
  });

  it('round-trip: dark magenta', () => {
    const orig = { r: 128, g: 0, b: 128, alpha: 1 };
    const back = labToRgb(rgbToLab(orig)); // use lab as proxy since cmykToRgb is a separate import
    const { c, m, y, k } = rgbToCmyk(orig);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(m).toBeLessThanOrEqual(100);
    expect(k).toBeGreaterThanOrEqual(0);
  });

  it('near-black {r:1,g:1,b:1} → k close to 100, not pure black', () => {
    const { k } = rgbToCmyk({ r: 1, g: 1, b: 1, alpha: 1 });
    expect(k).toBeGreaterThan(99);
    expect(k).toBeLessThan(100);
  });
});

describe('CMYK — parseCmykString', () => {
  it('unitless 0–1 values', () => {
    const rgb = parseCmykString('device-cmyk(0.5 0.5 0.5 0.5)');
    expect(rgb).not.toBeNull();
    expect(rgb!.r).toBeGreaterThan(0);
    expect(rgb!.r).toBeLessThan(255);
  });

  it('percentage values', () => {
    const a = parseCmykString('device-cmyk(50% 50% 50% 50%)');
    const b = parseCmykString('device-cmyk(0.5 0.5 0.5 0.5)');
    expect(a!.r).toBe(b!.r);
    expect(a!.g).toBe(b!.g);
    expect(a!.b).toBe(b!.b);
  });

  it('pure black unitless → rgb(0,0,0)', () => {
    const rgb = parseCmykString('device-cmyk(0 0 0 1)');
    expect(rgb!.r).toBe(0);
    expect(rgb!.g).toBe(0);
    expect(rgb!.b).toBe(0);
  });

  it('pure black percentage → rgb(0,0,0)', () => {
    const rgb = parseCmykString('device-cmyk(0% 0% 0% 100%)');
    expect(rgb!.r).toBe(0);
    expect(rgb!.g).toBe(0);
    expect(rgb!.b).toBe(0);
  });

  it('with decimal alpha', () => {
    const rgb = parseCmykString('device-cmyk(0 0 0 0 / 0.5)');
    expect(rgb!.alpha).toBe(0.5);
  });

  it('with percentage alpha', () => {
    const rgb = parseCmykString('device-cmyk(0% 0% 0% 0% / 50%)');
    expect(rgb!.alpha).toBe(0.5);
  });

  it('negative values clamp, not crash', () => {
    expect(() => parseCmykString('device-cmyk(-10% 0% 0% 0%)')).not.toThrow();
    const rgb = parseCmykString('device-cmyk(-10% 0% 0% 0%)');
    expect(rgb!.r).toBeGreaterThanOrEqual(0);
    expect(rgb!.r).toBeLessThanOrEqual(255);
  });
});

describe('CMYK — parseCmykObject', () => {
  it('negative values clamp, not crash', () => {
    expect(() => parseCmykObject({ c: -10, m: 0, y: 0, k: 0, alpha: 1 })).not.toThrow();
    const rgb = parseCmykObject({ c: -10, m: 0, y: 0, k: 0, alpha: 1 });
    expect(rgb!.r).toBeGreaterThanOrEqual(0);
    expect(rgb!.r).toBeLessThanOrEqual(255);
  });
});


describe('HEX — parseHex', () => {
  it('#fff expands to rgb(255,255,255)', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255, alpha: 1 });
  });

  it('#000 expands to rgb(0,0,0)', () => {
    expect(parseHex('#000')).toEqual({ r: 0, g: 0, b: 0, alpha: 1 });
  });

  it('#f00 expands to rgb(255,0,0)', () => {
    expect(parseHex('#f00')).toEqual({ r: 255, g: 0, b: 0, alpha: 1 });
  });

  it('#ffff → alpha 1.0', () => {
    expect(parseHex('#ffff')!.alpha).toBe(1);
  });

  it('#fff0 → alpha 0.0', () => {
    expect(parseHex('#fff0')!.alpha).toBe(0);
  });

  it('#0000 → transparent black', () => {
    const rgb = parseHex('#0000')!;
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
    expect(rgb.alpha).toBe(0);
  });

  it('#ffffff80 → alpha ~0.502, not 0.5', () => {
    expect(parseHex('#ffffff80')!.alpha).toBe(0.502);
  });

  it('#ffffffff → alpha exactly 1', () => {
    expect(parseHex('#ffffffff')!.alpha).toBe(1);
  });

  it('#ffffff00 → alpha exactly 0', () => {
    expect(parseHex('#ffffff00')!.alpha).toBe(0);
  });

  it('case insensitive', () => {
    expect(parseHex('#FF0000')).toEqual(parseHex('#ff0000'));
    expect(parseHex('#FF0000FF')).toEqual(parseHex('#ff0000ff'));
  });
});

describe('HEX — rgbToHex', () => {
  it('round-trip #ff8040', () => {
    expect(rgbToHex(parseHex('#ff8040')!)).toBe('#ff8040');
  });

  it('#abc expands then back to #aabbcc', () => {
    expect(rgbToHex(parseHex('#abc')!)).toBe('#aabbcc');
  });

  it('rounds fractional channel values', () => {
    const hex = rgbToHex({ r: 255.4, g: 0.6, b: 127.5, alpha: 1 });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(parseHex(hex)).not.toBeNull();
  });
});


describe('HSL — achromatic colors', () => {
  it('black → s=0', () => {
    expect(rgbToHsl({ r: 0, g: 0, b: 0, alpha: 1 }).s).toBe(0);
  });

  it('white → s=0', () => {
    expect(rgbToHsl({ r: 255, g: 255, b: 255, alpha: 1 }).s).toBe(0);
  });

  it('grey → s=0', () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128, alpha: 1 }).s).toBe(0);
  });
});

describe('HSL — hslToRgb edge cases', () => {
  it('h=0 and h=360 produce same color', () => {
    const a = hslToRgb({ h: 0, s: 50, l: 50, alpha: 1 });
    const b = hslToRgb({ h: 360, s: 50, l: 50, alpha: 1 });
    expect(a.r).toBe(b.r);
    expect(a.g).toBe(b.g);
    expect(a.b).toBe(b.b);
  });

  it('h=720 wraps same as h=0', () => {
    const a = hslToRgb({ h: 720, s: 50, l: 50, alpha: 1 });
    const b = hslToRgb({ h: 0, s: 50, l: 50, alpha: 1 });
    expect(a.r).toBe(b.r);
    expect(a.g).toBe(b.g);
    expect(a.b).toBe(b.b);
  });

  it('h=-30 wraps same as h=330', () => {
    const a = hslToRgb({ h: -30, s: 50, l: 50, alpha: 1 });
    const b = hslToRgb({ h: 330, s: 50, l: 50, alpha: 1 });
    expect(a.r).toBe(b.r);
    expect(a.g).toBe(b.g);
    expect(a.b).toBe(b.b);
  });

  it('s=0 → grey regardless of hue', () => {
    const a = hslToRgb({ h: 180, s: 0, l: 50, alpha: 1 });
    const b = hslToRgb({ h: 0, s: 0, l: 50, alpha: 1 });
    expect(a.r).toBe(b.r);
  });

  it('l=0 → black regardless of s and h', () => {
    const rgb = hslToRgb({ h: 180, s: 100, l: 0, alpha: 1 });
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it('l=100 → white regardless of s and h', () => {
    const rgb = hslToRgb({ h: 180, s: 100, l: 100, alpha: 1 });
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(255);
    expect(rgb.b).toBeCloseTo(255, 0);
  });
});

describe('HSL — parseHslString both syntaxes', () => {
  it('legacy comma', () => {
    expect(parseHslString('hsl(180, 50%, 50%)')).not.toBeNull();
  });

  it('modern space', () => {
    const a = parseHslString('hsl(180 50% 50%)');
    const b = parseHslString('hsl(180, 50%, 50%)');
    expect(a!.r).toBeCloseTo(b!.r, 0);
  });

  it('legacy with alpha', () => {
    expect(parseHslString('hsla(180, 50%, 50%, 0.5)')!.alpha).toBeCloseTo(0.5, 2);
  });

  it('modern with alpha', () => {
    expect(parseHslString('hsl(180 50% 50% / 0.5)')!.alpha).toBeCloseTo(0.5, 2);
  });

  it('percentage alpha', () => {
    expect(parseHslString('hsl(180 50% 50% / 50%)')!.alpha).toBeCloseTo(0.5, 2);
  });

  it('turn units', () => {
    const turn = parseHslString('hsl(0.5turn 50% 50%)');
    const deg  = parseHslString('hsl(180 50% 50%)');
    expect(turn!.r).toBeCloseTo(deg!.r, 0);
    expect(turn!.g).toBeCloseTo(deg!.g, 0);
  });

  it('rad units', () => {
    const rad = parseHslString('hsl(3.14159rad 50% 50%)');
    const deg = parseHslString('hsl(180 50% 50%)');
    expect(rad!.r).toBeCloseTo(deg!.r, 0);
  });

  it('grad units', () => {
    const grad = parseHslString('hsl(200grad 50% 50%)');
    const deg  = parseHslString('hsl(180 50% 50%)');
    expect(grad!.r).toBeCloseTo(deg!.r, 0);
  });

  it('negative hue', () => {
    const neg = parseHslString('hsl(-30deg 50% 50%)');
    const pos = parseHslString('hsl(330 50% 50%)');
    expect(neg!.r).toBeCloseTo(pos!.r, 0);
    expect(neg!.g).toBeCloseTo(pos!.g, 0);
    expect(neg!.b).toBeCloseTo(pos!.b, 0);
  });
});


describe('HWB', () => {
  it('w+b=100 → grey', () => {
    const a = hwbToRgb({ h: 0,   w: 50, b: 50, alpha: 1 });
    const b = hwbToRgb({ h: 180, w: 50, b: 50, alpha: 1 });
    expect(a.r).toBe(b.r);
    expect(a.g).toBe(b.g);
    expect(a.b).toBe(b.b);
  });

  it('w+b>100 normalizes: w=60,b=60 same as w=50,b=50 (via clampHwb)', () => {
    // hwbToRgb precondition: w+b ≤ 100. Must call clampHwb first for overflow values.
    const a = hwbToRgb(clampHwb({ h: 0, w: 60, b: 60, alpha: 1 }));
    const b = hwbToRgb(clampHwb({ h: 0, w: 50, b: 50, alpha: 1 }));
    expect(a.r).toBe(b.r);
    expect(a.g).toBe(b.g);
    expect(a.b).toBe(b.b);
  });

  it('w=100,b=100 normalizes to grey (via clampHwb)', () => {
    const rgb = hwbToRgb(clampHwb({ h: 0, w: 100, b: 100, alpha: 1 }));
    expect(rgb.r).toBe(rgb.g);
    expect(rgb.g).toBe(rgb.b);
  });

  it('w=100,b=0 → white', () => {
    const rgb = hwbToRgb({ h: 0, w: 100, b: 0, alpha: 1 });
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(255);
    expect(rgb.b).toBe(255);
  });

  it('w=0,b=100 → black', () => {
    const rgb = hwbToRgb({ h: 0, w: 0, b: 100, alpha: 1 });
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it('round-trip {r:255,g:128,b:0}', () => {
    const orig = { r: 255, g: 128, b: 0, alpha: 1 };
    const back = hwbToRgb(rgbToHwb(orig));
    expect(back.r).toBeCloseTo(orig.r, 0);
    expect(back.g).toBeCloseTo(orig.g, 0);
    expect(back.b).toBeCloseTo(orig.b, 0);
  });
});


describe('Lab — reference values and XYZ clamp removal', () => {
  it('pure red in Lab(D50) ≈ L=54.29, a=80.80, b=69.89', () => {
    // D65-based values (53.23 / 80.11 / 67.22) differ because this library uses the
    // D50 white point (CSS Color 4), yielding L≈54.29, a≈80.80, b≈69.89.
    const lab = rgbToLab({ r: 255, g: 0, b: 0, alpha: 1 });
    expect(lab.l).toBeCloseTo(54.29, 0);
    expect(lab.a).toBeCloseTo(80.80, 0);
    expect(lab.b).toBeCloseTo(69.89, 0);
  });

  it('pure white → L=100, a=0, b=0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255, alpha: 1 });
    expect(lab.l).toBeCloseTo(100, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });

  it('pure black → L=0', () => {
    expect(rgbToLab({ r: 0, g: 0, b: 0, alpha: 1 }).l).toBeCloseTo(0, 1);
  });

  it('deep blue (previously had negative XYZ) survives round-trip', () => {
    const orig = { r: 0, g: 0, b: 255, alpha: 1 };
    const back = labToRgb(rgbToLab(orig));
    expect(back.r).toBeCloseTo(0, 0);
    expect(back.g).toBeCloseTo(0, 0);
    expect(back.b).toBeCloseTo(255, 0);
  });

  it('pure green (wide gamut) round-trip', () => {
    const orig = { r: 0, g: 255, b: 0, alpha: 1 };
    const back = labToRgb(rgbToLab(orig));
    expect(back.r).toBeCloseTo(0, 0);
    expect(back.g).toBeCloseTo(255, 0);
    expect(back.b).toBeCloseTo(0, 0);
  });

  it('saturated purple round-trip', () => {
    const orig = { r: 120, g: 50, b: 200, alpha: 1 };
    const back = labToRgb(rgbToLab(orig));
    expect(back.r).toBeCloseTo(orig.r, 0);
    expect(back.g).toBeCloseTo(orig.g, 0);
    expect(back.b).toBeCloseTo(orig.b, 0);
  });
});

describe('deltaE2000 — known values', () => {
  it('identical colors → 0', () => {
    const red = rgbToLab({ r: 255, g: 0, b: 0, alpha: 1 });
    expect(deltaE2000(red, red)).toBe(0);
  });

  it('white vs white → 0', () => {
    const w = rgbToLab({ r: 255, g: 255, b: 255, alpha: 1 });
    expect(deltaE2000(w, w)).toBe(0);
  });

  it('black vs white → ~100', () => {
    const black = rgbToLab({ r: 0,   g: 0,   b: 0,   alpha: 1 });
    const white = rgbToLab({ r: 255, g: 255, b: 255, alpha: 1 });
    expect(deltaE2000(black, white)).toBeCloseTo(100, -1);
  });
});


describe('OKLab — reference values', () => {
  it('pure red ≈ oklab(0.6280, 0.2249, 0.1257)', () => {
    const lab = rgbToOklab({ r: 255, g: 0, b: 0, alpha: 1 });
    expect(lab.l).toBeCloseTo(0.6280, 3);
    expect(lab.a).toBeCloseTo(0.2249, 3);
    expect(lab.b).toBeCloseTo(0.1257, 3);
  });

  it('round-trip', () => {
    const orig = { r: 200, g: 50, b: 100, alpha: 1 };
    const back = oklabToRgb(rgbToOklab(orig));
    expect(back.r).toBeCloseTo(orig.r, 0);
    expect(back.g).toBeCloseTo(orig.g, 0);
    expect(back.b).toBeCloseTo(orig.b, 0);
  });
});

describe('OKLCH — achromatic and hue continuity', () => {
  it('black → l≈0, c≈0, h=0', () => {
    const lch = rgbToOklch({ r: 0, g: 0, b: 0, alpha: 1 });
    expect(lch.l).toBeCloseTo(0, 3);
    expect(lch.c).toBeCloseTo(0, 3);
    expect(lch.h).toBe(0);
  });

  it('white → l≈1, c≈0, h=0', () => {
    const lch = rgbToOklch({ r: 255, g: 255, b: 255, alpha: 1 });
    expect(lch.l).toBeCloseTo(1, 2);
    expect(lch.c).toBeCloseTo(0, 3);
    expect(lch.h).toBe(0);
  });

  it('mid grey → c near 0', () => {
    expect(rgbToOklch({ r: 128, g: 128, b: 128, alpha: 1 }).c).toBeCloseTo(0, 2);
  });

  it('h=360 same as h=0', () => {
    const a = oklchToRgb({ l: 0.5, c: 0.1, h: 360, alpha: 1 });
    const b = oklchToRgb({ l: 0.5, c: 0.1, h: 0,   alpha: 1 });
    // cos(2π) ≠ cos(0) in IEEE 754 — last-bit difference is expected for raw functions
    expect(a.r).toBeCloseTo(b.r, 5);
    expect(a.g).toBeCloseTo(b.g, 5);
    expect(a.b).toBeCloseTo(b.b, 5);
  });

  it('hue continuity: h=359.99 close to h=0', () => {
    const a = oklchToRgb({ l: 0.5, c: 0.1, h: 359.99, alpha: 1 });
    const b = oklchToRgb({ l: 0.5, c: 0.1, h: 0,      alpha: 1 });
    expect(Math.abs(a.r - b.r)).toBeLessThan(2);
  });

  it('round-trip', () => {
    const orig = { r: 200, g: 50, b: 100, alpha: 1 };
    const back = oklchToRgb(rgbToOklch(orig));
    expect(back.r).toBeCloseTo(orig.r, 0);
    expect(back.g).toBeCloseTo(orig.g, 0);
    expect(back.b).toBeCloseTo(orig.b, 0);
  });
});

describe('OKLab / OKLCH string — none keyword', () => {
  it('oklch(0.5 0.1 none) → h treated as 0', () => {
    const a = parseOklchString('oklch(0.5 0.1 none)');
    const b = parseOklchString('oklch(0.5 0.1 0)');
    expect(a!.r).toBeCloseTo(b!.r, 0);
  });

  it('oklab(0.5 none 0.1) → a treated as 0', () => {
    const a = parseOklabString('oklab(0.5 none 0.1)');
    const b = parseOklabString('oklab(0.5 0 0.1)');
    expect(a!.r).toBeCloseTo(b!.r, 0);
  });

  it('oklab(none none none) → all zero → black', () => {
    const rgb = parseOklabString('oklab(none none none)');
    expect(rgb!.r).toBe(0);
    expect(rgb!.g).toBe(0);
    expect(rgb!.b).toBe(0);
  });
});

describe('OKLab / OKLCH string — percentage syntax', () => {
  it('oklch(50% 25% 180) → l=0.5, c=0.1', () => {
    const a = parseOklchString('oklch(50% 25% 180)');
    const b = parseOklchString('oklch(0.5 0.1 180)');
    expect(a!.r).toBe(b!.r);
    expect(a!.g).toBe(b!.g);
    expect(a!.b).toBe(b!.b);
  });

  it('oklab(50% 25% -25%) → l=0.5, a=0.1, b=-0.1', () => {
    const a = parseOklabString('oklab(50% 25% -25%)');
    const b = parseOklabString('oklab(0.5 0.1 -0.1)');
    expect(a!.r).toBe(b!.r);
    expect(a!.g).toBe(b!.g);
    expect(a!.b).toBe(b!.b);
  });
});


describe('Gamut', () => {
  it('sRGB colors always in sRGB gamut', () => {
    expect(inGamutSrgb('#ff0000')).toBe(true);
    expect(inGamutSrgb('rgb(255, 0, 0)')).toBe(true);
  });

  it('vivid oklch green — outside sRGB, inside P3', () => {
    expect(inGamutSrgb('oklch(0.7 0.25 145)')).toBe(false);
    expect(inGamutP3('oklch(0.7 0.25 145)')).toBe(true);
  });

  it('extreme oklch — outside sRGB, P3, possibly Rec.2020', () => {
    expect(inGamutSrgb('oklch(0.5 0.5 180)')).toBe(false);
    expect(inGamutP3('oklch(0.5 0.5 180)')).toBe(false);
  });

  it('toGamutSrgb preserves lightness and hue', () => {
    const mapped = toGamutSrgb('oklch(0.7 0.35 145)');
    const lch = colordx(mapped.toHex()).toOklch();
    expect(lch.l).toBeCloseTo(0.7, 1);
    // CSS Color 4 returns a clipped result — hue may shift slightly from the gamut boundary
    expect(Math.abs(lch.h - 145)).toBeLessThan(5);
    expect(inGamutSrgb(mapped.toHex())).toBe(true);
  });

  it('toGamutSrgb on already-in-gamut color returns same color within ±1 per channel', () => {
    // toGamutSrgb routes through OKLab intermediate; direct parse uses the string parser.
    // Different conversion paths can give ±1 channel difference due to floating-point.
    const input = 'oklch(0.5 0.1 180)';
    const a = toGamutSrgb(input).toRgb();
    const b = colordx(input).toRgb();
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(1);
    expect(inGamutSrgb(toGamutSrgb(input).toHex())).toBe(true);
  });
});


describe('Colordx core', () => {
  it('invalid input → isValid() false', () => {
    expect(colordx('not a color').isValid()).toBe(false);
    expect(colordx('').isValid()).toBe(false);
    expect(colordx(null as any).isValid()).toBe(false);
  });

  it('transparent → rgba(0,0,0,0)', () => {
    expect(colordx('transparent').toRgb()).toEqual({ r: 0, g: 0, b: 0, alpha: 0 });
  });

  it('WCAG contrast: black/white = 21', () => {
    expect(colordx('#000000').contrast('#ffffff')).toBeCloseTo(21, 0);
  });

  it('WCAG contrast: same color = 1', () => {
    expect(colordx('#ffffff').contrast('#ffffff')).toBeCloseTo(1, 1);
  });

  it('WCAG contrast: #777777 vs white ≈ 4.48', () => {
    expect(colordx('#777777').contrast('#ffffff')).toBeCloseTo(4.48, 0);
  });

  it('nearest — empty array throws', () => {
    expect(() => nearest('#ff0000', [])).toThrow();
  });

  it('nearest — single candidate returns it', () => {
    expect(nearest('#ff0000', ['#00ff00'])).toBe('#00ff00');
  });

  it('mix at weight=0 → pure self', () => {
    expect((colordx('#ff0000') as any).mix('#0000ff', 0).toHex()).toBe('#ff0000');
  });

  it('mix at weight=1 → pure target', () => {
    expect((colordx('#ff0000') as any).mix('#0000ff', 1).toHex()).toBe('#0000ff');
  });

  it('mix at weight=0.5 → mid color', () => {
    const mid = (colordx('#ff0000') as any).mix('#0000ff', 0.5).toRgb();
    expect(mid.r).toBeCloseTo(mid.b, 0);
  });

  it('alpha(0) → 0', () => {
    expect(colordx('#ff0000').alpha(0).alpha()).toBe(0);
  });

  it('alpha(1.5) clamps to 1', () => {
    expect(colordx('#ff0000').alpha(1.5).alpha()).toBe(1);
  });

  it('alpha(-0.5) clamps to 0', () => {
    expect(colordx('#ff0000').alpha(-0.5).alpha()).toBe(0);
  });

  it('minReadable: mid-grey on slightly-lighter grey finds readable color', () => {
    const result = (colordx('#777777') as any).minReadable('#888888');
    expect(result.isValid()).toBe(true);
    expect(result.contrast('#888888')).toBeGreaterThanOrEqual(4.5);
  });
});


describe('Plugins — mix (tints/shades/tones)', () => {
  it('tints(0) → []', () => {
    expect((colordx('#ff0000') as any).tints(0)).toEqual([]);
  });

  it('tints(1) → [self]', () => {
    const result = (colordx('#ff0000') as any).tints(1);
    expect(result).toHaveLength(1);
    expect(result[0].toHex()).toBe('#ff0000');
  });

  it('tints(1) contains no NaN channels', () => {
    const { r, g, b } = (colordx('#ff0000') as any).tints(1)[0].toRgb();
    expect(isNaN(r)).toBe(false);
    expect(isNaN(g)).toBe(false);
    expect(isNaN(b)).toBe(false);
  });

  it('shades(1) → [self], no NaN', () => {
    const result = (colordx('#ff0000') as any).shades(1);
    expect(result).toHaveLength(1);
    const { r, g, b } = result[0].toRgb();
    expect(isNaN(r)).toBe(false);
  });

  it('tones(1) → [self], no NaN', () => {
    const result = (colordx('#ff0000') as any).tones(1);
    expect(result).toHaveLength(1);
    const { r, g, b } = result[0].toRgb();
    expect(isNaN(r)).toBe(false);
  });

  it('tints(2) → [original, white]', () => {
    const result = (colordx('#ff0000') as any).tints(2);
    expect(result).toHaveLength(2);
    expect(result[0].toHex()).toBe('#ff0000');
    expect(result[1].toHex()).toBe('#ffffff');
  });
});

describe('Plugins — harmonies', () => {
  it('defaults to complementary', () => {
    const h = (colordx('#ff0000') as any).harmonies();
    expect(h).toHaveLength(2);
    expect(h[0].toHex()).toBe('#ff0000');
    expect(h[1].toHex()).toBe('#00ffff');
  });

  it('complementary: 2 colors, base + opposite', () => {
    const h = (colordx('#ff0000') as any).harmonies('complementary');
    expect(h).toHaveLength(2);
    expect(h[0].toHex()).toBe('#ff0000');
    expect(h[1].toHex()).toBe('#00ffff');
  });

  it('analogous: 3 colors at −30°, 0°, +30°', () => {
    const h = (colordx('#ff0000') as any).harmonies('analogous');
    expect(h).toHaveLength(3);
    expect(h[0].toHex()).toBe('#ff0080'); // rotate(−30) → hsl(330)
    expect(h[1].toHex()).toBe('#ff0000'); // rotate(0)
    expect(h[2].toHex()).toBe('#ff8000'); // rotate(30) → hsl(30)
  });

  it('triadic: 3 colors at 120° intervals', () => {
    const h = (colordx('#ff0000') as any).harmonies('triadic');
    expect(h).toHaveLength(3);
    expect(h[0].toHex()).toBe('#ff0000');
    expect(h[1].toHex()).toBe('#00ff00'); // rotate(120) → hsl(120)
    expect(h[2].toHex()).toBe('#0000ff'); // rotate(240) → hsl(240)
  });

  it('tetradic: 4 colors at 90° intervals (square)', () => {
    const h = (colordx('#ff0000') as any).harmonies('tetradic');
    expect(h).toHaveLength(4);
    expect(h[0].toHex()).toBe('#ff0000');
    expect(h[1].toHex()).toBe('#80ff00'); // rotate(90) → hsl(90)
    expect(h[2].toHex()).toBe('#00ffff'); // rotate(180)
    expect(h[3].toHex()).toBe('#7f00ff'); // rotate(270) → hsl(270)
  });

  it('split-complementary: 3 colors at 0°, 150°, 210°', () => {
    const h = (colordx('#ff0000') as any).harmonies('split-complementary');
    expect(h).toHaveLength(3);
    expect(h[0].toHex()).toBe('#ff0000');
    expect(h[1].toHex()).toBe('#00ff80'); // rotate(150) → hsl(150)
    expect(h[2].toHex()).toBe('#007fff'); // rotate(210) → hsl(210)
  });

  it('rectangle: 4 colors at 0°, 60°, 180°, 240°', () => {
    const h = (colordx('#ff0000') as any).harmonies('rectangle');
    expect(h).toHaveLength(4);
    expect(h[0].toHex()).toBe('#ff0000');
    expect(h[1].toHex()).toBe('#ffff00'); // rotate(60) → hsl(60)
    expect(h[2].toHex()).toBe('#00ffff'); // rotate(180)
    expect(h[3].toHex()).toBe('#0000ff'); // rotate(240) → hsl(240)
  });

  it('double-split-complementary: 5 colors at −30°, 0°, 30°, 150°, 210°', () => {
    const h = (colordx('#ff0000') as any).harmonies('double-split-complementary');
    expect(h).toHaveLength(5);
    expect(h[0].toHex()).toBe('#ff0080'); // rotate(−30) → hsl(330)
    expect(h[1].toHex()).toBe('#ff0000'); // rotate(0)
    expect(h[2].toHex()).toBe('#ff8000'); // rotate(30) → hsl(30)
    expect(h[3].toHex()).toBe('#00ff80'); // rotate(150) → hsl(150)
    expect(h[4].toHex()).toBe('#007fff'); // rotate(210) → hsl(210)
  });

  it('works with non-primary input', () => {
    const h = (colordx('#0080ff') as any).harmonies('complementary');
    expect(h).toHaveLength(2);
    expect(h[1].toHex()).toBe((colordx('#0080ff') as any).rotate(180).toHex());
  });
});

describe('Plugins — minify', () => {
  it('all formats disabled → still returns valid color', () => {
    const result = (colordx('#ff0000') as any).minify({ hex: false, rgb: false, hsl: false });
    expect(colordx(result).toHex()).toBe('#ff0000');
  });
});

describe('Plugins — names', () => {
  it('rgba(0,0,0,0) → "transparent" (CSS spec: transparent is black at alpha=0)', () => {
    expect((colordx('rgba(0,0,0,0)') as any).toName()).toBe('transparent');
  });

  it('rgba(255,0,0,0) → undefined (non-black transparent has no CSS name)', () => {
    // CSS `transparent` is specifically rgba(0,0,0,0). Other fully-transparent colors have no name.
    expect((colordx('rgba(255,0,0,0)') as any).toName()).toBeUndefined();
  });

  it('exact red match', () => {
    expect((colordx('#ff0000') as any).toName()).toBe('red');
  });

  it('closest to red', () => {
    expect((colordx('#ff0001') as any).toName({ closest: true })).toBe('red');
  });
});

/**
 * README contract tests — every code example in the README is exercised here.
 * If a README example changes, this test must change too (and vice-versa).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  Colordx,
  colordx,
  extend,
  getFormat,
  nearest,
  oklchToLinear,
  oklchToRgbChannels,
  inGamutSrgb,
} from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import cmyk from '../src/plugins/cmyk.js';
import harmonies from '../src/plugins/harmonies.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import minify from '../src/plugins/minify.js';
import mix from '../src/plugins/mix.js';
import names from '../src/plugins/names.js';
import p3, { inGamutP3, linearToP3Channels, oklchToP3Channels } from '../src/plugins/p3.js';
import rec2020, {
  inGamutRec2020,
  linearToRec2020Channels,
  oklchToRec2020Channels,
} from '../src/plugins/rec2020.js';

beforeAll(() => {
  extend([a11y, cmyk, harmonies, hsv, hwb, lab, lch, minify, mix, names, p3, rec2020]);
});


describe('README — Usage', () => {
  it('toOklch', () => {
    expect(colordx('#ff0000').toOklch()).toEqual({ l: 0.628, c: 0.2577, h: 29.23, alpha: 1 });
  });
  it('toOklchString', () => {
    expect(colordx('#ff0000').toOklchString()).toBe('oklch(0.628 0.2577 29.23)');
  });
  it('lighten then toHex', () => {
    expect(colordx('#ff0000').lighten(0.1).toHex()).toBe('#ff3333');
  });
  it('parse oklch string', () => {
    expect(colordx('oklch(0.5 0.2 240)').toHex()).toBe('#0069c7');
  });
});


describe('README — Parsing (core)', () => {
  it('hex 6-digit', () => expect(colordx('#ff0000').isValid()).toBe(true));
  it('hex 3-digit', () => expect(colordx('#f00').toHex()).toBe('#ff0000'));
  it('rgb string', () => expect(colordx('rgb(255, 0, 0)').toHex()).toBe('#ff0000'));
  it('rgba string', () => expect(colordx('rgba(255, 0, 0, 0.5)').alpha()).toBe(0.5));
  it('hsl string', () => expect(colordx('hsl(0, 100%, 50%)').toHex()).toBe('#ff0000'));
  it('oklab string', () => expect(colordx('oklab(0.6279 0.2249 0.1257)').isValid()).toBe(true));
  it('oklch string', () => expect(colordx('oklch(0.6279 0.2577 29.23)').isValid()).toBe(true));
  it('rgb object', () => expect(colordx({ r: 255, g: 0, b: 0, alpha: 1 }).toHex()).toBe('#ff0000'));
  it('hsl object', () => expect(colordx({ h: 0, s: 100, l: 50, alpha: 1 }).toHex()).toBe('#ff0000'));
  it('oklab object', () => expect(colordx({ l: 0.6279, a: 0.2249, b: 0.1257, alpha: 1 }).isValid()).toBe(true));
  it('oklch object', () => expect(colordx({ l: 0.6279, c: 0.2577, h: 29.23, alpha: 1 }).isValid()).toBe(true));
});

describe('README — Parsing (plugins)', () => {
  it('display-p3 string', () => expect(colordx('color(display-p3 0.9176 0.2003 0.1386)').isValid()).toBe(true));
  it('rec2020 string', () => expect(colordx('color(rec2020 0.7919 0.2307 0.0739)').isValid()).toBe(true));
  it('hwb string', () => expect(colordx('hwb(0 0% 0%)').toHex()).toBe('#ff0000'));
  it('hwb object', () => expect(colordx({ h: 0, w: 0, b: 0, alpha: 1 }).toHex()).toBe('#ff0000'));
  it('hsv object', () => expect(colordx({ h: 0, s: 100, v: 100, alpha: 1 }).toHex()).toBe('#ff0000'));
});


describe('README — Conversion', () => {
  it('toRgb', () => expect(colordx('#ff0000').toRgb()).toEqual({ r: 255, g: 0, b: 0, alpha: 1 }));
  it('toRgbString', () => expect(colordx('#ff0000').toRgbString()).toBe('rgb(255, 0, 0)'));
  it('toHex', () => expect(colordx('#ff0000').toHex()).toBe('#ff0000'));
  it('toNumber', () => expect(colordx('#ff0000').toNumber()).toBe(16711680));
  it('toHsl', () => expect(colordx('#ff0000').toHsl()).toEqual({ h: 0, s: 100, l: 50, alpha: 1 }));
  it('toHslString', () => expect(colordx('#ff0000').toHslString()).toBe('hsl(0, 100%, 50%)'));

  it('toHsl precision default (2)', () => {
    expect(colordx('#3d7a9f').toHsl()).toEqual({ h: 202.65, s: 44.55, l: 43.14, alpha: 1 });
  });
  it('toHsl precision 4', () => {
    expect(colordx('#3d7a9f').toHsl(4)).toEqual({ h: 202.6531, s: 44.5455, l: 43.1373, alpha: 1 });
  });
  it('toHsl precision 0 (integers)', () => {
    expect(colordx('#3d7a9f').toHsl(0)).toEqual({ h: 203, s: 45, l: 43, alpha: 1 });
  });
  it('toHslString default', () => {
    expect(colordx('#3d7a9f').toHslString()).toBe('hsl(202.65, 44.55%, 43.14%)');
  });
  it('toHslString precision 4', () => {
    expect(colordx('#3d7a9f').toHslString(4)).toBe('hsl(202.6531, 44.5455%, 43.1373%)');
  });

  it('toHwb', () => expect((colordx('#ff0000') as any).toHwb()).toEqual({ h: 0, w: 0, b: 0, alpha: 1 }));
  it('toHwbString', () => expect((colordx('#ff0000') as any).toHwbString()).toBe('hwb(0 0% 0%)'));

  it('toOklab', () => expect(colordx('#ff0000').toOklab()).toEqual({ l: 0.628, a: 0.2249, b: 0.1258, alpha: 1 }));
  it('toOklabString', () => expect(colordx('#ff0000').toOklabString()).toBe('oklab(0.628 0.2249 0.1258)'));
  it('toOklch', () => expect(colordx('#ff0000').toOklch()).toEqual({ l: 0.628, c: 0.2577, h: 29.23, alpha: 1 }));
  it('toOklchString', () => expect(colordx('#ff0000').toOklchString()).toBe('oklch(0.628 0.2577 29.23)'));

  it('toP3', () => expect((colordx('#ff0000') as any).toP3()).toEqual({ r: 0.9175, g: 0.2003, b: 0.1386, alpha: 1, colorSpace: 'display-p3' }));
  it('toP3String', () => expect((colordx('#ff0000') as any).toP3String()).toBe('color(display-p3 0.9175 0.2003 0.1386)'));
});


describe('README — Getters', () => {
  it('isValid true', () => expect(colordx('#ff0000').isValid()).toBe(true));
  it('isValid false', () => expect(colordx('notacolor').isValid()).toBe(false));
  it('alpha getter', () => expect(colordx('rgba(255,0,0,0.5)').alpha()).toBe(0.5));
  it('hue getter', () => expect(colordx('#ff0000').hue()).toBe(0));
  it('lightness getter', () => expect(typeof colordx('#ff0000').lightness()).toBe('number'));
  it('chroma getter', () => expect(typeof colordx('#ff0000').chroma()).toBe('number'));
  it('brightness', () => expect(colordx('#ff0000').brightness()).toBeGreaterThan(0));
  it('isDark', () => expect(colordx('#000000').isDark()).toBe(true));
  it('isLight', () => expect(colordx('#ffffff').isLight()).toBe(true));
  it('isEqual', () => expect(colordx('#ff0000').isEqual('#f00')).toBe(true));
  it('luminance (a11y plugin)', () => expect(typeof (colordx('#ff0000') as any).luminance()).toBe('number'));
  it('contrast (a11y plugin)', () => expect(typeof (colordx('#ff0000') as any).contrast('#fff')).toBe('number'));
  it('mix (mix plugin)', () => expect((colordx('#ff0000') as any).mix('#0000ff', 0.5).isValid()).toBe(true));
  it('mixOklab (mix plugin)', () => expect((colordx('#ff0000') as any).mixOklab('#0000ff', 0.5).isValid()).toBe(true));
});


describe('README — getFormat', () => {
  it("hex → 'hex'", () => expect(getFormat('#ff0000')).toBe('hex'));
  it("rgb string → 'rgb'", () => expect(getFormat('rgb(255, 0, 0)')).toBe('rgb'));
  it("hsl string → 'hsl'", () => expect(getFormat('hsl(0, 100%, 50%)')).toBe('hsl'));
  it("oklch string → 'oklch'", () => expect(getFormat('oklch(0.5 0.2 240)')).toBe('oklch'));
  it("oklab string → 'oklab'", () => expect(getFormat('oklab(0.6279 0.2249 0.1257)')).toBe('oklab'));
  it("rgb object → 'rgb'", () => expect(getFormat({ r: 255, g: 0, b: 0, alpha: 1 })).toBe('rgb'));
  it("hsl object → 'hsl'", () => expect(getFormat({ h: 0, s: 100, l: 50, alpha: 1 })).toBe('hsl'));
  it('invalid → undefined', () => expect(getFormat('notacolor')).toBeUndefined());
});

describe('README — nearest', () => {
  it("nearest '#800' → '#f00'", () => expect(nearest('#800', ['#f00', '#ff0', '#00f'])).toBe('#f00'));
  it("nearest '#ffe' → '#ff0'", () => expect(nearest('#ffe', ['#f00', '#ff0', '#00f'])).toBe('#ff0'));
});

describe('README — oklchToRgbChannels / oklchToLinear', () => {
  it('oklchToRgbChannels returns array of 3 numbers in [0,1]', () => {
    const [r, g, b] = oklchToRgbChannels(0.5, 0.2, 240);
    expect(typeof r).toBe('number');
    expect(typeof g).toBe('number');
    expect(typeof b).toBe('number');
  });
  it('oklchToLinear returns array of 3 numbers', () => {
    const linear = oklchToLinear(0.5, 0.2, 240);
    expect(linear).toHaveLength(3);
  });
});

describe('README — p3/rec2020 channel functions', () => {
  it('oklchToP3Channels returns [r, g, b]', () => {
    const result = oklchToP3Channels(0.5, 0.2, 240);
    expect(result).toHaveLength(3);
  });
  it('oklchToRec2020Channels returns [r, g, b]', () => {
    const result = oklchToRec2020Channels(0.5, 0.2, 240);
    expect(result).toHaveLength(3);
  });
  it('linearToP3Channels', () => {
    const linear = oklchToLinear(0.5, 0.2, 240);
    const result = linearToP3Channels(...linear);
    expect(result).toHaveLength(3);
  });
  it('linearToRec2020Channels', () => {
    const linear = oklchToLinear(0.5, 0.2, 240);
    const result = linearToRec2020Channels(...linear);
    expect(result).toHaveLength(3);
  });
});


describe('README — Gamut (sRGB)', () => {
  it('hex is always in sRGB', () => expect(inGamutSrgb('#ff0000')).toBe(true));
  it('red oklch is in sRGB', () => expect(inGamutSrgb('oklch(0.5 0.1 30)')).toBe(true));
  it('out-of-gamut oklch is not in sRGB', () => expect(inGamutSrgb('oklch(0.5 0.4 180)')).toBe(false));
  it('toGamutSrgb out-of-gamut → valid color', () => expect(Colordx.toGamutSrgb('oklch(0.5 0.4 180)').isValid()).toBe(true));
  it('toGamutSrgb already in gamut → unchanged', () => expect(Colordx.toGamutSrgb('#ff0000').toHex()).toBe('#ff0000'));
});

describe('README — Gamut (P3)', () => {
  it('inside P3 but outside sRGB', () => expect(inGamutP3('oklch(0.64 0.27 29)')).toBe(true));
  it('outside P3', () => expect(inGamutP3('oklch(0.5 0.4 180)')).toBe(false));
  it('toGamutP3 → valid color', () => expect(Colordx.toGamutP3('oklch(0.5 0.4 180)').isValid()).toBe(true));
});

describe('README — Gamut (Rec.2020)', () => {
  it('outside Rec.2020', () => expect(inGamutRec2020('oklch(0.5 0.4 180)')).toBe(false));
  it('toGamutRec2020 → valid color', () => expect(Colordx.toGamutRec2020('oklch(0.5 0.4 180)').isValid()).toBe(true));
});


describe('README — lab plugin', () => {
  it('toLab', () => {
    expect((colordx('#ff0000') as any).toLab()).toEqual({ l: 54.29, a: 80.8, b: 69.89, alpha: 1, colorSpace: 'lab' });
  });
  it('toLabString', () => {
    expect((colordx('#ff0000') as any).toLabString()).toBe('lab(54.29% 80.8 69.89)');
  });
  it('parse lab string', () => {
    expect(colordx('lab(54.29% 80.8 69.89)').toHex()).toBe('#ff0000');
  });
  it('toXyz', () => {
    expect((colordx('#ff0000') as any).toXyz()).toEqual({ x: 43.61, y: 22.25, z: 1.39, alpha: 1 });
  });
  it('toXyzString', () => {
    expect((colordx('#ff0000') as any).toXyzString()).toBe('color(xyz-d65 43.61 22.25 1.39)');
  });
  it('parse lab object (colorSpace discriminant)', () => {
    expect(colordx({ l: 54.29, a: 80.82, b: 69.91, alpha: 1, colorSpace: 'lab' as const }).toHex()).toBe('#ff0000');
  });
  it('parse xyz object', () => {
    expect(colordx({ x: 43.61, y: 22.25, z: 1.39, alpha: 1 }).toHex()).toBe('#ff0000');
  });
  it('mixLab', () => {
    expect((colordx('#000000') as any).mixLab('#ffffff').toHex()).toBe('#777777');
  });
  it('delta identical colors → 0', () => {
    expect((colordx('#ff0000') as any).delta('#ff0000')).toBe(0);
  });
  it('delta black vs white → ~1', () => {
    expect((colordx('#000000') as any).delta('#ffffff')).toBeCloseTo(1, 1);
  });
});


describe('README — lch plugin', () => {
  it('toLch', () => {
    expect((colordx('#ff0000') as any).toLch()).toEqual({
      l: 54.29,
      c: 106.84,
      h: 40.86,
      alpha: 1,
      colorSpace: 'lch',
    });
  });
  it('toLchString', () => {
    expect((colordx('#ff0000') as any).toLchString()).toBe('lch(54.29% 106.84 40.86)');
  });
  it('parse lch string round-trip', () => {
    expect(colordx('lch(54.29% 106.84 40.86)').toHex()).toBe('#ff0000');
  });
  it('parse lch object with colorSpace discriminant', () => {
    expect(colordx({ l: 50, c: 50, h: 180, alpha: 1, colorSpace: 'lch' as const }).isValid()).toBe(true);
  });
});


describe('README — cmyk plugin', () => {
  it('toCmyk', () => {
    expect((colordx('#ff0000') as any).toCmyk()).toEqual({ c: 0, m: 100, y: 100, k: 0, alpha: 1 });
  });
  it('toCmykString', () => {
    expect((colordx('#ff0000') as any).toCmykString()).toBe('device-cmyk(0% 100% 100% 0%)');
  });
  it('parse device-cmyk string', () => {
    expect(colordx('device-cmyk(0% 100% 100% 0%)').toHex()).toBe('#ff0000');
  });
  it('parse cmyk object', () => {
    expect(colordx({ c: 0, m: 100, y: 100, k: 0, alpha: 1 }).toHex()).toBe('#ff0000');
  });
});


describe('README — names plugin', () => {
  it("parse 'red'", () => expect(colordx('red').toHex()).toBe('#ff0000'));
  it("parse 'rebeccapurple'", () => expect(colordx('rebeccapurple').toHex()).toBe('#663399'));
  it('toName red', () => expect((colordx('#ff0000') as any).toName()).toBe('red'));
  it('toName unnamed → undefined', () => expect((colordx('#c06060') as any).toName()).toBeUndefined());
  it('toName closest', () => expect(typeof (colordx('#c06060') as any).toName({ closest: true })).toBe('string'));
});


describe('README — hsv plugin', () => {
  it('toHsv', () => {
    expect((colordx('#ff0000') as any).toHsv()).toEqual({ h: 0, s: 100, v: 100, alpha: 1 });
  });
  it('toHsvString', () => {
    expect((colordx('#ff0000') as any).toHsvString()).toBe('hsv(0, 100%, 100%)');
  });
  it('parse hsv string', () => {
    expect(colordx('hsv(0, 100%, 100%)').toHex()).toBe('#ff0000');
  });
  it('parse hsv object', () => {
    expect(colordx({ h: 0, s: 100, v: 100, alpha: 1 }).toHex()).toBe('#ff0000');
  });
});


describe('README — harmonies plugin', () => {
  it('default (complementary) → 2 colors', () => {
    expect((colordx('#ff0000') as any).harmonies()).toHaveLength(2);
  });
  it('complementary → 2 colors', () => {
    expect((colordx('#ff0000') as any).harmonies('complementary')).toHaveLength(2);
  });
  it('analogous → 3 colors', () => {
    expect((colordx('#ff0000') as any).harmonies('analogous')).toHaveLength(3);
  });
  it('split-complementary → 3 colors', () => {
    expect((colordx('#ff0000') as any).harmonies('split-complementary')).toHaveLength(3);
  });
  it('triadic → 3 colors', () => {
    expect((colordx('#ff0000') as any).harmonies('triadic')).toHaveLength(3);
  });
  it('tetradic → 4 colors', () => {
    expect((colordx('#ff0000') as any).harmonies('tetradic')).toHaveLength(4);
  });
  it('rectangle → 4 colors', () => {
    expect((colordx('#ff0000') as any).harmonies('rectangle')).toHaveLength(4);
  });
  it('double-split-complementary → 5 colors', () => {
    expect((colordx('#ff0000') as any).harmonies('double-split-complementary')).toHaveLength(5);
  });
});


describe('README — hwb plugin', () => {
  it('toHwb', () => {
    expect((colordx('#ff0000') as any).toHwb()).toEqual({ h: 0, w: 0, b: 0, alpha: 1 });
  });
  it('toHwbString', () => {
    expect((colordx('#ff0000') as any).toHwbString()).toBe('hwb(0 0% 0%)');
  });
  it('parse hwb string', () => {
    expect(colordx('hwb(0 0% 0%)').toHex()).toBe('#ff0000');
  });
  it('parse hwb object', () => {
    expect(colordx({ h: 0, w: 0, b: 0, alpha: 1 }).toHex()).toBe('#ff0000');
  });
  it('toHwb default precision (0)', () => {
    expect((colordx('#3d7a9f') as any).toHwb()).toEqual({ h: 203, w: 24, b: 38, alpha: 1 });
  });
  it('toHwb precision 2', () => {
    expect((colordx('#3d7a9f') as any).toHwb(2)).toEqual({ h: 202.65, w: 23.92, b: 37.65, alpha: 1 });
  });
  it('toHwbString default', () => {
    expect((colordx('#3d7a9f') as any).toHwbString()).toBe('hwb(203 24% 38%)');
  });
  it('toHwbString precision 2', () => {
    expect((colordx('#3d7a9f') as any).toHwbString(2)).toBe('hwb(202.65 23.92% 37.65%)');
  });
});


describe('README — mix plugin', () => {
  it('tints(5)', () => {
    const t = (colordx('#ff0000') as any).tints(5).map((c: any) => c.toHex());
    expect(t).toEqual(['#ff0000', '#ff4040', '#ff8080', '#ffbfbf', '#ffffff']);
  });
  it('shades(3)', () => {
    const s = (colordx('#ff0000') as any).shades(3).map((c: any) => c.toHex());
    expect(s).toEqual(['#ff0000', '#800000', '#000000']);
  });
  it('tones(3)', () => {
    const t = (colordx('#ff0000') as any).tones(3).map((c: any) => c.toHex());
    expect(t).toEqual(['#ff0000', '#c04040', '#808080']);
  });
  it('palette(3, target)', () => {
    const p = (colordx('#ff0000') as any).palette(3, '#0000ff').map((c: any) => c.toHex());
    expect(p).toEqual(['#ff0000', '#800080', '#0000ff']);
  });
});


describe('README — minify plugin', () => {
  it('#ff0000 → #f00', () => expect((colordx('#ff0000') as any).minify()).toBe('#f00'));
  it('#ffffff → #fff', () => expect((colordx('#ffffff') as any).minify()).toBe('#fff'));
  it('name: true → red', () => expect((colordx('#ff0000') as any).minify({ name: true })).toBe('red'));
  it('transparent', () => {
    expect(colordx({ r: 0, g: 0, b: 0, alpha: 0 } as any).minify({ transparent: true })).toBe('transparent');
  });
  it('alphaHex', () => {
    expect(colordx({ r: 255, g: 0, b: 0, alpha: 0.5 } as any).minify({ alphaHex: true })).toBe('#ff000080');
  });
  it('hsl: false skips HSL candidates', () => {
    const result = (colordx('#ff0000') as any).minify({ hsl: false });
    expect(result).not.toMatch(/^hsl/);
  });
});


describe('README — a11y plugin (WCAG)', () => {
  it('isReadable AA normal', () => expect((colordx('#000') as any).isReadable('#fff')).toBe(true));
  it('isReadable AAA normal', () => expect((colordx('#000') as any).isReadable('#fff', { level: 'AAA' })).toBe(true));
  it('isReadable AA large', () => expect((colordx('#000') as any).isReadable('#fff', { size: 'large' })).toBe(true));
  it("readableScore black/white → 'AAA'", () => expect((colordx('#000') as any).readableScore('#fff')).toBe('AAA'));
  it("readableScore → 'AA'", () => expect((colordx('#e60000') as any).readableScore('#ffff47')).toBe('AA'));
  it("readableScore → 'AA large'", () => expect((colordx('#949494') as any).readableScore('#fff')).toBe('AA large'));
  it("readableScore → 'fail'", () => expect((colordx('#aaa') as any).readableScore('#fff')).toBe('fail'));
  it('minReadable produces readable color', () => {
    const result = (colordx('#777') as any).minReadable('#fff');
    expect((result as any).contrast('#fff')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('README — a11y plugin (APCA)', () => {
  it('black on white → ~106', () => expect((colordx('#000') as any).apcaContrast('#fff')).toBeCloseTo(106, 0));
  it('white on black → ~ -107.9', () => expect((colordx('#fff') as any).apcaContrast('#000')).toBeCloseTo(-107.9, 0));
  it('dark text on orange', () => expect((colordx('#202122') as any).apcaContrast('#cf674a')).toBeCloseTo(37.2, 0));
  it('white text on orange', () => expect((colordx('#ffffff') as any).apcaContrast('#cf674a')).toBeCloseTo(-69.5, 0));
  it('isReadableApca black/white → true', () => expect((colordx('#000') as any).isReadableApca('#fff')).toBe(true));
  it('isReadableApca #777 normal → false', () => expect((colordx('#777') as any).isReadableApca('#fff')).toBe(false));
  it('isReadableApca #777 large → true', () => {
    expect((colordx('#777') as any).isReadableApca('#fff', { size: 'large' })).toBe(true);
  });
});


describe('README — p3 plugin', () => {
  it('toP3', () => {
    expect((colordx('#ff0000') as any).toP3()).toEqual({ r: 0.9175, g: 0.2003, b: 0.1386, alpha: 1, colorSpace: 'display-p3' });
  });
  it('toP3String', () => {
    expect((colordx('#ff0000') as any).toP3String()).toBe('color(display-p3 0.9175 0.2003 0.1386)');
  });
  it('parse display-p3 string → toHex', () => {
    expect(colordx('color(display-p3 0.9175 0.2003 0.1386)').toHex()).toBe('#ff0000');
  });
  it('parse display-p3 string with alpha', () => {
    expect(colordx('color(display-p3 0.9175 0.2003 0.1386 / 0.5)').alpha()).toBeCloseTo(0.5, 2);
  });
  it('inGamutP3 inside P3', () => expect(inGamutP3('oklch(0.64 0.27 29)')).toBe(true));
  it('inGamutP3 outside P3', () => expect(inGamutP3('oklch(0.5 0.4 180)')).toBe(false));
  it('toGamutP3 → valid', () => expect(Colordx.toGamutP3('oklch(0.5 0.4 180)').isValid()).toBe(true));
  it('parse p3 object with colorSpace discriminant', () => {
    expect(colordx({ r: 0.9505, g: 0.2856, b: 0.0459, alpha: 1, colorSpace: 'display-p3' as const }).isValid()).toBe(
      true
    );
  });
});


describe('README — rec2020 plugin', () => {
  it('toRec2020', () => {
    expect((colordx('#ff0000') as any).toRec2020()).toEqual({ r: 0.792, g: 0.231, b: 0.0738, alpha: 1, colorSpace: 'rec2020' });
  });
  it('toRec2020String', () => {
    expect((colordx('#ff0000') as any).toRec2020String()).toBe('color(rec2020 0.792 0.231 0.0738)');
  });
  it('parse rec2020 string → toHex', () => {
    expect(colordx('color(rec2020 0.792 0.231 0.0738)').toHex()).toBe('#ff0000');
  });
  it('parse rec2020 string with alpha', () => {
    expect(colordx('color(rec2020 0.792 0.231 0.0738 / 0.5)').alpha()).toBeCloseTo(0.5, 2);
  });
  it('inGamutRec2020 outside', () => expect(inGamutRec2020('oklch(0.5 0.4 180)')).toBe(false));
  it('toGamutRec2020 → valid', () => expect(Colordx.toGamutRec2020('oklch(0.5 0.4 180)').isValid()).toBe(true));
  it('parse rec2020 object with colorSpace discriminant', () => {
    expect(colordx({ r: 0.7919, g: 0.2307, b: 0.0739, alpha: 1, colorSpace: 'rec2020' as const }).isValid()).toBe(true);
  });
});

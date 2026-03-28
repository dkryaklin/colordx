/**
 * Additional plugin tests covering edge cases, boundary values, and behaviours
 * not captured in plugins.test.ts.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { colordx, extend, Colordx } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import harmonies from '../src/plugins/harmonies.js';
import lab from '../src/plugins/lab.js';
import mix from '../src/plugins/mix.js';
import minify from '../src/plugins/minify.js';
import names from '../src/plugins/names.js';
import rec2020 from '../src/plugins/rec2020.js';
import { rgbToRec2020, rec2020ToRgb } from '../src/colorModels/rec2020.js';

beforeAll(() => {
  extend([names, a11y, harmonies, lab, mix, minify, rec2020]);
});


describe('a11y: APCA edge cases', () => {
  it('identical colors → APCA = 0', () => {
    expect((colordx('#777777') as any).apcaContrast('#777777')).toBe(0);
    expect((colordx('#000000') as any).apcaContrast('#000000')).toBe(0);
  });

  it('white on black → negative APCA', () => {
    expect((colordx('#ffffff') as any).apcaContrast('#000000')).toBeLessThan(0);
  });

  it('black on white → positive APCA', () => {
    expect((colordx('#000000') as any).apcaContrast('#ffffff')).toBeGreaterThan(0);
  });

  it('alpha compositing: precision not lost by premature integer rounding', () => {
    // rgba(0,0,0,0.5) composited over #ffffff → grey(127.5) not grey(128)
    // The APCA value must differ meaningfully from both black-on-white and grey-on-white
    const halfBlack = (colordx('rgba(0,0,0,0.5)') as any).apcaContrast('#ffffff');
    const blackOnWhite = (colordx('#000000') as any).apcaContrast('#ffffff');
    // composited grey should be noticeably less contrasty than full black
    expect(halfBlack).toBeLessThan(blackOnWhite);
    expect(halfBlack).toBeGreaterThan(0);
  });

  it('alpha compositing: white-on-black semi-transparent', () => {
    const halfWhite = (colordx('rgba(255,255,255,0.5)') as any).apcaContrast('#000000');
    const whiteOnBlack = (colordx('#ffffff') as any).apcaContrast('#000000');
    // composited grey over black should have less negative contrast than full white
    expect(halfWhite).toBeGreaterThan(whiteOnBlack);
    expect(halfWhite).toBeLessThan(0);
  });
});

describe('a11y: isReadableApca threshold boundaries', () => {
  // isReadableApca requires |Lc| >= 75 for normal, >= 60 for large.
  // We find colors that produce Lc exactly at the boundary and verify the transition.
  it('|Lc| < 75 → not readable (normal)', () => {
    // #777777 on white Lc ≈ 58 — well below 75
    expect((colordx('#777777') as any).isReadableApca('#ffffff')).toBe(false);
  });

  it('|Lc| >= 75 → readable (normal)', () => {
    // #000000 on white Lc ≈ 106 — above 75
    expect((colordx('#000000') as any).isReadableApca('#ffffff')).toBe(true);
  });

  it('|Lc| < 60 → not readable (large)', () => {
    // #999999 on white Lc ≈ 45 — below 60
    expect((colordx('#999999') as any).isReadableApca('#ffffff', { size: 'large' })).toBe(false);
  });

  it('|Lc| >= 60 → readable (large)', () => {
    // #777777 on white Lc ≈ 58, too low; #666666 on white Lc > 60
    expect((colordx('#555555') as any).isReadableApca('#ffffff', { size: 'large' })).toBe(true);
  });
});

describe('a11y: minReadable edge cases', () => {
  it('mid-grey on similar-grey bg: result achieves 4.5:1', () => {
    const result = (colordx('#888888') as any).minReadable('#777777');
    expect(result.contrast('#777777')).toBeGreaterThanOrEqual(4.5);
  });

  it('mid-grey on similar-grey bg: result is not the same as input', () => {
    const fg = colordx('#888888');
    const result = (fg as any).minReadable('#777777');
    // Must change the color, not return input unchanged
    expect(result.toHex()).not.toBe('#888888');
  });

  it('already readable color returned (virtually) unchanged', () => {
    // #000000 on #ffffff contrast = 21 >> 4.5 → returned immediately (first if)
    const result = (colordx('#000000') as any).minReadable('#ffffff');
    expect(result.toHex()).toBe('#000000');
  });

  it('white on white: darkens until contrast >= 4.5', () => {
    const result = (colordx('#ffffff') as any).minReadable('#ffffff');
    expect(result.contrast('#ffffff')).toBeGreaterThanOrEqual(4.5);
    // result must be darker than input
    expect(result.toHsl().l).toBeLessThan(100);
  });
});

describe('a11y: readableScore boundaries', () => {
  it('#000000 on #ffffff → AAA (contrast = 21)', () => {
    expect((colordx('#000000') as any).readableScore('#ffffff')).toBe('AAA');
  });

  it('ratio >= 4.5 and < 7 → AA', () => {
    // #595959 on white ≈ contrast 7+, actually AAA; use something that lands in AA band
    // #767676 on white ≈ contrast ~4.54 → AA
    expect((colordx('#767676') as any).readableScore('#ffffff')).toBe('AA');
  });

  it('ratio >= 3 and < 4.5 → AA large', () => {
    expect((colordx('#949494') as any).readableScore('#ffffff')).toBe('AA large');
  });

  it('#ffffff on #ffffff → fail (contrast = 1)', () => {
    expect((colordx('#ffffff') as any).readableScore('#ffffff')).toBe('fail');
  });
});


describe('harmonies: hue wraparound', () => {
  it('analogous on hsl(350°) produces hues in [0, 360)', () => {
    const colors: any[] = (colordx('hsl(350, 100%, 50%)') as any).harmonies('analogous');
    for (const c of colors) {
      const h = c.hue();
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  it('complementary on near-360 hue wraps correctly', () => {
    // hsl(10°) complement = 190°
    const colors: any[] = (colordx('hsl(10, 100%, 50%)') as any).harmonies('complementary');
    expect(colors[1].hue()).toBeCloseTo(190, 0);
  });
});

describe('harmonies: achromatic colors', () => {
  it('triadic on grey → all three remain grey (s ≈ 0)', () => {
    const colors: any[] = (colordx('#808080') as any).harmonies('triadic');
    for (const c of colors) {
      expect(c.toHsl().s).toBeCloseTo(0, 1);
    }
  });

  it('triadic on grey → all three have the same lightness', () => {
    const grey = colordx('#808080');
    const colors: any[] = (grey as any).harmonies('triadic');
    const l = (grey as any).toHsl().l;
    for (const c of colors) {
      expect(c.toHsl().l).toBeCloseTo(l, 1);
    }
  });
});

describe('harmonies: triadic angle precision', () => {
  it('triadic hues are ~120° apart', () => {
    const [a, b, c]: any[] = (colordx('#ff0000') as any).harmonies('triadic');
    const ha = a.hue(), hb = b.hue(), hc = c.hue();
    // red=0, 0+120=120, 0+240=240
    expect(ha).toBeCloseTo(0, 0);
    expect(hb).toBeCloseTo(120, 0);
    expect(hc).toBeCloseTo(240, 0);
  });

  it('split-complementary: first element has hue matching original', () => {
    const [a]: any[] = (colordx('hsl(60, 100%, 50%)') as any).harmonies('split-complementary');
    expect(a.hue()).toBeCloseTo(60, 0);
  });
});


describe('lab plugin: mixLab boundary ratios', () => {
  it('ratio=0 → pure first color', () => {
    const result = (colordx('#ff0000') as any).mixLab('#0000ff', 0);
    expect(result.toHex()).toBe('#ff0000');
  });

  it('ratio=1 → pure second color', () => {
    const result = (colordx('#ff0000') as any).mixLab('#0000ff', 1);
    expect(result.toHex()).toBe('#0000ff');
  });

  it('ratio=0.5 → perceptual midpoint (valid color)', () => {
    const result = (colordx('#ff0000') as any).mixLab('#0000ff', 0.5);
    expect(result.isValid()).toBe(true);
  });
});

describe('lab plugin: mixLab vs sRGB mix', () => {
  it('Lab mix produces different result than sRGB mix for red→blue', () => {
    const labMid = (colordx('#ff0000') as any).mixLab('#0000ff', 0.5).toHex();
    const rgbMid = colordx('#ff0000').mix('#0000ff', 0.5).toHex();
    // Perceptual mixing in Lab gives different midpoint than sRGB linear mixing
    expect(labMid).not.toBe(rgbMid);
  });
});

describe('lab plugin: mixLab alpha interpolation', () => {
  it('alpha interpolates from 0 to 1 at ratio=0.5', () => {
    const result = (colordx('rgba(255,0,0,0)') as any).mixLab('rgba(0,0,255,1)', 0.5);
    expect(result.alpha()).toBeCloseTo(0.5, 2);
  });

  it('alpha at ratio=0 matches first color alpha', () => {
    const result = (colordx('rgba(255,0,0,0.2)') as any).mixLab('rgba(0,0,255,0.8)', 0);
    expect(result.alpha()).toBeCloseTo(0.2, 2);
  });
});

describe('lab plugin: delta', () => {
  it('identical colors → delta = 0', () => {
    expect((colordx('#ff0000') as any).delta('#ff0000')).toBe(0);
    expect((colordx('#000000') as any).delta('#000000')).toBe(0);
  });

  it('delta is normalized to [0, 1]', () => {
    const d = (colordx('#ff0000') as any).delta('#0000ff');
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThanOrEqual(1);
  });

  it('delta is symmetric', () => {
    const d1 = (colordx('#ff0000') as any).delta('#00ff00');
    const d2 = (colordx('#00ff00') as any).delta('#ff0000');
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('black vs white → near-maximum delta (~1)', () => {
    const d = (colordx('#000000') as any).delta('#ffffff');
    expect(d).toBeGreaterThan(0.9);
  });
});

describe('lab plugin: toLab — no negative zero', () => {
  it('grey a and b channels are 0, not -0', () => {
    const lab = (colordx('#808080') as any).toLab();
    // Object.is distinguishes 0 from -0
    expect(Object.is(lab.a, -0)).toBe(false);
    expect(Object.is(lab.b, -0)).toBe(false);
    expect(lab.a).toBe(0);
    expect(lab.b).toBe(0);
  });
});


describe('minify: hex shortening', () => {
  it('non-shortable hex remains 6-digit', () => {
    const result = (colordx('#ff8040') as any).minify();
    // ff ≠ 88, 80 ≠ 00, 44 ≠ 00 → not shortable
    expect(result).toBe('#ff8040');
  });

  it('#fff shortens to #fff', () => {
    expect((colordx('#ffffff') as any).minify()).toBe('#fff');
  });

  it('#f00 shortens to #f00', () => {
    expect((colordx('#ff0000') as any).minify()).toBe('#f00');
  });
});

describe('minify: alpha hex lossless check', () => {
  it('alpha=0.5 is lossless at 2dp precision → produces 8-digit hex #ffffff80', () => {
    // byte = round(0.5*255) = 128; round(128/255*100) = round(50.196) = 50 = round(50) → lossless
    const result = (colordx('rgba(255,255,255,0.5)') as any).minify({ alphaHex: true });
    expect(result).toBe('#ffffff80');
  });

  it('alpha=0 is lossless → produces short hex #fff0', () => {
    // alpha=0 → 0x00; rgba(255,255,255,0) → #ffffff00 → shortable #fff0
    const result = (colordx('rgba(255,255,255,0)') as any).minify({ alphaHex: true });
    expect(result).toBe('#fff0');
  });

  it('alpha=0.005 is lossy → does NOT produce hex form', () => {
    // byte = round(0.005*255) = 1; round(1/255*100) = 0 ≠ round(0.5) = 1 → lossy
    const result = (colordx({ r: 255, g: 0, b: 0, alpha: 0.005 }) as any).minify({ alphaHex: true });
    expect(result).not.toMatch(/^#/);
  });
});

describe('minify: transparent keyword', () => {
  it('rgba(0,0,0,0) with transparent:true → "transparent"', () => {
    expect((colordx('rgba(0,0,0,0)') as any).minify({ transparent: true })).toBe('transparent');
  });

  it('rgba(255,0,0,0) with transparent:true → NOT "transparent"', () => {
    const result = (colordx('rgba(255,0,0,0)') as any).minify({ transparent: true });
    expect(result).not.toBe('transparent');
  });
});

describe('minify: name option', () => {
  it('#ff0000 with name:true → "red" (shorter than #f00)', () => {
    // 'red' = 3 chars, '#f00' = 4 chars → 'red' wins
    expect((colordx('#ff0000') as any).minify({ name: true })).toBe('red');
  });

  it('#663399 with name:true → "#639" (hex is shorter than "rebeccapurple")', () => {
    // '#639' = 4 chars < 'rebeccapurple' = 13 chars → hex wins
    expect((colordx('#663399') as any).minify({ name: true })).toBe('#639');
  });
});

describe('minify: winner selection', () => {
  it('#f00 (4 chars) beats rgb(255,0,0) (12 chars)', () => {
    const result = (colordx('#ff0000') as any).minify({ name: false });
    expect(result.length).toBeLessThanOrEqual(4);
  });
});


describe('mix plugin: boundary values', () => {
  it('tints(5): first = original, last = white', () => {
    const tints: any[] = (colordx('#ff0000') as any).tints(5);
    expect(tints[0].toHex()).toBe('#ff0000');
    expect(tints[4].toHex()).toBe('#ffffff');
  });

  it('shades(5): first = original, last = black', () => {
    const shades: any[] = (colordx('#ff0000') as any).shades(5);
    expect(shades[0].toHex()).toBe('#ff0000');
    expect(shades[4].toHex()).toBe('#000000');
  });

  it('tones(5): first = original, last = grey', () => {
    const tones: any[] = (colordx('#ff0000') as any).tones(5);
    expect(tones[0].toHex()).toBe('#ff0000');
    expect(tones[4].toHex()).toBe('#808080');
  });
});

describe('mix plugin: count=1', () => {
  it('tints(1) → [original], valid', () => {
    const t: any[] = (colordx('#ff0000') as any).tints(1);
    expect(t).toHaveLength(1);
    expect(t[0].isValid()).toBe(true);
    expect(t[0].toHex()).toBe('#ff0000');
  });

  it('shades(1) → [original], valid', () => {
    const s: any[] = (colordx('#ff0000') as any).shades(1);
    expect(s).toHaveLength(1);
    expect(s[0].isValid()).toBe(true);
  });

  it('tones(1) → [original], valid', () => {
    const t: any[] = (colordx('#ff0000') as any).tones(1);
    expect(t).toHaveLength(1);
    expect(t[0].isValid()).toBe(true);
  });
});

describe('mix plugin: all results valid', () => {
  it('tints(10) — all valid', () => {
    const tints: any[] = (colordx('#ff0000') as any).tints(10);
    for (const c of tints) expect(c.isValid()).toBe(true);
  });

  it('shades(10) — all valid', () => {
    const shades: any[] = (colordx('#ff0000') as any).shades(10);
    for (const c of shades) expect(c.isValid()).toBe(true);
  });
});

describe('mix plugin: palette with custom target', () => {
  it('palette(5, blue): first=red, last=blue', () => {
    const palette: any[] = (colordx('#ff0000') as any).palette(5, '#0000ff');
    expect(palette[0].toHex()).toBe('#ff0000');
    expect(palette[4].toHex()).toBe('#0000ff');
  });
});


describe('names: aqua/cyan and fuchsia/magenta duplicates', () => {
  it('#00ffff → "aqua" (insertion-order: aqua precedes cyan)', () => {
    expect((colordx('#00ffff') as any).toName()).toBe('aqua');
  });

  it('#ff00ff → "fuchsia" (insertion-order: fuchsia precedes magenta)', () => {
    expect((colordx('#ff00ff') as any).toName()).toBe('fuchsia');
  });
});

describe('names: case insensitive and trimmed parsing', () => {
  it('"RED" parses to #ff0000', () => {
    expect(colordx('RED').toHex()).toBe('#ff0000');
  });

  it('"AliceBlue" parses to #f0f8ff', () => {
    expect(colordx('AliceBlue').toHex()).toBe('#f0f8ff');
  });

  it('"  red  " (with spaces) parses to #ff0000', () => {
    expect(colordx('  red  ').toHex()).toBe('#ff0000');
  });
});

describe('names: closest is actually closest', () => {
  it('#fe0000 → "red" (not darkred or orangered)', () => {
    expect((colordx('#fe0000') as any).toName({ closest: true })).toBe('red');
  });

  it('#808080 → "gray" (exact hex match)', () => {
    expect((colordx('#808080') as any).toName({ closest: true })).toBe('gray');
  });

  it('#ffffff → "white" (exact hex match)', () => {
    expect((colordx('#ffffff') as any).toName({ closest: true })).toBe('white');
  });

  it('no exact match without closest: true → undefined', () => {
    expect((colordx('#ff0001') as any).toName()).toBeUndefined();
  });

  it('no exact match with closest: true → nearest name', () => {
    expect((colordx('#ff0001') as any).toName({ closest: true })).toBe('red');
  });
});

describe('names: transparent variants', () => {
  it('rgba(0,0,0,0) → "transparent"', () => {
    expect((colordx('rgba(0,0,0,0)') as any).toName()).toBe('transparent');
  });

  it('rgba(255,0,0,0) → undefined (not transparent — CSS transparent is specifically #00000000)', () => {
    expect((colordx('rgba(255,0,0,0)') as any).toName()).toBeUndefined();
  });

  it('rgba(255,255,255,0) → undefined', () => {
    expect((colordx('rgba(255,255,255,0)') as any).toName()).toBeUndefined();
  });
});


describe('rec2020: round-trip', () => {
  const srgbInputs = [
    { r: 200, g: 100, b: 50, alpha: 1 },
    { r: 255, g: 255, b: 255, alpha: 1 },
    { r: 0,   g: 0,   b: 0,   alpha: 1 },
    { r: 128, g: 64,  b: 192, alpha: 1 },
  ];

  for (const orig of srgbInputs) {
    it(`rgb(${orig.r},${orig.g},${orig.b})`, () => {
      const back = rec2020ToRgb(rgbToRec2020(orig));
      expect(back.r).toBeCloseTo(orig.r, 0);
      expect(back.g).toBeCloseTo(orig.g, 0);
      expect(back.b).toBeCloseTo(orig.b, 0);
    });
  }
});

describe('rec2020: string round-trip', () => {
  const hexColors = ['#ff8040', '#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#3b82f6'];

  for (const hex of hexColors) {
    it(hex, () => {
      const str = (colordx(hex) as any).toRec2020String();
      expect(colordx(str).toHex()).toBe(hex);
    });
  }
});

describe('rec2020: in-gamut sRGB channels stay in [0, 1]', () => {
  it('sRGB red r channel is in [0, 1] in Rec.2020', () => {
    const p = rgbToRec2020({ r: 255, g: 0, b: 0, alpha: 1 });
    expect(p.r).toBeGreaterThanOrEqual(0);
    expect(p.r).toBeLessThanOrEqual(1);
  });

  it('sRGB primary colors have channels in [0, 1]', () => {
    for (const rgb of [
      { r: 255, g: 0, b: 0, alpha: 1 },
      { r: 0, g: 255, b: 0, alpha: 1 },
      { r: 0, g: 0, b: 255, alpha: 1 },
    ]) {
      const p = rgbToRec2020(rgb);
      expect(p.r).toBeGreaterThanOrEqual(0);
      expect(p.r).toBeLessThanOrEqual(1);
      expect(p.g).toBeGreaterThanOrEqual(0);
      expect(p.g).toBeLessThanOrEqual(1);
      expect(p.b).toBeGreaterThanOrEqual(0);
      expect(p.b).toBeLessThanOrEqual(1);
    }
  });
});

describe('rec2020: alpha passthrough', () => {
  it('rgbToRec2020 preserves alpha', () => {
    expect(rgbToRec2020({ r: 255, g: 0, b: 0, alpha: 0.5 }).alpha).toBe(0.5);
  });

  it('rec2020ToRgb preserves alpha', () => {
    expect(rec2020ToRgb({ r: 0.5, g: 0.5, b: 0.5, alpha: 0.7, colorSpace: 'rec2020' }).alpha).toBe(0.7);
  });
});

describe('rec2020: string format', () => {
  it('opaque color starts with "color(rec2020 " and has no "/"', () => {
    const str = (colordx('#ff0000') as any).toRec2020String();
    expect(str).toMatch(/^color\(rec2020 /);
    expect(str).not.toContain('/');
  });

  it('semi-transparent color includes "/ alpha"', () => {
    const str = (colordx('rgba(255,0,0,0.5)') as any).toRec2020String();
    expect(str).toMatch(/^color\(rec2020 /);
    expect(str).toContain('/ 0.5');
  });
});

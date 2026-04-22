import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import cmyk from '../src/plugins/cmyk.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import p3 from '../src/plugins/p3.js';
import rec2020 from '../src/plugins/rec2020.js';

beforeAll(() => extend([hsv, hwb, lab, lch, p3, rec2020, cmyk]));

// CSS Color 4 expands the parseable surface: `none` keyword, `<percentage>|<number>`
// on most channels, and makes `%` optional on lab/lch L. These tests pin the new behaviour.

describe('`none` keyword (CSS Color 4)', () => {
  it('rgb channels: none → 0', () => {
    expect(colordx('rgb(none 128 255)').toHex()).toBe('#0080ff');
    expect(colordx('rgb(255 none 128)').toHex()).toBe('#ff0080');
  });
  it('rgb alpha: none → 0', () => {
    expect(colordx('rgb(255 0 0 / none)').alpha()).toBe(0);
  });
  it('rgb legacy comma syntax rejects none', () => {
    expect(colordx('rgb(none, 0, 0)').isValid()).toBe(false);
    expect(colordx('rgba(0, 0, 0, none)').isValid()).toBe(false);
  });
  it('hsl channels: none → 0', () => {
    expect(colordx('hsl(none 100% 50%)').toHex()).toBe('#ff0000');
    expect(colordx('hsl(120 none 50%)').toHex()).toBe('#808080');
  });
  it('hsl legacy comma syntax rejects none', () => {
    expect(colordx('hsl(none, 100%, 50%)').isValid()).toBe(false);
  });
  it('hwb channels: none → 0', () => {
    expect(colordx('hwb(none 0% 0%)').toHex()).toBe('#ff0000');
    expect(colordx('hwb(0 none 0%)').toHex()).toBe('#ff0000');
  });
  it('lab channels: none → 0', () => {
    expect(colordx('lab(50 none none)').isValid()).toBe(true);
  });
  it('lch alpha: none → 0', () => {
    expect(colordx('lch(50 30 180 / none)').alpha()).toBe(0);
  });
  it('p3 channels: none → 0', () => {
    expect(colordx('color(display-p3 none 0 0)').isValid()).toBe(true);
  });
  it('rec2020 alpha: none → 0', () => {
    expect(colordx('color(rec2020 1 0 0 / none)').alpha()).toBe(0);
  });
  it('device-cmyk: none → 0', () => {
    expect(colordx('device-cmyk(none none none none)').isValid()).toBe(true);
  });
});

describe('lab/lch L accepts number or percentage', () => {
  it('lab(50 ...) and lab(50% ...) produce the same color', () => {
    expect(colordx('lab(50 20 -10)').toHex()).toBe(colordx('lab(50% 20 -10)').toHex());
  });
  it('lch(50 ...) and lch(50% ...) produce the same color', () => {
    expect(colordx('lch(50 30 180)').toHex()).toBe(colordx('lch(50% 30 180)').toHex());
  });
});

describe('lab/lch a/b/c accept percentages', () => {
  it('lab a/b: 100% = 125', () => {
    // lab(50 100% 0) should equal lab(50 125 0)
    expect(colordx('lab(50 100% 0)').toHex()).toBe(colordx('lab(50 125 0)').toHex());
  });
  it('lch c: 100% = 150', () => {
    expect(colordx('lch(50 100% 180)').toHex()).toBe(colordx('lch(50 150 180)').toHex());
  });
});

describe('hwb w/b accept numbers without %', () => {
  it('hwb(0 50 50) equals hwb(0 50% 50%)', () => {
    expect(colordx('hwb(0 50 50)').toHex()).toBe(colordx('hwb(0 50% 50%)').toHex());
  });
});

describe('p3/rec2020 accept percentages on channels', () => {
  it('display-p3 100% = 1', () => {
    expect(colordx('color(display-p3 100% 0 0)').toHex()).toBe(colordx('color(display-p3 1 0 0)').toHex());
  });
  it('rec2020 100% = 1', () => {
    expect(colordx('color(rec2020 50% 50% 50%)').toHex()).toBe(colordx('color(rec2020 0.5 0.5 0.5)').toHex());
  });
});

describe('modern output formats', () => {
  it('toRgbString uses space syntax', () => {
    expect(colordx('#ff0000').toRgbString()).toBe('rgb(255 0 0)');
    expect(colordx('rgb(255 0 0 / 0.5)').toRgbString()).toBe('rgb(255 0 0 / 0.5)');
  });
  it('toHslString uses space syntax', () => {
    expect(colordx('#ff0000').toHslString()).toBe('hsl(0 100% 50%)');
  });
  it('toLabString drops % on L', () => {
    expect((colordx('#ff0000') as unknown as { toLabString: () => string }).toLabString()).toMatch(/^lab\(\d/);
  });
  it('toLchString drops % on L', () => {
    expect((colordx('#ff0000') as unknown as { toLchString: () => string }).toLchString()).toMatch(/^lch\(\d/);
  });
});

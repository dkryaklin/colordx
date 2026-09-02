import { describe, expect, it } from 'vitest';
import { Colordx, colordx, extend, inGamutSrgb } from '../src/index.js';
import p3, { inGamutP3 } from '../src/plugins/p3.js';

// Gamut helpers read wide-gamut input through the shared parser, so a plugin format is only
// understood once its plugin is loaded. A plugin's own helpers parse their own format without
// extend(). This file must not call extend() before the first block runs.

describe('gamut helpers before extend()', () => {
  it('inGamutP3 understands its own format without extend()', () => {
    expect(inGamutP3('color(display-p3 1 0 0)')).toBe(true);
    expect(inGamutP3('color(display-p3 1.2 0 0)')).toBe(false);
    expect(inGamutP3({ r: 1, g: 0, b: 0, alpha: 1, colorSpace: 'display-p3' })).toBe(true);
    expect(inGamutP3({ r: 1.2, g: 0, b: 0, alpha: 1, colorSpace: 'display-p3' })).toBe(false);
  });

  it('inGamutP3 still reads oklch and oklab directly', () => {
    expect(inGamutP3('oklch(0.64 0.27 29)')).toBe(true);
    expect(inGamutP3('oklch(0.5 0.4 180)')).toBe(false);
  });

  it('core treats an unloaded plugin format as sRGB-bounded', () => {
    expect(colordx('color(display-p3 1 0 0)').isValid()).toBe(false);
    expect(inGamutSrgb('color(display-p3 1 0 0)')).toBe(true);
    expect(Colordx.toGamutSrgb('color(display-p3 1 0 0)').isValid()).toBe(false);
  });
});

describe('gamut helpers after extend()', () => {
  it('core sees the plugin format once it is loaded', () => {
    extend([p3]);
    expect(inGamutSrgb('color(display-p3 1 0 0)')).toBe(false);
    expect(inGamutSrgb('color(display-p3 0.5 0.5 0.5)')).toBe(true);
    const mapped = Colordx.toGamutSrgb('color(display-p3 1 0 0)');
    expect(mapped.isValid()).toBe(true);
    expect(inGamutSrgb(mapped.toRgb())).toBe(true);
    expect(mapped.toHex()).toBe(colordx('color(display-p3 1 0 0)').mapSrgb().toHex());
  });
});

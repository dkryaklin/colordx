import { describe, expect, it } from 'vitest';
import { inGamutSrgb, toGamutSrgb } from '../src/gamut.js';

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

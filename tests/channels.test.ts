import { describe, expect, it } from 'vitest';
import { oklchToP3Channels, oklchToRec2020Channels, oklchToRgbChannels } from '../src/channels.js';
import { colordx, inGamutSrgb } from '../src/index.js';

describe('oklchToRgbChannels', () => {
  it('returns [1,1,1] for white', () => {
    const [r, g, b] = oklchToRgbChannels(1, 0, 0);
    expect(r).toBeCloseTo(1, 5);
    expect(g).toBeCloseTo(1, 5);
    expect(b).toBeCloseTo(1, 5);
  });

  it('returns [0,0,0] for black', () => {
    const [r, g, b] = oklchToRgbChannels(0, 0, 0);
    expect(r).toBeCloseTo(0, 5);
    expect(g).toBeCloseTo(0, 5);
    expect(b).toBeCloseTo(0, 5);
  });

  it('matches colordx class API for in-gamut colors (round-trip)', () => {
    const cases: [number, number, number][] = [
      [0.7, 0.1, 120],
      [0.5, 0.05, 250],
      [0.9, 0.08, 60],
      [0.5, 0.06, 330],
    ];
    for (const [l, c, h] of cases) {
      if (!inGamutSrgb({ l, c, h, alpha: 1 })) continue;
      const [r, g, b] = oklchToRgbChannels(l, c, h);
      const rgb = colordx({ l, c, h, alpha: 1 }).toRgb();
      expect(Math.round(r * 255)).toBe(rgb.r);
      expect(Math.round(g * 255)).toBe(rgb.g);
      expect(Math.round(b * 255)).toBe(rgb.b);
    }
  });

  it('handles hue of 0 and 360 identically', () => {
    const [r0, g0, b0] = oklchToRgbChannels(0.6, 0.15, 0);
    const [r360, g360, b360] = oklchToRgbChannels(0.6, 0.15, 360);
    expect(r0).toBeCloseTo(r360, 10);
    expect(g0).toBeCloseTo(g360, 10);
    expect(b0).toBeCloseTo(b360, 10);
  });

  it('returns values outside [0,1] for out-of-gamut colors', () => {
    // Very saturated green — outside sRGB
    const [r, g, b] = oklchToRgbChannels(0.5, 0.4, 145);
    const outOfGamut = r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1;
    expect(outOfGamut).toBe(true);
  });
});

describe('oklchToP3Channels', () => {
  it('returns [1,1,1] for white', () => {
    const [r, g, b] = oklchToP3Channels(1, 0, 0);
    expect(r).toBeCloseTo(1, 5);
    expect(g).toBeCloseTo(1, 5);
    expect(b).toBeCloseTo(1, 5);
  });

  it('returns [0,0,0] for black', () => {
    const [r, g, b] = oklchToP3Channels(0, 0, 0);
    expect(r).toBeCloseTo(0, 5);
    expect(g).toBeCloseTo(0, 5);
    expect(b).toBeCloseTo(0, 5);
  });

  it('accepts colors outside sRGB gamut that are within P3', () => {
    // A color in P3 but outside sRGB — all P3 channels should be in [0,1]
    const [r, g, b] = oklchToP3Channels(0.65, 0.22, 145);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
  });

  it('matches toP3String output for in-gamut sRGB colors', () => {
    // For in-gamut sRGB, p3 channels should match colordx toP3String values
    const l = 0.7, c = 0.1, h = 120;
    const [r, g, b] = oklchToP3Channels(l, c, h);
    const p3str = colordx({ l, c, h, alpha: 1 }).toP3String();
    // Parse the channel values from the string
    const m = /color\(display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/.exec(p3str)!;
    expect(r).toBeCloseTo(Number(m[1]), 3);
    expect(g).toBeCloseTo(Number(m[2]), 3);
    expect(b).toBeCloseTo(Number(m[3]), 3);
  });

  it('returns different values than oklchToRgbChannels (wider gamut matrix)', () => {
    const [rRgb, gRgb, bRgb] = oklchToRgbChannels(0.6, 0.22, 145);
    const [rP3, gP3, bP3] = oklchToP3Channels(0.6, 0.22, 145);
    // P3 channels should differ from sRGB channels for saturated colors
    const anyDifferent = rRgb !== rP3 || gRgb !== gP3 || bRgb !== bP3;
    expect(anyDifferent).toBe(true);
  });
});

describe('oklchToRec2020Channels', () => {
  it('returns [1,1,1] for white', () => {
    const [r, g, b] = oklchToRec2020Channels(1, 0, 0);
    expect(r).toBeCloseTo(1, 5);
    expect(g).toBeCloseTo(1, 5);
    expect(b).toBeCloseTo(1, 5);
  });

  it('returns [0,0,0] for black', () => {
    const [r, g, b] = oklchToRec2020Channels(0, 0, 0);
    expect(r).toBeCloseTo(0, 5);
    expect(g).toBeCloseTo(0, 5);
    expect(b).toBeCloseTo(0, 5);
  });

  it('uses BT.2020 gamma, not sRGB gamma', () => {
    // For oklch(0.5, 0, 0), linear value ≈ 0.125 for all channels
    // sRGB gamma of 0.125 ≈ 0.3886
    // BT.2020 gamma of 0.125: alpha * 0.125^0.45 - (alpha-1) ≈ 0.3322
    // These are meaningfully different — test confirms correct transfer function
    const [r] = oklchToRec2020Channels(0.5, 0, 0);
    const [rSrgb] = oklchToRgbChannels(0.5, 0, 0);
    expect(r).not.toBeCloseTo(rSrgb, 2);
    // BT.2020 result for this linear value should be ~0.332
    expect(r).toBeCloseTo(0.332, 2);
  });

  it('returns different values than P3 channels for saturated colors', () => {
    const [rP3, gP3, bP3] = oklchToP3Channels(0.7, 0.2, 200);
    const [r2020, g2020, b2020] = oklchToRec2020Channels(0.7, 0.2, 200);
    const anyDifferent = rP3 !== r2020 || gP3 !== g2020 || bP3 !== b2020;
    expect(anyDifferent).toBe(true);
  });
});

describe('toP3String', () => {
  it('returns correct CSS format for opaque color', () => {
    const result = colordx('#ff0000').toP3String();
    expect(result).toMatch(/^color\(display-p3 [\d.]+ [\d.]+ [\d.]+\)$/);
  });

  it('includes alpha with / separator when alpha < 1', () => {
    const result = colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }).toP3String();
    expect(result).toMatch(/^color\(display-p3 [\d.]+ [\d.]+ [\d.]+ \/ 0\.5\)$/);
  });

  it('returns white for white input', () => {
    expect(colordx('#ffffff').toP3String()).toBe('color(display-p3 1 1 1)');
  });

  it('returns black for black input', () => {
    expect(colordx('#000000').toP3String()).toBe('color(display-p3 0 0 0)');
  });

  it('sRGB primary red maps to P3 red channel > 0.9', () => {
    // sRGB red in P3 has r ≈ 0.9174, much less saturated in P3 gamut
    const result = colordx('#ff0000').toP3String();
    const m = /color\(display-p3 ([\d.]+)/.exec(result)!;
    expect(Number(m[1])).toBeGreaterThan(0.9);
  });
});

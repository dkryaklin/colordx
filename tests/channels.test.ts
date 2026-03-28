import { describe, expect, it } from 'vitest';
import { oklchToLinearAndSrgb, oklchToRgbChannels } from '../src/channels.js';
import { colordx, extend } from '../src/index.js';
import p3 from '../src/plugins/p3.js';
import { oklchToP3Channels } from '../src/plugins/p3.js';
import { oklchToRec2020Channels } from '../src/plugins/rec2020.js';

extend([p3]);

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

  it('returns known channel values for in-gamut colors', () => {
    const [r1, g1, b1] = oklchToRgbChannels(0.7, 0.1, 120);
    expect(r1).toBeCloseTo(0.5894, 4);
    expect(g1).toBeCloseTo(0.6578, 4);
    expect(b1).toBeCloseTo(0.3703, 4);

    const [r2, g2, b2] = oklchToRgbChannels(0.5, 0.05, 250);
    expect(r2).toBeCloseTo(0.3038, 4);
    expect(g2).toBeCloseTo(0.3988, 4);
    expect(b2).toBeCloseTo(0.4983, 4);

    const [r3, g3, b3] = oklchToRgbChannels(0.5, 0.06, 330);
    expect(r3).toBeCloseTo(0.4667, 4);
    expect(g3).toBeCloseTo(0.3405, 4);
    expect(b3).toBeCloseTo(0.4535, 4);
  });

  it('handles hue of 0 and 360 identically', () => {
    const [r0, g0, b0] = oklchToRgbChannels(0.6, 0.15, 0);
    const [r360, g360, b360] = oklchToRgbChannels(0.6, 0.15, 360);
    expect(r0).toBeCloseTo(r360, 10);
    expect(g0).toBeCloseTo(g360, 10);
    expect(b0).toBeCloseTo(b360, 10);
  });

  it('returns unclamped r > 1 for slightly out-of-gamut color', () => {
    // (0.9, 0.08, 60) is just outside sRGB — r exceeds 1
    const [r] = oklchToRgbChannels(0.9, 0.08, 60);
    expect(r).toBeGreaterThan(1);
  });

  it('returns values outside [0,1] for strongly out-of-gamut colors', () => {
    const [r, g, b] = oklchToRgbChannels(0.5, 0.4, 145);
    const outOfGamut = r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1;
    expect(outOfGamut).toBe(true);
  });
});

describe('oklchToLinearAndSrgb', () => {
  it('linear and sRGB channels are consistent with each other', () => {
    const [[lr, lg, lb], [sr, sg, sb]] = oklchToLinearAndSrgb(0.7, 0.1, 120);
    const [sr2, sg2, sb2] = oklchToRgbChannels(0.7, 0.1, 120);
    expect(sr).toBeCloseTo(sr2, 10);
    expect(sg).toBeCloseTo(sg2, 10);
    expect(sb).toBeCloseTo(sb2, 10);
    // linear channels must differ from gamma channels for non-trivial lightness
    expect(lr).not.toBeCloseTo(sr, 3);
    expect(lg).not.toBeCloseTo(sg, 3);
  });

  it('returns [[1,1,1],[1,1,1]] for white', () => {
    const [[lr, lg, lb], [sr, sg, sb]] = oklchToLinearAndSrgb(1, 0, 0);
    expect(lr).toBeCloseTo(1, 5);
    expect(lg).toBeCloseTo(1, 5);
    expect(lb).toBeCloseTo(1, 5);
    expect(sr).toBeCloseTo(1, 5);
    expect(sg).toBeCloseTo(1, 5);
    expect(sb).toBeCloseTo(1, 5);
  });

  it('returns [[0,0,0],[0,0,0]] for black', () => {
    const [[lr, lg, lb], [sr, sg, sb]] = oklchToLinearAndSrgb(0, 0, 0);
    expect(lr).toBeCloseTo(0, 5);
    expect(lg).toBeCloseTo(0, 5);
    expect(lb).toBeCloseTo(0, 5);
    expect(sr).toBeCloseTo(0, 5);
    expect(sg).toBeCloseTo(0, 5);
    expect(sb).toBeCloseTo(0, 5);
  });

  it('linear channels in [0,1] for in-gamut colors (free gamut check)', () => {
    const [[lr, lg, lb]] = oklchToLinearAndSrgb(0.6, 0.1, 200);
    expect(lr).toBeGreaterThanOrEqual(0);
    expect(lr).toBeLessThanOrEqual(1);
    expect(lg).toBeGreaterThanOrEqual(0);
    expect(lg).toBeLessThanOrEqual(1);
    expect(lb).toBeGreaterThanOrEqual(0);
    expect(lb).toBeLessThanOrEqual(1);
  });

  it('linear channels exceed [0,1] for out-of-gamut colors', () => {
    const [[lr, lg, lb]] = oklchToLinearAndSrgb(0.5, 0.4, 145);
    const outOfGamut = lr < 0 || lr > 1 || lg < 0 || lg > 1 || lb < 0 || lb > 1;
    expect(outOfGamut).toBe(true);
  });

  it('sRGB channels match oklchToRgbChannels exactly', () => {
    const cases: [number, number, number][] = [
      [0.5, 0.05, 250],
      [0.5, 0.06, 330],
      [0.9, 0.08, 60],
    ];
    for (const [l, c, h] of cases) {
      const [, [sr, sg, sb]] = oklchToLinearAndSrgb(l, c, h);
      const [er, eg, eb] = oklchToRgbChannels(l, c, h);
      expect(sr).toBeCloseTo(er, 10);
      expect(sg).toBeCloseTo(eg, 10);
      expect(sb).toBeCloseTo(eb, 10);
    }
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

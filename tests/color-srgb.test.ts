import { parse as culoriParse } from 'culori';
import { describe, expect, it } from 'vitest';
import { colordx, getFormat, inGamutSrgb } from '../src/index.js';

// color(srgb …) is core: same space as rgb(), 0–1 scale, no plugin needed.

describe('color(srgb) parsing', () => {
  it.each([
    ['color(srgb 1 0 0)', '#ff0000'],
    ['color(srgb 100% 0% 0%)', '#ff0000'],
    ['color(srgb 0.5 0.25 1)', '#8040ff'],
    ['color(srgb 0.5 25% 1)', '#8040ff'],
    ['color(srgb none 0 0)', '#000000'],
    ['color(srgb 1 0 0 / 0.5)', '#ff000080'],
    ['color(srgb 1 0 0 / 50%)', '#ff000080'],
    ['color(srgb 1 0 0 / none)', '#ff000000'],
    ['COLOR( SRGB  1  0  0 )', '#ff0000'],
    ['\tcolor(srgb 1 0 0)\n', '#ff0000'],
  ])('%s → %s', (input, hex) => {
    expect(colordx(input).toHex8().slice(0, hex.length)).toBe(hex);
  });

  it('matches rgb() for the same color', () => {
    expect(colordx('color(srgb 0.2 0.4 0.6)').toRgb()).toEqual(colordx('rgb(51 102 153)').toRgb());
  });

  it('keeps out-of-range channels until sRGB output', () => {
    const c = colordx('color(srgb 1.2 -0.1 0)');
    expect(c.isValid()).toBe(true);
    expect(c.toHex()).toBe('#ff0000');
    expect(c._rawRgb().r).toBeCloseTo(306, 6);
    expect(c._rawRgb().g).toBeCloseTo(-25.5, 6);
  });

  it('clamps alpha', () => {
    expect(colordx('color(srgb 1 0 0 / 2)').toRgb().alpha).toBe(1);
    expect(colordx('color(srgb 1 0 0 / -1)').toRgb().alpha).toBe(0);
  });

  it('reports rgb format', () => {
    expect(getFormat('color(srgb 1 0 0)')).toBe('rgb');
  });

  it('does not swallow other color() spaces', () => {
    expect(colordx('color(srgb-linear 1 0 0)').isValid()).toBe(false);
    expect(colordx('color(display-p3 1 0 0)').isValid()).toBe(false);
  });
});

describe('color(srgb) gamut', () => {
  it('inGamutSrgb checks channels against [0, 1]', () => {
    expect(inGamutSrgb('color(srgb 1 0 0)')).toBe(true);
    expect(inGamutSrgb('color(srgb 1.2 0 0)')).toBe(false);
    expect(inGamutSrgb('color(srgb 0 -1% 0)')).toBe(false);
  });
});

describe('color(srgb) parity vs culori', () => {
  let seed = 0xc0ffee;
  const rand = () => {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >>> 17)) >>> 0;
    seed = (seed ^ (seed << 5)) >>> 0;
    return seed / 0xffffffff;
  };
  const COUNT = Number(process.env.PARITY_COUNT ?? 10_000);

  it('bytes agree within ±1 over random in-gamut inputs', () => {
    let worst = 0;
    for (let i = 0; i < COUNT; i++) {
      const r = rand().toFixed(6);
      const g = rand().toFixed(6);
      const b = rand().toFixed(6);
      const a = rand().toFixed(3);
      const str = `color(srgb ${r} ${g} ${b} / ${a})`;
      const cx = colordx(str).toRgb();
      const cu = culoriParse(str) as { r: number; g: number; b: number; alpha?: number };
      worst = Math.max(
        worst,
        Math.abs(cx.r - Math.round(cu.r * 255)),
        Math.abs(cx.g - Math.round(cu.g * 255)),
        Math.abs(cx.b - Math.round(cu.b * 255))
      );
      expect(cx.alpha).toBeCloseTo(cu.alpha ?? 1, 3);
    }
    expect(worst).toBeLessThanOrEqual(1);
  });

  it('raw channels agree exactly with culori before rounding', () => {
    for (let i = 0; i < 1000; i++) {
      const r = (rand() * 1.4 - 0.2).toFixed(6);
      const g = (rand() * 1.4 - 0.2).toFixed(6);
      const b = (rand() * 1.4 - 0.2).toFixed(6);
      const str = `color(srgb ${r} ${g} ${b})`;
      const cx = colordx(str)._rawRgb();
      const cu = culoriParse(str) as { r: number; g: number; b: number };
      expect(cx.r / 255).toBeCloseTo(cu.r, 10);
      expect(cx.g / 255).toBeCloseTo(cu.g, 10);
      expect(cx.b / 255).toBeCloseTo(cu.b, 10);
    }
  });
});

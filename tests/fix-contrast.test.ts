import { beforeAll, describe, expect, it } from 'vitest';
import { Colordx, colordx, extend, inGamutSrgb } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import p3, { inGamutP3 } from '../src/plugins/p3.js';

beforeAll(() => extend([a11y, p3]));

const hueDiff = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe('fixContrast()', () => {
  it('returns the same instance when the pair already passes', () => {
    const c = colordx('#000');
    expect(c.fixContrast('#fff')).toBe(c);
  });

  it('defaults to WCAG 4.5 and returns a color that passes as written (bytes)', () => {
    const fix = colordx('#3b82f6').fixContrast('#fff')!;
    expect(fix.toHex()).toBe('#2c72e5');
    expect(colordx(fix.toHex()).isReadable('#fff')).toBe(true);
  });

  it('keeps hue and chroma, moves lightness only, when the move stays in gamut', () => {
    const from = colordx('#3b82f6').toOklch();
    const to = colordx('#3b82f6').fixContrast('#fff')!.toOklch();
    expect(hueDiff(from.h, to.h)).toBeLessThan(1);
    expect(Math.abs(from.c - to.c)).toBeLessThan(0.002);
    expect(to.l).toBeLessThan(from.l);
  });

  it('is the smallest move: one step closer to the original fails', () => {
    const { c, h } = colordx('#3b82f6').toOklch();
    const fix = colordx('#3b82f6').fixContrast('#fff')!;
    const closer = Colordx.toGamutSrgb({ l: fix.toOklch().l + 0.01, c, h, alpha: 1 });
    expect(colordx(closer.toHex()).isReadable('#fff')).toBe(false);
  });

  it('reduces chroma only when the gamut forces it (yellow must go dark)', () => {
    const from = colordx('#ffeb3b').toOklch();
    const fix = colordx('#ffeb3b').fixContrast('#fff')!;
    const to = fix.toOklch();
    expect(fix.isReadable('#fff')).toBe(true);
    expect(hueDiff(from.h, to.h)).toBeLessThan(3);
    expect(to.c).toBeLessThan(from.c);
  });

  it('keeps polarity: a darker fg stays darker than the bg', () => {
    const fix = colordx('#3b82f6').fixContrast('#fff')!;
    expect(fix.luminance()).toBeLessThan(1);
    expect(fix.apcaContrast('#fff')).toBeGreaterThan(0);
  });

  it('flips polarity only when the same side has no solution', () => {
    // black on #444 is 2.2:1, so nothing darker than #333 passes
    const fix = colordx('#333').fixContrast('#444')!;
    expect(fix.luminance()).toBeGreaterThan(colordx('#444').luminance());
    expect(fix.isReadable('#444')).toBe(true);
  });

  it('returns null when no color with that hue passes', () => {
    expect(colordx('#999').fixContrast('#777', { wcag: 7 })).toBeNull();
    expect(colordx('#999').fixContrast('#777', { apca: 90 })).toBeNull();
  });

  it('gates on APCA alone when only apca is given', () => {
    const c = colordx('#3b82f6');
    expect(c.fixContrast('#fff', { apca: 60 })).toBe(c); // Lc 63.9, ratio 3.68
    const fix = c.fixContrast('#fff', { apca: 75 })!;
    expect(Math.abs(fix.apcaContrast('#fff'))).toBeGreaterThanOrEqual(75);
  });

  it('gates on both when both are given', () => {
    const fix = colordx('#3b82f6').fixContrast('#fff', { wcag: 4.5, apca: 75 })!;
    expect(fix.isReadable('#fff')).toBe(true);
    expect(fix.isReadableApca('#fff')).toBe(true);
    expect(fix.toHex()).toBe('#2168da');
  });

  it('keeps fg alpha and composites it over the bg', () => {
    const fix = colordx('rgba(120, 120, 120, 0.9)').fixContrast('#fff')!;
    expect(fix.alpha()).toBe(0.9);
    expect(fix.isReadable('#fff')).toBe(true);
    // black at 50% over white is 3.98:1, so nothing passes at that alpha
    expect(colordx('rgba(0, 0, 0, 0.5)').fixContrast('#fff')).toBeNull();
  });

  it('space p3 keeps the fix inside P3 rather than sRGB', () => {
    const wide = 'oklch(0.9 0.3 145)';
    const p3Fix = colordx(wide).fixContrast('#fff', { space: 'p3', apca: 60 })!;
    const srgbFix = colordx(wide).fixContrast('#fff', { apca: 60 })!;
    expect(inGamutP3(p3Fix.toP3String())).toBe(true);
    expect(Colordx.toGamutSrgb(p3Fix.toP3String()).toHex()).not.toBe(p3Fix.toHex());
    expect(p3Fix.toOklch().c).toBeGreaterThan(srgbFix.toOklch().c);
    expect(Math.abs(colordx(p3Fix.toP3String()).apcaContrast('#fff', { space: 'p3' }))).toBeGreaterThanOrEqual(60);
  });

  it('minReadable is fixContrast at WCAG 4.5, falling back to the input', () => {
    expect(colordx('#777').minReadable('#fff').toHex()).toBe(colordx('#777').fixContrast('#fff')!.toHex());
    const half = colordx('rgba(0, 0, 0, 0.5)');
    expect(half.minReadable('#fff')).toBe(half);
  });

  it('random pairs: fix passes as written, keeps hue when chroma is kept, null means black and white fail too', () => {
    let seed = 12345;
    const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000;
    const hex = () =>
      '#' +
      [0, 0, 0]
        .map(() =>
          Math.floor(rand() * 256)
            .toString(16)
            .padStart(2, '0')
        )
        .join('');
    const gates = [{ wcag: 4.5 }, { wcag: 7 }, { apca: 75 }, { wcag: 3, apca: 60 }];
    for (let i = 0; i < 500; i++) {
      const fg = hex();
      const bg = hex();
      const gate = gates[i % gates.length]!;
      const passes = (c: Colordx) =>
        (gate.wcag === undefined || c.contrast(bg, 10) >= gate.wcag) &&
        (gate.apca === undefined || Math.abs(c.apcaContrast(bg, { precision: 10 })) >= gate.apca);
      const fix = colordx(fg).fixContrast(bg, gate);
      if (fix === null) {
        expect(passes(colordx('#000')) || passes(colordx('#fff'))).toBe(false);
        continue;
      }
      expect(passes(colordx(fix.toHex()))).toBe(true);
      // Hue is exact when the moved color needed no gamut mapping. When it did, the CSS Color 4
      // map's clip step (within 0.02 deltaEOK) may shift hue a few degrees near black and white.
      const from = colordx(fg).toOklch();
      const to = fix.toOklch();
      if (from.c > 0.05 && inGamutSrgb({ l: to.l, c: from.c, h: from.h, alpha: 1 })) {
        expect(hueDiff(from.h, to.h)).toBeLessThan(2);
      }
    }
  });
});

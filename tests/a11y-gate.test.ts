import { beforeAll, describe, expect, it } from 'vitest';
import { Colordx, colordx, extend } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import p3 from '../src/plugins/p3.js';

beforeAll(() => extend([a11y, p3]));

describe('precision: gates use the unrounded value', () => {
  it('contrast() rounds to 2 decimals by default and accepts a precision', () => {
    expect(colordx('#d200d2').contrast('#fff')).toBe(4.5);
    expect(colordx('#d200d2').contrast('#fff', 4)).toBe(4.4959);
    expect(colordx('#000').contrast('#fff', 0)).toBe(21);
  });

  it('a true ratio of 4.4959 fails AA even though contrast() shows 4.5', () => {
    expect(colordx('#d200d2').isReadable('#fff')).toBe(false);
    expect(colordx('#d200d2').readableScore('#fff')).toBe('AA large');
  });

  it('luminance() accepts a precision and does not feed rounding into contrast()', () => {
    expect(colordx('#767676').luminance()).toBe(0.1812);
    expect(colordx('#767676').luminance(8)).toBe(0.18116424);
    // luminance rounded to 4 decimals used to push this pair below 4.5 (reported 4.49)
    expect(colordx('#c900ea').contrast('#fff', 4)).toBe(4.4952);
  });

  it('apcaContrast() rounds to 1 decimal by default and accepts a precision', () => {
    expect(colordx('#9900ff').apcaContrast('#fff')).toBe(75);
    expect(colordx('#9900ff').apcaContrast('#fff', { precision: 3 })).toBe(74.956);
  });

  it('a true Lc of 74.956 fails even though apcaContrast() shows 75', () => {
    expect(colordx('#9900ff').isReadableApca('#fff')).toBe(false);
  });
});

describe('over()', () => {
  it('returns the same instance for an opaque fg', () => {
    const c = colordx('#123456');
    expect(c.over('#fff')).toBe(c);
  });

  it('composites a translucent fg over an opaque bg', () => {
    expect(colordx('rgba(0, 0, 0, 0.5)').over('#fff').toHex()).toBe('#808080');
    expect(colordx('rgba(255, 0, 0, 0.25)').over('#0000ff').toRgb()).toEqual({ r: 64, g: 0, b: 191, alpha: 1 });
  });

  it('keeps the combined alpha when the bg is translucent too', () => {
    const c = colordx('rgba(0, 0, 0, 0.5)').over('rgba(255, 255, 255, 0.5)');
    expect(c.alpha()).toBe(0.75);
    // fg weight 0.5 / 0.75 = 2/3 → 255 / 3 = 85
    expect(c.toRgb()).toEqual({ r: 85, g: 85, b: 85, alpha: 0.75 });
  });

  it('two fully transparent layers stay transparent', () => {
    expect(colordx('rgba(0, 0, 0, 0)').over('rgba(255, 255, 255, 0)').alpha()).toBe(0);
  });

  it('flattens a stack bottom up', () => {
    const page = '#000';
    const surface = 'rgba(255, 255, 255, 0.2)';
    const fg = 'rgba(255, 255, 255, 0.6)';
    const flat = colordx(fg).over(colordx(surface).over(page));
    // surface over page = #333333; fg over that = 0.6 * 255 + 0.4 * 51 = 173.4
    expect(flat.toHex()).toBe('#adadad');
    expect(flat.alpha()).toBe(1);
  });

  it('accepts a Colordx instance as bg', () => {
    expect(colordx('rgba(0, 0, 0, 0.5)').over(colordx('#fff')).toHex()).toBe('#808080');
  });
});

describe('contrast methods composite through over()', () => {
  it('WCAG: translucent fg equals the flattened fg', () => {
    const fg = colordx('rgba(0, 0, 0, 0.5)');
    expect(fg.contrast('#fff', 6)).toBe(fg.over('#fff').contrast('#fff', 6));
    expect(fg.contrast('#fff')).toBe(3.98);
  });

  it('APCA: translucent fg equals the flattened fg', () => {
    const fg = colordx('rgba(0, 0, 0, 0.5)');
    expect(fg.apcaContrast('#fff', { precision: 6 })).toBe(fg.over('#fff').apcaContrast('#fff', { precision: 6 }));
    expect(colordx('#00000000').apcaContrast('#fff')).toBe(0);
  });

  it('accepts a Colordx instance as bg everywhere', () => {
    const bg = colordx('#fff');
    expect(colordx('#000').contrast(bg)).toBe(21);
    expect(colordx('#000').apcaContrast(bg)).toBe(106);
    expect(colordx('#000').isReadable(bg)).toBe(true);
    expect(colordx('#000').isReadableApca(bg)).toBe(true);
    expect(colordx('#000').readableScore(bg)).toBe('AAA');
    expect(colordx('#777').minReadable(bg).isReadable(bg)).toBe(true);
  });
});

describe('gamut: map, do not clip', () => {
  const p3Green = 'color(display-p3 0 1 0)';

  it('WCAG runs on the sRGB-mapped color', () => {
    const mapped = Colordx.toGamutSrgb(p3Green);
    expect(colordx(p3Green).contrast('#000', 6)).toBe(mapped.contrast('#000', 6));
    expect(colordx(p3Green).luminance(6)).toBe(mapped.luminance(6));
  });

  it('APCA in srgb space runs on the mapped color, not the clipped one', () => {
    const mapped = Colordx.toGamutSrgb(p3Green);
    expect(colordx(p3Green).apcaContrast('#000', { precision: 6 })).toBe(mapped.apcaContrast('#000', { precision: 6 }));
    expect(colordx(p3Green).apcaContrast('#000', { precision: 6 })).not.toBe(
      colordx('#00ff00').apcaContrast('#000', { precision: 6 })
    );
  });

  it('APCA in p3 space uses the P3 coefficients on the P3-mapped color', () => {
    const wide = 'oklch(0.8 0.3 145)';
    expect(colordx(wide).apcaContrast('#000', { space: 'srgb' })).toBe(-74.8);
    expect(colordx(wide).apcaContrast('#000', { space: 'p3' })).toBe(-73.3);
    expect(colordx('#000').apcaContrast('#fff', { space: 'p3' })).toBe(106);
    expect(colordx('#777').isReadableApca('#fff', { space: 'p3' })).toBe(false);
  });

  it('APCA in p3 space differs only slightly for in-sRGB colors (2.4 power, not the true transfer)', () => {
    const srgb = colordx('#3b82f6').apcaContrast('#fff', { precision: 4 });
    const p3 = colordx('#3b82f6').apcaContrast('#fff', { space: 'p3', precision: 4 });
    expect(p3).not.toBe(srgb);
    expect(Math.abs(p3 - srgb)).toBeLessThan(0.2);
  });
});

import { APCAcontrast, displayP3toY, sRGBtoY } from 'apca-w3';
import { wcagContrast } from 'culori';
import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import p3 from '../src/plugins/p3.js';

// Parity against apca-w3 (the APCA reference, pinned in thresholds.md) and culori (WCAG).
// Both are compared unrounded: the gate must not depend on display rounding.

const N = 2000;
let seed = 0x9e3779b9;
const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const byte = () => Math.floor(rand() * 256);
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

beforeAll(() => extend([a11y, p3]));

describe('APCA parity with apca-w3', () => {
  it('sRGB: matches APCAcontrast(sRGBtoY, sRGBtoY) on random byte pairs', () => {
    for (let i = 0; i < N; i++) {
      const fg: [number, number, number] = [byte(), byte(), byte()];
      const bg: [number, number, number] = [byte(), byte(), byte()];
      const expected = APCAcontrast(sRGBtoY(fg), sRGBtoY(bg), -1) as number;
      const actual = colordx(hex(...fg)).apcaContrast(hex(...bg), { precision: 10 });
      expect(actual).toBeCloseTo(expected, 6);
    }
  });

  it('P3: matches APCAcontrast(displayP3toY, displayP3toY) on random P3 pairs', () => {
    for (let i = 0; i < N; i++) {
      const fg: [number, number, number] = [rand(), rand(), rand()];
      const bg: [number, number, number] = [rand(), rand(), rand()];
      const css = (c: [number, number, number]) => `color(display-p3 ${c[0]} ${c[1]} ${c[2]})`;
      const expected = APCAcontrast(displayP3toY(fg), displayP3toY(bg), -1) as number;
      const actual = colordx(css(fg)).apcaContrast(css(bg), { space: 'p3', precision: 10 });
      expect(actual).toBeCloseTo(expected, 5);
    }
  });
});

describe('WCAG parity with culori', () => {
  it('matches wcagContrast on random byte pairs', () => {
    for (let i = 0; i < N; i++) {
      const fg = hex(byte(), byte(), byte());
      const bg = hex(byte(), byte(), byte());
      expect(colordx(fg).contrast(bg, 10)).toBeCloseTo(wcagContrast(fg, bg), 8);
    }
  });
});

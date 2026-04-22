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

// Cross-cutting invariant: alpha is always emitted with ≤3 decimal places, regardless of
// input format or output formatter. Guards against parser/formatter drift where a single
// path forgets to snap a raw float like 1/255 (0.00392156862745098) before serialization.

const UGLY_ALPHAS = [
  1 / 255, // 0.00392156862745098 — #ff000001 territory
  254 / 255, // 0.996078... — #ff0000fe territory
  0.0039000000000000003, // float arithmetic noise
  0.1 + 0.2, // 0.30000000000000004 — the classic
  0.123456789,
];

const inputsFor = (a: number): ReadonlyArray<unknown> => [
  { r: 255, g: 0, b: 0, alpha: a },
  `#ff0000${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`,
  `rgb(255 0 0 / ${a})`,
  `hsl(0 100% 50% / ${a})`,
  `oklab(0.628 0.2249 0.1258 / ${a})`,
  `oklch(0.628 0.2577 29.23 / ${a})`,
  `lab(54.29 80.8 69.89 / ${a})`,
  `lch(54.29 106.84 40.85 / ${a})`,
  `color(display-p3 1 0 0 / ${a})`,
  `color(rec2020 0.79 0.23 0.07 / ${a})`,
];

interface WithStrings {
  toRgbString(): string;
  toHslString(): string;
  toOklabString(): string;
  toOklchString(): string;
  toHwbString(): string;
  toHsvString(): string;
  toLabString(): string;
  toLchString(): string;
  toCmykString(): string;
  toP3String(): string;
  toRec2020String(): string;
}

const FORMATTERS: ReadonlyArray<[string, (c: WithStrings) => string]> = [
  ['toRgbString', (c) => c.toRgbString()],
  ['toHslString', (c) => c.toHslString()],
  ['toOklabString', (c) => c.toOklabString()],
  ['toOklchString', (c) => c.toOklchString()],
  ['toHwbString', (c) => c.toHwbString()],
  ['toHsvString', (c) => c.toHsvString()],
  ['toLabString', (c) => c.toLabString()],
  ['toLchString', (c) => c.toLchString()],
  ['toCmykString', (c) => c.toCmykString()],
  ['toP3String', (c) => c.toP3String()],
  ['toRec2020String', (c) => c.toRec2020String()],
];

// Capture the alpha token in "... / <alpha>)". Opaque outputs (alpha=1) omit the slash and are skipped.
const ALPHA_IN_STRING = /\/\s*([^)\s]+)\s*\)/;
const MAX_3_DECIMALS = /^\d+(?:\.\d{1,3})?$/;

describe('alpha precision invariant', () => {
  it('every formatter emits alpha with ≤3 decimal places', () => {
    for (const alpha of UGLY_ALPHAS) {
      for (const input of inputsFor(alpha)) {
        const c = colordx(input as Parameters<typeof colordx>[0]) as unknown as WithStrings;
        for (const [name, format] of FORMATTERS) {
          const out = format(c);
          const match = ALPHA_IN_STRING.exec(out);
          if (!match) continue; // opaque path — formatter omitted alpha
          expect(match[1], `${name} emitted "${out}" for input ${JSON.stringify(input)}`).toMatch(
            MAX_3_DECIMALS
          );
        }
      }
    }
  });

  it('alpha() accessor returns a value snapped to ≤3 decimal places', () => {
    for (const alpha of UGLY_ALPHAS) {
      for (const input of inputsFor(alpha)) {
        const c = colordx(input as Parameters<typeof colordx>[0]);
        const a = c.alpha();
        expect(Math.round(a * 1000) / 1000, `input ${JSON.stringify(input)} → alpha ${a}`).toBe(a);
      }
    }
  });
});

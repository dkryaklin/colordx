import { describe, expectTypeOf, it } from 'vitest';
import { colordx } from '../src/index.js';
import type {
  AnyColor,
  OklchColor,
  OklchColorInput,
  RgbColor,
  RgbColorInput,
} from '../src/index.js';

// Type-level contract: every color space exposes a strict output type (alpha required)
// and a loose input type (alpha optional). Runtime accepts both; TS must too.
// rgb + oklch chosen as representatives — all 12 spaces use the same Omit<_, 'alpha'> pattern,
// so a regression in the pattern surfaces here without enumerating every space.
//
// Run with `yarn test:types` to actually enforce — plain `yarn test` only executes the
// runtime bodies, which are no-ops for type assertions.

describe('color type contracts', () => {
  it('output alpha is required (number, not number | undefined)', () => {
    expectTypeOf<RgbColor['alpha']>().toEqualTypeOf<number>();
    expectTypeOf<OklchColor['alpha']>().toEqualTypeOf<number>();
  });

  it('input alpha is optional (number | undefined)', () => {
    expectTypeOf<RgbColorInput['alpha']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<OklchColorInput['alpha']>().toEqualTypeOf<number | undefined>();
  });

  it('input types accept objects without alpha', () => {
    const rgb: RgbColorInput = { r: 1, g: 2, b: 3 };
    const oklch: OklchColorInput = { l: 0.5, c: 0.1, h: 29 };
    void rgb;
    void oklch;
  });

  it('output types reject objects without alpha', () => {
    // @ts-expect-error alpha is required on the output type
    const bad: RgbColor = { r: 0, g: 0, b: 0 };
    void bad;
  });

  it('colordx() accepts color objects without alpha', () => {
    colordx({ r: 255, g: 0, b: 0 });
    colordx({ l: 0.5, c: 0.1, h: 29 });
    colordx({ r: 255, g: 0, b: 0, alpha: 0.5 });
  });

  it('AnyColor is the union of *Input* variants (widens to allow missing alpha)', () => {
    const noAlpha: AnyColor = { r: 255, g: 0, b: 0 };
    const withAlpha: AnyColor = { r: 255, g: 0, b: 0, alpha: 0.5 };
    void noAlpha;
    void withAlpha;
  });
});

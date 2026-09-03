import { beforeAll, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';

beforeAll(() => extend([a11y]));

it('apcaContrast space "p3" maps into P3 without the p3 plugin loaded', () => {
  expect(colordx('oklch(0.8 0.3 145)').apcaContrast('#000', { space: 'p3' })).toBe(-73.3);
});

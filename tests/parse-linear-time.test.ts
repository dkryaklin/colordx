import { beforeAll, describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import a98rgb from '../src/plugins/a98rgb.js';
import cmyk from '../src/plugins/cmyk.js';
import hsv from '../src/plugins/hsv.js';
import hwb from '../src/plugins/hwb.js';
import lab from '../src/plugins/lab.js';
import lch from '../src/plugins/lch.js';
import okhsl from '../src/plugins/okhsl.js';
import okhsv from '../src/plugins/okhsv.js';
import names from '../src/plugins/names.js';
import p3 from '../src/plugins/p3.js';
import prophoto from '../src/plugins/prophoto.js';
import rec2020 from '../src/plugins/rec2020.js';
import srgbLinear from '../src/plugins/srgb-linear.js';
import tinycolor from '../src/tinycolor.js';

beforeAll(() => extend([a98rgb, cmyk, hsv, hwb, lab, lch, names, okhsl, okhsv, p3, prophoto, rec2020, srgbLinear]));

/**
 * Rejection has to stay linear in the length of the input.
 *
 * Every regex in this library spells a number as `(?:\d*\.\d+|\d+)` rather than the shorter
 * `\d*\.?\d+`, and the scanners in `scan.ts` walk each character once. The shorter regex form
 * accepts exactly the same strings, so no assertion about parsing *results* can tell the two
 * apart — but it lets two quantifiers claim the same digits, which divides a long malformed
 * number between them in O(n²) ways, and a rejection retries every division. Parsing is
 * synchronous and uninterruptible, so a caller that parses untrusted CSS hands that time to
 * whatever else shares the thread (omgovich/colord#141).
 *
 * Running time is therefore the only thing that can hold the convention in place, which is what
 * this file measures. The budget is deliberately loose: these inputs take well under a
 * millisecond as written and several seconds with an ambiguous number, so a slow or noisy
 * machine cannot make it flaky.
 */
const LENGTH = 64_000;
const BUDGET_MS = 500;

// Long enough to be expensive, then a character no color function can contain, so the parser has
// to walk the whole thing and still reject it.
const digits = '1'.repeat(LENGTH);
const spaces = ' '.repeat(LENGTH);
const letters = 'a'.repeat(LENGTH);

const durationOf = (parse: () => unknown): number => {
  const start = performance.now();
  parse();
  return performance.now() - start;
};

const rejectionTime = (input: string): number => {
  let valid = true;
  const duration = durationOf(() => (valid = colordx(input).isValid()));
  expect(valid, input.slice(0, 20)).toBe(false);
  return duration;
};

describe('rejects oversized malformed colors in linear time', () => {
  it.each([
    ['rgb', `rgb(${digits}!`],
    ['rgb, alpha position', `rgba(1, 2, 3, ${digits}!`],
    ['hsl', `hsl(${digits}!`],
    ['hsl, alpha position', `hsl(1deg 2% 3% / ${digits}!`],
    ['hwb', `hwb(${digits}!`],
    ['lab', `lab(${digits}!`],
    ['lch', `lch(${digits}!`],
    ['oklab', `oklab(${digits}!`],
    ['oklch', `oklch(${digits}!`],
    ['okhsl', `okhsl(${digits}!`],
    ['okhsl, alpha position', `okhsl(1deg 2% 3% / ${digits}!`],
    ['okhsv', `okhsv(${spaces}${digits}!`],
    ['device-cmyk', `device-cmyk(${digits}!`],
    ['color()', `color(display-p3 ${digits}!`],
    ['hex', `#${digits}`],
    ['named color', letters],
    ['leading whitespace', `${spaces}rgb(1, 2, 3)!`],
    ['inner whitespace', `rgb(${spaces}!`],
  ])('%s', (_label, input) => expect(rejectionTime(input)).toBeLessThan(BUDGET_MS), 30_000);
});

// The compat layer is the one place that still matches whole color functions with a regex, so it
// gets the same treatment. Only the timing is asserted here: tinycolor2 accepts most of these
// (it reads a numeric prefix and tolerates a missing paren), and mirroring that is the compat
// layer's job — `tinycolor.test.ts` is where the verdicts are checked against the real library.
describe('tinycolor compat answers on oversized malformed colors in linear time', () => {
  it.each([
    ['rgb', `rgb(${digits}!`],
    ['hsl', `hsl(${digits}!`],
    ['hsv', `hsv(${spaces}${digits}!`],
    ['whitespace after the name', `rgb(${spaces}!`],
    ['whitespace after a channel', `rgb(1${spaces}!`],
    ['whitespace between channels', `rgb(1 1${spaces}!`],
    ['hex', `#${digits}`],
  ])('%s', (_label, input) => expect(durationOf(() => tinycolor(input).isValid)).toBeLessThan(BUDGET_MS), 30_000);
});

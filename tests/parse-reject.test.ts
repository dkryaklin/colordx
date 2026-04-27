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

// Parser robustness battery. Every row is a literal input that MUST be
// accepted or rejected. The point is to guard against overly-permissive
// regexes: happy-path tests all pass even when the grammar silently admits
// garbage, so this file is the net that catches the garbage.
//
// Ordered by format. Within a format: structural rejections, token-level
// rejections, whitespace/unicode edges, then positive assertions for the
// canonical forms and their variants.

const reject = (input: string) => expect(colordx(input).isValid()).toBe(false);
const accept = (input: string) => expect(colordx(input).isValid()).toBe(true);

const rejectMany = (label: string, inputs: string[]) =>
  describe(label, () => {
    for (const input of inputs) it(JSON.stringify(input), () => reject(input));
  });
const acceptMany = (label: string, inputs: string[]) =>
  describe(label, () => {
    for (const input of inputs) it(JSON.stringify(input), () => accept(input));
  });

// ─── hex ───────────────────────────────────────────────────────────────

rejectMany('hex — structural rejections', [
  '',
  '#',
  '#f',
  '#ff',
  '#fffff', // 5 digits
  '#fffffff', // 7 digits
  '#fffffffff', // 9 digits
  '#ff0000ff0', // 10 digits
  '#ff 00 00',
  '#ff-00-00',
  '#ff.00.00',
  'ff0000', // missing #
  '##ff0000',
  '# ff0000',
  '#ff0000#',
]);

rejectMany('hex — invalid characters', [
  '#gggggg',
  '#zzzzzz',
  '#ff00gg',
  '#ff000g',
  '#ff0.00', // dot in hex
  '#ff00_0', // underscore
  '#ff0000!',
  '#ff-00ff',
  '#ff 00ff',
  '#0x0000', // 0x prefix not allowed inside
  '#ff\u00000', // null byte
  '#ff\t00ff',
]);

acceptMany('hex — valid forms', [
  '#000',
  '#fff',
  '#000f',
  '#ffff',
  '#000000',
  '#ffffff',
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#00000000',
  '#ffffffff',
  '#12345678',
  '#ABCDEF', // uppercase
  '#AbCdEf', // mixed case
  '  #ff0000  ', // surrounding whitespace is trimmed — intentional
  '\t#ff0000\n',
]);

// ─── rgb / rgba ────────────────────────────────────────────────────────

rejectMany('rgb — structural', [
  'rgb',
  'rgb()',
  'rgb(',
  'rgb)',
  'rgb)(',
  'rgb[255, 0, 0]',
  'rgb{255, 0, 0}',
  'rgb(255)',
  'rgb(255, 0)',
  'rgb(255 0)',
  'rgb(255,0)',
  'rgb(255, 0, 0, 0, 0)',
  'rgb(255 0 0 0 0)',
  'rgb(255 0 0 0.5)', // modern without slash
  'rgb(255 0 0 / )', // slash with no alpha
  'rgb(/0.5)',
  'rgb( / 0.5)',
  'rgb(255, 0, 0 / 0.5)', // mixing comma and slash
  'rgb(255, 0 0)', // partial comma/space mix
  'rgb(255 0, 0)',
  'rgb(255 0 0 / 0.5 / 0.5)',
  'rgb 255 0 0)',
  'rgb(255 0 0',
  'rgb255 0 0)',
  'rgb255, 0, 0',
  'rgb(255 0 0)extra',
  ' x rgb(255 0 0)',
]);

rejectMany('rgb — invalid tokens', [
  'rgb(red 0 0)',
  'rgb(#ff 0 0)',
  'rgb(0x00 0 0)',
  'rgb(1e2 0 0)', // scientific notation not supported
  'rgb(1E2 0 0)',
  'rgb(1e+2 0 0)',
  'rgb(-- 0 0)',
  'rgb(++1 0 0)',
  'rgb(+-1 0 0)',
  'rgb(NaN 0 0)',
  'rgb(Infinity 0 0)',
  'rgb(-Infinity 0 0)',
  'rgb(. 0 0)', // bare dot
  'rgb(1. 0 0)', // trailing dot only (pre-existing limitation)
  'rgb(1.2.3 0 0)',
  'rgb(calc(255 / 2) 0 0)', // calc() not supported
  'rgb(var(--red) 0 0)',
  'rgb(null 0 0)',
  'rgb(undefined 0 0)',
  'rgb(0xff 0 0)',
]);

rejectMany('rgb — legacy-only restrictions', [
  'rgb(255, 50%, 0)', // mix types in legacy
  'rgb(100%, 50, 0%)',
  'rgb(50%, 128, 0)',
  'rgb(128, 100%, 0)',
  'rgb(none, 0, 0)',
  'rgb(0, none, 0)',
  'rgb(0, 0, none)',
  'rgba(0, 0, 0, none)',
  'rgba(none, 0, 0, 0.5)',
]);

rejectMany('rgb — delimiter / separator edges', [
  'rgb(255;0;0)',
  'rgb(255|0|0)',
  'rgb(255-0-0)',
  'rgb(255:0:0)',
  'rgb(255,,0,0)', // double comma
  'rgb(,255,0,0)', // leading comma
  'rgb(255,0,0,)', // trailing comma
  'rgb(255 , 0 , 0 ,)',
  'rgb( , , )',
  'rgb(,0,0)',
  'rgb(0,,0)',
]);

acceptMany('rgb — valid legacy comma forms', [
  'rgb(0, 0, 0)',
  'rgb(255, 255, 255)',
  'rgb(255, 0, 0)',
  'rgba(255, 0, 0, 0.5)',
  'rgba(255, 0, 0, 50%)',
  'rgba(255, 0, 0, 0)',
  'rgba(255, 0, 0, 1)',
  'rgb(100%, 0%, 0%)',
  'rgb(50%, 50%, 50%)',
  'rgba(100%, 0%, 0%, 0.5)',
  'rgb( 255 , 0 , 0 )', // inner padding
  'rgb(255,0,0)', // no padding
]);

acceptMany('rgb — valid modern space forms', [
  'rgb(0 0 0)',
  'rgb(255 0 0)',
  'rgb(100% 0% 0%)',
  'rgb(255 0 0 / 0.5)',
  'rgb(255 0 0 / 50%)',
  'rgb(255 0 0 / 1)',
  'rgb(255 0 0 / 0)',
  'rgb(100% 50% 0%)',
  'rgb(255 50% 0)', // mixed types allowed in modern
  'rgb(none 128 255)',
  'rgb(255 none 0)',
  'rgb(0 0 0 / none)',
  'rgb(255 0 0/0.5)', // no space around /
  'rgb(  255  0  0  )',
  'rgb(255\t0\t0)', // tabs
  'rgb(+255 +0 +0)', // explicit positive
  'rgb(-10 0 0)', // negative clamped but syntax is valid
  'rgb(300 0 0)', // over-255 clamped
  'rgb(.5 .5 .5)', // leading dot
  'rgb(0.5 0.5 0.5)',
]);

// ─── hsl / hsla ────────────────────────────────────────────────────────

rejectMany('hsl — structural', [
  'hsl()',
  'hsl(0)',
  'hsl(0 100%)',
  'hsl(0, 100%)',
  'hsl(0 100% 50% 0.5)', // no slash
  'hsl(0, 100%, 50%, 0.5, 1)',
  'hsl[0 100% 50%]',
  'hsl(0 100% 50% / 0.5 / 0.5)',
  'hsl(0, 100%, 50% / 0.5)', // mix comma + slash
  'hsl(0 100%, 50%)', // partial
  'hsl 0, 100%, 50%',
  'hsla()',
]);

rejectMany('hsl — legacy requires `%` on s/l', [
  'hsl(0, 100, 50)',
  'hsl(0, 100%, 50)',
  'hsl(0, 100, 50%)',
  'hsla(0, 50, 50, 0.5)',
]);

rejectMany('hsl — legacy rejects `none`', [
  'hsl(none, 100%, 50%)',
  'hsla(0, 100%, 50%, none)',
]);

rejectMany('hsl — invalid hue units', [
  'hsl(0degx 100% 50%)',
  'hsl(0degrees 100% 50%)',
  'hsl(0px 100% 50%)',
  'hsl(0em 100% 50%)',
  'hsl(0% 100% 50%)', // % is not a valid hue unit (H is angle, not percent)
  'hsl(0deg deg 100% 50%)',
  'hsl(0deggrad 100% 50%)',
]);

rejectMany('hsl — invalid tokens', [
  'hsl(red 100% 50%)',
  'hsl(0 1e2% 50%)',
  'hsl(0 100%% 50%)', // double percent
  'hsl(0 %100 50%)', // leading percent
  'hsl(0 100 % 50%)', // space between value and %
  'hsl(0 calc(100%) 50%)',
]);

acceptMany('hsl — valid forms', [
  'hsl(0, 0%, 0%)',
  'hsl(360, 100%, 100%)',
  'hsl(180, 50%, 50%)',
  'hsla(0, 100%, 50%, 0.5)',
  'hsla(0, 100%, 50%, 50%)',
  'hsl(0 0% 0%)',
  'hsl(0 100% 50% / 0.5)',
  'hsl(0 100% 50% / 50%)',
  'hsl(none 100% 50%)',
  'hsl(0 none 50%)',
  'hsl(0 100% none)',
  'hsl(0 100% 50% / none)',
  'hsl(0deg 100% 50%)',
  'hsl(3.14rad 100% 50%)',
  'hsl(200grad 100% 50%)',
  'hsl(0.5turn 100% 50%)',
  'hsl(-180 100% 50%)',
  'hsl(720 100% 50%)',
  'hsl(180 50 50)', // modern bare numbers
  'hsl(180 50% 50)', // modern mixed
  'hsl(180 50 50%)',
  'hsl(180\t50%\t50%)',
]);

// ─── hsv / hsva (non-standard but ours) ────────────────────────────────

rejectMany('hsv — structural', [
  'hsv()',
  'hsv(0)',
  'hsv(0 100%)',
  'hsv(0 100% 100% 0.5)',
  'hsv(0, 100%, 100%, 0.5, 1)',
  'hsv[0, 100%, 100%]',
  'hsva()',
]);

rejectMany('hsv — legacy requires `%`', [
  'hsv(0, 100, 100)',
  'hsv(0, 100%, 100)',
  'hsv(0, 100, 100%)',
]);

rejectMany('hsv — legacy rejects `none`', [
  'hsv(none, 100%, 100%)',
  'hsva(0, 100%, 100%, none)',
]);

acceptMany('hsv — valid forms', [
  'hsv(0, 0%, 0%)',
  'hsv(360, 100%, 100%)',
  'hsv(180, 50%, 50%)',
  'hsva(0, 100%, 100%, 0.5)',
  'hsv(0 100% 100%)',
  'hsv(0 100% 100% / 0.5)',
  'hsv(none 100% 100%)',
  'hsv(0 none 100%)',
  'hsv(0 100% none / 0.5)',
  'hsv(0deg 100% 100%)',
  'hsv(0.5turn 100% 100%)',
  'hsv(180 50 50)',
]);

// ─── hwb ───────────────────────────────────────────────────────────────

rejectMany('hwb — structural', [
  'hwb()',
  'hwb(0)',
  'hwb(0 0%)',
  'hwb(0, 0%, 0%)', // hwb has no legacy comma form
  'hwba(0 0% 0%)', // no `hwba()` alias
  'hwb(0 0% 0% 0.5)', // no slash
  'hwb(0 0% 0% / 0.5 / 0.5)',
  'hwb(0 0% 0%)extra',
]);

rejectMany('hwb — invalid hue units', [
  'hwb(0degx 0% 0%)',
  'hwb(0em 0% 0%)',
  'hwb(0% 0% 0%)', // % not valid on hue
]);

rejectMany('hwb — invalid tokens', [
  'hwb(red 0% 0%)',
  'hwb(0 0%% 0%)',
  'hwb(0 1e2% 0%)',
]);

acceptMany('hwb — valid forms', [
  'hwb(0 0% 0%)',
  'hwb(360 100% 100%)',
  'hwb(180 50% 50%)',
  'hwb(0 50% 30%)',
  'hwb(0 50 30)', // bare numbers
  'hwb(0 50% 30)', // mixed
  'hwb(0 50 30%)',
  'hwb(0 0% 0% / 0.5)',
  'hwb(0 0% 0% / 50%)',
  'hwb(none 0% 0%)',
  'hwb(0 none 0%)',
  'hwb(0 0% none)',
  'hwb(0 0% 0% / none)',
  'hwb(0deg 0% 0%)',
  'hwb(0.5turn 0% 0%)',
]);

// ─── lab ───────────────────────────────────────────────────────────────

rejectMany('lab — structural', [
  'lab()',
  'lab(50)',
  'lab(50 0)',
  'lab(50, 0, 0)', // lab uses space syntax only
  'lab(50 0 0 0.5)', // no slash
  'lab(50% 0% 0% 0%)', // 4 channels before alpha
  'lab(50%% 0 0)',
  'lab(50 0 0 / 0.5 / 0.5)',
  'lab(50 0 0)extra',
  'laba(50 0 0)', // no laba() alias
]);

rejectMany('lab — invalid tokens', [
  'lab(red 0 0)',
  'lab(50deg 0 0)', // degrees don't apply to lab
  'lab(50 red 0)',
  'lab(50 0 calc(0))',
  'lab(50 1e2 0)',
]);

acceptMany('lab — valid forms', [
  'lab(0 0 0)',
  'lab(100 0 0)',
  'lab(50 0 0)',
  'lab(50% 0 0)',
  'lab(50 100% 0)', // a percent: 100% = 125
  'lab(50 0 -100%)',
  'lab(50 50% 30)',
  'lab(50 50% 30%)',
  'lab(50 0 0 / 0.5)',
  'lab(50 0 0 / 50%)',
  'lab(50 0 0 / none)',
  'lab(none none none)',
  'lab(50 -60 -80)', // negative a/b
  'lab(50\t0\t0)',
  'lab(  50  0  0  )',
  'lab(.5 0 0)', // leading dot
]);

// ─── lch ───────────────────────────────────────────────────────────────

rejectMany('lch — structural', [
  'lch()',
  'lch(50)',
  'lch(50 30)',
  'lch(50, 30, 180)',
  'lch(50 30 180 0.5)', // no slash
  'lch(50 30 180deg grad)', // two units
  'lch(50 30 180 / 0.5 / 0.5)',
  'lch(50 30 180)extra',
  'lcha(50 30 180)',
]);

rejectMany('lch — invalid tokens', [
  'lch(red 30 180)',
  'lch(50 red 180)',
  'lch(50 30 red)',
  'lch(50 30deg 180)', // degrees only on hue, not on chroma
  'lch(50 30 1e2)',
  'lch(50 30 180degrees)',
]);

acceptMany('lch — valid forms', [
  'lch(0 0 0)',
  'lch(100 150 360)',
  'lch(50 30 180)',
  'lch(50% 30 180)',
  'lch(50 100% 180)', // c percent: 100% = 150
  'lch(50 30 180deg)',
  'lch(50 30 3.14rad)',
  'lch(50 30 0.5turn)',
  'lch(50 30 200grad)',
  'lch(50 30 none)',
  'lch(50 none 180)',
  'lch(50 30 180 / 0.5)',
  'lch(50 30 180 / none)',
  'lch(none none none)',
  'lch(50 30 -180)', // negative hue normalized
  'lch(50 30 720)', // over-360 hue normalized
  'lch(.5 0 0)',
]);

// ─── oklab ─────────────────────────────────────────────────────────────

rejectMany('oklab — structural', [
  'oklab()',
  'oklab(0.5)',
  'oklab(0.5 0)',
  'oklab(0.5, 0, 0)',
  'oklab(0.5 0 0 0.5)', // no slash
  'oklab(0.5 0 0 / 0.5 / 0.5)',
  'oklab(0.5 0 0)extra',
  'oklaba(0.5 0 0)',
]);

rejectMany('oklab — invalid tokens', [
  'oklab(red 0 0)',
  'oklab(0.5 red 0)',
  'oklab(0.5deg 0 0)',
  'oklab(0.5 0 calc(0))',
]);

acceptMany('oklab — valid forms', [
  'oklab(0 0 0)',
  'oklab(1 0 0)',
  'oklab(0.5 0 0)',
  'oklab(50% 0 0)', // L 100% = 1
  'oklab(0.5 100% 0)', // a/b 100% = 0.4
  'oklab(0.5 -100% 0)',
  'oklab(0.5 50% -50%)',
  'oklab(0.5 0 0 / 0.5)',
  'oklab(0.5 0 0 / 50%)',
  'oklab(0.5 0 0 / none)',
  'oklab(none none none)',
  'oklab(0.5 -0.2 0.3)',
  'oklab(.5 0 0)',
  'oklab(  0.5  0  0  )',
]);

// ─── oklch ─────────────────────────────────────────────────────────────

rejectMany('oklch — structural', [
  'oklch()',
  'oklch(0.5)',
  'oklch(0.5 0.1)',
  'oklch(0.5, 0.1, 180)',
  'oklch(0.5 0.1 180 0.5)', // no slash
  'oklch(0.5 0.1 180 / 0.5 / 0.5)',
  'oklch(0.5 0.1 180)extra',
  'oklcha(0.5 0.1 180)',
]);

rejectMany('oklch — invalid tokens', [
  'oklch(red 0.1 180)',
  'oklch(0.5 red 180)',
  'oklch(0.5 0.1 red)',
  'oklch(0.5 0.1deg 180)', // degrees not on chroma
  'oklch(0.5 0.1 180degrees)',
]);

acceptMany('oklch — valid forms', [
  'oklch(0 0 0)',
  'oklch(1 0.4 360)',
  'oklch(0.5 0.1 180)',
  'oklch(50% 0.1 180)',
  'oklch(0.5 100% 180)', // c 100% = 0.4
  'oklch(0.5 0.1 180deg)',
  'oklch(0.5 0.1 0.5turn)',
  'oklch(0.5 0.1 3.14rad)',
  'oklch(0.5 0.1 200grad)',
  'oklch(0.5 0.1 none)',
  'oklch(0.5 none 180)',
  'oklch(0.5 0.1 180 / 0.5)',
  'oklch(0.5 0.1 180 / none)',
  'oklch(none none none)',
  'oklch(0.5 0.1 -180)',
  'oklch(0.5 0.1 720)',
  'oklch(.5 .1 180)',
]);

// ─── p3 / rec2020 (color() syntax) ─────────────────────────────────────

rejectMany('color() — structural & unsupported spaces', [
  'color()',
  'color(display-p3)',
  'color(display-p3 1)',
  'color(display-p3 1 0)',
  'color(display-p3, 1, 0, 0)', // no commas
  'color(display-p3 1 0 0, 0.5)',
  'color(display-p3 1 0 0 / 0.5 / 0.5)',
  'color(display-p3 1 0 0)extra',
  'color(rec2020)',
  'color(rec2020 1 0)',
  'color(rec2020 1, 0, 0)',
  'color(srgb 1 0 0)', // unsupported
  'color(srgb-linear 1 0 0)',
  'color(prophoto-rgb 1 0 0)',
  'color(a98-rgb 1 0 0)',
  'color(xyz 1 0 0)', // bare xyz (no -d50/-d65 suffix) not supported
  'color(display-p3 red green blue)',
  'color(display-p31 0 0)', // no space after name
]);

rejectMany('color() — invalid tokens', [
  'color(display-p3 1e2 0 0)',
  'color(display-p3 0xff 0 0)',
  'color(display-p3 calc(0.5) 0 0)',
  'color(display-p3 1%% 0 0)',
]);

acceptMany('p3 — valid forms', [
  'color(display-p3 0 0 0)',
  'color(display-p3 1 1 1)',
  'color(display-p3 0.5 0.5 0.5)',
  'color(display-p3 100% 0% 0%)',
  'color(display-p3 50% 50% 50%)',
  'color(display-p3 0.5 50% 1)', // mixed
  'color(display-p3 none 0 0)',
  'color(display-p3 0 none 0)',
  'color(display-p3 1 0 0 / 0.5)',
  'color(display-p3 1 0 0 / 50%)',
  'color(display-p3 1 0 0 / none)',
  'color(display-p3 -0.5 0 0)', // out-of-gamut negative
  'color(display-p3 1.5 0 0)', // over-1
  'color(  display-p3  1  0  0  )',
]);

acceptMany('xyz — valid forms', [
  'color(xyz-d65 0 0 0)',
  'color(xyz-d65 41.24 21.26 1.93)',
  'color(xyz-d65 none 0 0)',
  'color(xyz-d65 41.24 21.26 1.93 / 0.5)',
  'color(xyz-d65 41.24 21.26 1.93 / 50%)',
  'color(xyz-d65 41.24 21.26 1.93 / none)',
  'color(xyz-d50 0 0 0)',
  'color(xyz-d50 43.61 22.25 1.39)',
  'color(xyz-d50 43.61 22.25 1.39 / 0.5)',
  'color(  xyz-d65  41.24  21.26  1.93  )',
]);

acceptMany('rec2020 — valid forms', [
  'color(rec2020 0 0 0)',
  'color(rec2020 1 1 1)',
  'color(rec2020 0.5 0.5 0.5)',
  'color(rec2020 100% 0% 0%)',
  'color(rec2020 50% 50% 50% / 50%)',
  'color(rec2020 0.5 50% 1)',
  'color(rec2020 none 0 0)',
  'color(rec2020 1 0 0 / 0.5)',
  'color(rec2020 1 0 0 / none)',
]);

// ─── device-cmyk ───────────────────────────────────────────────────────

rejectMany('device-cmyk — structural', [
  'device-cmyk()',
  'device-cmyk(0 0 0)', // 3 channels
  'device-cmyk(0 0 0 0 0)', // 5 channels without slash
  'device-cmyk(0, 0, 0, 0)', // legacy comma form not supported
  'cmyk(0 0 0 0)', // `device-` prefix required
  'device-cmyk(0 0 0 0 / 0.5 / 0.5)',
  'device-cmyk(0 0 0 0)extra',
  'devicecmyk(0 0 0 0)', // missing dash
  'device_cmyk(0 0 0 0)',
]);

rejectMany('device-cmyk — invalid tokens', [
  'device-cmyk(red 0 0 0)',
  'device-cmyk(0 1e2 0 0)',
  'device-cmyk(0 0xff 0 0)',
  'device-cmyk(0 0 calc(0) 0)',
]);

acceptMany('device-cmyk — valid forms', [
  'device-cmyk(0 0 0 0)',
  'device-cmyk(1 1 1 1)',
  'device-cmyk(0.5 0.5 0.5 0.5)',
  'device-cmyk(0% 0% 0% 0%)',
  'device-cmyk(100% 100% 100% 100%)',
  'device-cmyk(50% 25% 75% 10%)',
  'device-cmyk(0.5 50% 0.25 25%)', // mixed
  'device-cmyk(none none none none)',
  'device-cmyk(0 0 0 0 / 0.5)',
  'device-cmyk(0 0 0 0 / 50%)',
  'device-cmyk(0 0 0 0 / none)',
]);

// ─── case-insensitive function names ──────────────────────────────────

acceptMany('function name is case-insensitive', [
  'RGB(255 0 0)',
  'Rgb(255, 0, 0)',
  'RGBA(0, 0, 0, 0.5)',
  'HSL(0 100% 50%)',
  'HSLA(0, 100%, 50%, 0.5)',
  'Hsl(0 100% 50%)',
  'HWB(0 0% 0%)',
  'Hwb(0 0% 0%)',
  'LAB(50 0 0)',
  'Lab(50 0 0)',
  'LCH(50 30 180)',
  'Lch(50 30 180)',
  'OKLAB(0.5 0 0)',
  'Oklab(0.5 0 0)',
  'OKLCH(0.5 0.1 180)',
  'Oklch(0.5 0.1 180)',
  'COLOR(display-p3 1 0 0)',
  'Color(display-p3 1 0 0)',
  'COLOR(rec2020 1 0 0)',
  'Color(rec2020 1 0 0)',
  'DEVICE-CMYK(0 0 0 0)',
  'Device-Cmyk(0 0 0 0)',
  'HSV(0 100% 100%)',
  'Hsv(0 100% 100%)',
]);

acceptMany('angle units are case-insensitive', [
  'hsl(0DEG 100% 50%)',
  'hsl(0Deg 100% 50%)',
  'hsl(0.5TURN 100% 50%)',
  'hsl(3.14RAD 100% 50%)',
  'hsl(200GRAD 100% 50%)',
  'hwb(0DEG 0% 0%)',
  'lch(50 30 180DEG)',
  'oklch(0.5 0.1 180DEG)',
]);

acceptMany('`none` keyword is case-insensitive', [
  'rgb(NONE 0 0)',
  'rgb(None 0 0)',
  'rgb(nONe 0 0)',
  'hsl(0 NONE 50%)',
  'hwb(NONE 0% 0%)',
  'lab(NONE 0 0)',
  'lab(50 None None)',
  'lch(NONE 30 180)',
  'oklab(NONE 0 0)',
  'oklch(NONE 0.1 180)',
  'color(display-p3 NONE 0 0)',
  'color(rec2020 NONE 0 0)',
  'device-cmyk(NONE 0 0 0)',
]);

// ─── slot-assignment pins: distinct values per channel trip any swap ───

describe('channel slot assignments — rgb/hsl/hsv', () => {
  it('rgb modern: r=10 g=20 b=30', () => {
    const c = colordx('rgb(10 20 30)').toRgb();
    expect(c.r).toBe(10);
    expect(c.g).toBe(20);
    expect(c.b).toBe(30);
  });
  it('rgb modern with alpha: r=10 g=20 b=30 a=0.42', () => {
    const c = colordx('rgb(10 20 30 / 0.42)').toRgb();
    expect(c.r).toBe(10);
    expect(c.g).toBe(20);
    expect(c.b).toBe(30);
    expect(c.alpha).toBe(0.42);
  });
  it('rgb legacy: r=10 g=20 b=30', () => {
    const c = colordx('rgb(10, 20, 30)').toRgb();
    expect(c.r).toBe(10);
    expect(c.g).toBe(20);
    expect(c.b).toBe(30);
  });
  it('rgb legacy with alpha', () => {
    const c = colordx('rgba(10, 20, 30, 0.42)').toRgb();
    expect(c.r).toBe(10);
    expect(c.g).toBe(20);
    expect(c.b).toBe(30);
    expect(c.alpha).toBe(0.42);
  });
  it('rgb percent slot test', () => {
    // 10%, 20%, 30% → 25.5, 51, 76.5 → rounded 26, 51, 77
    const c = colordx('rgb(10% 20% 30%)').toRgb();
    expect(c.r).toBe(26);
    expect(c.g).toBe(51);
    expect(c.b).toBe(77);
  });
  it('hsl: h=45 s=20 l=60', () => {
    const hsl = colordx('hsl(45 20% 60%)').toHsl();
    expect(hsl.h).toBe(45);
    expect(hsl.s).toBe(20);
    expect(hsl.l).toBe(60);
  });
  it('hsl legacy: h=45 s=20 l=60 a=0.42', () => {
    const c = colordx('hsla(45, 20%, 60%, 0.42)');
    const hsl = c.toHsl();
    expect(hsl.h).toBe(45);
    expect(hsl.s).toBe(20);
    expect(hsl.l).toBe(60);
    expect(c.alpha()).toBe(0.42);
  });
  it('hsv: h=45 s=20 v=60', () => {
    const hsv = (colordx('hsv(45 20% 60%)') as unknown as { toHsv: () => { h: number; s: number; v: number } }).toHsv();
    expect(hsv.h).toBe(45);
    expect(hsv.s).toBe(20);
    expect(hsv.v).toBe(60);
  });
});

describe('channel slot assignments — lab/lch/oklab/oklch', () => {
  it('lab: l=20 a=30 b=-40', () => {
    const l = (colordx('lab(20 30 -40)') as unknown as { toLab: () => { l: number; a: number; b: number } }).toLab();
    expect(l.l).toBe(20);
    expect(l.a).toBe(30);
    expect(l.b).toBe(-40);
  });
  it('lab alpha slot', () => {
    expect(colordx('lab(50 0 0 / 0.42)').alpha()).toBe(0.42);
  });
  it('lch: l=20 c=30 h=40', () => {
    const v = (colordx('lch(20 30 40)') as unknown as { toLch: () => { l: number; c: number; h: number } }).toLch();
    expect(v.l).toBe(20);
    expect(v.c).toBe(30);
    expect(v.h).toBe(40);
  });
  it('oklab: l=0.2 a=0.1 b=-0.1', () => {
    const v = colordx('oklab(0.2 0.1 -0.1)').toOklab();
    expect(v.l).toBe(0.2);
    expect(v.a).toBe(0.1);
    expect(v.b).toBe(-0.1);
  });
  it('oklch: l=0.2 c=0.15 h=90', () => {
    const v = colordx('oklch(0.2 0.15 90)').toOklch();
    expect(v.l).toBe(0.2);
    expect(v.c).toBe(0.15);
    expect(v.h).toBe(90);
  });
  it('oklch hue unit slot: 0.5turn == 180deg', () => {
    // Compare via parses (not against literal 180) to dodge ~1e-5 round-trip noise
    // exposed at the 5dp default — the parser is what's under test, not OKLCh round-trip.
    expect(colordx('oklch(0.5 0.1 0.5turn)').toOklch().h).toBe(colordx('oklch(0.5 0.1 180deg)').toOklch().h);
  });
});

describe('channel slot assignments — hwb/cmyk/p3/rec2020', () => {
  it('hwb: h=45 w=10 b=20', () => {
    const v = (colordx('hwb(45 10% 20%)') as unknown as { toHwb: () => { h: number; w: number; b: number } }).toHwb();
    expect(v.h).toBe(45);
    expect(v.w).toBe(10);
    expect(v.b).toBe(20);
  });
  // cmyk roundtrip is lossy; verify slots via canonical hex conversions.
  it('cmyk slot C → cyan', () => expect(colordx('device-cmyk(100% 0% 0% 0%)').toHex()).toBe('#00ffff'));
  it('cmyk slot M → magenta', () => expect(colordx('device-cmyk(0% 100% 0% 0%)').toHex()).toBe('#ff00ff'));
  it('cmyk slot Y → yellow', () => expect(colordx('device-cmyk(0% 0% 100% 0%)').toHex()).toBe('#ffff00'));
  it('cmyk slot K → black', () => expect(colordx('device-cmyk(0% 0% 0% 100%)').toHex()).toBe('#000000'));
  it('p3: r=0.1 g=0.2 b=0.3', () => {
    const v = (colordx('color(display-p3 0.1 0.2 0.3)') as unknown as {
      toP3: () => { r: number; g: number; b: number };
    }).toP3();
    expect(v.r).toBe(0.1);
    expect(v.g).toBe(0.2);
    expect(v.b).toBe(0.3);
  });
  it('p3 alpha slot', () => {
    expect(colordx('color(display-p3 1 0 0 / 0.42)').alpha()).toBe(0.42);
  });
  it('rec2020: r=0.1 g=0.2 b=0.3', () => {
    const v = (colordx('color(rec2020 0.1 0.2 0.3)') as unknown as {
      toP3: () => { r: number; g: number; b: number };
    }).toP3();
    // Via P3 space since rec2020 → sRGB → P3 round-trips the component order predictably for these safe values.
    expect(v.r).toBeCloseTo(0.11, 1);
    expect(v.g).toBeCloseTo(0.22, 1);
    expect(v.b).toBeCloseTo(0.31, 1);
  });
});

// ─── alpha slot uniqueness across every format ────────────────────────

describe('alpha slot integrity — alpha is parsed from its own slot, not a channel', () => {
  it('rgb modern alpha', () => expect(colordx('rgb(10 20 30 / 0.42)').alpha()).toBe(0.42));
  it('rgb legacy alpha', () => expect(colordx('rgba(10, 20, 30, 0.42)').alpha()).toBe(0.42));
  it('rgb modern alpha as percent', () => expect(colordx('rgb(10 20 30 / 42%)').alpha()).toBe(0.42));
  it('hsl modern alpha', () => expect(colordx('hsl(10 20% 30% / 0.42)').alpha()).toBe(0.42));
  it('hsl legacy alpha', () => expect(colordx('hsla(10, 20%, 30%, 0.42)').alpha()).toBe(0.42));
  it('hsv modern alpha', () =>
    expect(colordx('hsv(10 20% 30% / 0.42)').alpha()).toBe(0.42));
  it('hwb alpha', () => expect(colordx('hwb(0 0% 0% / 0.42)').alpha()).toBe(0.42));
  it('lab alpha', () => expect(colordx('lab(50 0 0 / 0.42)').alpha()).toBe(0.42));
  it('lch alpha', () => expect(colordx('lch(50 0 0 / 0.42)').alpha()).toBe(0.42));
  it('oklab alpha', () => expect(colordx('oklab(0.5 0 0 / 0.42)').alpha()).toBe(0.42));
  it('oklch alpha', () => expect(colordx('oklch(0.5 0 0 / 0.42)').alpha()).toBe(0.42));
  it('p3 alpha', () => expect(colordx('color(display-p3 1 0 0 / 0.42)').alpha()).toBe(0.42));
  it('rec2020 alpha', () => expect(colordx('color(rec2020 1 0 0 / 0.42)').alpha()).toBe(0.42));
  it('cmyk alpha', () => expect(colordx('device-cmyk(0% 0% 0% 0% / 0.42)').alpha()).toBe(0.42));
});

// ─── boundary / edge cases ─────────────────────────────────────────────

describe('boundary values', () => {
  it('rgb at max 255', () => expect(colordx('rgb(255 255 255)').toHex()).toBe('#ffffff'));
  it('rgb at min 0', () => expect(colordx('rgb(0 0 0)').toHex()).toBe('#000000'));
  it('rgb 100% equals 255', () => expect(colordx('rgb(100% 100% 100%)').toHex()).toBe('#ffffff'));
  it('rgb 0% equals 0', () => expect(colordx('rgb(0% 0% 0%)').toHex()).toBe('#000000'));
  it('rgb clamps over-255', () => expect(colordx('rgb(300 0 0)').toHex()).toBe('#ff0000'));
  it('rgb clamps negative', () => expect(colordx('rgb(-50 0 0)').toHex()).toBe('#000000'));
  it('rgb alpha clamps > 1', () => expect(colordx('rgb(0 0 0 / 5)').alpha()).toBe(1));
  it('rgb alpha clamps < 0', () => expect(colordx('rgb(0 0 0 / -1)').alpha()).toBe(0));
  it('hsl hue normalizes negative', () =>
    expect(colordx('hsl(-180 100% 50%)').toHex()).toBe(colordx('hsl(180 100% 50%)').toHex()));
  it('hsl hue normalizes over-360', () =>
    expect(colordx('hsl(720 100% 50%)').toHex()).toBe(colordx('hsl(0 100% 50%)').toHex()));
  it('lab clamps L to [0, 100]', () => {
    expect(colordx('lab(-50 0 0)').toHex()).toBe('#000000');
    expect(colordx('lab(200 0 0)').toHex()).toBe('#ffffff');
  });
  it('lch with negative L is accepted and clamped', () => accept('lch(-50 30 180)'));
  it('lch with L > 100 is accepted and clamped', () => accept('lch(150 30 180)'));
  it('oklab accepts L=0', () => expect(colordx('oklab(0 0 0)').toHex()).toBe('#000000'));
  it('oklab accepts L=1', () => expect(colordx('oklab(1 0 0)').toHex()).toBe('#ffffff'));
  it('hwb w+b>100 normalizes', () =>
    expect(colordx('hwb(0 60% 60%)').toHex()).toBe(colordx('hwb(0 50% 50%)').toHex()));
  it('hex alpha = 00 → alpha 0', () => expect(colordx('#ff000000').alpha()).toBe(0));
  it('hex alpha = ff → alpha 1', () => expect(colordx('#ff0000ff').alpha()).toBe(1));
});

// ─── unicode / whitespace surprises ────────────────────────────────────

describe('unicode and whitespace edges', () => {
  // Full-width digits/parens are different Unicode code points — not accepted.
  it('full-width digits rejected', () => reject('rgb(２５５ ０ ０)'));
  it('full-width parens rejected', () => reject('rgb（255 0 0）'));
  // \s in JS regex matches standard whitespace including NBSP? Actually \s matches NBSP (U+00A0) in JS.
  it('NBSP between channels accepted (per \\s semantics)', () =>
    expect(colordx('rgb(255\u00A00\u00A00)').isValid()).toBe(true));
  // Zero-width space is NOT \s; must be rejected.
  it('zero-width space rejected', () => reject('rgb(255\u200B0\u200B0)'));
  // JS regex `\s` includes U+FEFF (BOM), so it's whitespace here; documented behavior.
  it('BOM inside accepted (JS \\s matches U+FEFF)', () => accept('rgb(\uFEFF255 0 0)'));
  // Newlines inside the value list are whitespace.
  it('newlines between channels accepted', () => accept('rgb(255\n0\n0)'));
  it('mixed tabs and spaces accepted', () => accept('rgb(255 \t 0 \t 0)'));
});

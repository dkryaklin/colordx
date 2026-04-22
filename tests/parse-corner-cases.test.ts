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

const valid = (s: string) => expect(colordx(s).isValid()).toBe(true);
const invalid = (s: string) => expect(colordx(s).isValid()).toBe(false);

// Corner cases that go beyond "happy path" parsing. Many of these are subtle
// CSS Color 4 rules where legacy and modern syntaxes diverge.
describe('rgb — legacy comma vs modern space rules', () => {
  it('legacy: all-number is valid', () => valid('rgb(255, 0, 0)'));
  it('legacy: all-percent is valid', () => valid('rgb(100%, 0%, 0%)'));
  it('legacy: mixed types are invalid', () => invalid('rgb(255, 0%, 0)'));
  it('legacy: `none` is invalid on any channel', () => {
    invalid('rgb(none, 0, 0)');
    invalid('rgb(0, none, 0)');
    invalid('rgba(0, 0, 0, none)');
  });
  it('modern: mixed types are valid', () => {
    valid('rgb(255 50% 0)');
    valid('rgb(50% 128 100%)');
  });
  it('modern: `none` is valid on any channel', () => {
    valid('rgb(none 128 255)');
    valid('rgb(255 none 0 / none)');
  });
  it('modern: mixed gives the same color regardless of unit', () => {
    expect(colordx('rgb(255 50% 0)').toHex()).toBe(colordx('rgb(255 128 0)').toHex());
  });
});

describe('rgb — alpha forms', () => {
  it('omitted alpha defaults to 1', () => expect(colordx('rgb(0 0 0)').alpha()).toBe(1));
  it('alpha as percent in legacy comma form', () => {
    expect(colordx('rgba(0, 0, 0, 50%)').alpha()).toBe(0.5);
  });
  it('alpha as percent in modern slash form', () => {
    expect(colordx('rgb(0 0 0 / 50%)').alpha()).toBe(0.5);
  });
  it('alpha as fraction', () => expect(colordx('rgb(0 0 0 / 0.25)').alpha()).toBe(0.25));
  it('alpha clamps to [0, 1]', () => {
    expect(colordx('rgb(0 0 0 / -1)').alpha()).toBe(0);
    expect(colordx('rgb(0 0 0 / 5)').alpha()).toBe(1);
  });
});

describe('rgb — whitespace tolerance', () => {
  it('extra leading/trailing inner whitespace', () => valid('rgb(  255   0   0  )'));
  it('no whitespace around `/` in modern form', () => valid('rgb(255 0 0/0.5)'));
  it('newlines inside the function', () => valid('rgb(255\n0\n0)'));
});

describe('rgb — invalid forms', () => {
  it('mismatched braces', () => invalid('rgb(255 0 0'));
  it('non-numeric channel', () => invalid('rgb(red 0 0)'));
  it('only one channel', () => invalid('rgb(255)'));
  it('four channels without slash', () => invalid('rgb(255 0 0 0.5)'));
  it('alpha after legacy without comma', () => invalid('rgb(255, 0, 0 0.5)'));
});

describe('hsl — legacy vs modern', () => {
  it('legacy requires `%` on s/l', () => invalid('hsl(0, 100, 50)'));
  it('modern allows bare numbers on s/l', () => valid('hsl(0 100 50)'));
  it('modern bare numbers equal percent values', () => {
    expect(colordx('hsl(180 50 50)').toHex()).toBe(colordx('hsl(180 50% 50%)').toHex());
  });
  it('legacy rejects `none`', () => invalid('hsl(none, 100%, 50%)'));
  it('modern accepts `none` on hue', () => valid('hsl(none 100% 50%)'));
});

describe('hsl — angle units', () => {
  it('deg', () => expect(colordx('hsl(180deg 100% 50%)').toHex()).toBe(colordx('hsl(180 100% 50%)').toHex()));
  it('rad', () => expect(colordx('hsl(3.14159rad 100% 50%)').toHex()).toBe(colordx('hsl(180 100% 50%)').toHex()));
  it('turn', () => expect(colordx('hsl(0.5turn 100% 50%)').toHex()).toBe(colordx('hsl(180 100% 50%)').toHex()));
  it('grad', () => expect(colordx('hsl(200grad 100% 50%)').toHex()).toBe(colordx('hsl(180 100% 50%)').toHex()));
});

describe('hwb — number vs percentage on w/b', () => {
  it('numbers and percents are equivalent', () => {
    expect(colordx('hwb(0 25 25)').toHex()).toBe(colordx('hwb(0 25% 25%)').toHex());
  });
  it('mixed number/percent is valid', () => valid('hwb(180 50% 30)'));
  it('w + b > 100 normalizes proportionally', () => {
    // 60+60=120, scaled to 50/50 → gray
    expect(colordx('hwb(0 60% 60%)').toHex()).toBe(colordx('hwb(0 50% 50%)').toHex());
  });
});

describe('lab — L `%` is optional', () => {
  it('lab(50 ...) parses', () => valid('lab(50 0 0)'));
  it('lab(50% ...) parses', () => valid('lab(50% 0 0)'));
  it('both forms equal', () => {
    expect(colordx('lab(50 20 -10)').toHex()).toBe(colordx('lab(50% 20 -10)').toHex());
  });
});

describe('lab — a/b accept percentages', () => {
  it('100% on a = 125', () => {
    expect(colordx('lab(50 100% 0)').toHex()).toBe(colordx('lab(50 125 0)').toHex());
  });
  it('-100% on b = -125', () => {
    expect(colordx('lab(50 0 -100%)').toHex()).toBe(colordx('lab(50 0 -125)').toHex());
  });
  it('mixed unit on a/b is fine', () => valid('lab(50 50% 30)'));
});

describe('lch — L/C `%`', () => {
  it('L without %', () => valid('lch(50 30 180)'));
  it('L with %', () => valid('lch(50% 30 180)'));
  it('C with % (100% = 150)', () => {
    expect(colordx('lch(50 100% 180)').toHex()).toBe(colordx('lch(50 150 180)').toHex());
  });
  it('hue accepts angle units', () => {
    expect(colordx('lch(50 30 0.5turn)').toHex()).toBe(colordx('lch(50 30 180)').toHex());
  });
  it('hue `none` collapses to 0', () => {
    expect(colordx('lch(50 30 none)').toHex()).toBe(colordx('lch(50 30 0)').toHex());
  });
});

describe('oklab/oklch — channel scaling', () => {
  it('oklab L 100% = 1', () => {
    expect(colordx('oklab(100% 0 0)').toHex()).toBe(colordx('oklab(1 0 0)').toHex());
  });
  it('oklab a 100% = 0.4', () => {
    expect(colordx('oklab(0.5 100% 0)').toHex()).toBe(colordx('oklab(0.5 0.4 0)').toHex());
  });
  it('oklab a -100% = -0.4', () => {
    expect(colordx('oklab(0.5 -100% 0)').toHex()).toBe(colordx('oklab(0.5 -0.4 0)').toHex());
  });
  it('oklch C 100% = 0.4', () => {
    expect(colordx('oklch(0.5 100% 180)').toHex()).toBe(colordx('oklch(0.5 0.4 180)').toHex());
  });
});

describe('p3/rec2020 — CSS Color 4 channel forms', () => {
  it('p3 percent on channels', () => {
    expect(colordx('color(display-p3 100% 0 0)').toHex()).toBe(colordx('color(display-p3 1 0 0)').toHex());
  });
  it('p3 mixed number/percent', () => valid('color(display-p3 0.5 50% 1)'));
  it('p3 `none`', () => valid('color(display-p3 none 0 0)'));
  it('rec2020 percent + alpha-percent', () => valid('color(rec2020 50% 50% 50% / 50%)'));
});

describe('cmyk — number is in [0,1] and percent is in [0,100]', () => {
  it('numbers map to percentages', () => {
    expect(colordx('device-cmyk(0.5 0 0 0)').toHex()).toBe(colordx('device-cmyk(50% 0 0 0)').toHex());
  });
  it('`none` is valid', () => valid('device-cmyk(none none none none)'));
});

describe('hex — minor edges', () => {
  it('uppercase', () => expect(colordx('#FF0000').toHex()).toBe('#ff0000'));
  it('3-digit shorthand', () => expect(colordx('#f00').toHex()).toBe('#ff0000'));
  it('4-digit shorthand with alpha', () => expect(colordx('#f00f').toHex()).toBe('#ff0000'));
  it('8-digit alpha', () => expect(colordx('#ff000080').alpha()).toBe(0.502));
  it('5-digit is invalid', () => invalid('#ff000'));
  it('7-digit is invalid', () => invalid('#ff00000'));
  it('non-hex character', () => invalid('#gggggg'));
});

describe('case-insensitive function names', () => {
  it('RGB', () => valid('RGB(255 0 0)'));
  it('Hsl', () => valid('Hsl(0 100% 50%)'));
  it('LAB', () => valid('LAB(50 0 0)'));
  it('OKLCH', () => valid('OKLCH(0.5 0.1 180)'));
  it('Color', () => valid('Color(display-p3 1 0 0)'));
});

describe('case-insensitive `none` keyword', () => {
  it('NONE in rgb modern', () => valid('rgb(NONE 0 0)'));
  it('None in oklab', () => valid('oklab(None 0 0)'));
  it('nONe in lch hue', () => valid('lch(50 30 nONe)'));
});

describe('alpha keyword `none`', () => {
  it('rgb modern: alpha none → 0', () => expect(colordx('rgb(255 0 0 / none)').alpha()).toBe(0));
  it('lab modern: alpha none → 0', () => expect(colordx('lab(50 0 0 / none)').alpha()).toBe(0));
  it('p3: alpha none → 0', () => expect(colordx('color(display-p3 1 0 0 / none)').alpha()).toBe(0));
});

describe('whitespace edges across formats', () => {
  it('lab: tabs between channels', () => valid('lab(50\t0\t0)'));
  it('hwb: trailing whitespace before )', () => valid('hwb(0 0% 0%   )'));
  it('rgb: leading whitespace inside (', () => valid('rgb(   255 0 0)'));
});

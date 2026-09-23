import { beforeAll, describe, expect, it } from 'vitest';
import { NUM } from '../src/helpers.js';
import { scanChannel, scanPos } from '../src/scan.js';
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
  it('an infinite w or b dominates the normalization', () => {
    expect(colordx('hwb(0 1e999% 0%)').toHex()).toBe('#ffffff');
    expect(colordx('hwb(0 0% 1e999%)').toHex()).toBe('#000000');
    expect(colordx('hwb(0 1e999% 1e999%)').toHex()).toBe('#808080');
  });
});

describe('hsv — whitespace before the closing paren', () => {
  // The old hsv() regex allowed it only after an alpha; hsl() was fixed the same way earlier.
  it('with or without alpha', () => {
    valid('hsv(0 50 50 )');
    valid('hsv(0 50% 50%\t)');
    valid('hsv(0 50 50 / 1 )');
    expect(colordx('hsv(0 50 50 )').toHex()).toBe(colordx('hsv(0 50 50)').toHex());
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

describe('`none` is an ident: no `%` or angle unit', () => {
  it.each([
    'rgb(none% 0 0)',
    'rgb(255 0 0 / none%)',
    'hsl(nonedeg 50% 50%)',
    'hsl(120 none% 50%)',
    'hwb(nonedeg 0% 0%)',
    'lab(none% 0 0)',
    'lch(50 30 noneturn)',
    'oklab(none% 0 0)',
    'oklch(0.7 0.1 nonedeg)',
    'oklch(0.7 none% 120)',
    'color(srgb 1 0 0 / none%)',
    'color(display-p3 none% 0 0)',
    'device-cmyk(none% 0 0 0)',
  ])('%s', invalid);
});

describe('`transparent` is case-insensitive like other keywords', () => {
  it.each(['TRANSPARENT', 'Transparent', ' transparent '])('%s', (s) =>
    expect(colordx(s).toRgb()).toEqual({ r: 0, g: 0, b: 0, alpha: 0 })
  );
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

describe('scientific notation (CSS Syntax 3 <number-token> exponent)', () => {
  const same = (a: string, b: string) => {
    valid(a);
    expect(colordx(a).toHex8()).toBe(colordx(b).toHex8());
  };
  it('rgb: 1e2 reads as 100', () => same('rgb(1e2 0 0)', 'rgb(100 0 0)'));
  it('rgb: mantissa with a fraction', () => same('rgb(2.55e2 0 0)', 'rgb(255 0 0)'));
  it('rgb: negative exponent', () => same('rgb(2550e-1 0 0)', 'rgb(255 0 0)'));
  it('rgb: explicit positive exponent, upper-case E', () => same('rgb(2.55E+2 0 0)', 'rgb(255 0 0)'));
  it('rgb: percent after the exponent', () => same('rgb(1e2% 0 0)', 'rgb(100% 0 0)'));
  it('rgb: alpha with an exponent', () => expect(colordx('rgb(0 0 0 / 5e-1)').alpha()).toBe(0.5));
  it('rgb: legacy comma form', () => same('rgba(1e2, 0, 0, 5e-1)', 'rgba(100, 0, 0, 0.5)'));
  it('rgb: 16+ digit mantissa with an exponent still defers to Number()', () =>
    same('rgb(1234567890123456789e-17 0 0)', 'rgb(12.34567890123456789 0 0)'));
  it('hsl: hue with an exponent', () => same('hsl(1.2e2 100% 50%)', 'hsl(120 100% 50%)'));
  it('hsl: hue with an exponent and a unit', () => same('hsl(1.2e2deg 100% 50%)', 'hsl(120 100% 50%)'));
  it('oklch: 6e-1 reads as 0.6', () => same('oklch(6e-1 0.1 30)', 'oklch(0.6 0.1 30)'));
  it('oklch: tiny chroma as culori formats it', () => same('oklch(0.5 1e-7 30)', 'oklch(0.5 0.0000001 30)'));
  it('oklab', () => same('oklab(5e-1 1e-1 -1e-1)', 'oklab(0.5 0.1 -0.1)'));
  it('lab', () => same('lab(5e1 -1E1 1e-1)', 'lab(50 -10 0.1)'));
  it('lch', () => same('lch(50 30 1.8e2)', 'lch(50 30 180)'));
  it('hwb', () => same('hwb(1.2e2 1e1% 1e1%)', 'hwb(120 10% 10%)'));
  it('hsv', () => same('hsv(1.2e2 1e2% 1e2%)', 'hsv(120 100% 100%)'));
  it('color(srgb)', () => same('color(srgb 1e-7 0 0)', 'color(srgb 0.0000001 0 0)'));
  it('color(display-p3)', () => same('color(display-p3 5e-1 0 0)', 'color(display-p3 0.5 0 0)'));
  it('color(rec2020)', () => same('color(rec2020 5e-1 0 0)', 'color(rec2020 0.5 0 0)'));
  it('device-cmyk', () => same('device-cmyk(0 1e2% 0 0)', 'device-cmyk(0 100% 0 0)'));
  it('a bare `e` ends the number and the leftover rejects the string', () => {
    invalid('rgb(1e 0 0)');
    invalid('rgb(1e+ 0 0)');
    invalid('rgb(1e2.5 0 0)');
    invalid('oklch(6e-1e 0.1 30)');
  });
});

describe('scientific notation: round-trips and grammar parity', () => {
  const same = (a: string, b: string) => {
    valid(a);
    expect(colordx(a).toHex8()).toBe(colordx(b).toHex8());
  };

  it('high-precision formatter output prints tiny values in fixed decimals and re-parses to the same color', () => {
    // A chroma of ~1e-7 used to print as `1.105e-7` at 10 dp — valid CSS, but not what a caller asking
    // for 10 decimals expects. It prints as fixed decimals now; the parser still reads exponents.
    const c = colordx('oklch(0.5 1e-7 30)');
    const s = c.toOklchString(10);
    expect(s).not.toMatch(/e-\d/);
    expect(s).toMatch(/ 0\.0000001\d* /);
    expect(colordx(s).isValid()).toBe(true);
    expect(colordx(s).toHex8()).toBe(c.toHex8());
  });

  it('every formatter prints fixed decimals at 7+ dp', () => {
    expect(colordx('oklab(0.5 0.00000004 -0.00000012)').toOklabString(8)).toBe('oklab(0.5 0.00000004 -0.00000012)');
    expect((colordx('lab(50 0.0000002 0)') as any).toLabString(8)).toBe('lab(50 0.0000002 0)');
    expect(colordx('oklab(0.5 0.00000004 0)').toOklabString()).toBe('oklab(0.5 0 0)');
  });

  it('overflowing and underflowing exponents clamp like their long spellings', () => {
    same('rgb(1e400 0 0)', 'rgb(1' + '0'.repeat(400) + ' 0 0)');
    same('rgb(-1e400 0 0)', 'rgb(0 0 0)');
    same('rgb(1e-400 0 0)', 'rgb(0 0 0)');
    same('hsl(1e20 100% 50%)', 'hsl(100000000000000000000 100% 50%)');
    same('hsl(1e400 100% 50%)', 'hsl(0 100% 50%)'); // non-finite hue → 0°
    same('oklch(0.5 1e400 30)', 'oklch(0.5 1' + '0'.repeat(400) + ' 30)');
    expect(colordx('rgb(0 0 0 / 1e400)').alpha()).toBe(1);
    expect(colordx('rgb(0 0 0 / 1e-400)').alpha()).toBe(0);
  });

  it('the hand-written scanner and the NUM regex accept exactly the same tokens', () => {
    const re = new RegExp(`^${NUM}%?$`);
    const tokens = [
      '1', '-1', '+1', '.5', '1.5', '1e2', '1E2', '1e+2', '1e-2', '1.5e2', '.5e2', '1e02', '1e2%', '1.5e-2%',
      '0e0', '-0e0', '1e0000000000000000002', '1234567890123456789e-17',
      '1e', '1e+', '1e-', 'e2', '.e2', '1.e2', '1e2.5', '1e2e2', '1e 2', '1 e2', '1e0x2', '1.', '.', '', '+', '-',
      '1e2%%', '1%e2', '1e%2', '1ee2', '1e+-2', '1e2-', '1e2+', '1e2e', 'E2', '1E', '1e.5',
    ];
    for (const t of tokens) {
      const v = scanChannel(t, 0, t.length);
      const scannerAccepts = v === v && scanPos() === t.length;
      expect(scannerAccepts, JSON.stringify(t)).toBe(re.test(t));
      if (scannerAccepts) expect(v, JSON.stringify(t)).toBe(Number(t.replace('%', '')));
    }
  });
});

describe('the parser registry handed to plugins', () => {
  it('starts with the ten built-in parsers, strings first, and plugin parsers run after them', async () => {
    const fn = await import('../src/fn.js');
    let seen: unknown[] = [];
    const calls: unknown[] = [];
    const probe = (input: unknown) => {
      calls.push(input);
      return input === 'probe-color' ? { r: 1, g: 2, b: 3, alpha: 1 } : null;
    };
    extend([
      (_, parsers) => {
        seen = [...parsers];
        parsers.push(probe);
      },
    ]);
    expect(seen.slice(0, 10)).toEqual([
      fn.parseHex,
      fn.parseRgbString,
      fn.parseSrgbColorString,
      fn.parseHslString,
      fn.parseOklchString,
      fn.parseOklabString,
      fn.parseRgbObject,
      fn.parseHslObject,
      fn.parseOklabObject,
      fn.parseOklchObject,
    ]);
    expect(colordx('probe-color').toHex()).toBe('#010203');
    expect(colordx({ probe: true } as never).isValid()).toBe(false);
    expect(calls).toEqual(['probe-color', { probe: true }]);
    expect(colordx('  #f00  ').toHex()).toBe('#ff0000');
    expect(colordx('\toklab(1 0 0)').toHex()).toBe('#ffffff');
    expect(calls).toHaveLength(2);
  });
});

describe('hsl() string scanner', () => {
  const ok = (s: string, hex: string) => expect(colordx(s).toHex(), s).toBe(hex);
  const bad = (s: string) => expect(colordx(s).isValid(), s).toBe(false);

  it('accepts whitespace before the closing paren with or without alpha', () => {
    ok('hsl(0, 100%, 50% )', '#ff0000');
    ok('hsl(0 100% 50% )', '#ff0000');
    ok('hsl(0 100% 50%\t)', '#ff0000');
    ok('hsl(0 100% 50% / 0.5 )', '#ff000080');
    ok('hsla(0, 100%, 50%, 0.5 )', '#ff000080');
    ok(' \n hsl( 0 100% 50% ) \f\r\n', '#ff0000');
    // CSS whitespace is space, tab, LF, CR and FF only — not JS \s, which adds NBSP and the BOM.
    bad(' \n hsl( 0 100% 50% ) \u00a0\n');
  });

  it('reads both syntaxes, any case, with exponents and leading dots', () => {
    ok('HSLA(1e1GRAD,5%,5%,50%)', '#0d0c0c80');
    ok('hsl(120 100% 50%)', '#00ff00');
    ok('hsl(120 100 50)', '#00ff00');
    ok('hsl(1.2e2, 1e2%, 5e1%)', '#00ff00');
    ok('hsl(+120 .1e3% 50.0%)', '#00ff00');
    ok('hsl(120,100%,50%)', '#00ff00');
    ok('hsl(120 100% 50%/50%)', '#00ff0080');
    ok('hsl(120 100% 50% / none)', '#00ff0000');
  });

  it('applies angle units case-insensitively and wraps the hue', () => {
    ok('hsl(0.5turn 100% 50%)', '#00ffff');
    ok('hsl(200GRAD 100% 50%)', '#00ffff');
    ok(`hsl(${Math.PI}rad 100% 50%)`, '#00ffff');
    ok('hsl(180DEG 100% 50%)', '#00ffff');
    ok('hsl(-180 100% 50%)', '#00ffff');
    ok('hsl(540 100% 50%)', '#00ffff');
  });

  it('`none` is modern-syntax only', () => {
    ok('hsl(none 100% 50%)', '#ff0000');
    ok('hsl(NONE none 50%)', '#808080');
    // `none` is an ident token: it takes no unit or `%`.
    bad('hsl(nonedeg 100% 50%)');
    bad('hsl(0 none% 50%)');
    bad('hsl(none, 100%, 50%)');
    bad('hsl(0, none, 50%)');
    bad('hsl(0, 100%, none)');
    bad('hsl(0, 100%, 50%, none)');
  });

  it('legacy syntax needs % on s and l and consistent commas', () => {
    bad('hsl(0, 100, 50%)');
    bad('hsl(0, 100%, 50)');
    bad('hsl(0, 100% 50%)');
    bad('hsl(0 100%, 50%)');
    bad('hsl(0, 100%, 50% / 0.5)');
    bad('hsl(0 100% 50%, 0.5)');
  });

  it('rejects malformed input', () => {
    for (const s of [
      'hsl(0 100% 50%',
      'hsl(0 100% 50%))',
      'hsl(0 100% 50%) x',
      'hsl (0 100% 50%)',
      'hsl(0100%50%)',
      'hsl(0 100%50%)',
      'hsl(0% 100% 50%)',
      'hsl(0 deg 100% 50%)',
      'hsl(0degs 100% 50%)',
      'hsl(10constructor 100% 50%)',
      'hsl(10__proto__ 100% 50%)',
      'hsl(10toString 100% 50%)',
      'hsl(1e 100% 50%)',
      'hsl(5. 100% 50%)',
      'hsl(. 100% 50%)',
      'hsl(--1 100% 50%)',
      'hsl(0 100% 50% 0.5)',
      'hsl(0 100% 50% / )',
      'hsl(0 100% 50% / 0.5 0.5)',
      'hsl(0 100%% 50%)',
      'hsl(0 100 % 50%)',
      'hsl(0 100%)',
      'hsl()',
      'hslx(0 100% 50%)',
      'hs(0 100% 50%)',
      '\u017fsl(0 100% 50%)',
      'h\u017fl(0 100% 50%)',
    ])
      bad(s);
  });

  it('called directly, checks every delimiter itself', async () => {
    const { parseHslString, rgbToHex } = await import('../src/fn.js');
    for (const s of [
      'xsl(0 100% 50%)',
      'hsl[0 100% 50%)',
      'hsla[0 100% 50%)',
      'hsl(0 100% 50%x',
      'hsl(0 100% 50%]',
      'hsl(0deg100% 50%)',
      'hsl(0-100% 50%)',
      'hsl(0 100%-50%)',
      'hsl(0 100% )',
      'hsl(0 )',
      'hsl(10z 100% 50%)',
      'hsl(10{ 100% 50%)',
    ])
      expect(parseHslString(s), s).toBeNull();
    expect(rgbToHex(parseHslString('hsl(0\t100%\n50%)')!)).toBe('#ff0000');
    expect(rgbToHex(parseHslString('hsl(0deg\f100% 50%)')!)).toBe('#ff0000');
    expect(rgbToHex(parseHslString('\r\nhsl(0 100% 50%)\n')!)).toBe('#ff0000');
    // Not CSS whitespace: NBSP, the BOM, \v.
    for (const s of ['hsl(0\u00a0100%\u00a050%)', 'hsl(0deg\v100% 50%)', '\u00a0hsl(0 100% 50%)\ufeff'])
      expect(parseHslString(s), s).toBeNull();
  });

  it('clamps like the object parser and matches Number() on long tokens', () => {
    ok('hsl(0 150% 50%)', '#ff0000');
    ok('hsl(0 -10% 50%)', '#808080');
    ok('hsl(0 100% 1e400%)', '#ffffff');
    ok('hsl(0 100% 50% / 7)', '#ff0000');
    expect(colordx('hsl(210.12345678901234567 50% 40%)')._rawRgb()).toEqual(
      colordx({ h: Number('210.12345678901234567'), s: 50, l: 40 })._rawRgb()
    );
    expect(colordx('hsl(13.64365 33.3333% 66.6667%)')._rawRgb()).toEqual(
      colordx({ h: 13.64365, s: 33.3333, l: 66.6667 })._rawRgb()
    );
  });
});

import { describe, expect, it } from 'vitest';
import { colordx, extend } from '../src/index.js';
import hwb from '../src/plugins/hwb.js';
import minify from '../src/plugins/minify.js';
import names from '../src/plugins/names.js';


extend([hwb, names, minify]);

type Options = Parameters<ReturnType<typeof colordx>['minify']>[0];

const minifyColor = (input: string, options: Options = {}): string => {
  const instance = colordx(input);
  if (instance.isValid()) {
    const minified = instance.minify(options);
    return minified.length < input.length ? minified : input.toLowerCase();
  }
  return input;
};

const min = (input: string, options: Options = {}): string =>
  minifyColor(input, { alphaHex: false, transparent: true, name: true, ...options });

const table = (cases: [input: string, output: string, title?: string][], options?: Options) => {
  for (const [input, output, title] of cases)
    it(title ?? `${input} → ${output}`, () => expect(min(input, options)).toBe(output));
};


describe('colormin minifyColorFormats — Basic color conversions', () => {
  table([
    ['RED', 'red', 'should lowercase keywords'],
    ['#f00', 'red', 'should convert shorthand hex to keyword'],
    ['#ff0000', 'red', 'should convert longhand hex to keyword'],
    ['rgb(255,0,0)', 'red', 'should convert rgb to keyword'],
    ['rgba(255, 0, 0, 1)', 'red', 'should convert fully opaque rgb to keyword'],
    ['hsl(0, 100%, 50%)', 'red', 'should convert hsl to keyword'],
    ['hsla(0, 100%, 50%, 1)', 'red', 'should convert fully opaque hsl to keyword'],
    ['hsla(0, 100%, 50%, .5)', 'rgba(255,0,0,.5)', 'should convert translucent hsla to rgba'],
    ['#FFFFFF', '#fff', 'should convert longhand hex to shorthand, case insensitive'],
    ['WHiTE', '#fff', 'should convert keyword to hex, case insensitive'],
    ['yellow', '#ff0', 'should convert keyword to hex'],
    ['rgb(12, 134, 29)', '#0c861d', 'should convert rgb to hex'],
    ['hsl(230, 50%, 40%)', '#349', 'should convert hsl to hex'],
    ['#000080', 'navy', 'should convert another longhand hex to keyword'],
    ['rgba(221, 221, 221, 0.5)', 'hsla(0,0%,86.7%,.5)', 'should convert rgba to shortest lossless form'],
    ['rgba(0,0,0,0)', 'transparent', 'should convert this specific rgba value to "transparent"'],
    ['hsla(0,0%,0%,0)', 'transparent', 'should convert this specific hsla value to "transparent"'],
    ['hsla(200,0%,0%,0)', 'transparent', 'should convert hsla values with 0 saturation & 0 lightness to "transparent"'],
    ['transparent', 'transparent', 'should leave transparent as it is'],
    ['#696969', '#696969', 'should prefer to output hex rather than keywords when they are the same length'],
    ['rgb(400,400,400)', '#fff', 'should cap values at their maximum'],
    ['hsl(400, 400%, 50%)', '#fa0', 'should continue hsl value rotation'],
    ['rgba(-100,0,-100,.5)', 'rgba(0,0,0,.5)', 'should convert signed numbers'],
    ['hsla(-400, 50%, 10%, 0.5)', 'rgba(38,13,30,.5)', 'should convert signed numbers (2)'],
    ['rgb(100%,100%,100%)', '#fff', 'should convert percentage based rgb values'],
    ['rgba(50%, 50%, 50%, 0.5)', 'hsla(0,0%,50%,.5)', 'should convert percentage based rgba values (2)'],
    ['rgba(100%,100%,100%,0.5)', 'hsla(0,0%,100%,.5)', 'should convert percentage based rgba values (4)'],
    ['rgba(100%, 64.7%, 0%, .5)', 'rgba(255,165,0,.5)', 'should convert percentage based rgba values (5)'],
    ['rgb(50%,23,54)', 'rgb(50%,23,54)', 'should pass through on invalid rgb functions'],
    ['999', '999', 'should pass on non prefixed hexadecimal value'],
    ['darkgray', '#a9a9a9', 'should convert darkgray to a hex'],
    ['#000000FF', '#000', 'should convert 8 character hex codes'],
    ['#000F', '#000', 'should convert 4 character hex codes'],
    ['#00000004', '#00000004', 'should pass through 8 character hex codes'],
    ['Unrecognised', 'Unrecognised', 'should pass through if not recognised'],
    ['inherit', 'inherit', 'should pass through inherit'],
  ]);
});

describe('colormin minifyColorFormats — Alpha hex conversions', () => {
  table(
    [
      ['#aabbcc33', '#abc3', 'should convert to hex4'],
      ['rgb(119,119,119,0.2)', '#7773', 'should convert rgb with alpha to hex4'],
      ['hsla(0,0%,100%,.4)', '#fff6', 'should convert hsla to hex4'],
      ['transparent', '#0000', 'should convert transparent to hex4 when alphaHex enabled'],
      ['rgba(128, 128, 128, 0.5)', '#80808080', 'should convert to hex8'],
      ['hsla(180, 100%, 50%, 0.5)', '#00ffff80', 'should convert hsla to hex8'],
      ['rgba(0, 0, 0, 0.075)', 'rgba(0,0,0,.075)', 'should not convert to alpha hex since the conversion is not lossless'],
      ['hsla(0, 0%, 50%, 0.515)', 'hsla(0,0%,50%,.515)', 'should not convert to alpha hex since the conversion is not lossless (2)'],
    ],
    { alphaHex: true }
  );
  table([
    ['color-mix(#000, #FFF 0%)', 'color-mix(#000, #FFF 0%)', 'should preserve percentage in color-mix'],
    ['rgba(255,255,255,.7)', 'hsla(0,0%,100%,.7)', 'should preserve percentage in hsla'],
  ]);
});

describe('colormin minifyColorFormats — Named colors and namesPlugin', () => {
  table([
    ['red', 'red', 'should keep red when shortest'],
    ['blue', 'blue', 'should keep blue when shortest'],
    ['rebeccapurple', '#639', 'should shorten rebeccapurple to hex'],
    ['#ff0000', 'red', 'should convert hex to named color when name is shorter'],
    ['#0000ff', '#00f', 'should keep hex when it is shorter than the name'],
    ['currentcolor', 'currentcolor', 'should pass through currentcolor'],
    ['inherit', 'inherit', 'should pass through inherit'],
  ]);
  table(
    [
      ['rgb(255,0,0)', '#f00', 'name:false should use hex instead of named colors'],
      ['yellow', '#ff0', 'name:false should use hex instead of named colors (2)'],
      ['#ff0000', '#f00', 'name:false should use hex instead of named colors (3)'],
    ],
    { name: false }
  );
});

describe('colormin minifyColorFormats — Space-separated syntax and format flags', () => {
  table([
    ['rgb(255 0 0)', 'red', 'should minify space-separated rgb() to shortest form'],
    ['rgb(0 0 0)', '#000', 'should minify space-separated rgb() to shortest form (2)'],
    ['rgb(255 255 255)', '#fff', 'should minify space-separated rgb() to shortest form (3)'],
    ['rgb(255 0 0 / 0.5)', 'rgba(255,0,0,.5)', 'should minify space-separated rgb() with slash alpha'],
    ['rgb(255 0 0 / 50%)', 'rgba(255,0,0,.5)', 'should minify space-separated rgb() with percent slash alpha'],
    ['hsl(0 100% 50%)', 'red', 'should minify space-separated hsl() to shortest form'],
    ['hsl(0 100% 50% / 0.5)', 'rgba(255,0,0,.5)', 'should minify space-separated hsl() with slash alpha'],
    ['currentColor', 'currentColor', 'should pass through currentColor unchanged'],
    ['transparent', 'transparent', 'should pass through transparent unchanged'],
  ]);
  table([['rgba(50%, 50%, 50%, 0.5)', 'rgba(128,128,128,.5)', 'hsl:false should avoid hsl output and use rgba instead']], {
    hsl: false,
  });
  table([['rgba(255, 0, 0, 0.5)', 'hsla(0,100%,50%,.5)', 'rgb:false should avoid rgb output and use hsl instead']], {
    rgb: false,
  });
});


describe('colormin minifyColorPrecision — Lossless round-trip tests', () => {
  it.each([
    ['rgb(143 101 98 / 43%)', 'rgb(143, 101, 98)'],
    ['rgba(221, 221, 221, 0.5)', 'rgb(221, 221, 221)'],
  ])('should not produce a lossier representation for %s', (input, opaque) => {
    const orig = colordx(opaque).toRgb();
    const roundtrip = colordx(min(input)).toRgb();
    expect(Math.round(roundtrip.r)).toBe(Math.round(orig.r));
    expect(Math.round(roundtrip.g)).toBe(Math.round(orig.g));
    expect(Math.round(roundtrip.b)).toBe(Math.round(orig.b));
  });
});

describe('colormin minifyColorPrecision — Modern CSS color formats', () => {
  table([
    ['oklch(0.5 0.1 240)', '#1f6a96', 'should minify sRGB-equivalent oklch to hex'],
    ['oklch(0.6279 0.2577 29.23)', 'red', 'should minify sRGB-equivalent oklch to a name'],
    ['oklch(0.5 0.2 240)', 'oklch(.5 .2 240)', 'should not clip wide-gamut oklch to sRGB hex'],
    ['oklab(0.5 0.1 -0.2)', '#7532d0', 'should minify sRGB-equivalent oklab to hex'],
    ['hwb(120 0% 0%)', '#0f0', 'should minify hwb to hex'],
    ['lch(54.29 106.84 40.85)', 'lch(54.29 106.84 40.85)', 'should pass through lch values (lch plugin not loaded)'],
    ['color(display-p3 0.9176 0.2003 0.1386)', 'color(display-p3 0.9176 0.2003 0.1386)', 'should pass through color() function values'],
  ]);
});

describe('colormin minifyColorPrecision — Precision regressions', () => {
  table([
    ['rgba(130, 138, 145, 0.5)', 'rgba(130,138,145,.5)'],
    ['rgba(216, 217, 219, 0.5)', 'rgba(216,217,219,.5)'],
    ['rgba(108, 117, 125, 0.5)', 'rgba(108,117,125,.5)'],
    ['rgba(254, 254, 254, 0.25)', 'hsla(0,0%,99.6%,.25)'],
    ['rgba(17, 17, 17, 0.1)', 'rgba(17,17,17,.1)'],
    ['rgba(17, 17, 17, 0.2)', 'rgba(17,17,17,.2)'],
    ['rgba(17, 17, 17, 0.3)', 'rgba(17,17,17,.3)'],
    ['rgba(17, 17, 17, 0.6)', 'rgba(17,17,17,.6)'],
    ['rgba(100, 100, 100, 0.3)', 'hsla(0,0%,39.2%,.3)'],
    ['rgba(100, 100, 100, 0.4)', 'hsla(0,0%,39.2%,.4)'],
    ['rgba(128, 135, 139, 0.8)', 'rgba(128,135,139,.8)'],
    ['rgba(225, 225, 225, 0.3)', 'hsla(0,0%,88.2%,.3)'],
    ['hsl(220, 80%, 50%)', 'hsl(220,80%,50%)'],
    ['hsl(20, 100%, 55%)', '#ff661a'],
    ['hsl(270, 80%, 50%)', '#801ae6'],
    ['hsl(320, 80%, 50%)', 'hsl(320,80%,50%)'],
  ]);
});


describe('colormin declarations / hwb / propertyContext — the color values colormin hands to colordx', () => {
  table([
    ['yellow', '#ff0'],
    ['YELLOW', '#ff0'],
    ['rgba(255, 230, 220, 0.5)', 'rgba(255,230,220,.5)'],
    ['hsla(134, 50%, 50%, 1)', 'hsl(134,50%,50%)'],
    ['HSLA(134, 50%, 50%, 1)', 'hsl(134,50%,50%)'],
    ['#000000', '#000'],
    ['rgb(255, 255, 255)', '#fff'],
    ['hsl(0,0%,100%)', '#fff'],
    ['#FFFFFF', '#fff'],
    ['#F0FFFF', 'azure'],
    ['#ff0000', 'red'],
    ['orange', 'orange'],
    ['black', '#000'],
    ['rgba(255, 255, 255, 0)', 'hsla(0,0%,100%,0)'],
    ['#fbfbfb', '#fbfbfb'],
    ['#ffffff', '#fff'],
    ['#ececec', '#ececec'],
    ['#999999', '#999'],
    ['rgb(255,0,0)', 'red'],
    ['rgb(0,255,0)', '#0f0'],
    ['white', '#fff'],
    ['rgb(50, 50, 50)', '#323232'],
    ['rgb(1,2,3)', '#010203'],
    ['rgba(0,0,0,0)', 'transparent'],
    ['hwba(120,0%,0%,.5)', 'hwba(120,0%,0%,.5)', 'hwba() does not exist and passes through'],
    ['rgb(50%, 23, 54)', 'rgb(50%, 23, 54)', 'mixed percent and number channels are invalid and pass through'],
    ['hwb(120 0% 0%)', '#0f0'],
    ['hwb(120 0% 0% / 0.5)', 'rgba(0,255,0,.5)'],
    ['hwb(120deg 0% 0% / 1)', '#0f0'],
    ['hwb(0.3333turn 0% 0%)', '#0f0'],
    ['oklch(0.6279 0.2577 29.23)', 'red', 'colormin leaves oklch() alone before colordx sees it; colordx alone would minify it'],
    ['color(display-p3 1 0.5 0)', 'color(display-p3 1 0.5 0)', 'no p3 plugin loaded, so color() passes through'],
    ['rgba(255,255,255,0)', 'hsla(0,0%,100%,0)'],
  ]);
  table(
    [
      ['rgba(100% 50% 0% / 50%)', '#ff800080', 'modern target: 8-digit hex'],
      ['hsla(0 100% 50% / 40%)', '#f006', 'modern target: 4-digit hex'],
    ],
    { alphaHex: true }
  );
  table([['hsla(0 100% 50% / 40%)', 'rgba(255,0,0,.4)', 'legacy target: rgba()']]);
  table([['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'IE 8 target: rgba(0,0,0,0) is not "transparent"']], { transparent: false });
});

import {
  DisplayP3Linear,
  Rec2020Linear,
  OKLCH as TexelOKLCH,
  sRGB as TexelSRGB,
  convert as texelConvert,
  isRGBInGamut as texelIsRGBInGamut,
  parse as texelParse,
  RGBToHex as texelRGBToHex,
  serialize as texelSerialize,
} from '@texel/color';
// @ts-ignore
import chroma from 'chroma-js';
// @ts-ignore
import ColorLib from 'color';
import { colord, extend as colordExtend } from 'colord';
// @ts-ignore
import colordA11yPlugin from 'colord/plugins/a11y';
// @ts-ignore
import colordMixPlugin from 'colord/plugins/mix';
// @ts-ignore
import colordNamesPlugin from 'colord/plugins/names';
import * as culori from 'culori';
import { bench, group, run } from 'mitata';
// @ts-ignore
import tinycolor2 from 'tinycolor2';
import { Colordx, colordx, extend } from '../src/index.js';
import a11y from '../src/plugins/a11y.js';
import lab from '../src/plugins/lab.js';
import mix from '../src/plugins/mix.js';
import names from '../src/plugins/names.js';
import { inGamutP3 } from '../src/plugins/p3.js';
import { inGamutRec2020 } from '../src/plugins/rec2020.js';

colordExtend([colordMixPlugin, colordA11yPlugin, colordNamesPlugin]);

extend([mix, a11y, lab, names]);

// ---------------------------------------------------------------------------
// Inputs live in arrays and are read through a rotating index.
//
// This is not incidental. A colour literal written inline at the call site gets
// partly constant-folded and escape-analysed by V8: for a library whose whole
// path is allocation-free and inlineable, that inflated measured throughput by
// 42%. A module-level `const` is not enough either — V8 still sees through a
// binding that is never reassigned. An array element load is opaque to the
// optimiser, so every library ends up measured doing real work.
//
// The rotation is deliberately small (8) so inputs stay cache-resident and we
// measure the library rather than memory latency.
// ---------------------------------------------------------------------------
const R = 8;
let k = 0;
const next = (): number => k++ & (R - 1);

const mkHex = (base: number): string[] =>
  Array.from({ length: R }, (_, i) => `#${(base + i).toString(16).padStart(6, '0')}`);

const HEX = mkHex(0x808080);
const HEX_BLUE = mkHex(0x3498db);
const RGB_STR = Array.from({ length: R }, (_, i) => `rgb(${52 + i}, 152, 219)`);
const HSL_STR = Array.from({ length: R }, (_, i) => `hsl(${204 + i}, 70%, 53%)`);
const RGB_OBJ = Array.from({ length: R }, (_, i) => ({ r: 52 + i, g: 152, b: 219 }));
const RGB_OBJ_CULORI = Array.from({ length: R }, (_, i) => ({
  mode: 'rgb' as const,
  r: (52 + i) / 255,
  g: 152 / 255,
  b: 219 / 255,
}));
const NAMED = ['rebeccapurple', 'tomato', 'seagreen', 'goldenrod', 'orchid', 'slateblue', 'firebrick', 'teal'];
const OKLCH_STR = Array.from({ length: R }, (_, i) => `oklch(0.7 0.15 ${210 + i})`);
const MIX_A = mkHex(0xff0000);
const MIX_B = mkHex(0x0000ff);
const FG = mkHex(0x3498db);
const DELTA_B = mkHex(0x2980b9);
// oklch(0.75 0.25 …) is outside P3 but inside Rec2020 — exercises full computation.
const WIDE = Array.from({ length: R }, (_, i) => `oklch(0.75 0.25 ${180 + i})`);

const culoriInGamutP3 = culori.inGamut('p3');
const culoriInGamutRec2020 = culori.inGamut('rec2020');

group('Parse HEX → toHsl', () => {
  bench('colordx', () => colordx(HEX[next()]!).toHsl());
  bench('colord', () => colord(HEX[next()]!).toHsl());
  bench('tinycolor2', () => tinycolor2(HEX[next()]!).toHsl());
  bench('chroma-js', () => chroma(HEX[next()]!).hsl());
  bench('color', () => ColorLib(HEX[next()]!).hsl().object());
  bench('culori', () => culori.hsl(culori.parse(HEX[next()]!)));
});

group('Parse HEX → lighten → toHex', () => {
  bench('colordx', () => colordx(HEX[next()]!).lighten(0.2).toHex());
  bench('colord', () => colord(HEX[next()]!).lighten(0.2).toHex());
  bench('tinycolor2', () => tinycolor2(HEX[next()]!).lighten(20).toHexString());
  bench('chroma-js', () => chroma(HEX[next()]!).brighten(0.5).hex());
  bench('color', () => ColorLib(HEX[next()]!).lighten(0.2).hex());
  bench('culori', () => {
    const h = culori.hsl(culori.parse(HEX[next()]!));
    return culori.formatHex({ ...h, l: Math.min(1, (h?.l ?? 0) + 0.2) } as culori.Color);
  });
});

group('Mix two colors', () => {
  bench('colordx', () => colordx(MIX_A[next()]!).mix(MIX_B[next()]!, 0.5).toHex());
  bench('colord', () => colord(MIX_A[next()]!).mix(MIX_B[next()]!, 0.5).toHex());
  bench('tinycolor2', () => tinycolor2.mix(MIX_A[next()]!, MIX_B[next()]!, 50).toHexString());
  bench('chroma-js', () => chroma.mix(MIX_A[next()]!, MIX_B[next()]!, 0.5).hex());
  bench('color', () => ColorLib(MIX_A[next()]!).mix(ColorLib(MIX_B[next()]!), 0.5).hex());
  bench('culori', () => culori.formatHex(culori.interpolate([MIX_A[next()]!, MIX_B[next()]!])(0.5)));
  bench('@texel/color', () => {
    const a = texelParse(MIX_A[next()]!, TexelSRGB);
    const b = texelParse(MIX_B[next()]!, TexelSRGB);
    return texelSerialize([(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5], TexelSRGB);
  });
});

group('Parse HEX → toOklch', () => {
  bench('colordx', () => colordx(HEX_BLUE[next()]!).toOklch());
  bench('chroma-js', () => chroma(HEX_BLUE[next()]!).oklch());
  bench('color', () => ColorLib(HEX_BLUE[next()]!).oklch().object());
  bench('culori', () => culori.oklch(culori.parse(HEX_BLUE[next()]!)));
  bench('@texel/color', () => texelConvert(texelParse(HEX_BLUE[next()]!, TexelSRGB), TexelSRGB, TexelOKLCH));
});

group('Parse HEX → toHex', () => {
  bench('colordx', () => colordx(HEX_BLUE[next()]!).toHex());
  bench('colord', () => colord(HEX_BLUE[next()]!).toHex());
  bench('tinycolor2', () => tinycolor2(HEX_BLUE[next()]!).toHexString());
  bench('chroma-js', () => chroma(HEX_BLUE[next()]!).hex());
  bench('color', () => ColorLib(HEX_BLUE[next()]!).hex());
  bench('culori', () => culori.formatHex(culori.parse(HEX_BLUE[next()]!)));
  bench('@texel/color', () => texelRGBToHex(texelParse(HEX_BLUE[next()]!, TexelSRGB)));
});

group('Parse rgb() string → toHex', () => {
  bench('colordx', () => colordx(RGB_STR[next()]!).toHex());
  bench('colord', () => colord(RGB_STR[next()]!).toHex());
  bench('tinycolor2', () => tinycolor2(RGB_STR[next()]!).toHexString());
  bench('chroma-js', () => chroma(RGB_STR[next()]!).hex());
  bench('color', () => ColorLib(RGB_STR[next()]!).hex());
  bench('culori', () => culori.formatHex(culori.parse(RGB_STR[next()]!)));
});

group('Parse hsl() string → toHex', () => {
  bench('colordx', () => colordx(HSL_STR[next()]!).toHex());
  bench('colord', () => colord(HSL_STR[next()]!).toHex());
  bench('tinycolor2', () => tinycolor2(HSL_STR[next()]!).toHexString());
  bench('chroma-js', () => chroma(HSL_STR[next()]!).hex());
  bench('color', () => ColorLib(HSL_STR[next()]!).hex());
  bench('culori', () => culori.formatHex(culori.parse(HSL_STR[next()]!)));
});

// culori's native model *is* {mode,r,g,b} with 0–1 channels, so it receives that
// shape and does no parsing or validation. Every other library takes 0–255.
group('Parse RGB object → toHex', () => {
  bench('colordx', () => colordx(RGB_OBJ[next()]!).toHex());
  bench('colord', () => colord(RGB_OBJ[next()]!).toHex());
  bench('tinycolor2', () => tinycolor2(RGB_OBJ[next()]!).toHexString());
  bench('chroma-js', () => {
    const o = RGB_OBJ[next()]!;
    return chroma(o.r, o.g, o.b).hex();
  });
  bench('color', () => ColorLib(RGB_OBJ[next()]!).hex());
  bench('culori', () => culori.formatHex(RGB_OBJ_CULORI[next()]!));
});

group('Parse named color → toHex', () => {
  bench('colordx', () => colordx(NAMED[next()]!).toHex());
  bench('colord', () => colord(NAMED[next()]!).toHex());
  bench('tinycolor2', () => tinycolor2(NAMED[next()]!).toHexString());
  bench('chroma-js', () => chroma(NAMED[next()]!).hex());
  bench('color', () => ColorLib(NAMED[next()]!).hex());
  bench('culori', () => culori.formatHex(culori.parse(NAMED[next()]!)));
});

group('OKLCH string → HEX', () => {
  bench('colordx', () => colordx(OKLCH_STR[next()]!).toHex());
  bench('chroma-js', () => chroma(OKLCH_STR[next()]!).hex());
  bench('culori', () => culori.formatHex(culori.parse(OKLCH_STR[next()]!)));
  bench('@texel/color', () =>
    texelRGBToHex(texelConvert(texelParse(OKLCH_STR[next()]!, TexelOKLCH), TexelOKLCH, TexelSRGB))
  );
});

group('WCAG contrast ratio', () => {
  bench('colordx', () => colordx(FG[next()]!).contrast('#ffffff'));
  bench('colord', () => colord(FG[next()]!).contrast('#ffffff'));
  bench('tinycolor2', () => tinycolor2.readability(FG[next()]!, '#ffffff'));
  bench('chroma-js', () => chroma.contrast(FG[next()]!, '#ffffff'));
  bench('culori', () => culori.wcagContrast(FG[next()]!, '#ffffff'));
});

group('CIEDE2000 delta', () => {
  bench('colordx', () => colordx(FG[next()]!).delta(DELTA_B[next()]!));
  bench('chroma-js', () => chroma.deltaE(FG[next()]!, DELTA_B[next()]!));
  bench('culori', () => culori.differenceCiede2000()(FG[next()]!, DELTA_B[next()]!));
});

group('inGamutP3', () => {
  bench('colordx', () => inGamutP3(WIDE[next()]!));
  bench('culori', () => culoriInGamutP3(culori.parse(WIDE[next()]!)!));
  bench('@texel/color', () =>
    texelIsRGBInGamut(texelConvert(texelParse(WIDE[next()]!, TexelOKLCH), TexelOKLCH, DisplayP3Linear))
  );
});

group('inGamutRec2020', () => {
  bench('colordx', () => inGamutRec2020(WIDE[next()]!));
  bench('culori', () => culoriInGamutRec2020(culori.parse(WIDE[next()]!)!));
  bench('@texel/color', () =>
    texelIsRGBInGamut(texelConvert(texelParse(WIDE[next()]!, TexelOKLCH), TexelOKLCH, Rec2020Linear))
  );
});

group('Gamut map → sRGB', () => {
  bench('colordx', () => Colordx.toGamutSrgb(WIDE[next()]!).toHex());
  bench('culori', () => culori.formatHex(culori.clampChroma(culori.parse(WIDE[next()]!), 'oklch')));
});

await run({ format: 'mitata' });

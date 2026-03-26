import { bench, group, run } from 'mitata';
import { colord, extend as colordExtend } from 'colord';
// @ts-ignore
import colordMixPlugin from 'colord/plugins/mix';
colordExtend([colordMixPlugin]);
import { colordx, inGamutP3, inGamutRec2020 } from '../src/index.js';
// @ts-ignore
import tinycolor2 from 'tinycolor2';
// @ts-ignore
import chroma from 'chroma-js';
// @ts-ignore
import ColorLib from 'color';
import * as culori from 'culori';


group('Parse HEX → toHsl', () => {
  bench('colordx', () => colordx('#808080').toHsl());
  bench('colord', () => colord('#808080').toHsl());
  bench('tinycolor2', () => tinycolor2('#808080').toHsl());
  bench('chroma-js', () => chroma('#808080').hsl());
  bench('color', () => ColorLib('#808080').hsl().object());
  bench('culori', () => culori.hsl(culori.parse('#808080')));
});


group('Parse HEX → lighten → toHex', () => {
  bench('colordx', () => colordx('#808080').lighten(0.2).toHex());
  bench('colord', () => colord('#808080').lighten(0.2).toHex());
  bench('tinycolor2', () => tinycolor2('#808080').lighten(20).toHexString());
  bench('chroma-js', () => chroma('#808080').brighten(0.5).hex());
  bench('color', () => ColorLib('#808080').lighten(0.2).hex());
  bench('culori', () => { const h = culori.hsl(culori.parse('#808080')); return culori.formatHex({ ...h, l: Math.min(1, (h?.l ?? 0) + 0.2) }); });
});


group('Mix two colors', () => {
  bench('colordx', () => colordx('#ff0000').mix('#0000ff', 0.5).toHex());
  bench('colord', () => colord('#ff0000').mix('#0000ff', 0.5).toHex());
  bench('tinycolor2', () => tinycolor2.mix('#ff0000', '#0000ff', 50).toHexString());
  bench('chroma-js', () => chroma.mix('#ff0000', '#0000ff', 0.5).hex());
  bench('color', () => ColorLib('#ff0000').mix(ColorLib('#0000ff'), 0.5).hex());
  bench('culori', () => culori.formatHex(culori.interpolate(['#ff0000', '#0000ff'])(0.5)));
});


group('Parse HEX → toOklch', () => {
  bench('colordx', () => colordx('#3498db').toOklch());
  bench('chroma-js', () => chroma('#3498db').oklch());
  bench('color', () => ColorLib('#3498db').oklch().object());
  bench('culori', () => culori.oklch(culori.parse('#3498db')));
});


// oklch(0.75 0.25 180) is outside P3 but inside Rec2020 — exercises full computation.
const culoriInGamutP3 = culori.inGamut('p3');
const culoriInGamutRec2020 = culori.inGamut('rec2020');
const WIDE_GAMUT = 'oklch(0.75 0.25 180)';

group('inGamutP3', () => {
  bench('colordx', () => inGamutP3(WIDE_GAMUT));
  bench('culori', () => culoriInGamutP3(culori.parse(WIDE_GAMUT)));
});


group('inGamutRec2020', () => {
  bench('colordx', () => inGamutRec2020(WIDE_GAMUT));
  bench('culori', () => culoriInGamutRec2020(culori.parse(WIDE_GAMUT)));
});


await run({ format: 'mitata' });

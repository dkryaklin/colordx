import { parseHex } from './colorModels/hex.js';
import { parseHslBody, parseHslObject, parseHslString } from './colorModels/hsl.js';
import { parseOklabObject, parseOklabString } from './colorModels/oklab.js';
import { parseOklchObject, parseOklchString } from './colorModels/oklch.js';
import { parseRgbBody, parseRgbObject, parseRgbString, parseSrgbColorString } from './colorModels/rgb.js';
import { trimWs } from './helpers.js';
import type { AnyColor, ColorFormat, ColorParser, RgbColor } from './types.js';

const stringFormatParsers: [ColorParser, ColorFormat][] = [
  [parseHex, 'hex'],
  [parseRgbString, 'rgb'],
  [parseSrgbColorString, 'rgb'],
  [parseHslString, 'hsl'],
  [parseOklchString, 'oklch'],
  [parseOklabString, 'oklab'],
];

const objectFormatParsers: [ColorParser, ColorFormat][] = [
  [parseRgbObject, 'rgb'],
  [parseHslObject, 'hsl'],
  [parseOklabObject, 'oklab'],
  [parseOklchObject, 'oklch'],
];

export const parsers: ColorParser[] = [
  parseHex,
  parseRgbString,
  parseSrgbColorString,
  parseHslString,
  parseOklchString,
  parseOklabString,
  parseRgbObject,
  parseHslObject,
  parseOklabObject,
  parseOklchObject,
];
export const pluginFormatParsers: [ColorParser, ColorFormat][] = [];

let _partitionedAt = -1;
let _strPlugins: ColorParser[] = [];
let _objPlugins: ColorParser[] = [];

const repartition = (): void => {
  _strPlugins = [];
  _objPlugins = [];
  for (let i = stringFormatParsers.length + objectFormatParsers.length; i < parsers.length; i++) {
    const p = parsers[i]!;
    const kind = (p as { inputKind?: string }).inputKind;
    if (kind !== 'object') _strPlugins.push(p);
    if (kind !== 'string') _objPlugins.push(p);
  }
  _partitionedAt = parsers.length;
};

const runPlugins = (input: AnyColor, isString: boolean): RgbColor | null => {
  if (_partitionedAt !== parsers.length) repartition();
  const list = isString ? _strPlugins : _objPlugins;
  for (let i = 0; i < list.length; i++) {
    const r = list[i]!(input);
    if (r) return r;
  }
  return null;
};

const isTransparent = (s: string): boolean => trimWs(s).toLowerCase() === 'transparent';
const parseTransparentLoose = (s: string): RgbColor | null =>
  isTransparent(s) ? { r: 0, g: 0, b: 0, alpha: 0 } : null;

const parseString = (input: string): RgbColor | null => {
  const c0 = input.charCodeAt(0);
  const c = c0 | 32;
  let r: RgbColor | null = null;
  if (c === 35) r = parseHex(input);
  else if (c === 114) r = parseRgbString(input);
  else if (c === 99) r = parseSrgbColorString(input);
  else if (c === 104) r = parseHslString(input);
  else if (c === 111) {
    r = (input.charCodeAt(3) | 32) === 99 ? parseOklchString(input) : parseOklabString(input);
  } else if (c0 === 32 || c0 === 9 || c0 === 10 || c0 === 13 || c0 === 12) {
    for (const [p] of stringFormatParsers) {
      const x = p(input);
      if (x) return x;
    }
  }
  return r ?? runPlugins(input, true) ?? parseTransparentLoose(input);
};

const parseObject = (input: AnyColor & object): RgbColor | null => {
  let r: RgbColor | null = null;
  if ('r' in input) r = parseRgbBody(input);
  else if ('l' in input) {
    if ('c' in input) r = parseOklchObject(input);
    else if ('h' in input && 's' in input) r = parseHslBody(input);
    else if ('a' in input) r = parseOklabObject(input);
  }
  return r ?? runPlugins(input, false);
};

export const parse = (input: AnyColor): RgbColor | null => {
  if (typeof input === 'string') {
    if (input === 'transparent') return { r: 0, g: 0, b: 0, alpha: 0 };
    return parseString(input);
  }
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) return parseObject(input);
  return null;
};

/** Input format tag such as `'hex'` or `'oklch'`, or `undefined` when unrecognised. */
export const getFormat = (input: AnyColor): ColorFormat | undefined => {
  if (input === 'transparent') return 'name';
  const typed = typeof input === 'string' ? stringFormatParsers : objectFormatParsers;
  for (const [parser, format] of typed) {
    if (parser(input)) return format;
  }
  for (const [parser, format] of pluginFormatParsers) {
    if (parser(input)) return format;
  }
  return typeof input === 'string' && isTransparent(input) ? 'name' : undefined;
};

/**
 * Drop-in replacement for tinycolor2.
 *
 *   import tinycolor from 'tinycolor2';              // before
 *   import tinycolor from '@colordx/core/tinycolor'; // after
 *
 * Same API, same input quirks, same output strings, colordx math underneath. Instances are
 * mutable exactly like tinycolor2 (`lighten()` changes the instance and returns it).
 * `toColordx()` hands back the immutable Colordx for everything tinycolor2 never had.
 *
 * Results can differ from tinycolor2 by at most 1/255 per channel: tinycolor2 truncates
 * percentages to two decimals when it re-parses HSL between operations, colordx keeps full
 * precision. tinycolor2's `names` map holds shortened hex (`f00`); this one holds full hex (`ff0000`).
 */
import { parseHex, toHexByte } from './colorModels/hex.js';
import { hslToRgb, rgbToHslRaw } from './colorModels/hsl.js';
import { hsvToRgb, rgbToHsvRaw } from './colorModels/hsv.js';
import { Colordx } from './colordx.js';
import { clamp, isObject } from './helpers.js';
import { NAMES } from './plugins/names.js';
import { srgbToLinear } from './transfer.js';
import type { RgbColor } from './types.js';

type Unit = number | string;
export interface RGB {
  r: number;
  g: number;
  b: number;
}
export interface RGBA extends RGB {
  a: number;
}
export interface PRGB {
  r: string;
  g: string;
  b: string;
}
export interface PRGBA extends PRGB {
  a: number;
}
export interface HSL {
  h: number;
  s: number;
  l: number;
}
export interface HSLA extends HSL {
  a: number;
}
export interface HSV {
  h: number;
  s: number;
  v: number;
}
export interface HSVA extends HSV {
  a: number;
}
interface RgbInput {
  r: Unit;
  g: Unit;
  b: Unit;
  a?: Unit;
}
interface HslInput {
  h: Unit;
  s: Unit;
  l: Unit;
  a?: Unit;
}
interface HsvInput {
  h: Unit;
  s: Unit;
  v: Unit;
  a?: Unit;
}
export type ColorInputWithoutInstance = string | RgbInput | HslInput | HsvInput;
export type ColorInput = ColorInputWithoutInstance | TinyColor;
export interface ConstructorOptions {
  format?: string;
  gradientType?: boolean;
}
export interface WCAG2Options {
  level?: 'AA' | 'AAA';
  size?: 'small' | 'large';
}
export interface MostReadableArgs extends WCAG2Options {
  includeFallbackColors?: boolean;
}
export type StringFormat = 'rgb' | 'prgb' | 'hex' | 'hex6' | 'hex3' | 'hex4' | 'hex8' | 'name' | 'hsl' | 'hsv';

// name → 'rrggbb' and the reverse. Later names win on shared hex (cyan over aqua), like tinycolor2.
const names: Record<string, string> = {};
const hexNames: Record<string, string> = {};
for (const name of Object.keys(NAMES).sort()) {
  const hex = NAMES[name]!.slice(1);
  names[name] = hex;
  hexNames[hex] = name;
}
names.burntsienna = 'ea7e5d'; // tinycolor2 extra, not a CSS name
hexNames.ea7e5d = 'burntsienna';

const UNIT_RE = /[-+]?(?:\d*\.\d+|\d+)%?/;
const HEX_RE = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
const FN_RE = /^(rgba?|hsla?|hsva?)[\s(]+([^)]*?)\s*\)?$/;

const isUnit = (v: unknown): v is Unit =>
  typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && UNIT_RE.test(v);

// tinycolor2's bound01 without its two-decimal truncation. Returns [0, max].
const chan = (n: Unit, max: number): number => {
  if (typeof n !== 'string') return clamp(n, 0, max);
  const v = parseFloat(n);
  if (n.includes('%')) return (clamp(v, 0, 100) / 100) * max;
  if (v === 1 && n.includes('.')) return max; // "1.0" means 100%
  return clamp(v, 0, max);
};

// tinycolor2's convertToPercentage: s/l/v at or below 1 are fractions. Returns [0, 100].
const pct = (n: Unit): number => {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  const isPct = typeof n === 'string' && n.includes('%');
  return clamp(!isPct && v <= 1 ? v * 100 : v, 0, 100);
};

// tinycolor2's boundAlpha: anything outside [0, 1] (or unparseable) becomes 1, not clamped.
const boundAlpha = (a: unknown): number => {
  const v = parseFloat(String(a));
  return Number.isNaN(v) || v < 0 || v > 1 ? 1 : v;
};

// tinycolor2's `amount === 0 ? 0 : amount || default`.
const amt = (n: number | undefined, d: number): number => (n === 0 ? 0 : n || d);

interface Parsed {
  rgb: RgbColor;
  ok: boolean;
  format: string | false;
}

const parseInput = (input: unknown): Parsed => {
  const invalid: Parsed = { rgb: { r: 0, g: 0, b: 0, alpha: 1 }, ok: false, format: false };
  let obj: Record<string, unknown>;
  if (typeof input === 'string') {
    let s = input.trim().toLowerCase();
    if (s === 'transparent') return { rgb: { r: 0, g: 0, b: 0, alpha: 0 }, ok: true, format: 'name' };
    const named = names[s] !== undefined;
    if (named) s = names[s]!;
    const hm = HEX_RE.exec(s);
    if (hm) {
      const hex = hm[1]!;
      const rgb = parseHex(`#${hex}`)!;
      // parseHex snaps alpha to 3 decimals; tinycolor2 keeps the raw byte fraction (0x80 → 128/255).
      if (hex.length === 8) rgb.alpha = parseInt(hex.slice(6), 16) / 255;
      else if (hex.length === 4) rgb.alpha = parseInt(hex[3]! + hex[3]!, 16) / 255;
      return { rgb, ok: true, format: named ? 'name' : hex.length % 4 === 0 ? 'hex8' : 'hex' };
    }
    const fm = FN_RE.exec(s);
    if (!fm) return invalid;
    const p = fm[2]!.split(/[\s,/]+/).filter(Boolean);
    if (p.length < 3 || p.length > 4) return invalid;
    const k = fm[1]!.slice(0, 3);
    obj =
      k === 'rgb'
        ? { r: p[0], g: p[1], b: p[2] }
        : k === 'hsl'
          ? { h: p[0], s: p[1], l: p[2] }
          : { h: p[0], s: p[1], v: p[2] };
    if (p[3] !== undefined) obj.a = p[3];
  } else if (isObject(input)) {
    obj = input;
  } else {
    return invalid;
  }

  let rgb: RgbColor;
  let format: string;
  if (isUnit(obj.r) && isUnit(obj.g) && isUnit(obj.b)) {
    rgb = { r: chan(obj.r, 255), g: chan(obj.g, 255), b: chan(obj.b, 255), alpha: 1 };
    format = String(obj.r).endsWith('%') ? 'prgb' : 'rgb';
  } else if (isUnit(obj.h) && isUnit(obj.s) && isUnit(obj.v)) {
    rgb = hsvToRgb({ h: chan(obj.h, 360), s: pct(obj.s), v: pct(obj.v), alpha: 1 });
    format = 'hsv';
  } else if (isUnit(obj.h) && isUnit(obj.s) && isUnit(obj.l)) {
    rgb = hslToRgb({ h: chan(obj.h, 360), s: pct(obj.s), l: pct(obj.l), alpha: 1 });
    format = 'hsl';
  } else {
    return invalid;
  }
  rgb.alpha = boundAlpha(obj.a);
  // tinycolor2 rounds channels below 1 so a fraction is never read as a ratio later.
  if (rgb.r < 1) rgb.r = Math.round(rgb.r);
  if (rgb.g < 1) rgb.g = Math.round(rgb.g);
  if (rgb.b < 1) rgb.b = Math.round(rgb.b);
  return { rgb, ok: true, format: typeof obj.format === 'string' ? obj.format : format };
};

const argbHex = (c: TinyColor): string => {
  const { r, g, b, a } = c.toRgb();
  return `#${toHexByte(a * 255)}${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
};

class TinyColor {
  private _c: Colordx;
  private _a: number; // raw alpha, unrounded like tinycolor2 (Colordx snaps to 3 decimals)
  private readonly _ok: boolean;
  private readonly _format: string | false;
  private readonly _originalInput: ColorInput;
  private readonly _gradientType: boolean | undefined;

  constructor(color: ColorInput = '', opts: ConstructorOptions = {}) {
    if (color instanceof TinyColor) {
      this._c = color._c;
      this._a = color._a;
      this._ok = color._ok;
      this._format = color._format;
      this._originalInput = color._originalInput;
      this._gradientType = color._gradientType;
      return;
    }
    const p = parseInput(color);
    this._c = new Colordx(p.rgb);
    this._a = p.rgb.alpha;
    this._ok = p.ok;
    this._format = opts.format || p.format;
    this._originalInput = color;
    this._gradientType = opts.gradientType;
  }

  /** The immutable Colordx behind this instance — the door to oklch, gamut mapping and plugins. */
  toColordx(): Colordx {
    return this._c.alpha(this._a);
  }

  isValid(): boolean {
    return this._ok;
  }
  isDark(): boolean {
    return this.getBrightness() < 128;
  }
  isLight(): boolean {
    return !this.isDark();
  }
  getOriginalInput(): ColorInput {
    return this._originalInput;
  }
  getFormat(): string {
    return this._format as string;
  }
  getAlpha(): number {
    return this._a;
  }
  /** 0–255 */
  getBrightness(): number {
    const { r, g, b } = this.toRgb();
    return (r * 299 + g * 587 + b * 114) / 1000;
  }
  /** 0–1 */
  getLuminance(): number {
    const { r, g, b } = this.toRgb();
    return 0.2126 * srgbToLinear(r / 255) + 0.7152 * srgbToLinear(g / 255) + 0.0722 * srgbToLinear(b / 255);
  }
  setAlpha(value: unknown): this {
    this._a = boundAlpha(value);
    return this;
  }

  // Alpha as tinycolor2 prints it in strings.
  private get _a2(): number {
    return Math.round(this._a * 100) / 100;
  }

  toRgb(): RGBA {
    const { r, g, b } = this._c.toRgb();
    return { r, g, b, a: this._a };
  }
  toRgbString(): string {
    const { r, g, b, a } = this.toRgb();
    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${this._a2})`;
  }
  toPercentageRgb(): PRGBA {
    const { r, g, b } = this._c._rawRgb();
    const p = (n: number): string => `${Math.round((n / 255) * 100)}%`;
    return { r: p(r), g: p(g), b: p(b), a: this._a };
  }
  toPercentageRgbString(): string {
    const { r, g, b, a } = this.toPercentageRgb();
    return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${this._a2})`;
  }

  /** h in [0, 360), s and l as fractions in [0, 1]. */
  toHsl(): HSLA {
    const { h, s, l } = rgbToHslRaw(this._c._rawRgb());
    return { h, s: s / 100, l: l / 100, a: this._a };
  }
  toHslString(): string {
    const { h, s, l, a } = this.toHsl();
    const H = Math.round(h),
      S = Math.round(s * 100),
      L = Math.round(l * 100);
    return a === 1 ? `hsl(${H}, ${S}%, ${L}%)` : `hsla(${H}, ${S}%, ${L}%, ${this._a2})`;
  }
  /** h in [0, 360), s and v as fractions in [0, 1]. */
  toHsv(): HSVA {
    const { h, s, v } = rgbToHsvRaw(this._c._rawRgb());
    return { h, s: s / 100, v: v / 100, a: this._a };
  }
  toHsvString(): string {
    const { h, s, v, a } = this.toHsv();
    const H = Math.round(h),
      S = Math.round(s * 100),
      V = Math.round(v * 100);
    return a === 1 ? `hsv(${H}, ${S}%, ${V}%)` : `hsva(${H}, ${S}%, ${V}%, ${this._a2})`;
  }

  /** `rrggbb` without `#`. Alpha is ignored. */
  toHex(allow3Char?: boolean): string {
    const { r, g, b } = this.toRgb();
    const hex = toHexByte(r) + toHexByte(g) + toHexByte(b);
    return allow3Char && hex[0] === hex[1] && hex[2] === hex[3] && hex[4] === hex[5]
      ? hex[0]! + hex[2]! + hex[4]!
      : hex;
  }
  toHexString(allow3Char?: boolean): string {
    return `#${this.toHex(allow3Char)}`;
  }
  /** `rrggbbaa` without `#`. */
  toHex8(allow4Char?: boolean): string {
    const { a } = this.toRgb();
    const hex = this.toHex() + toHexByte(a * 255);
    return allow4Char && hex[0] === hex[1] && hex[2] === hex[3] && hex[4] === hex[5] && hex[6] === hex[7]
      ? hex[0]! + hex[2]! + hex[4]! + hex[6]!
      : hex;
  }
  toHex8String(allow4Char?: boolean): string {
    return `#${this.toHex8(allow4Char)}`;
  }

  toName(): string | false {
    const a = this._a;
    if (a === 0) return 'transparent';
    if (a < 1) return false;
    return hexNames[this.toHex()] ?? false;
  }

  toFilter(secondColor?: ColorInput): string {
    const first = argbHex(this);
    const second = secondColor ? argbHex(tinycolor(secondColor)) : first;
    const gradient = this._gradientType ? 'GradientType = 1, ' : '';
    return `progid:DXImageTransform.Microsoft.gradient(${gradient}startColorstr=${first},endColorstr=${second})`;
  }

  toString(format?: StringFormat): string {
    const formatSet = !!format;
    const f = format || this._format;
    const a = this._a;
    const hexLike = f === 'hex' || f === 'hex6' || f === 'hex3' || f === 'hex4' || f === 'hex8' || f === 'name';
    if (!formatSet && a < 1 && hexLike) {
      // Alpha does not fit these formats: tinycolor2 falls back to rgba(), except for `transparent`.
      if (f === 'name' && a === 0) return 'transparent';
      return this.toRgbString();
    }
    switch (f) {
      case 'rgb':
        return this.toRgbString();
      case 'prgb':
        return this.toPercentageRgbString();
      case 'hex':
      case 'hex6':
        return this.toHexString();
      case 'hex3':
        return this.toHexString(true);
      case 'hex4':
        return this.toHex8String(true);
      case 'hex8':
        return this.toHex8String();
      case 'name':
        return this.toName() || this.toHexString();
      case 'hsl':
        return this.toHslString();
      case 'hsv':
        return this.toHsvString();
      default:
        return this.toHexString();
    }
  }

  /** Re-parses `toString()`, exactly like tinycolor2 — so it goes through string precision. */
  clone(): TinyColor {
    return new TinyColor(this.toString());
  }

  // Mutators: change this instance and return it, like tinycolor2. Amounts are 0–100.
  private _set(c: Colordx): this {
    this._c = c;
    return this;
  }
  lighten(amount?: number): this {
    return this._set(this._c.lighten(amt(amount, 10) / 100));
  }
  darken(amount?: number): this {
    return this._set(this._c.darken(amt(amount, 10) / 100));
  }
  saturate(amount?: number): this {
    return this._set(this._c.saturate(amt(amount, 10) / 100));
  }
  desaturate(amount?: number): this {
    return this._set(this._c.desaturate(amt(amount, 10) / 100));
  }
  greyscale(): this {
    return this._set(this._c.grayscale());
  }
  /** Adds `amount`% of 255 to each RGB channel. */
  brighten(amount?: number): this {
    const d = -Math.round(255 * -(amt(amount, 10) / 100)); // tinycolor2's exact rounding, .5 included
    const { r, g, b, a } = this.toRgb();
    return this._set(
      new Colordx({ r: clamp(r + d, 0, 255), g: clamp(g + d, 0, 255), b: clamp(b + d, 0, 255), alpha: a })
    );
  }
  spin(amount: number): this {
    return this._set(this._c.rotate(amount));
  }

  // Combinations: new instances built from HSL/HSV objects, like tinycolor2. Where tinycolor2
  // builds from `{ h, s, l }` without `a`, alpha is dropped here too.
  complement(): TinyColor {
    const { h, s, l, a } = this.toHsl();
    return new TinyColor({ h: (h + 180) % 360, s, l, a });
  }
  private _polyad(n: number): TinyColor[] {
    const { h, s, l } = this.toHsl();
    const out: TinyColor[] = [this];
    const step = 360 / n;
    for (let i = 1; i < n; i++) out.push(new TinyColor({ h: (h + i * step) % 360, s, l }));
    return out;
  }
  triad(): [TinyColor, TinyColor, TinyColor] {
    return this._polyad(3) as [TinyColor, TinyColor, TinyColor];
  }
  tetrad(): [TinyColor, TinyColor, TinyColor, TinyColor] {
    return this._polyad(4) as [TinyColor, TinyColor, TinyColor, TinyColor];
  }
  splitcomplement(): [TinyColor, TinyColor, TinyColor] {
    const { h, s, l } = this.toHsl();
    return [this, new TinyColor({ h: (h + 72) % 360, s, l }), new TinyColor({ h: (h + 216) % 360, s, l })];
  }
  analogous(results?: number, slices?: number): TinyColor[] {
    let n = results || 6;
    const part = 360 / (slices || 30);
    const hsl = this.toHsl();
    const out: TinyColor[] = [this];
    for (hsl.h = (hsl.h - ((part * n) >> 1) + 720) % 360; --n; ) {
      hsl.h = (hsl.h + part) % 360;
      out.push(new TinyColor({ ...hsl }));
    }
    return out;
  }
  monochromatic(results?: number): TinyColor[] {
    let n = results || 6;
    const { h, s } = this.toHsv();
    let { v } = this.toHsv();
    const out: TinyColor[] = [];
    const step = 1 / n;
    while (n--) {
      out.push(new TinyColor({ h, s, v }));
      v = (v + step) % 1;
    }
    return out;
  }
}

/** Creates a TinyColor. An existing instance is returned as-is, like tinycolor2. */
function tinycolor(color?: ColorInput, opts?: ConstructorOptions): TinyColor {
  return color instanceof TinyColor ? color : new TinyColor(color, opts);
}

/* eslint-disable @typescript-eslint/no-namespace -- type aliases so `tinycolor.Instance` keeps working */
declare namespace tinycolor {
  export type Instance = TinyColor;
  export type { ColorInput, ColorInputWithoutInstance, ConstructorOptions, WCAG2Options, MostReadableArgs };
  export namespace ColorFormats {
    export type { RGB, RGBA, PRGB, PRGBA, HSL, HSLA, HSV, HSVA };
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

/** Treats every value at or below 1 as a fraction of its range. */
tinycolor.fromRatio = (color?: ColorInputWithoutInstance, opts?: ConstructorOptions): TinyColor => {
  if (!isObject(color)) return tinycolor(color, opts);
  const scaled: Record<string, unknown> = {};
  for (const k of Object.keys(color)) {
    const v = color[k];
    const n = Number(v); // "50%" → NaN → kept as-is, like tinycolor2
    scaled[k] = k !== 'a' && n <= 1 ? `${n * 100}%` : v;
  }
  return tinycolor(scaled as unknown as ColorInputWithoutInstance, opts);
};

tinycolor.equals = (color1?: ColorInput, color2?: ColorInput): boolean =>
  !!color1 && !!color2 && tinycolor(color1).toRgbString() === tinycolor(color2).toRgbString();

tinycolor.random = (): TinyColor => tinycolor.fromRatio({ r: Math.random(), g: Math.random(), b: Math.random() });

/** `amount` is 0–100, default 50. */
tinycolor.mix = (color1: ColorInput, color2: ColorInput, amount?: number): TinyColor => {
  const p = amt(amount, 50) / 100;
  const a = tinycolor(color1).toRgb();
  const b = tinycolor(color2).toRgb();
  return tinycolor({
    r: (b.r - a.r) * p + a.r,
    g: (b.g - a.g) * p + a.g,
    b: (b.b - a.b) * p + a.b,
    a: (b.a - a.a) * p + a.a,
  });
};

/** WCAG 2 contrast ratio, 1–21. */
tinycolor.readability = (color1: ColorInput, color2: ColorInput): number => {
  const l1 = tinycolor(color1).getLuminance();
  const l2 = tinycolor(color2).getLuminance();
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

tinycolor.isReadable = (color1: ColorInput, color2: ColorInput, wcag2?: WCAG2Options): boolean => {
  const ratio = tinycolor.readability(color1, color2);
  const level = String(wcag2?.level || 'AA').toUpperCase();
  const size = String(wcag2?.size || 'small').toLowerCase();
  if (level === 'AAA' && size !== 'large') return ratio >= 7;
  if (level !== 'AAA' && size === 'large') return ratio >= 3;
  return ratio >= 4.5;
};

tinycolor.mostReadable = (baseColor: ColorInput, colorList: ColorInput[], args: MostReadableArgs = {}): TinyColor => {
  let best: TinyColor | null = null;
  let bestScore = 0;
  for (const c of colorList) {
    const score = tinycolor.readability(baseColor, c);
    if (score > bestScore) {
      bestScore = score;
      best = tinycolor(c);
    }
  }
  const chosen = best ?? tinycolor();
  if (!args.includeFallbackColors || tinycolor.isReadable(baseColor, chosen, args)) return chosen;
  return tinycolor.mostReadable(baseColor, ['#fff', '#000'], { ...args, includeFallbackColors: false });
};

/** name → `rrggbb` */
tinycolor.names = names;
/** `rrggbb` → name */
tinycolor.hexNames = hexNames;

// Default export only, so the CJS build is `module.exports = tinycolor` and `require()` returns the
// function, like tinycolor2. The class is reachable as a type (`tinycolor.Instance`).
export type { TinyColor };
export default tinycolor;

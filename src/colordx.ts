import { rgbToHex } from './colorModels/hex.js';
import { hslToRgb, rgbToHslRaw } from './colorModels/hsl.js';
import { rgbToHsv } from './colorModels/hsv.js';
import { rgbToHwb } from './colorModels/hwb.js';
import { rgbToOklab } from './colorModels/oklab.js';
import { oklchToRgb, rgbToOklch } from './colorModels/oklch.js';
import { clamp, round } from './helpers.js';
import { parse, parsers } from './parse.js';
import type { AnyColor, ColorParser, HslColor, HsvColor, HwbColor, OklabColor, OklchColor, RgbColor } from './types.js';

export class Colordx {
  private readonly _rgb: RgbColor;
  private readonly _valid: boolean;

  constructor(input: AnyColor) {
    const parsed = parse(input);
    this._valid = parsed !== null;
    this._rgb = parsed ?? { r: 0, g: 0, b: 0, a: 1 };
  }

  isValid(): boolean {
    return this._valid;
  }

  // Converters
  toRgb(): RgbColor {
    const { r, g, b, a } = this._rgb;
    return { r: round(r), g: round(g), b: round(b), a };
  }

  toRgbString(): string {
    const { r, g, b, a } = this._rgb;
    const ri = round(r),
      gi = round(g),
      bi = round(b);
    return a < 1 ? `rgba(${ri}, ${gi}, ${bi}, ${a})` : `rgb(${ri}, ${gi}, ${bi})`;
  }

  toHex(): string {
    return rgbToHex(this._rgb);
  }

  toNumber(): number {
    const { r, g, b } = this._rgb;
    return (round(r) << 16) | (round(g) << 8) | round(b);
  }

  toHsl(precision = 2): HslColor {
    const { h, s, l, a } = rgbToHslRaw(this._rgb);
    return { h: round(h, precision), s: round(s, precision), l: round(l, precision), a };
  }

  toHslString(precision = 2): string {
    const { h, s, l, a } = this.toHsl(precision);
    return a < 1 ? `hsla(${h}, ${s}%, ${l}%, ${a})` : `hsl(${h}, ${s}%, ${l}%)`;
  }

  toHsv(): HsvColor {
    return rgbToHsv(this._rgb);
  }

  toHsvString(): string {
    const { h, s, v, a } = this.toHsv();
    return a < 1 ? `hsva(${h}, ${s}%, ${v}%, ${a})` : `hsv(${h}, ${s}%, ${v}%)`;
  }

  toHwb(precision = 0): HwbColor {
    const { h, w, b, a } = rgbToHwb(this._rgb);
    return { h: round(h, precision), w: round(w, precision), b: round(b, precision), a: round(a, 3) };
  }

  toHwbString(precision = 0): string {
    const { h, w, b, a } = this.toHwb(precision);
    return a < 1 ? `hwb(${h} ${w}% ${b}% / ${a})` : `hwb(${h} ${w}% ${b}%)`;
  }

  toOklab(): OklabColor {
    return rgbToOklab(this._rgb);
  }

  toOklabString(): string {
    const { l, a, b, alpha } = this.toOklab();
    const L = round(l, 4);
    const A = round(a, 4);
    const B = round(b, 4);
    return alpha < 1 ? `oklab(${L} ${A} ${B} / ${alpha})` : `oklab(${L} ${A} ${B})`;
  }

  toOklch(): OklchColor {
    return rgbToOklch(this._rgb);
  }

  toOklchString(): string {
    const { l, c, h, a } = this.toOklch();
    const L = round(l, 4);
    const C = round(c, 4);
    const H = round(h, 2);
    return a < 1 ? `oklch(${L} ${C} ${H} / ${a})` : `oklch(${L} ${C} ${H})`;
  }

  // Getters
  brightness(): number {
    const { r, g, b } = this._rgb;
    return round((r * 299 + g * 587 + b * 114) / 255000, 2);
  }

  luminance(): number {
    const toLinear = (c: number) => {
      const n = c / 255;
      return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    };
    const { r, g, b } = this._rgb;
    return round(0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b), 4);
  }

  isDark(): boolean {
    return this.brightness() < 0.5;
  }

  isLight(): boolean {
    return this.brightness() >= 0.5;
  }

  alpha(): number;
  alpha(value: number): Colordx;
  alpha(value?: number): number | Colordx {
    if (value === undefined) return this._rgb.a;
    return new Colordx({ ...this._rgb, a: clamp(value, 0, 1) });
  }

  hue(): number;
  hue(value: number): Colordx;
  hue(value?: number): number | Colordx {
    const hsl = this.toHsl();
    if (value === undefined) return hsl.h;
    return new Colordx(hslToRgb({ ...hsl, h: value }));
  }

  lightness(): number;
  lightness(value: number): Colordx;
  lightness(value?: number): number | Colordx {
    const oklch = this.toOklch();
    if (value === undefined) return oklch.l;
    return new Colordx(oklchToRgb({ ...oklch, l: clamp(value, 0, 1) }));
  }

  chroma(): number;
  chroma(value: number): Colordx;
  chroma(value?: number): number | Colordx {
    const oklch = this.toOklch();
    if (value === undefined) return oklch.c;
    return new Colordx(oklchToRgb({ ...oklch, c: clamp(value, 0, 0.4) }));
  }

  // Manipulators
  lighten(amount = 0.1, options: { relative?: boolean } = {}): Colordx {
    const hsl = this.toHsl();
    const l = options.relative ? hsl.l * (1 + amount) : hsl.l + amount * 100;
    return new Colordx(hslToRgb({ ...hsl, l: clamp(l, 0, 100) }));
  }

  darken(amount = 0.1, options: { relative?: boolean } = {}): Colordx {
    return this.lighten(-amount, options);
  }

  saturate(amount = 0.1, options: { relative?: boolean } = {}): Colordx {
    const hsl = this.toHsl();
    const s = options.relative ? hsl.s * (1 + amount) : hsl.s + amount * 100;
    return new Colordx(hslToRgb({ ...hsl, s: clamp(s, 0, 100) }));
  }

  desaturate(amount = 0.1, options: { relative?: boolean } = {}): Colordx {
    return this.saturate(-amount, options);
  }

  grayscale(): Colordx {
    return this.desaturate(1);
  }

  invert(): Colordx {
    const { r, g, b, a } = this._rgb;
    return new Colordx({ r: 255 - r, g: 255 - g, b: 255 - b, a });
  }

  rotate(amount = 15): Colordx {
    return this.hue(this.hue() + amount);
  }

  mix(color: AnyColor, ratio = 0.5): Colordx {
    const other = new Colordx(color).toRgb();
    const self = this._rgb;
    const w = clamp(ratio, 0, 1);
    return new Colordx({
      r: round(self.r * (1 - w) + other.r * w),
      g: round(self.g * (1 - w) + other.g * w),
      b: round(self.b * (1 - w) + other.b * w),
      a: round(self.a * (1 - w) + other.a * w, 3),
    });
  }

  contrast(color: AnyColor = '#fff'): number {
    const bg = new Colordx(color);
    const bgRgb = bg._rgb;
    const fgRgb = this._rgb;
    // Composite semi-transparent foreground over the background before measuring contrast.
    // A fully-transparent color has zero contrast with any background, not the contrast of its base color.
    const effectiveFg =
      fgRgb.a < 1
        ? new Colordx({
            r: round(fgRgb.a * fgRgb.r + (1 - fgRgb.a) * bgRgb.r),
            g: round(fgRgb.a * fgRgb.g + (1 - fgRgb.a) * bgRgb.g),
            b: round(fgRgb.a * fgRgb.b + (1 - fgRgb.a) * bgRgb.b),
            a: 1,
          })
        : this;
    const l1 = effectiveFg.luminance();
    const l2 = bg.luminance();
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return round((lighter + 0.05) / (darker + 0.05), 2);
  }

  isEqual(color: AnyColor): boolean {
    const other = new Colordx(color).toRgb();
    const self = this.toRgb();
    return self.r === other.r && self.g === other.g && self.b === other.b && self.a === other.a;
  }

  toString(): string {
    return this.toHex();
  }
}

export type Plugin = (ColordxClass: typeof Colordx, parsers: ColorParser[]) => void;

export const colordx = (input: AnyColor): Colordx => new Colordx(input);

export const extend = (plugins: Plugin[]): void => {
  plugins.forEach((plugin) => plugin(Colordx, parsers));
};

export const nearest = <T extends AnyColor>(color: AnyColor, candidates: T[]): T => {
  const { l: l1, a: a1, b: b1 } = new Colordx(color).toOklab();
  let minDist = Infinity;
  let result = candidates[0] as T;
  for (const candidate of candidates) {
    const { l: l2, a: a2, b: b2 } = new Colordx(candidate).toOklab();
    const dist = (l2 - l1) ** 2 + (a2 - a1) ** 2 + (b2 - b1) ** 2;
    if (dist < minDist) {
      minDist = dist;
      result = candidate;
    }
  }
  return result;
};

export const random = (): Colordx =>
  new Colordx({
    r: Math.round(Math.random() * 255),
    g: Math.round(Math.random() * 255),
    b: Math.round(Math.random() * 255),
    a: 1,
  });

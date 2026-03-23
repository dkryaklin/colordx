import { rgbToHex } from './colorModels/hex.js';
import { hslToRgb, rgbToHslRaw } from './colorModels/hsl.js';
import { rgbToHsv } from './colorModels/hsv.js';
import { rgbToHwb } from './colorModels/hwb.js';
import { rgbToOklab } from './colorModels/oklab.js';
import { rgbToOklch } from './colorModels/oklch.js';
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
    return { ...this._rgb };
  }

  toRgbString(): string {
    const { r, g, b, a } = this._rgb;
    return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
  }

  toHex(): string {
    return rgbToHex(this._rgb);
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

  // Manipulators
  lighten(amount = 0.1): Colordx {
    const hsl = this.toHsl();
    return new Colordx(hslToRgb({ ...hsl, l: clamp(hsl.l + amount * 100, 0, 100) }));
  }

  darken(amount = 0.1): Colordx {
    return this.lighten(-amount);
  }

  saturate(amount = 0.1): Colordx {
    const hsl = this.toHsl();
    return new Colordx(hslToRgb({ ...hsl, s: clamp(hsl.s + amount * 100, 0, 100) }));
  }

  desaturate(amount = 0.1): Colordx {
    return this.saturate(-amount);
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
      a: round(self.a * (1 - w) + other.a * w, 2),
    });
  }

  contrast(color: AnyColor = '#fff'): number {
    const l1 = this.luminance();
    const l2 = new Colordx(color).luminance();
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return round((lighter + 0.05) / (darker + 0.05), 2);
  }

  isEqual(color: AnyColor): boolean {
    const other = new Colordx(color).toRgb();
    const self = this._rgb;
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

export const random = (): Colordx =>
  new Colordx({
    r: Math.round(Math.random() * 255),
    g: Math.round(Math.random() * 255),
    b: Math.round(Math.random() * 255),
    a: 1,
  });

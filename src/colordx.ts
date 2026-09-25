import { rgbToHex, rgbToHex8 } from './colorModels/hex.js';
import { hslToRgb, rgbToHslRaw } from './colorModels/hsl.js';
import { linearSrgbToOklab, rgbToOklab } from './colorModels/oklab.js';
import { OKLCH_ACHROMATIC, oklchToRgb, rgbToOklch } from './colorModels/oklch.js';
import { toGamutSrgbRaw } from './gamut.js';
import { clamp, fixedNotation, invalidColorError, round, round3, toByte } from './helpers.js';
import { parse, parsers, pluginFormatParsers } from './parse.js';
import { byteToLinear, srgbFromLinear } from './transfer.js';
import type { AnyColor, ColorFormat, ColorParser, HslColor, OklabColor, OklchColor, RgbColor } from './types.js';

const _SENTINEL: unique symbol = Symbol();

/** Immutable color value. Manipulation methods return a new `Colordx`. */
export class Colordx {
  private readonly _rgb: RgbColor;
  private readonly _valid: boolean;

  constructor(input: AnyColor | Colordx | typeof _SENTINEL, _direct?: RgbColor) {
    if (input === _SENTINEL) {
      this._valid = true;
      this._rgb = _direct!;
    } else if (input instanceof Colordx) {
      this._valid = input._valid;
      this._rgb = input._rgb;
      return;
    } else {
      const parsed = parse(input);
      this._valid = parsed !== null;
      this._rgb = parsed ?? { r: 0, g: 0, b: 0, alpha: 1 };
    }
    this._rgb.alpha = round3(this._rgb.alpha);
  }

  private static _make(rgb: RgbColor): Colordx {
    return new Colordx(_SENTINEL, rgb);
  }

  static _makeFromStoredRgb(rgb: RgbColor): Colordx {
    return Colordx._make(rgb);
  }

  static _makeFromLinearSrgb(lr: number, lg: number, lb: number, alpha: number, snap = true): Colordx {
    const rb = srgbFromLinear(lr) * 255;
    const gb = srgbFromLinear(lg) * 255;
    const bb = srgbFromLinear(lb) * 255;
    if (!snap) return Colordx._make({ r: rb, g: gb, b: bb, alpha });
    return Colordx._make({
      r: rb >= 0 && rb < 0.5 ? 0 : rb > 254.5 && rb <= 255 ? 255 : rb,
      g: gb >= 0 && gb < 0.5 ? 0 : gb > 254.5 && gb <= 255 ? 255 : gb,
      b: bb >= 0 && bb < 0.5 ? 0 : bb > 254.5 && bb <= 255 ? 255 : bb,
      alpha,
    });
  }

  /** True when the input parsed as a recognised color. */
  isValid(): boolean {
    return this._valid;
  }

  /** sRGB channels in [0, 255] and alpha in [0, 1], rounded to integers or to `precision` decimals. */
  toRgb(precision?: number): RgbColor {
    if (precision === undefined) {
      const { r, g, b, alpha } = this._rgb;
      return { r: toByte(r), g: toByte(g), b: toByte(b), alpha };
    }
    const { r, g, b, alpha } = this._srgbRgb();
    return { r: round(r, precision), g: round(g, precision), b: round(b, precision), alpha };
  }

  _rawRgb(): RgbColor {
    return this._rgb;
  }

  _srgbRgb(): RgbColor {
    const rgb = this._rgb;
    const { r, g, b } = rgb;
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) return rgb;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), alpha: rgb.alpha };
  }

  /** CSS `rgb()` string in modern syntax. `{ legacy: true }` gives comma syntax, `rgba()` when alpha < 1. */
  toRgbString(options?: { legacy?: boolean }): string {
    const { r, g, b, alpha } = this._rgb;
    const ri = toByte(r),
      gi = toByte(g),
      bi = toByte(b);
    if (options?.legacy) {
      return alpha < 1 ? `rgba(${ri}, ${gi}, ${bi}, ${alpha})` : `rgb(${ri}, ${gi}, ${bi})`;
    }
    return alpha < 1 ? `rgb(${ri} ${gi} ${bi} / ${alpha})` : `rgb(${ri} ${gi} ${bi})`;
  }

  /** Returns `#rrggbb` (or `#rrggbbaa` when alpha < 1). */
  toHex(): string {
    return rgbToHex(this._rgb);
  }

  /** Always returns an 8-digit `#rrggbbaa`, even when alpha is 1. */
  toHex8(): string {
    return rgbToHex8(this._rgb);
  }

  /** Returns a 24-bit RGB integer (0x000000–0xFFFFFF). Alpha is not included. */
  toNumber(): number {
    const { r, g, b } = this._rgb;
    return (toByte(r) << 16) | (toByte(g) << 8) | toByte(b);
  }

  /** 32-bit unsigned `0xrrggbbaa` integer, alpha included as a byte. */
  toNumber32(): number {
    const { r, g, b, alpha } = this._rgb;
    return ((toByte(r) << 24) | (toByte(g) << 16) | (toByte(b) << 8) | toByte(alpha * 255)) >>> 0;
  }

  /** Returns HSL channels: h in [0, 360), s/l in [0, 100], rounded to `precision` decimals. */
  toHsl(precision = 2): HslColor {
    const { h, s, l, alpha } = rgbToHslRaw(this._rgb);
    const hr = round(h, precision);
    return { h: hr >= 360 ? 0 : hr, s: round(s, precision), l: round(l, precision), alpha };
  }

  /** Formats as a CSS `hsl()` string. */
  toHslString(precision = 2): string {
    const { h, s, l, alpha } = this.toHsl(precision);
    return fixedNotation(alpha < 1 ? `hsl(${h} ${s}% ${l}% / ${alpha})` : `hsl(${h} ${s}% ${l}%)`, precision);
  }

  /** Returns OKLab channels: L in [0, 1], a/b roughly in [-0.4, 0.4]. */
  toOklab(precision = 5): OklabColor {
    const { l, a, b, alpha } = rgbToOklab(this._rgb);
    return { l: round(l, precision), a: round(a, precision), b: round(b, precision), alpha };
  }

  /** Formats as a CSS `oklab()` string. */
  toOklabString(precision = 5): string {
    const { l, a, b, alpha } = this.toOklab(precision);
    return fixedNotation(alpha < 1 ? `oklab(${l} ${a} ${b} / ${alpha})` : `oklab(${l} ${a} ${b})`, precision);
  }

  /** Returns OKLCh channels: L in [0, 1], C in [0, ~0.4], H in degrees. */
  toOklch(precision = 5): OklchColor {
    const { l, c, h, alpha } = rgbToOklch(this._rgb);
    const hr = round(h, precision);
    return { l: round(l, precision), c: round(c, precision), h: hr >= 360 ? 0 : hr, alpha };
  }

  /** Formats as a CSS `oklch()` string. Hue is `none` for achromatic colors. */
  toOklchString(precision = 5): string {
    const { l, c, h, alpha } = rgbToOklch(this._rgb);
    const hr = round(h, precision);
    const H = c < OKLCH_ACHROMATIC ? 'none' : hr >= 360 ? 0 : hr;
    const L = round(l, precision),
      C = round(c, precision);
    return fixedNotation(alpha < 1 ? `oklch(${L} ${C} ${H} / ${alpha})` : `oklch(${L} ${C} ${H})`, precision);
  }

  /** Perceived brightness in [0, 1] using the ITU-R BT.601 weights, on the sRGB-clipped color. */
  brightness(): number {
    const { r, g, b } = this._srgbRgb();
    return round((r * 299 + g * 587 + b * 114) / 255000, 2);
  }

  /** True when `brightness()` is below 0.5. */
  isDark(): boolean {
    return this.brightness() < 0.5;
  }

  /** True when `brightness()` is at or above 0.5. */
  isLight(): boolean {
    return this.brightness() >= 0.5;
  }

  /** Get or set the alpha channel (clamped to [0, 1]). Setter returns a new `Colordx`. */
  alpha(): number;
  alpha(value: number): Colordx;
  alpha(value?: number): number | Colordx {
    if (value === undefined) return this._rgb.alpha;
    return Colordx._make({ ...this._rgb, alpha: round(clamp(value, 0, 1), 3) });
  }

  /** Get or set the HSL hue in degrees. Setter returns a new `Colordx`. */
  hue(): number;
  hue(value: number): Colordx;
  hue(value?: number): number | Colordx {
    const { h, s, l, alpha } = rgbToHslRaw(this._rgb);
    if (value === undefined) {
      const hr = round(h, 2);
      return hr >= 360 ? 0 : hr;
    }
    return Colordx._make(hslToRgb({ h: value, s, l, alpha }));
  }

  /** Composites this color over `background` in gamma sRGB, as browsers do. Throws a RangeError on an invalid color. */
  over(background: AnyColor | Colordx): Colordx {
    if (!this._valid) throw invalidColorError('over', this, true);
    const back = new Colordx(background);
    if (!back._valid) throw invalidColorError('over', background);
    const fg = this._rgb;
    if (fg.alpha === 1) return this;
    const bg = back._rgb;
    const alpha = fg.alpha + bg.alpha * (1 - fg.alpha);
    if (alpha === 0) return Colordx._make({ r: 0, g: 0, b: 0, alpha: 0 });
    const w = fg.alpha / alpha;
    return Colordx._make({
      r: fg.r * w + bg.r * (1 - w),
      g: fg.g * w + bg.g * (1 - w),
      b: fg.b * w + bg.b * (1 - w),
      alpha,
    });
  }

  /** Get or set the OKLCh lightness in [0, 1]. Setter returns a new `Colordx`. */
  lightness(): number;
  lightness(value: number): Colordx;
  lightness(value?: number): number | Colordx {
    const oklch = this.toOklch();
    if (value === undefined) return oklch.l;
    return Colordx._make(oklchToRgb({ ...oklch, l: clamp(value, 0, 1) }));
  }

  /** Get or set the OKLCh chroma in [0, 0.4]. Setter returns a new `Colordx`. */
  chroma(): number;
  chroma(value: number): Colordx;
  chroma(value?: number): number | Colordx {
    const oklch = this.toOklch();
    if (value === undefined) return oklch.c;
    return Colordx._make(oklchToRgb({ ...oklch, c: clamp(value, 0, 0.4) }));
  }

  /** Adds `amount * 100` to HSL lightness, or multiplies it by `1 + amount` with `{ relative: true }`. */
  lighten(amount = 0.1, options?: { relative?: boolean }): Colordx {
    const { h, s, l, alpha } = rgbToHslRaw(this._rgb);
    const newL = options?.relative ? l * (1 + amount) : l + amount * 100;
    return Colordx._make(hslToRgb({ h, s, l: clamp(newL, 0, 100), alpha }));
  }

  /** Inverse of `lighten`. */
  darken(amount = 0.1, options?: { relative?: boolean }): Colordx {
    return this.lighten(-amount, options);
  }

  /** Adds `amount * 100` to HSL saturation, or multiplies it by `1 + amount` with `{ relative: true }`. */
  saturate(amount = 0.1, options?: { relative?: boolean }): Colordx {
    const { h, s, l, alpha } = rgbToHslRaw(this._rgb);
    const newS = options?.relative ? s * (1 + amount) : s + amount * 100;
    return Colordx._make(hslToRgb({ h, s: clamp(newS, 0, 100), l, alpha }));
  }

  /** Inverse of `saturate`. */
  desaturate(amount = 0.1, options?: { relative?: boolean }): Colordx {
    return this.saturate(-amount, options);
  }

  /** Drops saturation to zero. */
  grayscale(): Colordx {
    return this.desaturate(1);
  }

  /** Inverts each RGB channel (255 − channel) of the sRGB-clipped color. */
  invert(): Colordx {
    const { r, g, b, alpha } = this._srgbRgb();
    return Colordx._make({ r: 255 - r, g: 255 - g, b: 255 - b, alpha });
  }

  /** Shifts the HSL hue by `amount` degrees (default 15). */
  rotate(amount = 15): Colordx {
    if (amount % 360 === 0) return this;
    const { h, s, l, alpha } = rgbToHslRaw(this._rgb);
    return Colordx._make(hslToRgb({ h: h + amount, s, l, alpha }));
  }

  /** True when both colors are valid and round to the same RGBA tuple. */
  isEqual(color: AnyColor): boolean {
    const o = new Colordx(color);
    if (!this._valid || !o._valid) return false;
    const other = o.toRgb();
    const self = this.toRgb();
    return self.r === other.r && self.g === other.g && self.b === other.b && self.alpha === other.alpha;
  }

  /** function toString() { [native code] } */
  toString(): string {
    return this.toHex();
  }

  /** Clamps channels into sRGB, as browsers render. Hue and lightness may shift. Returns `this` when in gamut. */
  clampSrgb(): Colordx {
    const { r, g, b, alpha } = this._rgb;
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) return this;
    return Colordx._make({
      r: clamp(r, 0, 255),
      g: clamp(g, 0, 255),
      b: clamp(b, 0, 255),
      alpha,
    });
  }

  /** Maps into sRGB with CSS Color 4 gamut mapping, keeping lightness and hue. Returns `this` when in gamut. */
  mapSrgb(): Colordx {
    return this._mapSrgb(true);
  }

  _mapSrgb(snap: boolean): Colordx {
    const { r, g, b, alpha } = this._rgb;
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) return this;
    const [lRaw, a, bv] = linearSrgbToOklab(byteToLinear(r), byteToLinear(g), byteToLinear(b));
    const l = lRaw > 1 - 1e-7 ? 1 : lRaw < 1e-7 ? 0 : lRaw;
    const mapped = toGamutSrgbRaw({ l, a, b: bv, alpha });
    if (mapped === null || mapped.inGamut) return this;
    const [mr, mg, mb] = mapped.linear;
    return Colordx._makeFromLinearSrgb(mr, mg, mb, mapped.alpha, snap);
  }

  /** Maps a color into sRGB with CSS Color 4 gamut mapping. In-gamut colors pass through. */
  static toGamutSrgb: (input: AnyColor) => Colordx;
}

/** Plugin function. Receives the `Colordx` class and parser arrays to add methods and parsers. */
export type Plugin = (
  ColordxClass: typeof Colordx,
  parsers: ColorParser[],
  formatParsers: [ColorParser, ColorFormat][]
) => void;

/** Constructs a `Colordx` from any supported color input. Existing instances pass through. */
export const colordx = (input: AnyColor | Colordx): Colordx => new Colordx(input);

/** Emits an 8-digit `#rrggbbaa` hex for any color input. Shortcut for `colordx(c).toHex8()`. */
export const toHex8 = (input: AnyColor | Colordx): string => new Colordx(input).toHex8();

/** Registers plugins. Each plugin is called once with the `Colordx` class and parser arrays. */
export const extend = (plugins: Plugin[]): void => {
  plugins.forEach((plugin) => plugin(Colordx, parsers, pluginFormatParsers));
};

/** Returns the candidate closest to `color` in OKLab. Throws when `candidates` is empty or a color is invalid. */
export const nearest = <T extends AnyColor>(color: AnyColor, candidates: T[]): T => {
  if (candidates.length === 0) throw new Error('nearest: candidates array must not be empty');
  const from = new Colordx(color);
  if (!from.isValid()) throw invalidColorError('nearest', color);
  const { l: l1, a: a1, b: b1 } = from.toOklab();
  let minDist = Infinity;
  let result = candidates[0] as T;
  for (const candidate of candidates) {
    const c = new Colordx(candidate);
    if (!c.isValid()) throw invalidColorError('nearest', candidate);
    const { l: l2, a: a2, b: b2 } = c.toOklab();
    const dist = (l2 - l1) ** 2 + (a2 - a1) ** 2 + (b2 - b1) ** 2;
    if (dist < minDist) {
      minDist = dist;
      result = candidate;
    }
  }
  return result;
};

/** Returns a random opaque sRGB color. */
export const random = (): Colordx =>
  new Colordx({
    r: Math.round(Math.random() * 255),
    g: Math.round(Math.random() * 255),
    b: Math.round(Math.random() * 255),
    alpha: 1,
  });

Colordx.toGamutSrgb = (input: AnyColor): Colordx => {
  const mapped = toGamutSrgbRaw(input);
  if (mapped === null || mapped.inGamut) return new Colordx(input);
  const [mr, mg, mb] = mapped.linear;
  return Colordx._makeFromLinearSrgb(mr, mg, mb, mapped.alpha);
};

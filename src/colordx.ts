import { rgbToHex, rgbToHex8 } from './colorModels/hex.js';
import { hslToRgb, rgbToHslRaw } from './colorModels/hsl.js';
import { linearSrgbToOklab, rgbToOklab } from './colorModels/oklab.js';
import { oklchToRgb, rgbToOklch } from './colorModels/oklch.js';
import { toGamutSrgbRaw } from './gamut.js';
import { clamp, round } from './helpers.js';
import { parse, parsers, pluginFormatParsers } from './parse.js';
import { srgbFromLinear, srgbToLinear } from './transfer.js';
import type { AnyColor, ColorFormat, ColorParser, HslColor, OklabColor, OklchColor, RgbColor } from './types.js';

const _SENTINEL: unique symbol = Symbol();

/**
 * Color value with parse, format, and manipulation methods.
 * Construct via the `colordx()` helper or `new Colordx(input)`. Instances are immutable —
 * mutators return a new `Colordx`.
 */
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
    // Single chokepoint for alpha precision: parsers and _make() callers may hand us
    // raw floats (e.g. 1/255, 0.1+0.2). Snapping here keeps every formatter consistent.
    this._rgb.alpha = clamp(round(this._rgb.alpha, 3), 0, 1);
  }

  private static _make(rgb: RgbColor): Colordx {
    return new Colordx(_SENTINEL, rgb);
  }

  /**
   * Construct a Colordx from linear-sRGB channels, gamma-encoding to the internal ×255 storage.
   * Channels may exceed [0, 1] — wide-gamut inputs (toGamutP3 / toGamutRec2020 applied to a
   * color outside sRGB) land here after the target-space → linear-sRGB matrix, and the stored
   * _rgb holds unclamped gamma-encoded ×255 so toP3() / toRec2020() can recover the wide-gamut
   * channels. sRGB output methods (toRgb, toHex, etc.) clamp to [0, 255] before returning.
   *
   * Replaces the prior _makeFromOklab: cssGamutMap hands back clipped linear-target channels
   * directly, so callers skip the OKLab → linear round-trip that used to reintroduce 1-ULP
   * asymmetries on gamut-boundary colors.
   *
   * A residual source of asymmetry remains — the clip itself. cssGamutMap's clip puts one
   * channel exactly on 0 or 1 while the others sit where the input's hue landed, so an
   * extreme-dark or extreme-light color ends up with genuinely asymmetric sub-byte channels
   * (e.g. clipped linear (3e-6, 0, 8e-10) from oklch(0.001 0.001 0)). Math.round collapses all
   * three to the same byte, but rgbToHslRaw / rgbToOklab read the raw floats and report
   * phantom hue/saturation. Snap values within half a byte of 0 or 255 to the exact boundary;
   * the band matches Math.round's own behavior so byte output is unchanged, while HSL / OKLab
   * see a consistent pure white / black / primary. Values outside [0, 255] are wide-gamut
   * (P3 / Rec.2020 targets) and pass through untouched.
   */
  static _makeFromLinearSrgb(lr: number, lg: number, lb: number, alpha: number): Colordx {
    const rb = srgbFromLinear(lr) * 255;
    const gb = srgbFromLinear(lg) * 255;
    const bb = srgbFromLinear(lb) * 255;
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

  /** Returns sRGB channels rounded to integers in [0, 255], plus alpha in [0, 1]. */
  toRgb(): RgbColor {
    const { r, g, b, alpha } = this._rgb;
    return { r: clamp(round(r), 0, 255), g: clamp(round(g), 0, 255), b: clamp(round(b), 0, 255), alpha };
  }

  /** Returns the internal unrounded RGB. Intended for plugin use where deferred rounding matters. */
  _rawRgb(): RgbColor {
    return this._rgb;
  }

  /**
   * Formats as a CSS `rgb()` / `rgba()` string.
   * Default is CSS Color 4 modern syntax — `rgb(255 0 0 / 0.5)`.
   * Pass `{ legacy: true }` for CSS Color 3 comma syntax (switches to `rgba()` when alpha < 1).
   */
  toRgbString(options?: { legacy?: boolean }): string {
    const { r, g, b, alpha } = this._rgb;
    const ri = clamp(round(r), 0, 255),
      gi = clamp(round(g), 0, 255),
      bi = clamp(round(b), 0, 255);
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
    return (clamp(round(r), 0, 255) << 16) | (clamp(round(g), 0, 255) << 8) | clamp(round(b), 0, 255);
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
    return alpha < 1 ? `hsl(${h} ${s}% ${l}% / ${alpha})` : `hsl(${h} ${s}% ${l}%)`;
  }

  /** Returns OKLab channels: L in [0, 1], a/b roughly in [-0.4, 0.4]. */
  toOklab(precision = 5): OklabColor {
    const { l, a, b, alpha } = rgbToOklab(this._rgb);
    return { l: round(l, precision), a: round(a, precision), b: round(b, precision), alpha };
  }

  /** Formats as a CSS `oklab()` string. */
  toOklabString(precision = 5): string {
    const { l, a, b, alpha } = this.toOklab(precision);
    return alpha < 1 ? `oklab(${l} ${a} ${b} / ${alpha})` : `oklab(${l} ${a} ${b})`;
  }

  /** Returns OKLCh channels: L in [0, 1], C in [0, ~0.4], H in degrees. */
  toOklch(precision = 5): OklchColor {
    const { l, c, h, alpha } = rgbToOklch(this._rgb);
    return { l: round(l, precision), c: round(c, precision), h: round(h, precision), alpha };
  }

  /** Formats as a CSS `oklch()` string. Hue is `none` when chroma is 0. */
  toOklchString(precision = 5): string {
    const { l, c, h, alpha } = this.toOklch(precision);
    const H = c === 0 ? 'none' : h;
    return alpha < 1 ? `oklch(${l} ${c} ${H} / ${alpha})` : `oklch(${l} ${c} ${H})`;
  }

  /** Perceived brightness in [0, 1] using the ITU-R BT.601 weights. */
  brightness(): number {
    const { r, g, b } = this._rgb;
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

  /**
   * Lightens by `amount` (default 0.1) in HSL. Absolute by default — adds `amount * 100` to L.
   * Pass `{ relative: true }` to multiply L by `1 + amount` instead.
   */
  lighten(amount = 0.1, options?: { relative?: boolean }): Colordx {
    const { h, s, l, alpha } = rgbToHslRaw(this._rgb);
    const newL = options?.relative ? l * (1 + amount) : l + amount * 100;
    return Colordx._make(hslToRgb({ h, s, l: clamp(newL, 0, 100), alpha }));
  }

  /** Inverse of `lighten`. */
  darken(amount = 0.1, options?: { relative?: boolean }): Colordx {
    return this.lighten(-amount, options);
  }

  /**
   * Saturates by `amount` (default 0.1) in HSL. Absolute by default — adds `amount * 100` to S.
   * Pass `{ relative: true }` to multiply S by `1 + amount` instead.
   */
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

  /** Inverts each RGB channel (255 − channel). */
  invert(): Colordx {
    const { r, g, b, alpha } = this._rgb;
    return Colordx._make({ r: 255 - r, g: 255 - g, b: 255 - b, alpha });
  }

  /** Shifts the HSL hue by `amount` degrees (default 15). */
  rotate(amount = 15): Colordx {
    return this.hue(this.hue() + amount);
  }

  /** True when both colors round to the same RGBA tuple. */
  isEqual(color: AnyColor): boolean {
    const other = new Colordx(color).toRgb();
    const self = this.toRgb();
    return self.r === other.r && self.g === other.g && self.b === other.b && self.alpha === other.alpha;
  }

  /** Returns the hex form (alias for `toHex()`). */
  toString(): string {
    return this.toHex();
  }

  /**
   * Clips this color into the sRGB gamut by clamping out-of-range channels to [0, 255].
   * Matches the naive-clip strategy browsers use when rendering out-of-gamut `oklch()` / `oklab()`.
   * Hue and lightness may shift noticeably for colors far outside sRGB.
   * Returns `this` when already in gamut.
   */
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

  /**
   * Maps this color into the sRGB gamut using the CSS Color 4 gamut mapping algorithm
   * (chroma-reduction binary search). Preserves lightness and hue; sacrifices chroma.
   * Useful when hue stability matters — design tokens, palettes, color pickers.
   * Returns `this` when already in gamut.
   */
  mapSrgb(): Colordx {
    const { r, g, b, alpha } = this._rgb;
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) return this;
    const [lRaw, a, bv] = linearSrgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255));
    // The gamma-encoded round-trip drifts L by ~1e-9 at boundaries; snap so that inputs with
    // exact L=0 or L=1 hit the same white/black shortcut the static gamut map uses.
    const l = lRaw > 1 - 1e-7 ? 1 : lRaw < 1e-7 ? 0 : lRaw;
    const mapped = toGamutSrgbRaw({ l, a, b: bv, alpha });
    if (mapped === null) return this;
    const [mr, mg, mb] = mapped.linear;
    return Colordx._makeFromLinearSrgb(mr, mg, mb, mapped.alpha);
  }

  /**
   * Maps an out-of-sRGB-gamut color into sRGB using the CSS Color 4 gamut mapping algorithm.
   * Colors already in gamut are returned as-is. sRGB inputs (hex, rgb, hsl, etc.) are passed through.
   */
  static toGamutSrgb: (input: AnyColor) => Colordx;
}

/**
 * Plugin signature. Receives the `Colordx` class plus the parser arrays so a plugin
 * can register conversions (by adding instance methods) and parsers (by pushing onto the arrays).
 */
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

/**
 * Picks the candidate closest to `color` by Euclidean distance in OKLab.
 * Throws when `candidates` is empty.
 */
export const nearest = <T extends AnyColor>(color: AnyColor, candidates: T[]): T => {
  if (candidates.length === 0) throw new Error('nearest: candidates array must not be empty');
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
  if (mapped === null) return new Colordx(input);
  const [mr, mg, mb] = mapped.linear;
  return Colordx._makeFromLinearSrgb(mr, mg, mb, mapped.alpha);
};

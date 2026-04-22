import { rgbToHex } from './colorModels/hex.js';
import { hslToRgb, rgbToHslRaw } from './colorModels/hsl.js';
import { linearSrgbToOklab, oklabToLinear, rgbToOklab } from './colorModels/oklab.js';
import { oklchToRgb, rgbToOklch } from './colorModels/oklch.js';
import { toGamutSrgbRaw } from './gamut.js';
import { clamp, round } from './helpers.js';
import { parse, parsers, pluginFormatParsers } from './parse.js';
import { srgbFromLinear, srgbToLinear } from './transfer.js';
import type { AnyColor, ColorFormat, ColorParser, HslColor, OklabColor, OklchColor, RgbColor } from './types.js';

const _SENTINEL: unique symbol = Symbol();

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
   * Construct a Colordx from OKLab values, storing unclamped gamma-encoded sRGB internally.
   * Unlike new Colordx(oklabObject), this does NOT clamp channels to [0, 1] before gamma encoding,
   * so wide-gamut P3/Rec2020 colors are preserved accurately for toP3() / toRec2020() output.
   * sRGB output methods (toRgb, toHex, etc.) clamp to [0, 255] before returning.
   */
  static _makeFromOklab({ l, a, b, alpha }: OklabColor): Colordx {
    const [lr, lg, lb] = oklabToLinear(l, a, b);
    return Colordx._make({
      r: srgbFromLinear(lr) * 255,
      g: srgbFromLinear(lg) * 255,
      b: srgbFromLinear(lb) * 255,
      alpha,
    });
  }

  isValid(): boolean {
    return this._valid;
  }

  toRgb(): RgbColor {
    const { r, g, b, alpha } = this._rgb;
    return { r: clamp(round(r), 0, 255), g: clamp(round(g), 0, 255), b: clamp(round(b), 0, 255), alpha };
  }

  /** Returns the internal unrounded RGB. Intended for plugin use where deferred rounding matters. */
  _rawRgb(): RgbColor {
    return this._rgb;
  }

  toRgbString(): string {
    const { r, g, b, alpha } = this._rgb;
    const ri = clamp(round(r), 0, 255),
      gi = clamp(round(g), 0, 255),
      bi = clamp(round(b), 0, 255);
    return alpha < 1 ? `rgb(${ri} ${gi} ${bi} / ${alpha})` : `rgb(${ri} ${gi} ${bi})`;
  }

  toHex(): string {
    return rgbToHex(this._rgb);
  }

  /** Returns a 24-bit RGB integer (0x000000–0xFFFFFF). Alpha is not included. */
  toNumber(): number {
    const { r, g, b } = this._rgb;
    return (clamp(round(r), 0, 255) << 16) | (clamp(round(g), 0, 255) << 8) | clamp(round(b), 0, 255);
  }

  toHsl(precision = 2): HslColor {
    const { h, s, l, alpha } = rgbToHslRaw(this._rgb);
    const hr = round(h, precision);
    return { h: hr >= 360 ? 0 : hr, s: round(s, precision), l: round(l, precision), alpha };
  }

  toHslString(precision = 2): string {
    const { h, s, l, alpha } = this.toHsl(precision);
    return alpha < 1 ? `hsl(${h} ${s}% ${l}% / ${alpha})` : `hsl(${h} ${s}% ${l}%)`;
  }

  toOklab(): OklabColor {
    const { l, a, b, alpha } = rgbToOklab(this._rgb);
    return { l: round(l, 4), a: round(a, 4), b: round(b, 4), alpha };
  }

  toOklabString(): string {
    const { l, a, b, alpha } = this.toOklab();
    return alpha < 1 ? `oklab(${l} ${a} ${b} / ${alpha})` : `oklab(${l} ${a} ${b})`;
  }

  toOklch(): OklchColor {
    const { l, c, h, alpha } = rgbToOklch(this._rgb);
    return { l: round(l, 4), c: round(c, 4), h: round(h, 2), alpha };
  }

  toOklchString(): string {
    const { l, c, h, alpha } = this.toOklch();
    const H = c === 0 ? 'none' : h;
    return alpha < 1 ? `oklch(${l} ${c} ${H} / ${alpha})` : `oklch(${l} ${c} ${H})`;
  }

  brightness(): number {
    const { r, g, b } = this._rgb;
    return round((r * 299 + g * 587 + b * 114) / 255000, 2);
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
    if (value === undefined) return this._rgb.alpha;
    return Colordx._make({ ...this._rgb, alpha: round(clamp(value, 0, 1), 3) });
  }

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

  lightness(): number;
  lightness(value: number): Colordx;
  lightness(value?: number): number | Colordx {
    const oklch = this.toOklch();
    if (value === undefined) return oklch.l;
    return Colordx._make(oklchToRgb({ ...oklch, l: clamp(value, 0, 1) }));
  }

  chroma(): number;
  chroma(value: number): Colordx;
  chroma(value?: number): number | Colordx {
    const oklch = this.toOklch();
    if (value === undefined) return oklch.c;
    return Colordx._make(oklchToRgb({ ...oklch, c: clamp(value, 0, 0.4) }));
  }

  lighten(amount = 0.1, options?: { relative?: boolean }): Colordx {
    const { h, s, l, alpha } = rgbToHslRaw(this._rgb);
    const newL = options?.relative ? l * (1 + amount) : l + amount * 100;
    return Colordx._make(hslToRgb({ h, s, l: clamp(newL, 0, 100), alpha }));
  }

  darken(amount = 0.1, options?: { relative?: boolean }): Colordx {
    return this.lighten(-amount, options);
  }

  saturate(amount = 0.1, options?: { relative?: boolean }): Colordx {
    const { h, s, l, alpha } = rgbToHslRaw(this._rgb);
    const newS = options?.relative ? s * (1 + amount) : s + amount * 100;
    return Colordx._make(hslToRgb({ h, s: clamp(newS, 0, 100), l, alpha }));
  }

  desaturate(amount = 0.1, options?: { relative?: boolean }): Colordx {
    return this.saturate(-amount, options);
  }

  grayscale(): Colordx {
    return this.desaturate(1);
  }

  invert(): Colordx {
    const { r, g, b, alpha } = this._rgb;
    return Colordx._make({ r: 255 - r, g: 255 - g, b: 255 - b, alpha });
  }

  rotate(amount = 15): Colordx {
    return this.hue(this.hue() + amount);
  }

  isEqual(color: AnyColor): boolean {
    const other = new Colordx(color).toRgb();
    const self = this.toRgb();
    return self.r === other.r && self.g === other.g && self.b === other.b && self.alpha === other.alpha;
  }

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
    return mapped !== null ? Colordx._makeFromOklab(mapped) : this;
  }

  /**
   * Maps an out-of-sRGB-gamut color into sRGB using the CSS Color 4 gamut mapping algorithm.
   * Colors already in gamut are returned as-is. sRGB inputs (hex, rgb, hsl, etc.) are passed through.
   */
  static toGamutSrgb: (input: AnyColor) => Colordx;
}

export type Plugin = (
  ColordxClass: typeof Colordx,
  parsers: ColorParser[],
  formatParsers: [ColorParser, ColorFormat][]
) => void;

export const colordx = (input: AnyColor | Colordx): Colordx => new Colordx(input);

export const extend = (plugins: Plugin[]): void => {
  plugins.forEach((plugin) => plugin(Colordx, parsers, pluginFormatParsers));
};

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

export const random = (): Colordx =>
  new Colordx({
    r: Math.round(Math.random() * 255),
    g: Math.round(Math.random() * 255),
    b: Math.round(Math.random() * 255),
    alpha: 1,
  });

Colordx.toGamutSrgb = (input: AnyColor): Colordx => {
  const mapped = toGamutSrgbRaw(input);
  return mapped !== null ? Colordx._makeFromOklab(mapped) : new Colordx(input);
};

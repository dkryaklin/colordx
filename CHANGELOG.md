# @colordx/core

## 7.0.0

### Major Changes

- Fix crash in apcaContrast and fixContrast for out-of-range colors by clamping OKLab lightness before P3 gamut mapping ([cee329c](https://github.com/dkryaklin/colordx/commit/cee329c98e7bd285afbb9b6248c8823c6e72ec65))
- Fix CSS gamut mapping to return the clipped color once its deltaEOK is within epsilon of the JND, matching the CSS Color 4 algorithm ([6f8df65](https://github.com/dkryaklin/colordx/commit/6f8df65992216328be4a53032703f55d04de1177))
- Fix quadratic backtracking that made parsing rgb()/hsl()/hsv() strings with long trailing whitespace extremely slow ([0a02be7](https://github.com/dkryaklin/colordx/commit/0a02be7dc406034ac8b7ebce4db62da64e55d79f))
- Reject invalid channel syntax like "none%" and "nonedeg" in color string parsing, and match "transparent" case-insensitively with surrounding whitespace in parse and getFormat ([1c4cd0a](https://github.com/dkryaklin/colordx/commit/1c4cd0a03e8974ed71af17207865c24da03ebc18))
- Fix minify() clipping out-of-sRGB colors to hex — wide-gamut colors now minify to a shortened oklch() string with leading zeros dropped ([5a533bf](https://github.com/dkryaklin/colordx/commit/5a533bf3e765e9f16e1a2f91fbcf581e6a349d15))
- Fix D50 white point X to be derived from the CSS chromaticity so white round-trips to lab(100 0 0) exactly in XYZ-D50 and Lab conversions ([07339e0](https://github.com/dkryaklin/colordx/commit/07339e03a70fe97c0a8237bbf6c35066359a82a9))
- Fix HWB clamping so an infinite whiteness or blackness normalizes to black or white instead of producing NaN channels ([ae4cde6](https://github.com/dkryaklin/colordx/commit/ae4cde6cebc3c47f11ca79e62e89af5b437c47dd))
- Fix Display-P3 and Rec.2020 conversions to use full-precision sRGB matrices so round-trips through toP3/toRec2020 and back are exact ([9dabb0c](https://github.com/dkryaklin/colordx/commit/9dabb0cab1460f3da878119d6252388bb9817dd5))
- Use full-precision CSS Color 4 OKLab matrices so oklab()/oklch() round-trip through sRGB, and accept object L values up to 1e-9 above 1 — expect last-digit shifts in toOklab, toOklch, toOkhsl, and toOkhsv output ([0137cf7](https://github.com/dkryaklin/colordx/commit/0137cf7aef535bf90565f21f2dced64f2ad7f1c1))
- Fix mix(), mixOklab() and mixLab() to premultiply channels by alpha like CSS color-mix(), so translucent colors no longer contribute hue in proportion to their transparency ([58ba59c](https://github.com/dkryaklin/colordx/commit/58ba59cc51e084be181131fbceafe19a31b55222))
- Encode rec2020 with the pure 2.4 gamma curve CSS Color 4 now specifies instead of the BT.2020 camera OETF, changing all `color(rec2020 ...)` channel values produced and parsed by `toRec2020`, `toRec2020String`, `rec2020ToLinear`, `rec2020FromLinear`, and the `*ToRec2020Channels` helpers ([e2c4942](https://github.com/dkryaklin/colordx/commit/e2c4942a8e14c88b81dbeef40ae0ec79db827913))
- Treat only CSS whitespace (space, tab, LF, CR, FF) as whitespace when parsing color strings, so inputs padded or separated by NBSP, U+2028, BOM or other Unicode spaces are now rejected like in CSS ([57ead92](https://github.com/dkryaklin/colordx/commit/57ead927eb139a960c06e8e5a239d8ec9e1b9337))
- Fix minify to drop a redundant ff alpha byte and stop emitting alphaHex output for near-zero alphas that round to 00, and print none in toOklchString/toLchString whenever the unrounded chroma is achromatic ([9b1848a](https://github.com/dkryaklin/colordx/commit/9b1848aa7a782a31c881e11e0bf0779c849a173a))
- Reject `{ a: null }` in object input instead of treating it as alpha 1, matching `{ alpha: null }` ([91a3c72](https://github.com/dkryaklin/colordx/commit/91a3c72389cdf8c85577771ce95d78573c31e2bd))
- Raise default precision for toHwb/toHwbString (0 to 2), toRec2020, toProphoto, toXyzString and toXyzD65String (4 to 5) so every 8-bit sRGB color round-trips, and serialize tiny channel values as fixed decimals instead of exponent notation ([678f869](https://github.com/dkryaklin/colordx/commit/678f869ba21c014469352003dbef078ecde6c5a7))
- Round rgbToRec2020 channels to 5 decimal places instead of 4, matching toRec2020() so near-black colors round-trip ([5bef672](https://github.com/dkryaklin/colordx/commit/5bef672504fddf7cca122c6681bbfb2b6bb8f88f))
- Let plugins take precedence over non-exact "transparent" keywords, so case-variant or whitespace-padded transparent strings in parse and getFormat are only resolved after all parsers and plugins decline ([4de134f](https://github.com/dkryaklin/colordx/commit/4de134ff6e391120e0a55d97e275f5e588b70ef1))
- Stop publishing source maps, reducing package size by roughly 70% ([23cba9b](https://github.com/dkryaklin/colordx/commit/23cba9bb4eea60e8dade4933ecb1818fd8146ecf))

## 6.7.0

### Minor Changes

- Add okhsl and okhsv plugins with toOkhsl()/toOkhsv(), toOkhslString()/toOkhsvString(), okhsl()/okhsv() string and `colorSpace`-branded object parsing, and per-pixel channel helpers (rgbToOkhslChannels, okhslToRgbChannelsInto, rgbToOkhsvChannels, okhsvToRgbChannelsInto) ([7f900c0](https://github.com/dkryaklin/colordx/commit/7f900c0a2dc9786311baa66670f0f03f89ad3426))

## 6.6.0

### Minor Changes

- Fix gamut helpers to accept OKLab and OKLCH objects on the same terms as the object parsers, so non-finite channels are sanitized, alpha is clamped to [0,1], hue is normalized, and objects carrying an r channel are rejected ([96349c3](https://github.com/dkryaklin/colordx/commit/96349c3a597473487d541277e4f05e0a086f7a4a))
- Accept `a` as an alias for `alpha` on object input for every model except Lab and OKLab, so colord/tinycolor2 `{ r, g, b, a }` objects keep their alpha ([c03b2b4](https://github.com/dkryaklin/colordx/commit/c03b2b47e4a64d0b154dcf3642670829dc12d9d9))
- Add @colordx/core/fn entry point exporting parse plus per-format parsers and converters (parseHex, rgbToHex, hslToRgb, rgbToOklch, parseNameString, NAMES, etc.) as tree-shakable standalone functions ([376be64](https://github.com/dkryaklin/colordx/commit/376be64a8f47f990769789ab341767e4ca13caba))
- Add an optional precision argument to toRgb() to return sRGB channels rounded to that many decimals instead of integers ([4221ced](https://github.com/dkryaklin/colordx/commit/4221ced8fec787089f4463501af1d50a4586c62d))
- Improve tree-shaking so importing a single function such as an HSL or OKLCH parser no longer pulls every built-in parser into the bundle ([cf402ad](https://github.com/dkryaklin/colordx/commit/cf402add5efcaa6611d5b9e7cc235f9f00cab198))
- Speed up hsl()/hsla() string parsing about 2x with a scanner-based parser and accept whitespace before the closing paren in alpha-less values ([a02962f](https://github.com/dkryaklin/colordx/commit/a02962f8ff3e19bb86941b5616441de535451950))
- Fix rotate to shift the unrounded HSL hue and return the color unchanged for whole-turn rotations (0, ±360, …), so harmonies preserves a wide-gamut input instead of clipping it to sRGB ([527d9f0](https://github.com/dkryaklin/colordx/commit/527d9f069c2d2c1605197ca7c79ce6f7617c361b))

## 6.5.0

### Minor Changes

- Fix inGamutSrgb and inGamutCustom to return false for unparseable input, and make toGamutSrgb/toGamutCustom yield an invalid color instead of treating it as in-gamut sRGB ([cdc7a19](https://github.com/dkryaklin/colordx/commit/cdc7a195eb4607673b4785c2fac945c9b234e212))
- Add support for scientific-notation number tokens (1e2, 6e-1) in all CSS color string parsers, the fast scanner, and the oklch/oklab gamut regexes ([081d9d4](https://github.com/dkryaklin/colordx/commit/081d9d46a791f740cce653afd1245deb7ea7c84d))

## 6.4.0

### Minor Changes

- Add rgbToHslChannels/hslToRgbChannels to core and rgbToHsvChannels/hsvToRgbChannels to the hsv plugin, each with a zero-allocation \*Into sibling (hue in degrees, s/l/v 0–100, RGB 0–1) ([1e97cba](https://github.com/dkryaklin/colordx/commit/1e97cbaa70776ed3dd48d12989d07ee954c34533))

## 6.3.0

### Minor Changes

- Treat NaN as 0 and non-finite hues as 0° across all parsers and manipulators, make toHexByte(NaN) return "00", accept non-finite XYZ object channels via sanitize, and strip -0 from all rounded output ([096cd2f](https://github.com/dkryaklin/colordx/commit/096cd2fad93694be7ef179a43a28fb63cfac6570))
- Bound stored RGB channels to ±1e6 (NaN to 0) in the wide-gamut and rgb() parsers so extreme inputs like lab(50 1e400 0) or { a: -1e308 } no longer produce NaN output in later conversions ([ba67427](https://github.com/dkryaklin/colordx/commit/ba67427a497de8121e5ca8c3fe9a1c7133c90f69))
- Fix mapSrgb() and toGamut\*() hanging forever on colors with infinite or overflowing chroma by falling back to naive clipping ([828c501](https://github.com/dkryaklin/colordx/commit/828c501b2f4add138a3fac134b11b64cb63d44f6))
- Clamp oklab() and oklch() lightness to [0, 1] at parse time per CSS Color 4, matching lab() and lch() ([981551b](https://github.com/dkryaklin/colordx/commit/981551be6feb9334a1c76738782ef5b86788d2a7))
- Fix inGamut/toGamut OKLab and OKLCh input handling to match colordx(): default alpha to 1 instead of 0, clamp L to [0, 1] and chroma to >= 0, and reject objects with L > 1 as non-OKLab ([fe11b88](https://github.com/dkryaklin/colordx/commit/fe11b88674f42b9013435cbbdfadd868e8aee603))
- Clip wide-gamut colors to sRGB in toHsl/toHsv/toHwb/toCmyk, brightness, invert and the HSL-based manipulators (lighten, saturate, rotate, etc.) so they describe the same color as toHex() ([91793f4](https://github.com/dkryaklin/colordx/commit/91793f4085892310bbb6572cbb4ad7b0f05af89c))
- Fix toOklch, toLch and toHwb returning a hue of 360 by wrapping rounded hues back to 0 so H stays in [0, 360) ([3be0ee3](https://github.com/dkryaklin/colordx/commit/3be0ee32b4dadcd36a1f4a960db22c6c24b3349d))
- Fix mix() to read the second color unrounded so a.mix(b, t) and b.mix(a, 1 - t) return the same result ([47b4bb6](https://github.com/dkryaklin/colordx/commit/47b4bb6d00ed088865895581ddf62688da9faa8e))

## 6.2.0

### Minor Changes

- Add over() source-over compositing, gate isReadable/readableScore/minReadable/isReadableApca on unrounded contrast values, accept precision arguments on luminance/contrast/apcaContrast, gamut-map colors before WCAG and APCA checks, and add `{ space: 'p3' }` to apcaContrast and isReadableApca ([d6e79aa](https://github.com/dkryaklin/colordx/commit/d6e79aa9fbc052192ce556d0743261f382677845))
- Add fixContrast(background, { wcag, apca, space }) to find the nearest hue-preserving OKLCH color meeting WCAG and/or APCA gates (returns null when none passes) and reimplement minReadable on top of it, falling back to the original color when no fix exists ([20d31ef](https://github.com/dkryaklin/colordx/commit/20d31ef565660e6fb7df4e3b256465a7edd6c575))
- Fix tinycolor shim to treat "1.0%" as 100% for RGB channels and HSL/HSV saturation, lightness, and value, matching tinycolor2 ([ece82ba](https://github.com/dkryaklin/colordx/commit/ece82ba1f58e0166ff4eca1b3d42056898982dce))
- Add cvd plugin exposing simulate() for protanopia, deuteranopia and tritanopia, and accept an optional precision argument plus Colordx instances in delta() ([c7ff75a](https://github.com/dkryaklin/colordx/commit/c7ff75a90de42cbb471f44f1f5b634106fa29d5e))

## 6.1.0

### Minor Changes

- Fix achromatic colors reporting a phantom hue and saturation: hslToRgb is now exact at l=100 and rgbToHsl/rgbToHsv treat sub-1e-6 channel differences as grey, so greys from Lab, LCH, mixOklab and display-p3 read back as hsl(0 0% l); in the tinycolor shim, accept deg/grad/rad/turn hues, reject invalid string tokens like 1e2, 180foo and 0x10 as tinycolor2 does, and floor analogous()/monochromatic() counts to at least 1 instead of looping forever on negative or fractional values ([94d2f74](https://github.com/dkryaklin/colordx/commit/94d2f74800e2ef9992f67e575e049dfd79f3d39c))

## 6.0.0

### Major Changes

- Add a tinycolor2-compatible drop-in export at @colordx/core/tinycolor (with `toColordx()` for the underlying Colordx) and recognize British `grey` spellings (grey, darkgrey, dimgrey, lightgrey, slategrey, darkslategrey, lightslategrey) in the names plugin ([297e4a8](https://github.com/dkryaklin/colordx/commit/297e4a8b1322a230532ff0630579a41c80bec193))
- Reduce core bundle size by routing non-OKLab gamut inputs through the shared parser: `inGamutSrgb`/`toGamutSrgb*` now only recognize lab, lch, display-p3, rec2020, a98-rgb, prophoto-rgb, srgb-linear, and xyz inputs when the matching plugin is registered via `extend()` ([f66d2a8](https://github.com/dkryaklin/colordx/commit/f66d2a82ea7452d8ab32856f6c0e3a192b72f8d3))
- BREAKING: emit and parse color(xyz-d50|xyz-d65|xyz) strings on the CSS Color 4 0–1 scale (toXyzString/toXyzD65String now default to 4 decimal places; percentages map 100% = 1), while toXyz/toXyzD65 objects keep the 0–100 scale — divide existing string values by 100 ([e12f0b6](https://github.com/dkryaklin/colordx/commit/e12f0b6c40ad5ffca893383d7bd73daf9841aba0))

## 5.8.0

### Minor Changes

- Add color(srgb) string parsing in core, treat bare xyz as an xyz-d65 alias, and add srgb-linear plugin with toSrgbLinear, toSrgbLinearString, and color(srgb-linear) string and object parsing

## 5.7.0

### Minor Changes

- Add toNumber32 method for 32-bit RGBA integer output with alpha packed as the low byte

## 5.6.0

### Minor Changes

- Significantly improve parse throughput by replacing regex and named-group dispatch with charcode scanners and key-probe routing, and fix malformed color string rejection to run in linear rather than quadratic time

## 5.5.0

### Minor Changes

- Add a98-rgb and prophoto-rgb color space plugins with CSS Color 4 conversions, gamut checking, gamut mapping, and string/object parsing

## 5.4.3

### Patch Changes

- Bump default precision for toOklab and toOklch (and their string variants) from 4 to 5 decimal places to ensure lossless sRGB round-trips

## 5.4.2

### Patch Changes

- Fix phantom hue and saturation on gamut-mapped colors by returning clipped linear channels directly from cssGamutMap and snapping near-boundary values to exact 0/255

## 5.4.1

### Patch Changes

- Fix gamut helpers to recognize Lab, LCH, Display-P3, Rec.2020, and XYZ inputs and preserve unclamped channels so inGamut checks and toGamut mapping work correctly for wide-gamut color spaces

## 5.4.0

### Minor Changes

- Add XYZ D65 support (toXyzD65, toXyzD65String, color(xyz-d65) parsing), fix toXyzString to emit xyz-d50, add Lab/LCH channel helpers for sRGB, P3, and Rec.2020, add rgbToLinear, add legacy comma-syntax option to toRgbString, and accept optional precision on all formatter methods

## 5.3.3

### Patch Changes

- Add `toHex8` method and `toHexByte` utility, split color types into `*Color` output and `*ColorInput` input variants with optional alpha

## 5.3.2

### Patch Changes

- Fix float precision leak by snapping alpha to 3 decimal places in Colordx constructor

## 5.3.1

### Patch Changes

- Fix phantom hue appearing on achromatic OKLab colors when converting to HSL by short-circuiting the OKLab→sRGB matrix multiply for zero chroma inputs

## 5.3.0

### Minor Changes

- Update toRgbString, toHslString, toHsvString, toLabString, and toLchString output to CSS Color 4 space-separated syntax and extend string parsers to accept the none keyword and percentage channels across all color models

## 5.2.0

### Minor Changes

- Add zero-allocation \*Into variants for all channel conversion functions (oklchToLinearInto, oklchToRgbChannelsInto, oklchToP3ChannelsInto, oklchToRec2020ChannelsInto, and related primitives) to eliminate GC pressure in hot pixel loops

## 5.1.1

### Patch Changes

- Fix inGamutSrgb false negatives for OKLCH round-trip values by widening EPS tolerance to absorb 4-decimal-place precision artifacts

## 5.1.0

### Minor Changes

- 80011b8: Add `.clampSrgb()` and `.mapSrgb()` instance methods for gamut mapping; expand README with gamut strategy guide and updated benchmark table including @texel/color.

## 5.0.3

### Patch Changes

- b5b21d4: Add roadmap section to README covering planned CSS Color 4/5 features and internal improvements; add comprehensive isValid test coverage for all supported color formats.

## 5.0.2

### Patch Changes

- 86fce9f: Switch delta() to use D65 Lab for more screen-accurate perceptual color difference calculations.

## 5.0.1

### Patch Changes

- 7d88fe0: Fix wide-gamut color data loss by using unclamped parse paths for oklch, oklab, p3, rec2020, and xyz inputs; out-of-sRGB-gamut channel values are now preserved instead of being clipped to sRGB on parse.

## 5.0.0

### Major Changes

- 49cdfae: Move `toGamutSrgb`, `toGamutP3`, and `toGamutRec2020` from standalone exports to static methods on `Colordx` (`Colordx.toGamutSrgb`, `Colordx.toGamutP3`, `Colordx.toGamutRec2020`); fix wide-gamut accuracy by storing unclamped linear RGB internally and clamping only on sRGB output; extend transfer functions to the full real line for correct out-of-gamut channel handling; enable code splitting (bundle drops from 5 KB to 3 KB gzipped); add cssnano compatibility test suite.

## 4.1.1

### Patch Changes

- fcf0e94: Improve gamut mapping accuracy by tightening EPS tolerance, add parseLabString to enable parsing lab() CSS strings, update README examples, and expand culori comparison script.

## 4.1.0

### Minor Changes

- 7338bb6: Add `oklchToLinearAndSrgb` export that converts OKLCH to both linear and gamma-encoded sRGB channels in a single pass

## 4.0.0

### Major Changes

- 0b4c9e7: Move HSV, HWB, mix/mixOklab, luminance/contrast, P3, and Rec.2020 out of core into opt-in plugins; rename alpha property from `a` to `alpha` in all color objects; change getFormat return values for oklch/oklab from 'lch'/'lab' to 'oklch'/'oklab'; remove linearToP3Channels, linearToRec2020Channels, oklchToP3Channels, oklchToRec2020Channels, inGamutP3, inGamutRec2020, toGamutP3, and toGamutRec2020 from core exports (now in plugin modules); upgrade gamut mapping to the full CSS Color 4 binary-search algorithm with JND-based clipping; add object parsing support for P3 and Rec.2020 using colorSpace discriminant; add rectangle and double-split-complementary harmony types; fix toHsl to clamp h=360 to 0; update README API documentation and benchmark table

## 3.0.1

### Patch Changes

- d3c0df7: Fix HSL hue wrapping for out-of-range values (negative and >360) and export xyzToLab for internal use; add comprehensive, round-trip, property-based, and plugin edge case test suites

## 3.0.0

### Major Changes

- bab3e09: Rename alpha field from `a` to `alpha` on all color object types (RgbColor, HslColor, HsvColor, HwbColor, LchColor, OklchColor, CmykColor, P3Color, Rec2020Color, XyzColor); add `colorSpace` branding to LabColor, LchColor, P3Color, and Rec2020Color; rename `ColorFormat` values `'lab'`→`'oklab'` and `'lch'`→`'oklch'`; promote HSV string parsing, Display-P3 string parsing, and OKLab/OKLCH format identifiers to builtins (no plugin needed); add `toLabString`, `toXyzString` methods to lab plugin; fix luminance threshold (0.03928→0.04045), fix unclamped XYZ intermediate calculation, and add `parseHsvString` support.

## 2.2.0

### Minor Changes

- b5a8e49: Add `oklchToLinear`, `linearToP3Channels`, and `linearToRec2020Channels` split-step exports for converting one OKLCH color to multiple color spaces without repeating the expensive OKLab pipeline.

## 2.1.0

### Minor Changes

- 5e1e06e: Promote `toP3()` and `toP3String()` to core (no plugin required), and add `oklchToRgbChannels`, `oklchToP3Channels`, and `oklchToRec2020Channels` low-level functional exports for allocation-free OKLCH conversion in hot paths.

## 2.0.2

### Patch Changes

- 1b805b5: Update color matrix coefficients and D50 white point to CSS Color 4 exact values for XYZ, Lab, LCH, Display-P3, and Rec.2020; output `none` hue keyword for achromatic colors in `toOklchString` and `toLchString`; support parsing `none` hue keyword in LCH string input.

## 2.0.1

### Patch Changes

- 366a180: Remove intermediate rounding in XYZ/Lab conversion pipeline to prevent precision loss; rounding is now applied only at the final output stage in toLab() and toXyz().

## 2.0.0

### Major Changes

- 1f72197: Rename tint/shade/tone to tints/shades/tones (returning arrays); merge delta() into lab plugin (removes standalone delta plugin); add mixOklab() to core and mixLab() to lab plugin; add toName({ closest }) and transparent support; fix getFormat for plugin-registered parsers (adds p3/rec2020 to ColorFormat); clamp NaN/Infinity in object color parsers instead of rejecting; normalize LCH and OKLCH hue to 0 for achromatic colors; normalize -0 in Lab a/b output; fix minify to pick shortest lossless HSL precision; fix alpha setter rounding; fix TypeScript subpath type resolution via typesVersions; accept Colordx instances as input; trim whitespace in all string parsers.

## 1.13.1

### Patch Changes

- 5651514: Consolidate performance benchmark tables in README into a single unified comparison table

## 1.13.0

### Minor Changes

- f85e2bf: Perfomance up

## 1.12.0

### Minor Changes

- 4639b12: Add support for the CSS Color 4 `none` keyword in `oklch` and `oklab` string parsing, treating it as 0 for each channel.

## 1.11.2

### Patch Changes

- ec89d22: Fixed HSL minification to always include HSL candidates by removing the overly strict lossless round-trip guard.

## 1.11.1

### Patch Changes

- 65e705a: Consolidated RGB normalisation across all color model converters through a shared clampRgb utility, fixing minor inconsistencies in rounding and clamping behaviour.

## 1.11.0

### Minor Changes

- 96c0e81: Defer RGB channel rounding to output methods, preserving sub-integer precision internally for more accurate color space conversions.

## 1.10.5

### Patch Changes

- d33919e: Fixed minify plugin to skip lossy HSL candidates that don't round-trip back to the original RGB values, ensuring color accuracy.

## 1.10.4

### Patch Changes

- 1953129: Fixed incorrect alpha=0 exclusion and lossy alpha handling in the minify plugin's hex shortening logic.

## 1.10.3

### Patch Changes

- e00de2f: Fixed hex parsing to require leading '#', added RGB percentage channel support, allowed unitless s/l in HSL modern space syntax, and normalized HWB overflow per CSS Color 4 spec.

## 1.10.2

### Patch Changes

- e2cc330: Update README.md

## 1.10.1

### Patch Changes

- f03df33: Docs updated

## 1.10.0

### Minor Changes

- [`0ba00a0`](https://github.com/dkryaklin/colordx/commit/0ba00a0238caea820d2a2309046033ef41e7c483) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Add Display-P3 and Rec.2020 gamut support with new inGamutP3, inGamutRec2020, toGamutP3, toGamutRec2020 utilities and p3/rec2020 plugins.

## 1.9.0

### Minor Changes

- [`46ee089`](https://github.com/dkryaklin/colordx/commit/46ee089ab6381f26968f8bc0b60fdff7982e5757) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Added optional `{ relative: true }` flag to `lighten`, `darken`, `saturate`, and `desaturate` for proportional adjustments based on the current value.

## 1.8.2

### Patch Changes

- [`de29141`](https://github.com/dkryaklin/colordx/commit/de29141465b786e60b9f90f9291e01eea1800ab7) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Fix contrast and APCA calculations to correctly composite semi-transparent foreground colors over the background before measuring contrast.

## 1.8.1

### Patch Changes

- [`83fe1c7`](https://github.com/dkryaklin/colordx/commit/83fe1c7fd0002cf75c3880220ffe97fc61eaa27b) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Increased alpha channel precision from 2 to 3 decimal places to ensure lossless hex round-trips across all color models.

## 1.8.0

### Minor Changes

- [`04a6102`](https://github.com/dkryaklin/colordx/commit/04a61021c8d4918faf7bf056513d830d41d63598) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Added support for modern CSS space syntax (e.g., `hsl(0 100% 50%)`, `rgb(255 0 0 / 0.5)`) in HSL and RGB string parsing, including angle units and percentage alpha values.

## 1.7.0

### Minor Changes

- [`c05bbaf`](https://github.com/dkryaklin/colordx/commit/c05bbafff27c2a79feb2c4a4863f40a5729c861c) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Added `toNumber()` method to convert colors to integer format compatible with PixiJS and Discord.

## 1.6.0

### Minor Changes

- [`b2667da`](https://github.com/dkryaklin/colordx/commit/b2667dab1c0e1f08fbe6e71caf56d19a02e1a2ba) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Add `lightness()` and `chroma()` getter/setter methods for OKLCH color space manipulation.

## 1.5.0

### Minor Changes

- [`c8ad23f`](https://github.com/dkryaklin/colordx/commit/c8ad23f1b4648f86c4213c24ecea3c991d88e5ff) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Added `readableScore()` method to the a11y plugin, returning a WCAG 2.x compliance tier ('AAA', 'AA', 'AA large', or 'fail') for a given background color.

## 1.4.0

### Minor Changes

- [`1a5b078`](https://github.com/dkryaklin/colordx/commit/1a5b0781d88a1c385fb11d80905d88d2dfeff139) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Add `nearest()` utility for finding the perceptually closest color from a palette using OKLab distance.

## 1.3.0

### Minor Changes

- [`ef45f43`](https://github.com/dkryaklin/colordx/commit/ef45f4388ce18a04be3d6e284ac7836448746f98) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Added toHsvString() method to convert colors to HSV/HSVA string representation.

## 1.2.1

### Patch Changes

- [`f6ed8ae`](https://github.com/dkryaklin/colordx/commit/f6ed8aeaef746c56d0a0f56213e2347d5ee41b4b) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Fixed parsing of the 'transparent' CSS keyword, now correctly resolving to rgba(0,0,0,0).

## 1.2.0

### Minor Changes

- [`61f393a`](https://github.com/dkryaklin/colordx/commit/61f393a7ea9a65830f67eba3be2bcf8e949495c2) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Added APCA contrast support to the a11y plugin with new `apcaContrast()` and `isReadableApca()` methods, and updated the playground to demonstrate both WCAG and APCA accessibility checks.

## 1.1.0

### Minor Changes

- [`bcde9e2`](https://github.com/dkryaklin/colordx/commit/bcde9e25fea220ec515565f96c74261ff173274f) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Added optional `precision` parameter to `toHsl`, `toHslString`, `toHwb`, and `toHwbString` methods, and fixed lossy HSL minification in the minify plugin.

## 1.0.0

### Major Changes

- [`73d0b9d`](https://github.com/dkryaklin/colordx/commit/73d0b9d600e1c0ca7331d5f37dd41016e6847af3) Thanks [@dkryaklin](https://github.com/dkryaklin)! - Stable release

## 0.2.0

### Minor Changes

- [`600e4f3`](https://github.com/dkryaklin/colordx/commit/600e4f362d039e38f37cf71a300648ba09c3afa9) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Added HWB, XYZ, Lab, LCH, and CMYK color model support, a minify plugin, delta E2000 color difference function, fixed HSV-to-RGB conversion, and improved isValid() accuracy.

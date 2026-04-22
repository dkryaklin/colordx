# @colordx/core

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

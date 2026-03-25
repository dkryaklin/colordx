# @colordx/core

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

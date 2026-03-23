# @colordx/core

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

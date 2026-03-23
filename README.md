# @colordx/core

**[Try it on colordx.dev](https://colordx.dev)**

A modern color manipulation library built for the CSS Color 4 era. Drop-in upgrade from [colord](https://github.com/omgovich/colord) with first-class support for **OKLCH**, **OKLab**, and a cleaner plugin system.

## Why colordx?

[colord](https://github.com/omgovich/colord) is a great library, but it was designed around CSS Color 3. Modern CSS uses `oklch()` and `oklab()` — color spaces that are perceptually uniform and supported natively in all modern browsers. With colord, you need plugins for those. With colordx, they're built in.

## Install

```bash
npm install @colordx/core
```

## Usage

```ts
import { colordx } from '@colordx/core';

colordx('#ff0000').toOklch()          // { l: 0.6279, c: 0.2577, h: 29.23, a: 1 }
colordx('#ff0000').toOklchString()    // 'oklch(0.6279 0.2577 29.23)'
colordx('#ff0000').lighten(0.1).toHex()  // '#ff3333'
colordx('oklch(0.5 0.2 240)').toHex()   // '#0055c2'
```

## API

All methods are immutable — they return a new `Colordx` instance.

### Parsing

Accepts any CSS color string or color object:

```ts
colordx('#ff0000')
colordx('#f00')
colordx('rgb(255, 0, 0)')
colordx('rgba(255, 0, 0, 0.5)')
colordx('hsl(0, 100%, 50%)')
colordx('hwb(0 0% 0%)')
colordx('oklab(0.6279 0.2249 0.1257)')
colordx('oklch(0.6279 0.2577 29.23)')
colordx({ r: 255, g: 0, b: 0, a: 1 })
colordx({ h: 0, s: 100, l: 50, a: 1 })
colordx({ h: 0, s: 100, v: 100, a: 1 })
colordx({ h: 0, w: 0, b: 0, a: 1 })
colordx({ l: 0.6279, a: 0.2249, b: 0.1257, alpha: 1 })  // OKLab
colordx({ l: 0.6279, c: 0.2577, h: 29.23, a: 1 })       // OKLch
```

### Conversion

```ts
.toRgb()           // { r: 255, g: 0, b: 0, a: 1 }
.toRgbString()     // 'rgb(255, 0, 0)'
.toHex()           // '#ff0000'
.toHsl()           // { h: 0, s: 100, l: 50, a: 1 }         — default precision: 2
.toHsl(4)          // { h: 0, s: 100, l: 50, a: 1 }         — up to 4 decimal places
.toHsl(0)          // { h: 0, s: 100, l: 50, a: 1 }         — rounded to integers
.toHslString()     // 'hsl(0, 100%, 50%)'
.toHslString(4)    // 'hsl(0, 100%, 50%)'                   — higher precision string
.toHsv()           // { h: 0, s: 100, v: 100, a: 1 }
.toHsvString()     // 'hsv(0, 100%, 100%)'
.toHwb()           // { h: 0, w: 0, b: 0, a: 1 }            — default precision: 0
.toHwb(2)          // { h: 0, w: 0, b: 0, a: 1 }            — up to 2 decimal places
.toHwbString()     // 'hwb(0 0% 0%)'
.toHwbString(2)    // 'hwb(0 0% 0%)'                        — higher precision string
.toOklab()         // { l: 0.6279, a: 0.2249, b: 0.1257, alpha: 1 }
.toOklabString()   // 'oklab(0.6279 0.2249 0.1257)'
.toOklch()         // { l: 0.6279, c: 0.2577, h: 29.23, a: 1 }
.toOklchString()   // 'oklch(0.6279 0.2577 29.23)'
```

### Manipulation

```ts
.lighten(0.1)      // increase lightness by 10%
.darken(0.1)       // decrease lightness by 10%
.saturate(0.1)     // increase saturation by 10%
.desaturate(0.1)   // decrease saturation by 10%
.grayscale()       // fully desaturate
.invert()          // invert RGB channels
.rotate(30)        // rotate hue by 30°
.mix('#0000ff', 0.5)  // mix with another color
.alpha(0.5)        // set alpha
.hue(120)          // set hue
```

### Getters

```ts
.isValid()         // true if input was parseable
.alpha()           // get alpha (0–1)
.hue()             // get hue (0–360)
.brightness()      // perceived brightness (0–1)
.luminance()       // relative luminance (0–1, WCAG)
.isDark()          // brightness < 0.5
.isLight()         // brightness >= 0.5
.contrast('#fff')  // WCAG 2.x contrast ratio (1–21)
.isEqual('#f00')   // exact RGB equality
```

### Utilities

```ts
import { getFormat, nearest, random } from '@colordx/core';

getFormat('#ff0000')          // 'hex'
getFormat('oklch(0.5 0.2 240)') // 'lch'
getFormat({ r: 255, g: 0, b: 0, a: 1 }) // 'rgb'
getFormat('notacolor')        // undefined

nearest('#800', ['#f00', '#ff0', '#00f'])  // '#f00' — perceptual distance via OKLab
nearest('#ffe', ['#f00', '#ff0', '#00f'])  // '#ff0'

random()  // random Colordx instance
```

### Gamut

OKLCH and OKLab can describe colors outside the sRGB gamut. colordx includes standalone utilities for checking and mapping:

```ts
import { inGamutSrgb, toGamutSrgb } from '@colordx/core';

// Check: is this color displayable in sRGB?
inGamutSrgb('#ff0000')                  // true  — hex is always sRGB
inGamutSrgb('oklch(0.6279 0.2577 29.23)') // true  — red
inGamutSrgb('oklch(0.5 0.4 180)')       // false — too much cyan chroma

// Map: reduce chroma until in-gamut (preserves lightness and hue)
toGamutSrgb('oklch(0.5 0.4 180)')  // → Colordx at the sRGB boundary
toGamutSrgb('#ff0000')             // → unchanged, already in sRGB
```

`inGamutSrgb` is always `true` for sRGB-bounded inputs (hex, rgb, hsl, hsv, hwb).
`toGamutSrgb` uses a binary search on chroma following the [CSS Color 4 gamut mapping algorithm](https://www.w3.org/TR/css-color-4/#css-gamut-mapping).

## Plugins

Opt-in plugins for less common color spaces and utilities:

```ts
import { extend } from '@colordx/core';
import lab   from '@colordx/core/plugins/lab';   // toLab(), toXyz()
import lch   from '@colordx/core/plugins/lch';   // toLch(), toLchString()
import cmyk  from '@colordx/core/plugins/cmyk';  // toCmyk(), toCmykString()
import delta from '@colordx/core/plugins/delta'; // delta() — CIEDE2000
import names from '@colordx/core/plugins/names'; // toName(), parse CSS color names
import a11y  from '@colordx/core/plugins/a11y';  // isReadable(), minReadable(), apcaContrast(), isReadableApca()
import harmonies from '@colordx/core/plugins/harmonies'; // harmonies()
import mix   from '@colordx/core/plugins/mix';   // tint(), shade(), tone(), palette()
import minify from '@colordx/core/plugins/minify'; // minify()

extend([lab, lch, cmyk, delta, names, a11y, harmonies, mix, minify]);
```

### a11y plugin

WCAG 2.x contrast (uses `.contrast()` from core):

```ts
colordx('#000').isReadable('#fff')                          // true  — AA normal (ratio >= 4.5)
colordx('#000').isReadable('#fff', { level: 'AAA' })        // true  — AAA normal (ratio >= 7)
colordx('#000').isReadable('#fff', { size: 'large' })       // true  — AA large (ratio >= 3)
colordx('#000').readableScore('#fff')                       // 'AAA'
colordx('#e60000').readableScore('#ffff47')                 // 'AA'
colordx('#949494').readableScore('#fff')                    // 'AA large'
colordx('#aaa').readableScore('#fff')                       // 'fail'
colordx('#777').minReadable('#fff')                         // darkened/lightened to reach 4.5
```

APCA (Accessible Perceptual Contrast Algorithm) — the projected replacement for WCAG 2.x in WCAG 3.0:

```ts
// Returns a signed Lc value: positive = dark text on light bg, negative = light text on dark bg
colordx('#000').apcaContrast('#fff')     //  106.0
colordx('#fff').apcaContrast('#000')     // -107.9
colordx('#202122').apcaContrast('#cf674a')  //  37.2  ← dark text on orange
colordx('#ffffff').apcaContrast('#cf674a')  // -69.5  ← white text on orange

// Checks readability using |Lc| thresholds: >= 75 for normal text, >= 60 for large text/headings
colordx('#000').isReadableApca('#fff')                       // true
colordx('#777').isReadableApca('#fff')                       // false
colordx('#777').isReadableApca('#fff', { size: 'large' })    // true
```

APCA is better suited than WCAG 2.x for dark color pairs and more accurately reflects human perception. See [Introduction to APCA](https://git.apcacontrast.com/documentation/APCAeasyIntro) for background.

## Migrating from colord

The API is intentionally compatible. Most code works unchanged:

```ts
// Before
import { colord } from 'colord';
const c = colord('#ff0000');

// After
import { colordx } from '@colordx/core';
const c = colordx('#ff0000');
```

### What's the same

All core manipulation and conversion methods have identical signatures:
`.toHex()`, `.toRgb()`, `.toRgbString()`, `.toHsl()`, `.toHslString()`, `.toHsv()`, `.toHwb()`, `.toHwbString()`, `.lighten()`, `.darken()`, `.saturate()`, `.desaturate()`, `.grayscale()`, `.invert()`, `.rotate()`, `.mix()`, `.alpha()`, `.hue()`, `.brightness()`, `.luminance()`, `.isDark()`, `.isLight()`, `.contrast()`, `.isEqual()`, `getFormat()`, `random()`

### What changed

**OKLCH and OKLab are now core** — no plugin needed:

```ts
// colord (requires plugin — not available)
// colordx
colordx('#ff0000').toOklch()
colordx('#ff0000').toOklchString()
colordx('oklch(0.5 0.2 240)').toHex()
```

**CIE Lab, LCH, XYZ, CMYK moved to plugins:**

```ts
// colord
import { colord } from 'colord';
import labPlugin from 'colord/plugins/lab';
import lchPlugin from 'colord/plugins/lch';
import xyzPlugin from 'colord/plugins/xyz';
import cmykPlugin from 'colord/plugins/cmyk';
colordExtend([labPlugin, lchPlugin, xyzPlugin, cmykPlugin]);

// colordx
import { extend } from '@colordx/core';
import lab from '@colordx/core/plugins/lab';
import lch from '@colordx/core/plugins/lch';
import cmyk from '@colordx/core/plugins/cmyk';
extend([lab, lch, cmyk]);
```

**`delta()` moved to a plugin:**

```ts
// colord
import deltaPlugin from 'colord/plugins/lab';
colordExtend([deltaPlugin]);
colord('#ff0000').delta('#00ff00');

// colordx
import delta from '@colordx/core/plugins/delta';
extend([delta]);
colordx('#ff0000').delta('#00ff00');
```

**`getFormat()` import path:**

```ts
// colord
import { getFormat } from 'colord';

// colordx
import { getFormat } from '@colordx/core';
```

### `mix()` uses RGB instead of Lab

colord's `mix` plugin interpolates in **CIE Lab** space. colordx interpolates in **linear RGB**, which matches how browsers composite a semi-transparent layer over a background (CSS `opacity`, Figma elevation layers, etc.).

```ts
// Background: #f0f3f1, overlay: #007d40 at 14% opacity
colord('#f0f3f1').mix('#007d40', 0.14)   // '#d3e2d6'  ← Lab interpolation
colordx('#f0f3f1').mix('#007d40', 0.14)  // '#cee2d8'  ← RGB interpolation (matches browser)
```

The same applies to `tint()`, `shade()`, and `tone()` from the mix plugin, which all call `.mix()` internally. If you have hardcoded expected hex values from colord's mix output, update them — the new values are more accurate for UI work.

### `contrast()` rounding

colord uses `Math.floor` when rounding the WCAG contrast ratio to 2 decimal places; colordx uses standard rounding (`Math.round`). This affects values that fall exactly at .xxx5:

```ts
colord('#ff0000').contrast('#ffffff')   // 3.99  (floor)
colordx('#ff0000').contrast('#ffffff')  // 4     (round)
```

### HSL/HWB precision

colordx returns higher precision HSL/HSV values than colord. If your code does exact equality checks on `.toHsl()` output, use `toBeCloseTo` or round the values.

`toHsl()` and `toHwb()` now accept an optional `precision` argument to control decimal places:

```ts
colordx('#3d7a9f').toHsl()     // { h: 205.71, s: 43.24, l: 43.33, a: 1 }  — default (2)
colordx('#3d7a9f').toHsl(4)    // { h: 205.7143, s: 43.2432, l: 43.3333, a: 1 }
colordx('#3d7a9f').toHsl(0)    // { h: 206, s: 43, l: 43, a: 1 }

colordx('#3d7a9f').toHwb()     // { h: 206, w: 24, b: 38, a: 1 }            — default (0)
colordx('#3d7a9f').toHwb(2)    // { h: 205.71, w: 23.92, b: 37.65, a: 1 }
```

The `minify()` plugin preserves full HSL precision when building candidates, so minification is now lossless — it only picks HSL when the string is genuinely shorter than hex/rgb.

## License

MIT

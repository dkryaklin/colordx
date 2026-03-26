# @colordx/core

**[Try it on colordx.dev](https://colordx.dev)**

A modern color manipulation library built for the CSS Color 4 era. The successor to [colord](https://github.com/omgovich/colord) with first-class support for **OKLCH** and **OKLab**. **5 KB gzipped. More than 2× faster than colord.**

## Why colordx?

[colord](https://github.com/omgovich/colord) is a great library, but it was designed around CSS Color 3. Modern CSS uses `oklch()` and `oklab()` — color spaces that produce better gradients, more accurate lightness adjustments, and consistent hue shifts. colord has no support for them, not even via a plugin. With colordx, they're built in.

## Performance

Benchmarks run on Apple M4, Node.js 22, using [mitata](https://github.com/evanwashere/mitata). Operations per second — higher is better.

| Benchmark | **colordx** | colord | culori | chroma-js | color | tinycolor2 |
|---|---|---|---|---|---|---|
| HEX → toHsl | **27.1M** | 10M | 6.5M | 3.2M | 2.5M | 2.4M |
| HEX → lighten → toHex | **15M** | 5.7M | 4.8M | 1.1M | 990K | 960K |
| Mix two colors | **8.7M** | 1.3M | 714K | 1.1M | 505K | 1.1M |
| HEX → toOklch | **3.6M** | — | 3.4M | 980K | 1.8M | — |
| inGamutP3 | **3.7M** | — | 1M | — | — | — |
| inGamutRec2020 | **3.9M** | — | 943K | — | — | — |

## Install

```bash
npm install @colordx/core
```

## Usage

```ts
import { colordx } from '@colordx/core';

colordx('#ff0000').toOklch(); // { l: 0.6279, c: 0.2577, h: 29.23, a: 1 }
colordx('#ff0000').toOklchString(); // 'oklch(0.6279 0.2577 29.23)'
colordx('#ff0000').lighten(0.1).toHex(); // '#ff3333'
colordx('oklch(0.5 0.2 240)').toHex(); // '#0055c2'
```

## API

All methods are immutable — they return a new `Colordx` instance.

### Parsing

Accepts any CSS color string or color object:

```ts
colordx('#ff0000');
colordx('#f00');
colordx('rgb(255, 0, 0)');
colordx('rgba(255, 0, 0, 0.5)');
colordx('hsl(0, 100%, 50%)');
colordx('hwb(0 0% 0%)');
colordx('oklab(0.6279 0.2249 0.1257)');
colordx('oklch(0.6279 0.2577 29.23)');
colordx({ r: 255, g: 0, b: 0, a: 1 });
colordx({ h: 0, s: 100, l: 50, a: 1 });
colordx({ h: 0, s: 100, v: 100, a: 1 });
colordx({ h: 0, w: 0, b: 0, a: 1 });
colordx({ l: 0.6279, a: 0.2249, b: 0.1257, alpha: 1 }); // OKLab
colordx({ l: 0.6279, c: 0.2577, h: 29.23, a: 1 }); // OKLch
// With p3/rec2020 plugins loaded:
colordx('color(display-p3 0.9176 0.2003 0.1386)'); // Display-P3 string
colordx('color(rec2020 0.7919 0.2307 0.0739)'); // Rec.2020 string
```

### Conversion

```ts
.toRgb()           // { r: 255, g: 0, b: 0, a: 1 }
.toRgbString()     // 'rgb(255, 0, 0)'
.toHex()           // '#ff0000'
.toNumber()        // 16711680  (0xff0000 — PixiJS / Discord integer format)
.toHsl()           // { h: 0, s: 100, l: 50, a: 1 }
.toHslString()     // 'hsl(0, 100%, 50%)'
.toHsv()           // { h: 0, s: 100, v: 100, a: 1 }
.toHsvString()     // 'hsv(0, 100%, 100%)'
.toHwb()           // { h: 0, w: 0, b: 0, a: 1 }
.toHwbString()     // 'hwb(0 0% 0%)'
// toHsl/toHwb accept an optional precision argument (decimal places):
colordx('#3d7a9f').toHsl()         // { h: 205.71, s: 43.24, l: 43.33, a: 1 }      — default (2)
colordx('#3d7a9f').toHsl(4)        // { h: 205.7143, s: 43.2432, l: 43.3333, a: 1 }
colordx('#3d7a9f').toHsl(0)        // { h: 206, s: 43, l: 43, a: 1 }               — integers
colordx('#3d7a9f').toHslString()   // 'hsl(205.71, 43.24%, 43.33%)'
colordx('#3d7a9f').toHslString(4)  // 'hsl(205.7143, 43.2432%, 43.3333%)'
colordx('#3d7a9f').toHwb()         // { h: 206, w: 24, b: 38, a: 1 }               — default (0)
colordx('#3d7a9f').toHwb(2)        // { h: 205.71, w: 23.92, b: 37.65, a: 1 }
colordx('#3d7a9f').toHwbString()   // 'hwb(206 24% 38%)'
colordx('#3d7a9f').toHwbString(2)  // 'hwb(205.71 23.92% 37.65%)'
.toOklab()         // { l: 0.6279, a: 0.2249, b: 0.1257, alpha: 1 }
.toOklabString()   // 'oklab(0.6279 0.2249 0.1257)'
.toOklch()         // { l: 0.6279, c: 0.2577, h: 29.23, a: 1 }
.toOklchString()   // 'oklch(0.6279 0.2577 29.23)'
```

### Manipulation

```ts
.lighten(0.1)                        // increase lightness by 10 percentage points
.lighten(0.1, { relative: true })    // increase lightness by 10% of current value
.darken(0.1)                         // decrease lightness by 10 percentage points
.darken(0.1, { relative: true })     // decrease lightness by 10% of current value
.saturate(0.1)                       // increase saturation by 10 percentage points
.saturate(0.1, { relative: true })   // increase saturation by 10% of current value
.desaturate(0.1)                     // decrease saturation by 10 percentage points
.desaturate(0.1, { relative: true }) // decrease saturation by 10% of current value
.grayscale()       // fully desaturate
.invert()          // invert RGB channels
.rotate(30)        // rotate hue by 30°
.mix('#0000ff', 0.5)  // mix with another color
.alpha(0.5)        // set alpha
.hue(120)          // set hue (HSL)
.lightness(0.5)    // set lightness (OKLCH, 0–1)
.chroma(0.1)       // set chroma (OKLCH, 0–0.4)
```

### Getters

```ts
.isValid()         // true if input was parseable
.alpha()           // get alpha (0–1)
.hue()             // get hue (0–360)
.lightness()       // get OKLCH lightness (0–1)
.chroma()          // get OKLCH chroma (0–0.4)
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

getFormat('#ff0000'); // 'hex'
getFormat('rgb(255, 0, 0)'); // 'rgb'
getFormat('hsl(0, 100%, 50%)'); // 'hsl'
getFormat('hwb(0 0% 0%)'); // 'hwb'
getFormat('oklch(0.5 0.2 240)'); // 'lch'  — oklch and lch() both return 'lch'
getFormat('oklab(0.6279 0.2249 0.1257)'); // 'lab'  — oklab and lab() both return 'lab'
getFormat({ r: 255, g: 0, b: 0, a: 1 }); // 'rgb'
getFormat({ h: 0, s: 100, l: 50, a: 1 }); // 'hsl'
getFormat('notacolor'); // undefined
// Plugin-added parsers (cmyk, lch string, names, p3, rec2020) return 'name'

nearest('#800', ['#f00', '#ff0', '#00f']); // '#f00' — perceptual distance via OKLab
nearest('#ffe', ['#f00', '#ff0', '#00f']); // '#ff0'

random(); // random Colordx instance
```

### Gamut

OKLCH and OKLab can describe colors outside the sRGB gamut. colordx includes standalone utilities for checking and mapping colors into sRGB, Display-P3, and Rec.2020:

```ts
import { inGamutP3, inGamutRec2020, inGamutSrgb, toGamutP3, toGamutRec2020, toGamutSrgb } from '@colordx/core';

// Check: is this color displayable in sRGB?
inGamutSrgb('#ff0000'); // true  — hex is always sRGB
inGamutSrgb('oklch(0.6279 0.2577 29.23)'); // true  — red
inGamutSrgb('oklch(0.5 0.4 180)'); // false — too much cyan chroma

// Map: reduce chroma until in-gamut (preserves lightness and hue)
toGamutSrgb('oklch(0.5 0.4 180)'); // → Colordx at the sRGB boundary
toGamutSrgb('#ff0000'); // → unchanged, already in sRGB

// Display-P3 gamut (wider than sRGB)
inGamutP3('oklch(0.64 0.27 29)'); // true  — inside P3 but outside sRGB
inGamutP3('oklch(0.5 0.4 180)'); // false — outside P3
toGamutP3('oklch(0.5 0.4 180)'); // → Colordx at the P3 boundary

// Rec.2020 gamut (wider than P3)
inGamutRec2020('oklch(0.5 0.4 180)'); // false — outside Rec.2020
toGamutRec2020('oklch(0.5 0.4 180)'); // → Colordx at the Rec.2020 boundary
```

Gamut containment is hierarchical: sRGB ⊂ Display-P3 ⊂ Rec.2020. All three `inGamut*` functions always return `true` for sRGB-bounded inputs (hex, rgb, hsl, hsv, hwb). The `toGamut*` functions use a binary chroma-reduction search following the [CSS Color 4 gamut mapping algorithm](https://www.w3.org/TR/css-color-4/#css-gamut-mapping).

## Plugins

Opt-in plugins for less common color spaces and utilities:

```ts
import { extend } from '@colordx/core';
// toName(), parses CSS color names
import a11y from '@colordx/core/plugins/a11y';
// toLch() (CIE LCH D50), toLchString(), parses lch() strings and LCH objects
import cmyk from '@colordx/core/plugins/cmyk';
// toCmyk(), toCmykString(), parses device-cmyk() strings and CMYK objects
import delta from '@colordx/core/plugins/delta';
// isReadable(), readableScore(), minReadable(), apcaContrast(), isReadableApca()
import harmonies from '@colordx/core/plugins/harmonies';
import lab from '@colordx/core/plugins/lab';
// toLab() (CIE Lab D50), toXyz() (CIE XYZ D50), parses Lab/XYZ objects
import lch from '@colordx/core/plugins/lch';
// tint(), shade(), tone(), palette()
import minify from '@colordx/core/plugins/minify';
// harmonies()
import mix from '@colordx/core/plugins/mix';
// delta() — CIEDE2000 color difference (0–1)
import names from '@colordx/core/plugins/names';
// minify() — shortest CSS string
import p3 from '@colordx/core/plugins/p3';
// toP3(), toP3String(), parses color(display-p3 ...) strings
import rec2020 from '@colordx/core/plugins/rec2020';

// toRec2020(), toRec2020String(), parses color(rec2020 ...) strings

extend([lab, lch, cmyk, delta, names, a11y, harmonies, mix, minify, p3, rec2020]);
```

### lab plugin

CIE Lab (D50) and CIE XYZ (D50) color models. Lab and XYZ objects are also accepted as color input.

```ts
import lab from '@colordx/core/plugins/lab';

extend([lab]);

colordx('#ff0000').toLab(); // { l: 54.29, a: 80.82, b: 69.91, alpha: 1 }
colordx('#ff0000').toXyz(); // { x: 43.61, y: 22.25, z: 1.39, a: 1 }

// Lab and XYZ objects parse as color input (with lab plugin loaded)
colordx({ l: 54.29, a: 80.82, b: 69.91, alpha: 1 }).toHex(); // '#ff0000'
colordx({ x: 43.61, y: 22.25, z: 1.39, a: 1 }).toHex(); // '#ff0000'
```

### lch plugin

CIE LCH (D50) — the polar form of CIE Lab. Parses `lch()` CSS strings and LCH objects.

```ts
import lch from '@colordx/core/plugins/lch';

extend([lch]);

colordx('#ff0000').toLch(); // { l: 54.29, c: 106.84, h: 40.85, a: 1 }
colordx('#ff0000').toLchString(); // 'lch(54.29% 106.84 40.85)'
colordx('lch(54.29% 106.84 40.85)').toHex(); // '#ff0000'
colordx({ l: 50, c: 50, h: 180, a: 1 }).toHex(); // parses as LCH object
```

### cmyk plugin

CMYK color model. Parses `device-cmyk()` CSS strings and CMYK objects.

```ts
import cmyk from '@colordx/core/plugins/cmyk';

extend([cmyk]);

colordx('#ff0000').toCmyk(); // { c: 0, m: 100, y: 100, k: 0, a: 1 }
colordx('#ff0000').toCmykString(); // 'device-cmyk(0% 100% 100% 0%)'
colordx('device-cmyk(0% 100% 100% 0%)').toHex(); // '#ff0000'
colordx({ c: 0, m: 100, y: 100, k: 0, a: 1 }).toHex(); // '#ff0000'
```

### delta plugin

CIEDE2000 perceptual color difference. Returns a value from 0 (identical) to ~1 (maximum difference). Defaults to comparing against white.

```ts
import delta from '@colordx/core/plugins/delta';

extend([delta]);

colordx('#ff0000').delta('#ff0000'); // 0      — identical
colordx('#000000').delta('#ffffff'); // ~1     — maximum perceptual distance
colordx('#ff0000').delta('#0000ff'); // > 0    — red vs blue
colordx('#ff0000').delta(); // compared against white (default)
```

### names plugin

CSS named color support (140 names from the CSS spec). `toName()` returns `undefined` for colors with no CSS name.

```ts
import names from '@colordx/core/plugins/names';

extend([names]);

colordx('red').toHex(); // '#ff0000'
colordx('rebeccapurple').toHex(); // '#663399'
colordx('#ff0000').toName(); // 'red'
colordx('#c06060').toName(); // undefined — no CSS name for this color
```

### harmonies plugin

Color harmony generation using hue rotation.

```ts
import harmonies from '@colordx/core/plugins/harmonies';

extend([harmonies]);

colordx('#ff0000').harmonies(); // [red, cyan]  — complementary (default)
colordx('#ff0000').harmonies('analogous'); // 3 colors at ±30°
colordx('#ff0000').harmonies('triadic'); // 3 colors at 120° intervals
colordx('#ff0000').harmonies('tetradic'); // 4 colors at 90° intervals
colordx('#ff0000').harmonies('split-complementary'); // 3 colors at 0°, 150°, 210°
```

### mix plugin

Color mixing helpers built on top of `.mix()`.

```ts
import mix from '@colordx/core/plugins/mix';

extend([mix]);

colordx('#ff0000').tint(0.5); // mix 50% with white → #ff8080
colordx('#ff0000').shade(0.5); // mix 50% with black → #800000
colordx('#ff0000').tone(0.5); // mix 50% with gray  → #c04040

// palette: N evenly-spaced stops from this color to a target (default: white)
colordx('#ff0000').palette(5); // [#ff0000, #ff4040, #ff8080, #ffbfbf, #ffffff]
colordx('#ff0000').palette(3, '#0000ff'); // [#ff0000, #800080, #0000ff]
```

### minify plugin

Returns the shortest valid CSS representation of a color. By default tries hex, RGB, and HSL and picks the shortest.

```ts
import minify from '@colordx/core/plugins/minify';

extend([minify]);

colordx('#ff0000').minify(); // '#f00'
colordx('#ffffff').minify(); // '#fff'
colordx('#ff0000').minify({ name: true }); // 'red'  — requires names plugin
colordx({ r: 0, g: 0, b: 0, a: 0 }).minify({ transparent: true }); // 'transparent'
colordx({ r: 255, g: 0, b: 0, a: 0.5 }).minify({ alphaHex: true }); // '#ff000080'

// Disable specific formats to exclude them from candidates:
colordx('#ff0000').minify({ hsl: false }); // skips HSL, picks from hex/RGB
```

### a11y plugin

WCAG 2.x contrast (uses `.contrast()` from core):

```ts
colordx('#000').isReadable('#fff'); // true  — AA normal (ratio >= 4.5)
colordx('#000').isReadable('#fff', { level: 'AAA' }); // true  — AAA normal (ratio >= 7)
colordx('#000').isReadable('#fff', { size: 'large' }); // true  — AA large (ratio >= 3)
colordx('#000').readableScore('#fff'); // 'AAA'
colordx('#e60000').readableScore('#ffff47'); // 'AA'
colordx('#949494').readableScore('#fff'); // 'AA large'
colordx('#aaa').readableScore('#fff'); // 'fail'
colordx('#777').minReadable('#fff'); // darkened/lightened to reach 4.5
```

APCA (Accessible Perceptual Contrast Algorithm) — the projected replacement for WCAG 2.x in WCAG 3.0:

```ts
// Returns a signed Lc value: positive = dark text on light bg, negative = light text on dark bg
colordx('#000').apcaContrast('#fff'); //  106.0
colordx('#fff').apcaContrast('#000'); // -107.9
colordx('#202122').apcaContrast('#cf674a'); //  37.2  ← dark text on orange
colordx('#ffffff').apcaContrast('#cf674a'); // -69.5  ← white text on orange

// Checks readability using |Lc| thresholds: >= 75 for normal text, >= 60 for large text/headings
colordx('#000').isReadableApca('#fff'); // true
colordx('#777').isReadableApca('#fff'); // false
colordx('#777').isReadableApca('#fff', { size: 'large' }); // true
```

APCA is better suited than WCAG 2.x for dark color pairs and more accurately reflects human perception. See [Introduction to APCA](https://git.apcacontrast.com/documentation/APCAeasyIntro) for background.

### p3 plugin

Adds Display-P3 color space support. Display-P3 uses the same transfer function as sRGB but a wider gamut (about 26% more colors).

```ts
import p3 from '@colordx/core/plugins/p3';

extend([p3]);

colordx('#ff0000').toP3(); // { r: 0.9176, g: 0.2003, b: 0.1386, a: 1 }
colordx('#ff0000').toP3String(); // 'color(display-p3 0.9176 0.2003 0.1386)'

// Parse Display-P3 strings (alpha optional)
colordx('color(display-p3 0.9176 0.2003 0.1386)').toHex(); // '#ff0000'
colordx('color(display-p3 0.9176 0.2003 0.1386 / 0.5)').toHex(); // '#ff000080'
```

> **Note:** Object parsing (`{ r, g, b, a }`) is not supported for P3 — the shape is identical to sRGB and would be ambiguous. Use string format to pass P3 values into colordx.

### rec2020 plugin

Adds Rec.2020 (BT.2020) color space support. Rec.2020 has the widest gamut of the three — it covers most of the visible spectrum.

```ts
import rec2020 from '@colordx/core/plugins/rec2020';

extend([rec2020]);

colordx('#ff0000').toRec2020(); // { r: 0.7919, g: 0.2307, b: 0.0739, a: 1 }
colordx('#ff0000').toRec2020String(); // 'color(rec2020 0.7919 0.2307 0.0739)'

// Parse Rec.2020 strings (alpha optional)
colordx('color(rec2020 0.7919 0.2307 0.0739)').toHex(); // '#ff0000'
colordx('color(rec2020 0.7919 0.2307 0.0739 / 0.5)').toHex(); // '#ff000080'
```

> **Note:** Same as p3 — object parsing is not supported. Use string format.

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

`.lighten()`, `.darken()`, `.saturate()`, and `.desaturate()` accept an optional `{ relative: true }` flag not present in colord — see [Relative lighten/darken](#relative-lightendarken) below.

### What changed

**OKLCH and OKLab are now core** — no plugin needed:

```ts
// colord (requires plugin — not available)
// colordx
colordx('#ff0000').toOklch();
colordx('#ff0000').toOklchString();
colordx('oklch(0.5 0.2 240)').toHex();
```

**CIE Lab, LCH, XYZ, CMYK moved to plugins:**

```ts
// colord
// colordx
import { extend } from '@colordx/core';
import cmyk from '@colordx/core/plugins/cmyk';
import lab from '@colordx/core/plugins/lab';
import lch from '@colordx/core/plugins/lch';
import { colord } from 'colord';
import cmykPlugin from 'colord/plugins/cmyk';
import labPlugin from 'colord/plugins/lab';
import lchPlugin from 'colord/plugins/lch';
import xyzPlugin from 'colord/plugins/xyz';

colordExtend([labPlugin, lchPlugin, xyzPlugin, cmykPlugin]);

extend([lab, lch, cmyk]);
```

**`delta()` moved to a plugin:**

```ts
// colord
// colordx
import delta from '@colordx/core/plugins/delta';
import deltaPlugin from 'colord/plugins/lab';

colordExtend([deltaPlugin]);
colord('#ff0000').delta('#00ff00');

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
colord('#f0f3f1').mix('#007d40', 0.14); // '#d3e2d6'  ← Lab interpolation
colordx('#f0f3f1').mix('#007d40', 0.14); // '#cee2d8'  ← RGB interpolation (matches browser)
```

The same applies to `tint()`, `shade()`, and `tone()` from the mix plugin, which all call `.mix()` internally. If you have hardcoded expected hex values from colord's mix output, update them — the new values are more accurate for UI work.

### `contrast()` rounding

colord uses `Math.floor` when rounding the WCAG contrast ratio to 2 decimal places; colordx uses standard rounding (`Math.round`). This affects values that fall exactly at .xxx5:

```ts
colord('#ff0000').contrast('#ffffff'); // 3.99  (floor)
colordx('#ff0000').contrast('#ffffff'); // 4     (round)
```

### HSL/HWB precision

colordx returns higher precision HSL/HSV values than colord. If your code does exact equality checks on `.toHsl()` output, use `toBeCloseTo` or round the values.

`toHsl()` and `toHwb()` now accept an optional `precision` argument to control decimal places:

```ts
colordx('#3d7a9f').toHsl(); // { h: 205.71, s: 43.24, l: 43.33, a: 1 }  — default (2)
colordx('#3d7a9f').toHsl(4); // { h: 205.7143, s: 43.2432, l: 43.3333, a: 1 }
colordx('#3d7a9f').toHsl(0); // { h: 206, s: 43, l: 43, a: 1 }

colordx('#3d7a9f').toHwb(); // { h: 206, w: 24, b: 38, a: 1 }            — default (0)
colordx('#3d7a9f').toHwb(2); // { h: 205.71, w: 23.92, b: 37.65, a: 1 }
```

The `minify()` plugin preserves full HSL precision when building candidates, so minification is now lossless — it only picks HSL when the string is genuinely shorter than hex/rgb.

## Relative lighten/darken

By default, `.lighten(0.1)` shifts lightness by an **absolute** 10 percentage points (same as colord). Pass `{ relative: true }` to shift by a fraction of the **current** value instead — useful when migrating from Qix's `color` library or when you want proportional adjustments:

```ts
// Color with l=10%
colordx('#1a0000').lighten(0.1); // l = 10 + 10 = 20%  (absolute)
colordx('#1a0000').lighten(0.1, { relative: true }); // l = 10 * 1.1 = 11% (relative)

// Color with s=40%
colordx('#a35050').saturate(0.1); // s = 40 + 10 = 50%  (absolute)
colordx('#a35050').saturate(0.1, { relative: true }); // s = 40 * 1.1 = 44% (relative)
```

The same flag works on `.darken()` and `.desaturate()`.

## License

MIT

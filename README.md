# @colordx/core

**[Try it on colordx.dev](https://colordx.dev)**

A modern color manipulation library built for the CSS Color 4 era. The successor to [colord](https://github.com/omgovich/colord) with first-class support for **OKLCH** and **OKLab**. **3 KB gzipped. More than 2× faster than colord.**

## Why colordx?

[colord](https://github.com/omgovich/colord) is a great library, but it was designed around CSS Color 3. Modern CSS uses `oklch()` and `oklab()` — color spaces that produce better gradients, more accurate lightness adjustments, and consistent hue shifts. colord has no support for them, not even via a plugin. With colordx, they're built in.

## Performance

Benchmarks run on Apple M4, Node.js 22, using [mitata](https://github.com/evanwashere/mitata). Operations per second — higher is better.

| Benchmark | **colordx** | @texel/color | colord | culori | chroma-js | color | tinycolor2 |
|---|---|---|---|---|---|---|---|
| HEX → toHsl | **13M** | — | 5.2M | 3.4M | 2.4M | 1.7M | 1.7M |
| HEX → lighten → toHex | **9.9M** | — | 3.8M | 3.1M | 780K | 650K | 650K |
| Mix two colors | **6.3M** | 4.8M | 1.4M | 920K | 1.0M | 460K | 1.1M |
| HEX → toOklch | **5.6M** | 4.2M | — | 3.3M | 1.0M | 1.8M | — |
| inGamutP3 | **4.4M** | 3.0M | — | 960K | — | — | — |
| inGamutRec2020 | **4.1M** | 3.0M | — | 1.0M | — | — | — |

## Install

```bash
npm install @colordx/core
```

## Quick start

```ts
import { colordx } from '@colordx/core';

// Parse any CSS color string or color object, then chain conversions:
colordx('#ff0000').toRgbString();     // 'rgb(255, 0, 0)'
colordx('#ff0000').toHex();           // '#ff0000'
colordx('#ff0000').toOklch();         // { l: 0.628, c: 0.2577, h: 29.23, alpha: 1 }
colordx('#ff0000').toOklchString();   // 'oklch(0.628 0.2577 29.23)'

// Works from any input format — hex, rgb(), hsl(), oklch(), oklab(), plain objects:
colordx('oklch(0.5 0.2 240)').toHex();                     // '#0069c7'
colordx({ r: 255, g: 0, b: 0, alpha: 1 }).toHslString();   // 'hsl(0, 100%, 50%)'

// Chain manipulations — each call returns a new immutable Colordx:
colordx('#ff0000').lighten(0.1).saturate(0.2).toHex();
colordx('#3d7a9f').rotate(30).darken(0.1).toRgbString();
```

The `colordx()` factory is all you need for day-to-day work. For out-of-gamut `oklch()` / `oklab()` inputs, `.toHex()` / `.toRgbString()` clip in linear sRGB — the same strategy browsers use when rendering `background: oklch(...)` — so your output matches what users see on screen. If you need stricter hue/lightness preservation for authoring workflows, see [Gamut](#gamut).

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
colordx('oklab(0.6279 0.2249 0.1257)');
colordx('oklch(0.6279 0.2577 29.23)');
colordx({ r: 255, g: 0, b: 0, alpha: 1 });
colordx({ h: 0, s: 100, l: 50, alpha: 1 });
colordx({ l: 0.6279, a: 0.2249, b: 0.1257, alpha: 1 }); // OKLab
colordx({ l: 0.6279, c: 0.2577, h: 29.23, alpha: 1 }); // OKLch
// With p3 plugin loaded:
colordx('color(display-p3 0.9176 0.2003 0.1386)'); // Display-P3 string
// With rec2020 plugin loaded:
colordx('color(rec2020 0.7919 0.2307 0.0739)'); // Rec.2020 string
// With hwb plugin loaded:
colordx('hwb(0 0% 0%)');
colordx({ h: 0, w: 0, b: 0, alpha: 1 });
// With hsv plugin loaded:
colordx({ h: 0, s: 100, v: 100, alpha: 1 }); // HSV
```

### Conversion

```ts
.toRgb()           // { r: 255, g: 0, b: 0, alpha: 1 }
.toRgbString()     // 'rgb(255, 0, 0)'
.toHex()           // '#ff0000'
.toNumber()        // 16711680  (0xff0000 — PixiJS / Discord integer format)
.toHsl()           // { h: 0, s: 100, l: 50, alpha: 1 }
.toHslString()     // 'hsl(0, 100%, 50%)'
// toHsl accepts an optional precision argument (decimal places):
colordx('#3d7a9f').toHsl()         // { h: 202.65, s: 44.55, l: 43.14, alpha: 1 }      — default (2)
colordx('#3d7a9f').toHsl(4)        // { h: 202.6531, s: 44.5455, l: 43.1373, alpha: 1 }
colordx('#3d7a9f').toHsl(0)        // { h: 203, s: 45, l: 43, alpha: 1 }               — integers
colordx('#3d7a9f').toHslString()   // 'hsl(202.65, 44.55%, 43.14%)'
colordx('#3d7a9f').toHslString(4)  // 'hsl(202.6531, 44.5455%, 43.1373%)'
// With hwb plugin loaded:
.toHwb()           // { h: 0, w: 0, b: 0, alpha: 1 }
.toHwbString()     // 'hwb(0 0% 0%)'
.toOklab()         // { l: 0.628, a: 0.2249, b: 0.1258, alpha: 1 }
.toOklabString()   // 'oklab(0.628 0.2249 0.1258)'
.toOklch()         // { l: 0.628, c: 0.2577, h: 29.23, alpha: 1 }
.toOklchString()   // 'oklch(0.628 0.2577 29.23)'
// With p3 plugin loaded:
.toP3()            // { r: 0.9175, g: 0.2003, b: 0.1386, alpha: 1, colorSpace: 'display-p3' }
.toP3String()      // 'color(display-p3 0.9175 0.2003 0.1386)'
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
.isDark()          // brightness < 0.5
.isLight()         // brightness >= 0.5
.isEqual('#f00')   // exact RGB equality
// With a11y plugin loaded:
.luminance()       // relative luminance (0–1, WCAG)
.contrast('#fff')  // WCAG 2.x contrast ratio (1–21)
// With mix plugin loaded:
.mix('#0000ff', 0.5)       // mix in sRGB space (CSS spec)
.mixOklab('#0000ff', 0.5)  // mix in Oklab space (perceptually uniform)
```

### Utilities

```ts
import { getFormat, nearest, oklchToLinear, oklchToRgbChannels, random } from '@colordx/core';

getFormat('#ff0000'); // 'hex'
getFormat('rgb(255, 0, 0)'); // 'rgb'
getFormat('hsl(0, 100%, 50%)'); // 'hsl'
getFormat('oklch(0.5 0.2 240)'); // 'oklch'
getFormat('oklab(0.6279 0.2249 0.1257)'); // 'oklab'
getFormat({ r: 255, g: 0, b: 0, alpha: 1 }); // 'rgb'
getFormat({ h: 0, s: 100, l: 50, alpha: 1 }); // 'hsl'
getFormat('notacolor'); // undefined
// Plugin-added parsers register their own format:
// p3 → 'p3', hsv → 'hsv', cmyk → 'cmyk', lch → 'lch', lab → 'lab', xyz → 'xyz', names → 'name', rec2020 → 'rec2020'

nearest('#800', ['#f00', '#ff0', '#00f']); // '#f00' — perceptual distance via OKLab
nearest('#ffe', ['#f00', '#ff0', '#00f']); // '#ff0'

random(); // random Colordx instance

// Low-level functional converters — no object allocation, for hot paths (canvas gradients, etc.)
oklchToRgbChannels(0.5, 0.2, 240); // [r, g, b] gamma-encoded sRGB in [0, 1]
// Out-of-gamut channels may exceed [0, 1] — callers clamp before byte encoding

const linear = oklchToLinear(0.5, 0.2, 240); // unclamped linear sRGB — also a free sRGB gamut check

// P3/Rec.2020 channel functions live in their plugins:
import { linearToP3Channels, oklchToP3Channels } from '@colordx/core/plugins/p3';
import { linearToRec2020Channels, oklchToRec2020Channels } from '@colordx/core/plugins/rec2020';

oklchToP3Channels(0.5, 0.2, 240);      // [r, g, b] gamma-encoded Display-P3 in [0, 1]
oklchToRec2020Channels(0.5, 0.2, 240); // [r, g, b] gamma-encoded Rec.2020 in [0, 1] (BT.2020 gamma)

// Split-step API: compute the shared expensive OKLCH→linear sRGB step once,
// then apply cheap per-space steps to avoid repeating 3× Math.cbrt + OKLab matrix.
linearToP3Channels(...linear);      // linear sRGB → gamma-encoded P3
linearToRec2020Channels(...linear); // linear sRGB → gamma-encoded Rec.2020 (BT.2020 gamma)
```

### Gamut

`oklch()` and `oklab()` can describe colors outside the sRGB gamut. **For everyday conversion, `.toRgbString()` / `.toHex()` already do the right thing** — they naive-clip in linear sRGB to match browser rendering, so your output matches what `background: oklch(...)` displays on screen. You only need the methods below when that default isn't what you want.

Internally, out-of-gamut `oklch()` / `oklab()` inputs are stored **unclamped**, so the authored color is preserved losslessly. That means `.toOklchString()` round-trips the original, and you can choose when (and how) to fold the color into sRGB:

```ts
const input = 'oklch(0.5 0.4 180)';  // out of sRGB gamut

// 1. Preserve — keep the authored oklch as-is, clip only at sRGB output time
colordx(input).toOklchString();          // 'oklch(0.5 0.4 180)'
colordx(input).toRgbString();            // 'rgb(0, 152, 108)' — naive clip, matches browser

// 2. Map — CSS Color 4 gamut mapping (preserves lightness + hue, reduces chroma)
colordx(input).mapSrgb().toOklchString();   // 'oklch(0.5091 0.0938 177.85)'
colordx(input).mapSrgb().toRgbString();     // 'rgb(0, 119, 102)'

// 3. Clamp — naive-clip into sRGB as a Colordx (matches browser, but hue drifts)
colordx(input).clampSrgb().toOklchString(); // 'oklch(0.6012 0.1276 164.3)'
colordx(input).clampSrgb().toRgbString();   // 'rgb(0, 152, 108)' — same bytes as (1)
```

- **`.mapSrgb()`** — CSS Color 4 chroma-reduction binary search. Preserves lightness and hue; sacrifices chroma. Use when hue stability matters — design tokens, palettes, programmatic harmonies, OKLCH pickers.
- **`.clampSrgb()`** — naive clip in linear sRGB. Hue and lightness may drift. Use when you want a `Colordx` whose `.toOklchString()` describes what browsers actually render.

A static form is also available for one-shot conversion without wrapping first — `Colordx.toGamutSrgb(input)` is equivalent to `colordx(input).mapSrgb()`.

colordx also includes standalone utilities for checking and mapping into wider gamuts (Display-P3 / Rec.2020, via plugins):

```ts
import { Colordx, inGamutSrgb } from '@colordx/core';
import { inGamutP3 } from '@colordx/core/plugins/p3';
import { inGamutRec2020 } from '@colordx/core/plugins/rec2020';
import p3 from '@colordx/core/plugins/p3';
import rec2020 from '@colordx/core/plugins/rec2020';
extend([p3, rec2020]);

// Check: is this color displayable in sRGB?
inGamutSrgb('#ff0000'); // true  — hex is always sRGB
inGamutSrgb('oklch(0.5 0.1 30)'); // true  — clearly in sRGB
inGamutSrgb('oklch(0.5 0.4 180)'); // false — too much cyan chroma

// Map: reduce chroma until in-gamut (preserves lightness and hue)
Colordx.toGamutSrgb('oklch(0.5 0.4 180)'); // → Colordx at the sRGB boundary
Colordx.toGamutSrgb('#ff0000'); // → unchanged, already in sRGB

// Display-P3 gamut (wider than sRGB) — available after extend([p3])
inGamutP3('oklch(0.64 0.27 29)'); // true  — inside P3 but outside sRGB
inGamutP3('oklch(0.5 0.4 180)'); // false — outside P3
Colordx.toGamutP3('oklch(0.5 0.4 180)'); // → Colordx at the P3 boundary

// Rec.2020 gamut (wider than P3) — available after extend([rec2020])
inGamutRec2020('oklch(0.5 0.4 180)'); // false — outside Rec.2020
Colordx.toGamutRec2020('oklch(0.5 0.4 180)'); // → Colordx at the Rec.2020 boundary
```

Gamut containment is hierarchical: sRGB ⊂ Display-P3 ⊂ Rec.2020. All `inGamut*` functions always return `true` for sRGB-bounded inputs (hex, rgb, hsl, hsv, hwb). The `toGamut*` functions use a binary chroma-reduction search following the [CSS Color 4 gamut mapping algorithm](https://www.w3.org/TR/css-color-4/#css-gamut-mapping).

## Plugins

Opt-in plugins for less common color spaces and utilities:

```ts
import { extend } from '@colordx/core';
import a11y from '@colordx/core/plugins/a11y';
// isReadable(), readableScore(), minReadable(), apcaContrast(), isReadableApca()
import cmyk from '@colordx/core/plugins/cmyk';
// toCmyk(), toCmykString(), parses device-cmyk() strings and CMYK objects
import harmonies from '@colordx/core/plugins/harmonies';
// harmonies()
import hwb from '@colordx/core/plugins/hwb';
// toHwb(), toHwbString(), parses hwb() strings and HWB objects
import hsv from '@colordx/core/plugins/hsv';
// toHsv(), toHsvString(), parses hsv() strings and HSV objects
import lab from '@colordx/core/plugins/lab';
// toLab(), toLabString(), toXyz(), toXyzString(), mixLab(), delta(), parses Lab/XYZ objects
import lch from '@colordx/core/plugins/lch';
// toLch(), toLchString(), parses lch() strings and LCH objects
import minify from '@colordx/core/plugins/minify';
// minify() — shortest CSS string
import mix from '@colordx/core/plugins/mix';
// tints(), shades(), tones(), palette()
import names from '@colordx/core/plugins/names';
// toName(), parses CSS color names
import p3 from '@colordx/core/plugins/p3';
// toP3(), toP3String(), inGamutP3(), Colordx.toGamutP3(), linearToP3Channels(), oklchToP3Channels(), parses color(display-p3 ...) strings
import rec2020 from '@colordx/core/plugins/rec2020';
// toRec2020(), toRec2020String(), inGamutRec2020(), Colordx.toGamutRec2020(), linearToRec2020Channels(), oklchToRec2020Channels(), parses color(rec2020 ...) strings

extend([lab, lch, cmyk, names, a11y, harmonies, hwb, hsv, mix, minify, p3, rec2020]);
```

### lab plugin

CIE Lab (D50) and CIE XYZ (D50) color models. Lab and XYZ objects are also accepted as color input (Lab requires a `colorSpace: 'lab'` discriminant). Also adds `.mixLab()` for colord-compatible perceptual mixing, `.delta()` for CIEDE2000 color difference, and string conversion methods.

```ts
import lab from '@colordx/core/plugins/lab';

extend([lab]);

colordx('#ff0000').toLab(); // { l: 54.29, a: 80.8, b: 69.89, alpha: 1, colorSpace: 'lab' }
colordx('#ff0000').toLabString(); // 'lab(54.29% 80.8 69.89)'
colordx('lab(54.29% 80.8 69.89)').toHex(); // '#ff0000'  — lab strings are parseable
colordx('#ff0000').toXyz(); // { x: 43.61, y: 22.25, z: 1.39, alpha: 1 }
colordx('#ff0000').toXyzString(); // 'color(xyz-d65 43.61 22.25 1.39)'

// Lab and XYZ objects parse as color input (with lab plugin loaded)
// Lab objects require colorSpace: 'lab' to distinguish from OKLab (which has the same l/a/b shape)
colordx({ l: 54.29, a: 80.8, b: 69.89, alpha: 1, colorSpace: 'lab' as const }).toHex(); // '#ff0000'
colordx({ x: 43.61, y: 22.25, z: 1.39, alpha: 1 }).toHex(); // '#ff0000'

// Mix in CIE Lab space (colord-compatible)
colordx('#000000').mixLab('#ffffff').toHex(); // '#777777'

// CIEDE2000 perceptual color difference (0 = identical, ~1 = maximum)
colordx('#ff0000').delta('#ff0000'); // 0
colordx('#000000').delta('#ffffff'); // ~1
colordx('#ff0000').delta(); // compared against white (default)
```

### lch plugin

CIE LCH (D50) — the polar form of CIE Lab. Parses `lch()` CSS strings and LCH objects.

```ts
import lch from '@colordx/core/plugins/lch';

extend([lch]);

colordx('#ff0000').toLch(); // { l: 54.29, c: 106.84, h: 40.86, alpha: 1, colorSpace: 'lch' }
colordx('#ff0000').toLchString(); // 'lch(54.29% 106.84 40.86)'
colordx('lch(54.29% 106.84 40.86)').toHex(); // '#ff0000'
// LCH objects require colorSpace: 'lch' to distinguish from OKLCH (which has the same l/c/h shape)
colordx({ l: 50, c: 50, h: 180, alpha: 1, colorSpace: 'lch' as const }).toHex(); // parses as LCH object
```

### cmyk plugin

CMYK color model. Parses `device-cmyk()` CSS strings and CMYK objects.

```ts
import cmyk from '@colordx/core/plugins/cmyk';

extend([cmyk]);

colordx('#ff0000').toCmyk(); // { c: 0, m: 100, y: 100, k: 0, alpha: 1 }
colordx('#ff0000').toCmykString(); // 'device-cmyk(0% 100% 100% 0%)'
colordx('device-cmyk(0% 100% 100% 0%)').toHex(); // '#ff0000'
colordx({ c: 0, m: 100, y: 100, k: 0, alpha: 1 }).toHex(); // '#ff0000'
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
colordx('#c06060').toName({ closest: true }); // nearest named color by RGB distance
```

### hsv plugin

HSV/HSVa color model. Parses `hsv()` / `hsva()` strings and HSV objects.

```ts
import hsv from '@colordx/core/plugins/hsv';

extend([hsv]);

colordx('#ff0000').toHsv(); // { h: 0, s: 100, v: 100, alpha: 1 }
colordx('#ff0000').toHsvString(); // 'hsv(0, 100%, 100%)'
colordx('hsv(0, 100%, 100%)').toHex(); // '#ff0000'
colordx({ h: 0, s: 100, v: 100, alpha: 1 }).toHex(); // '#ff0000'
```

### harmonies plugin

Color harmony generation using hue rotation.

```ts
import harmonies from '@colordx/core/plugins/harmonies';

extend([harmonies]);

colordx('#ff0000').harmonies();                              // complementary (default) — 2 colors
colordx('#ff0000').harmonies('complementary');               // [0°, 180°] — 2 colors
colordx('#ff0000').harmonies('analogous');                   // [−30°, 0°, 30°] — 3 colors
colordx('#ff0000').harmonies('split-complementary');         // [0°, 150°, 210°] — 3 colors
colordx('#ff0000').harmonies('triadic');                     // [0°, 120°, 240°] — 3 colors
colordx('#ff0000').harmonies('tetradic');                    // [0°, 90°, 180°, 270°] — 4 colors (square)
colordx('#ff0000').harmonies('rectangle');                   // [0°, 60°, 180°, 240°] — 4 colors
colordx('#ff0000').harmonies('double-split-complementary');  // [−30°, 0°, 30°, 150°, 210°] — 5 colors
```

### hwb plugin

CSS Color Level 4 HWB (Hue, Whiteness, Blackness) color model.

```ts
import hwb from '@colordx/core/plugins/hwb';

extend([hwb]);

colordx('#ff0000').toHwb();         // { h: 0, w: 0, b: 0, alpha: 1 }
colordx('#ff0000').toHwbString();   // 'hwb(0 0% 0%)'
colordx('hwb(0 0% 0%)').toHex();   // '#ff0000'
colordx({ h: 0, w: 0, b: 0, alpha: 1 }).toHex(); // '#ff0000'

// toHwb accepts an optional precision argument (decimal places):
colordx('#3d7a9f').toHwb();    // { h: 203, w: 24, b: 38, alpha: 1 }   — default (0)
colordx('#3d7a9f').toHwb(2);   // { h: 202.65, w: 23.92, b: 37.65, alpha: 1 }
colordx('#3d7a9f').toHwbString();  // 'hwb(203 24% 38%)'
colordx('#3d7a9f').toHwbString(2); // 'hwb(202.65 23.92% 37.65%)'
```

### mix plugin

Color mixing helpers built on top of `.mix()`.

```ts
import mix from '@colordx/core/plugins/mix';

extend([mix]);

colordx('#ff0000').tints(5); // [#ff0000, #ff4040, #ff8080, #ffbfbf, #ffffff]
colordx('#ff0000').shades(3); // [#ff0000, #800000, #000000]
colordx('#ff0000').tones(3);  // [#ff0000, #c04040, #808080]

// palette: N evenly-spaced stops toward any target (default: white)
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

WCAG 2.x contrast:

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

Adds Display-P3 color space support. P3 has a wider gamut than sRGB and is natively supported by all modern browsers and most Mac/iOS displays.

```ts
import p3 from '@colordx/core/plugins/p3';

extend([p3]);

colordx('#ff0000').toP3(); // { r: 0.9175, g: 0.2003, b: 0.1386, alpha: 1, colorSpace: 'display-p3' }
colordx('#ff0000').toP3String(); // 'color(display-p3 0.9175 0.2003 0.1386)'

// Parse Display-P3 strings (alpha optional)
colordx('color(display-p3 0.9175 0.2003 0.1386)').toHex(); // '#ff0000'
colordx('color(display-p3 0.9175 0.2003 0.1386 / 0.5)').toHex(); // '#ff000080'
```

The plugin also exports standalone gamut utilities and low-level channel functions. `inGamutP3` and the channel helpers need no `extend()`. Gamut mapping is available as `Colordx.toGamutP3` after `extend([p3])`:

```ts
import { Colordx, extend } from '@colordx/core';
import p3, { inGamutP3, linearToP3Channels, oklchToP3Channels } from '@colordx/core/plugins/p3';

extend([p3]);

inGamutP3('oklch(0.64 0.27 29)');        // true — inside P3 but outside sRGB
Colordx.toGamutP3('oklch(0.5 0.4 180)'); // → Colordx at the P3 boundary

oklchToP3Channels(0.5, 0.2, 240); // [r, g, b] gamma-encoded P3 in [0, 1]
```

Object parsing is also supported using the `colorSpace` discriminant:

```ts
colordx({ r: 0.9505, g: 0.2856, b: 0.0459, alpha: 1, colorSpace: 'display-p3' }).toHex();
```

### rec2020 plugin

Adds Rec.2020 (BT.2020) color space support. Rec.2020 has the widest gamut of the three — it covers most of the visible spectrum.

```ts
import rec2020 from '@colordx/core/plugins/rec2020';

extend([rec2020]);

colordx('#ff0000').toRec2020(); // { r: 0.792, g: 0.231, b: 0.0738, alpha: 1, colorSpace: 'rec2020' }
colordx('#ff0000').toRec2020String(); // 'color(rec2020 0.792 0.231 0.0738)'

// Parse Rec.2020 strings (alpha optional)
colordx('color(rec2020 0.792 0.231 0.0738)').toHex(); // '#ff0000'
colordx('color(rec2020 0.792 0.231 0.0738 / 0.5)').toHex(); // '#ff000080'
```

The plugin also exports standalone gamut utilities and low-level channel functions. `inGamutRec2020` and the channel helpers need no `extend()`. Gamut mapping is available as `Colordx.toGamutRec2020` after `extend([rec2020])`:

```ts
import { Colordx, extend } from '@colordx/core';
import rec2020, { inGamutRec2020, linearToRec2020Channels, oklchToRec2020Channels } from '@colordx/core/plugins/rec2020';

extend([rec2020]);

inGamutRec2020('oklch(0.5 0.4 180)');        // false — outside Rec.2020
Colordx.toGamutRec2020('oklch(0.5 0.4 180)'); // → Colordx at the Rec.2020 boundary

oklchToRec2020Channels(0.5, 0.2, 240); // [r, g, b] gamma-encoded Rec.2020 in [0, 1]
```

Object parsing is also supported using the `colorSpace` discriminant:

```ts
colordx({ r: 0.7919, g: 0.2307, b: 0.0739, alpha: 1, colorSpace: 'rec2020' }).toHex();
```

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
`.toHex()`, `.toRgb()`, `.toRgbString()`, `.toHsl()`, `.toHslString()`, `.lighten()`, `.darken()`, `.saturate()`, `.desaturate()`, `.grayscale()`, `.invert()`, `.rotate()`, `.alpha()`, `.hue()`, `.brightness()`, `.isDark()`, `.isLight()`, `.isEqual()`, `getFormat()`, `random()`

The following remain **plugin-only** (same as colord): `.mix()`, `.mixOklab()`, `.luminance()`, `.contrast()`, `.toHwb()`, `.toHwbString()`.

`.lighten()`, `.darken()`, `.saturate()`, and `.desaturate()` accept an optional `{ relative: true }` flag not present in colord — see [Relative lighten/darken](#relative-lightendarken) below.

### What changed

**HSV moved to a plugin:**

```ts
// colord
colord('#ff0000').toHsv();

// colordx
import hsv from '@colordx/core/plugins/hsv';
extend([hsv]);
colordx('#ff0000').toHsv();
```

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
import { colord, extend } from 'colord';
import labPlugin from 'colord/plugins/lab';
import lchPlugin from 'colord/plugins/lch';
import xyzPlugin from 'colord/plugins/xyz';
import cmykPlugin from 'colord/plugins/cmyk';
extend([labPlugin, lchPlugin, xyzPlugin, cmykPlugin]);

// colordx
import { colordx, extend } from '@colordx/core';
import lab from '@colordx/core/plugins/lab';
import lch from '@colordx/core/plugins/lch';
import cmyk from '@colordx/core/plugins/cmyk';
// Note: XYZ is part of the lab plugin in colordx
extend([lab, lch, cmyk]);
```

**`getFormat()` import path:**

```ts
// colord
import { getFormat } from 'colord';

// colordx
import { getFormat } from '@colordx/core';
```

**Alpha channel property renamed from `a` to `alpha`:**

colord used `a` as the alpha key in all color objects. colordx uses `alpha` everywhere (except OKLab and CIE Lab where `a` is a color axis).

```ts
// colord
colord('#ff0000').toRgb(); // { r: 255, g: 0, b: 0, a: 1 }
colord({ r: 255, g: 0, b: 0, a: 1 });

// colordx
colordx('#ff0000').toRgb(); // { r: 255, g: 0, b: 0, alpha: 1 }
colordx({ r: 255, g: 0, b: 0, alpha: 1 });
```

### `mix()` uses sRGB; use `mixLab()` or `mixOklab()` for perceptual blending

colord's `mix` plugin interpolated in **CIE Lab** space. colordx's `mix()` uses **sRGB interpolation**, matching CSS `color-mix(in srgb, ...)` and how browsers composite layers.

```ts
colordx('#000000').mix('#ffffff').toHex();       // '#808080' — sRGB (CSS spec)
colordx('#000000').mixOklab('#ffffff').toHex();  // '#636363' — Oklab (perceptually uniform)

// colord-compatible Lab mixing — requires lab plugin
import lab from '@colordx/core/plugins/lab';
extend([lab]);
colordx('#000000').mixLab('#ffffff').toHex();    // '#777777' — CIE Lab (colord-compatible)
```

The same applies to `tints()`, `shades()`, and `tones()` from the mix plugin, which all call `.mix()` internally. If you have hardcoded expected hex values from colord's mix output, switch to `.mixLab()` or update the values.

### `contrast()` rounding

colord uses `Math.floor` when rounding the WCAG contrast ratio to 2 decimal places; colordx uses standard rounding (`Math.round`). This affects values that fall exactly at .xxx5:

```ts
colord('#ff0000').contrast('#ffffff'); // 3.99  (floor)
colordx('#ff0000').contrast('#ffffff'); // 4     (round)
```

### HSL precision

colordx returns higher precision HSL/HSV values than colord. If your code does exact equality checks on `.toHsl()` output, use `toBeCloseTo` or round the values.

`toHsl()` now accepts an optional `precision` argument to control decimal places:

```ts
colordx('#3d7a9f').toHsl(); // { h: 202.65, s: 44.55, l: 43.14, alpha: 1 }  — default (2)
colordx('#3d7a9f').toHsl(4); // { h: 202.6531, s: 44.5455, l: 43.1373, alpha: 1 }
colordx('#3d7a9f').toHsl(0); // { h: 203, s: 45, l: 43, alpha: 1 }
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

## Roadmap

### CSS Color 4/5 completeness

- **`color-mix()`** — parse and evaluate `color-mix(in oklch, red 30%, blue)` strings, with support for all interpolation spaces and polar hue methods (`shorter`, `longer`, `increasing`, `decreasing`)
- **`color()` for remaining spaces** — `color(srgb ...)`, `color(srgb-linear ...)`, `color(a98-rgb ...)`, `color(prophoto-rgb ...)`, `color(xyz-d50 ...)`, `color(xyz-d65 ...)` string parsing (`display-p3` and `rec2020` already supported)
- **Relative color syntax** — `oklch(from red l c h)` and channel arithmetic like `oklch(from red l calc(c + 0.1) h)`

### Internals

- Deduplicate the sRGB→XYZ D65 matrix shared between `xyz.ts` and `lab.ts`

## License

MIT

# @colordx/core

**[Try it on colordx.dev](https://colordx.dev)**

A modern color manipulation library built for the CSS Color 4 era. Drop-in upgrade from [colord](https://github.com/omgovich/colord) with first-class support for **OKLCH**, **OKLab**, and a cleaner plugin system.

## Why colordx?

[colord](https://github.com/omgovich/colord) is a great library, but it was designed around CSS Color 3. Modern CSS uses `oklch()` and `oklab()` — color spaces that are perceptually uniform and supported natively in all modern browsers. With colord, you need plugins for those. With colordx, they're built in.

| Feature | colord | colordx |
|---|---|---|
| `hex`, `rgb`, `hsl`, `hsv`, `hwb` | ✅ core | ✅ core |
| `oklch`, `oklab` | ❌ not available | ✅ core |
| `lab` (CIE), `lch` (CIE), `xyz`, `cmyk` | plugin | plugin |
| `delta()` (CIEDE2000) | plugin | plugin |
| `names`, `a11y`, `harmonies`, `mix`, `minify` | plugin | plugin |
| Bundle size (gzipped) | ~2.1 KB | ~3.4 KB |
| `getFormat()` | ✅ | ✅ |

The extra ~1.3 KB buys you OKLab + OKLCH math in core — no plugin import needed for the color spaces that modern CSS actually uses.

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
.toHsl()           // { h: 0, s: 100, l: 50, a: 1 }
.toHslString()     // 'hsl(0, 100%, 50%)'
.toHsv()           // { h: 0, s: 100, v: 100, a: 1 }
.toHwb()           // { h: 0, w: 0, b: 0, a: 1 }
.toHwbString()     // 'hwb(0 0% 0%)'
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
.contrast('#fff')  // WCAG contrast ratio
.isEqual('#f00')   // exact RGB equality
```

### Utilities

```ts
import { getFormat, random } from '@colordx/core';

getFormat('#ff0000')          // 'hex'
getFormat('oklch(0.5 0.2 240)') // 'lch'
getFormat({ r: 255, g: 0, b: 0, a: 1 }) // 'rgb'
getFormat('notacolor')        // undefined

random()  // random Colordx instance
```

## Plugins

Opt-in plugins for less common color spaces and utilities:

```ts
import { extend } from '@colordx/core';
import lab   from '@colordx/core/plugins/lab';   // toLab(), toXyz()
import lch   from '@colordx/core/plugins/lch';   // toLch(), toLchString()
import cmyk  from '@colordx/core/plugins/cmyk';  // toCmyk(), toCmykString()
import delta from '@colordx/core/plugins/delta'; // delta() — CIEDE2000
import names from '@colordx/core/plugins/names'; // toName(), parse CSS color names
import a11y  from '@colordx/core/plugins/a11y';  // isReadable(), minReadable()
import harmonies from '@colordx/core/plugins/harmonies'; // harmonies()
import mix   from '@colordx/core/plugins/mix';   // tint(), shade(), tone(), palette()
import minify from '@colordx/core/plugins/minify'; // minify()

extend([lab, lch, cmyk, delta, names, a11y, harmonies, mix, minify]);
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

### HSL/HSV precision

colordx returns higher precision HSL/HSV values than colord. If your code does exact equality checks on `.toHsl()` output, use `toBeCloseTo` or round the values.

## License

MIT

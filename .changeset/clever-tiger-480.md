---
"@colordx/core": major
---

Move `toGamutSrgb`, `toGamutP3`, and `toGamutRec2020` from standalone exports to static methods on `Colordx` (`Colordx.toGamutSrgb`, `Colordx.toGamutP3`, `Colordx.toGamutRec2020`); fix wide-gamut accuracy by storing unclamped linear RGB internally and clamping only on sRGB output; extend transfer functions to the full real line for correct out-of-gamut channel handling; enable code splitting (bundle drops from 5 KB to 3 KB gzipped); add cssnano compatibility test suite.

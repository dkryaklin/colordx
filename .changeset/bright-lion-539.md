---
"@colordx/core": major
---

Rename alpha field from `a` to `alpha` on all color object types (RgbColor, HslColor, HsvColor, HwbColor, LchColor, OklchColor, CmykColor, P3Color, Rec2020Color, XyzColor); add `colorSpace` branding to LabColor, LchColor, P3Color, and Rec2020Color; rename `ColorFormat` values `'lab'`→`'oklab'` and `'lch'`→`'oklch'`; promote HSV string parsing, Display-P3 string parsing, and OKLab/OKLCH format identifiers to builtins (no plugin needed); add `toLabString`, `toXyzString` methods to lab plugin; fix luminance threshold (0.03928→0.04045), fix unclamped XYZ intermediate calculation, and add `parseHsvString` support.

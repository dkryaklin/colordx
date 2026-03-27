---
"@colordx/core": patch
---

Update color matrix coefficients and D50 white point to CSS Color 4 exact values for XYZ, Lab, LCH, Display-P3, and Rec.2020; output `none` hue keyword for achromatic colors in `toOklchString` and `toLchString`; support parsing `none` hue keyword in LCH string input.

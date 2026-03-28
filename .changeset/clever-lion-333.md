---
"@colordx/core": major
---

Move HSV, HWB, mix/mixOklab, luminance/contrast, P3, and Rec.2020 out of core into opt-in plugins; rename alpha property from `a` to `alpha` in all color objects; change getFormat return values for oklch/oklab from 'lch'/'lab' to 'oklch'/'oklab'; remove linearToP3Channels, linearToRec2020Channels, oklchToP3Channels, oklchToRec2020Channels, inGamutP3, inGamutRec2020, toGamutP3, and toGamutRec2020 from core exports (now in plugin modules); upgrade gamut mapping to the full CSS Color 4 binary-search algorithm with JND-based clipping; add object parsing support for P3 and Rec.2020 using colorSpace discriminant; add rectangle and double-split-complementary harmony types; fix toHsl to clamp h=360 to 0; update README API documentation and benchmark table

---
"@colordx/core": patch
---

Fix wide-gamut color data loss by using unclamped parse paths for oklch, oklab, p3, rec2020, and xyz inputs; out-of-sRGB-gamut channel values are now preserved instead of being clipped to sRGB on parse.

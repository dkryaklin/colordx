---
"@colordx/core": patch
---

Remove intermediate rounding in XYZ/Lab conversion pipeline to prevent precision loss; rounding is now applied only at the final output stage in toLab() and toXyz().

---
"@colordx/core": patch
---

Fixed minify plugin to skip lossy HSL candidates that don't round-trip back to the original RGB values, ensuring color accuracy.

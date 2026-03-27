---
"@colordx/core": minor
---

Promote `toP3()` and `toP3String()` to core (no plugin required), and add `oklchToRgbChannels`, `oklchToP3Channels`, and `oklchToRec2020Channels` low-level functional exports for allocation-free OKLCH conversion in hot paths.

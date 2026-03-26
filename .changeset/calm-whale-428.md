---
"@colordx/core": major
---

Rename tint/shade/tone to tints/shades/tones (returning arrays); merge delta() into lab plugin (removes standalone delta plugin); add mixOklab() to core and mixLab() to lab plugin; add toName({ closest }) and transparent support; fix getFormat for plugin-registered parsers (adds p3/rec2020 to ColorFormat); clamp NaN/Infinity in object color parsers instead of rejecting; normalize LCH and OKLCH hue to 0 for achromatic colors; normalize -0 in Lab a/b output; fix minify to pick shortest lossless HSL precision; fix alpha setter rounding; fix TypeScript subpath type resolution via typesVersions; accept Colordx instances as input; trim whitespace in all string parsers.

import { describe, it, expect, beforeAll } from "vitest";
import { colordx, extend, getFormat, Colordx } from "../src/index.js";
import names from "../src/plugins/names.js";
import a11y from "../src/plugins/a11y.js";
import harmonies from "../src/plugins/harmonies.js";
import mix from "../src/plugins/mix.js";
import minify from "../src/plugins/minify.js";
import lab from "../src/plugins/lab.js";
import rec2020 from "../src/plugins/rec2020.js";

beforeAll(() => {
  extend([names, a11y, harmonies, mix, minify]);
});

describe("names plugin", () => {
  it("parses CSS color names", () => {
    expect(colordx("red").toHex()).toBe("#ff0000");
    expect(colordx("white").toHex()).toBe("#ffffff");
    expect(colordx("black").toHex()).toBe("#000000");
  });

  it("returns undefined for non-named colors", () => {
    expect((colordx("#c06060") as any).toName()).toBeUndefined();
  });

  it("converts to name", () => {
    expect((colordx("#ff0000") as any).toName()).toBe("red");
    expect((colordx("#ffffff") as any).toName()).toBe("white");
  });

  it("returns 'transparent' for rgba(0,0,0,0)", () => {
    expect((colordx({ r: 0, g: 0, b: 0, alpha: 0 }) as any).toName()).toBe("transparent");
    expect((colordx({ r: 255, g: 255, b: 255, alpha: 0 }) as any).toName()).toBeUndefined();
  });

  it("closest: true returns nearest CSS name", () => {
    expect((colordx("#aaaaaa") as any).toName({ closest: true })).toBe("darkgray");
    expect((colordx("#fe0000") as any).toName({ closest: true })).toBe("red");
  });

  it("getFormat returns 'name' for CSS color names when names plugin is loaded", () => {
    expect(getFormat("red")).toBe("name");
    expect(getFormat("blue")).toBe("name");
  });

  it("getFormat returns undefined for unknown strings even when plugin parsers are present", () => {
    // exercises the plugin parser loop returning null (false branch of the if inside the loop)
    expect(getFormat("notacolor")).toBeUndefined();
  });
});

describe("a11y plugin", () => {
  it("checks readability", () => {
    expect((colordx("#000000") as any).isReadable("#ffffff")).toBe(true);
    expect((colordx("#777777") as any).isReadable("#ffffff")).toBe(false);
  });

  it("checks AAA level", () => {
    expect((colordx("#000000") as any).isReadable("#ffffff", { level: "AAA" })).toBe(true);
    expect((colordx("#777777") as any).isReadable("#ffffff", { level: "AAA" })).toBe(false);
  });

  it("checks large size", () => {
    // large AA requires ratio >= 3, large AAA requires ratio >= 4.5
    expect((colordx("#767676") as any).isReadable("#ffffff", { size: "large" })).toBe(true);
    expect((colordx("#aaaaaa") as any).isReadable("#ffffff", { size: "large" })).toBe(false);
    expect((colordx("#000000") as any).isReadable("#ffffff", { size: "large", level: "AAA" })).toBe(true);
    expect((colordx("#aaaaaa") as any).isReadable("#ffffff", { size: "large", level: "AAA" })).toBe(false);
  });

  it("returns minReadable color with sufficient contrast", () => {
    const result = (colordx("#777777") as any).minReadable("#ffffff");
    expect(result.contrast("#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("minReadable lightens light-on-dark colors", () => {
    const result = (colordx("#aaaaaa") as any).minReadable("#000000");
    expect(result.contrast("#000000")).toBeGreaterThanOrEqual(4.5);
  });

  it("returns readable score", () => {
    expect((colordx("#000000") as any).readableScore("#ffffff")).toBe("AAA");
    expect((colordx("#e60000") as any).readableScore("#ffff47")).toBe("AA");
    expect((colordx("#949494") as any).readableScore("#ffffff")).toBe("AA large");
    expect((colordx("#aaaaaa") as any).readableScore("#ffffff")).toBe("fail");
  });

  it("calculates APCA contrast (positive = dark text on light bg)", () => {
    // Black on white: max positive contrast ~106
    expect((colordx("#000000") as any).apcaContrast("#ffffff")).toBeCloseTo(106, 0);
    // White on black: max negative contrast ~-108
    expect((colordx("#ffffff") as any).apcaContrast("#000000")).toBeCloseTo(-108, 0);
    // Same color: near zero
    expect((colordx("#ffffff") as any).apcaContrast("#ffffff")).toBe(0);
  });

  it("APCA returns 0 when contrast is below noise floor (loClip)", () => {
    // Very similar light colors: raw Sapc below loClip threshold → clamped to 0
    expect((colordx("#fefefe") as any).apcaContrast("#ffffff")).toBe(0);
    expect((colordx("#ffffff") as any).apcaContrast("#fefefe")).toBe(0);
  });

  it("composites semi-transparent foreground over background for APCA", () => {
    // Fully transparent black over white composites to white → ~0 contrast
    expect((colordx("#00000000") as any).apcaContrast("#ffffff")).toBe(0);
    // Opaque black on white: max APCA ~106 (unchanged)
    expect((colordx("#000000ff") as any).apcaContrast("#ffffff")).toBeCloseTo(106, 0);
  });

  it("APCA matches known reference values from the issue", () => {
    // From the GitHub issue: APCA gives 37.2 for dark text on orange bg
    expect((colordx("#202122") as any).apcaContrast("#cf674a")).toBeCloseTo(37.2, 0);
    // White on same orange bg: -69.5 (light text on darker bg)
    expect((colordx("#ffffff") as any).apcaContrast("#cf674a")).toBeCloseTo(-69.5, 0);
  });

  it("checks APCA readability (|Lc| >= 75 for normal, >= 60 for large)", () => {
    // Black on white Lc ~106: readable at both levels
    expect((colordx("#000000") as any).isReadableApca("#ffffff")).toBe(true);
    expect((colordx("#000000") as any).isReadableApca("#ffffff", { size: "large" })).toBe(true);
    // Mid-gray on white: Lc ~58 — not readable for normal, readable for large
    expect((colordx("#777777") as any).isReadableApca("#ffffff")).toBe(false);
    expect((colordx("#777777") as any).isReadableApca("#ffffff", { size: "large" })).toBe(true);
    // Very light gray on white: not readable at any size
    expect((colordx("#cccccc") as any).isReadableApca("#ffffff")).toBe(false);
    expect((colordx("#cccccc") as any).isReadableApca("#ffffff", { size: "large" })).toBe(false);
  });
});

describe("harmonies plugin", () => {
  it("generates complementary colors", () => {
    const colors = (colordx("#ff0000") as any).harmonies("complementary");
    expect(colors).toHaveLength(2);
  });

  it("generates analogous colors", () => {
    const colors = (colordx("#ff0000") as any).harmonies("analogous");
    expect(colors).toHaveLength(3);
  });

  it("generates triadic colors", () => {
    const colors = (colordx("#ff0000") as any).harmonies("triadic");
    expect(colors).toHaveLength(3);
  });

  it("generates tetradic colors", () => {
    const colors = (colordx("#ff0000") as any).harmonies("tetradic");
    expect(colors).toHaveLength(4);
  });

  it("generates split-complementary colors", () => {
    const colors = (colordx("#ff0000") as any).harmonies("split-complementary");
    expect(colors).toHaveLength(3);
  });

  it("defaults to complementary", () => {
    const colors = (colordx("#ff0000") as any).harmonies();
    expect(colors).toHaveLength(2);
  });
});

describe("minify plugin", () => {
  it("returns shortest hex for shortable colors", () => {
    expect((colordx("#ff0000") as any).minify()).toBe("#f00");
    expect((colordx("#ffffff") as any).minify()).toBe("#fff");
    expect((colordx("#000000") as any).minify()).toBe("#000");
  });

  it("returns shortest representation", () => {
    const result = (colordx("#c06060") as any).minify();
    expect(result.length).toBeLessThanOrEqual("#c06060".length);
  });

  it("uses name when names plugin is loaded and name option is set", () => {
    expect((colordx("#ff0000") as any).minify({ name: true })).toBe("red");
    expect((colordx("#ffffff") as any).minify({ name: true })).toBe("#fff");
  });

  it("handles transparent option", () => {
    expect((colordx({ r: 0, g: 0, b: 0, alpha: 0 }) as any).minify({ transparent: true })).toBe("transparent");
  });

  it("handles alphaHex option", () => {
    const result = (colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).minify({ alphaHex: true });
    expect(result.length).toBeLessThanOrEqual("rgba(255,0,0,.5)".length);
  });

  it("produces short 4-digit alphaHex when all channel pairs match", () => {
    // r=255=ff, g=0=00, b=0=00, a=0.4→102=0x66 → #ff000066 → #f006
    const result = (colordx({ r: 255, g: 0, b: 0, alpha: 0.4 }) as any).minify({ alphaHex: true });
    expect(result).toBe("#f006");
  });

  it("alphaHex falls back to rgb() when alpha is lossy in 8-bit hex", () => {
    // a=0.005 → round(0.005*255)=1=0x01 → 1/255=0.004 → rounds to 0.00 ≠ 0.01 → lossy
    const result = (colordx({ r: 255, g: 0, b: 0, alpha: 0.005 }) as any).minify({ alphaHex: true });
    expect(result).not.toMatch(/^#/);
  });

  it("alphaHex includes fully transparent (alpha=0) in short hex", () => {
    // alpha=0 → 0x00, #rgba short form: all pairs must match
    // r=0=00, g=0=00, b=0=00, a=0=00 → #00000000 → #0000
    const result = (colordx({ r: 0, g: 0, b: 0, alpha: 0 }) as any).minify({ alphaHex: true });
    expect(result).toBe("#0000");
  });

  it("minified output round-trips to the same RGB (lossless)", () => {
    // cssnano#1515: integer HSL rounding caused lossy minification
    // e.g. rgb(143,101,98) → hsla(4,19%,47%) → rgb(143,100,97) — off by 1
    const colors = [
      { r: 143, g: 101, b: 98, alpha: 0.43 },
      { r: 14, g: 14, b: 14, alpha: 0.5 },  // colord#130: becomes hsl(0,0%,5%) → rgb(13,13,13)
      { r: 100, g: 150, b: 200, alpha: 1 },
      { r: 64, g: 128, b: 192, alpha: 1 },
    ];
    for (const rgb of colors) {
      const minified = (colordx(rgb) as any).minify();
      const result = colordx(minified).toRgb();
      expect(result.r).toBe(rgb.r);
      expect(result.g).toBe(rgb.g);
      expect(result.b).toBe(rgb.b);
    }
  });

  it("does not produce lossy HSL when rgb option is disabled", () => {
    // When HSL is shorter it should still be lossless
    const color = colordx({ r: 255, g: 0, b: 0, alpha: 1 }); // pure red — exact in HSL
    const minified = (color as any).minify({ rgb: false });
    const result = colordx(minified).toRgb();
    expect(result.r).toBe(255);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it("skips HSL candidate when it would be lossy, falls back to rgb()", () => {
    // rgb(143,101,98) → hsl rounds to values that don't convert back exactly
    const result = (colordx({ r: 143, g: 101, b: 98, alpha: 1 }) as any).minify();
    const rt = colordx(result).toRgb();
    expect(rt.r).toBe(143);
    expect(rt.g).toBe(101);
    expect(rt.b).toBe(98);
    expect(result).not.toMatch(/^hsl/);
  });

  it("uses HSL when it round-trips exactly", () => {
    // Pure hues round-trip exactly through HSL
    const result = (colordx({ r: 255, g: 0, b: 0, alpha: 1 }) as any).minify();
    expect(result).toMatch(/^hsl|^#f00|^red/);
    const rt = colordx(result).toRgb();
    expect(rt.r).toBe(255);
    expect(rt.g).toBe(0);
    expect(rt.b).toBe(0);
  });

  it("picks shorter lossless HSL precision for alpha colors", () => {
    // hsla(0,0%,78.4%,.55) = 19 chars beats rgba(200,200,200,.55) = 21 chars
    const result = (colordx({ r: 200, g: 200, b: 200, alpha: 0.55 }) as any).minify();
    expect(result).toBe("hsla(0,0%,78.4%,.55)");
    // round-trip must be lossless
    const rt = colordx(result).toRgb();
    expect(rt.r).toBe(200);
    expect(rt.g).toBe(200);
    expect(rt.b).toBe(200);
    expect(rt.alpha).toBeCloseTo(0.55, 2);
  });

  it("HSL candidate is skipped even when rgb is disabled if lossy", () => {
    // With rgb:false, a lossy HSL should not appear — hex wins instead
    const result = (colordx({ r: 143, g: 101, b: 98, alpha: 1 }) as any).minify({ rgb: false });
    const rt = colordx(result).toRgb();
    expect(rt.r).toBe(143);
    expect(rt.g).toBe(101);
    expect(rt.b).toBe(98);
    expect(result).not.toMatch(/^hsl/);
  });
});

describe("mix plugin", () => {
  it("tints returns array from color to white", () => {
    const tints = (colordx("#ff0000") as any).tints(3);
    expect(tints).toHaveLength(3);
    expect(tints[0].toHex()).toBe("#ff0000");
    expect(tints[2].toHex()).toBe("#ffffff");
  });

  it("shades returns array from color to black", () => {
    const shades = (colordx("#ff0000") as any).shades(3);
    expect(shades).toHaveLength(3);
    expect(shades[0].toHex()).toBe("#ff0000");
    expect(shades[2].toHex()).toBe("#000000");
  });

  it("tones returns array from color to gray", () => {
    const tones = (colordx("#ff0000") as any).tones(3);
    expect(tones).toHaveLength(3);
    expect(tones[0].toHex()).toBe("#ff0000");
    expect(tones[2].toHex()).toBe("#808080");
  });

  it("tints defaults to 5 steps", () => {
    expect((colordx("#ff0000") as any).tints()).toHaveLength(5);
  });

  it("creates palette", () => {
    const palette = (colordx("#ff0000") as any).palette(5);
    expect(palette).toHaveLength(5);
  });

  it("creates palette with custom target", () => {
    const palette = (colordx("#ff0000") as any).palette(3, "#0000ff");
    expect(palette).toHaveLength(3);
  });
});

describe("names plugin: additional", () => {
  it("parses more CSS color names", () => {
    expect(colordx("blue").toHex()).toBe("#0000ff");
    expect(colordx("yellow").toHex()).toBe("#ffff00");
    expect(colordx("lime").toHex()).toBe("#00ff00");
    // CSS 'green' is #008000, not #00ff00
    expect(colordx("green").toHex()).toBe("#008000");
  });

  it("converts common named colors back to name", () => {
    expect((colordx("#0000ff") as any).toName()).toBe("blue");
    expect((colordx("#ffff00") as any).toName()).toBe("yellow");
    expect((colordx("#00ff00") as any).toName()).toBe("lime");
  });

  it("getFormat returns 'name' for additional CSS color names", () => {
    expect(getFormat("blue")).toBe("name");
    expect(getFormat("yellow")).toBe("name");
    expect(getFormat("lime")).toBe("name");
  });

  it("returns undefined toName for colors not in the CSS name list", () => {
    expect((colordx("#3b82f6") as any).toName()).toBeUndefined();
    expect((colordx("#123456") as any).toName()).toBeUndefined();
  });
});

describe("getFormat for additional plugin formats", () => {
  beforeAll(() => {
    extend([lab, rec2020]);
  });

  it("returns 'xyz' for XYZ object inputs", () => {
    expect(getFormat({ x: 0.2, y: 0.2, z: 0.2, alpha: 1 })).toBe("xyz");
  });

  it("returns 'p3' for Display-P3 string inputs", () => {
    expect(getFormat("color(display-p3 0.5 0.5 0.5)")).toBe("p3");
  });

  it("returns 'rec2020' for Rec.2020 string inputs", () => {
    expect(getFormat("color(rec2020 0.5 0.5 0.5)")).toBe("rec2020");
  });
});

describe("a11y plugin: additional cases", () => {
  it("isReadable large text AA requires ratio >= 3", () => {
    // #595959 on white has contrast ~6.2 → passes large AA
    expect((colordx("#595959") as any).isReadable("#ffffff", { size: "large" })).toBe(true);
    // #cccccc on white has contrast ~1.6 → fails large AA
    expect((colordx("#cccccc") as any).isReadable("#ffffff", { size: "large" })).toBe(false);
  });

  it("isReadable AA is false for very light gray on white", () => {
    expect((colordx("#cccccc") as any).isReadable("#ffffff")).toBe(false);
  });

  it("APCA is positive for dark text on light background", () => {
    expect((colordx("#000000") as any).apcaContrast("#ffffff")).toBeGreaterThan(0);
  });

  it("APCA is negative for light text on dark background", () => {
    expect((colordx("#ffffff") as any).apcaContrast("#000000")).toBeLessThan(0);
  });

  it("APCA absolute value is high for black on white", () => {
    expect(Math.abs((colordx("#000000") as any).apcaContrast("#ffffff"))).toBeGreaterThan(100);
  });

  it("isReadableApca returns a boolean", () => {
    expect(typeof (colordx("#777777") as any).isReadableApca("#000000")).toBe("boolean");
  });

  it("minReadable achieves at least 4.5:1 contrast", () => {
    const result = (colordx("#999999") as any).minReadable("#ffffff");
    expect(result.contrast("#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("minReadable for dark background lightens the color", () => {
    const result = (colordx("#888888") as any).minReadable("#000000");
    expect(result.contrast("#000000")).toBeGreaterThanOrEqual(4.5);
  });

  it("minReadable dark fg on dark bg lightens (not darkens) toward contrast", () => {
    // Old logic: fg.luminance < bg.luminance → darken → could never pass 4.5:1 on a dark bg
    // New logic: pick the extreme (black vs white) with higher max contrast against bg
    // For dark bg (#333), white gives ~10:1 max contrast vs black gives ~1:1 — so lighten wins.
    const result = (colordx("#222222") as any).minReadable("#333333");
    expect(result.contrast("#333333")).toBeGreaterThanOrEqual(4.5);
    // Result must be lighter than fg, not darker
    expect(result.toHsl().l).toBeGreaterThan(colordx("#222222").toHsl().l);
  });
});

describe("harmonies plugin: additional cases", () => {
  it("all harmony colors are Colordx instances", () => {
    const types = ["complementary", "analogous", "triadic", "tetradic", "split-complementary"] as const;
    for (const type of types) {
      const colors = (colordx("#ff0000") as any).harmonies(type);
      for (const c of colors) {
        expect(c).toBeInstanceOf(Colordx);
      }
    }
  });

  it("complementary: second color is 180° away in hue", () => {
    const colors = (colordx("#ff0000") as any).harmonies("complementary");
    expect(colors[1].hue()).toBeCloseTo(180, 0);
  });

  it("triadic: three hues are spread evenly (120° apart)", () => {
    const colors = (colordx("#ff0000") as any).harmonies("triadic");
    expect(colors).toHaveLength(3);
    // Hues 0, 120, 240 — range spans at least 200°
    const hues = colors.map((c: any) => c.hue());
    expect(Math.max(...hues) - Math.min(...hues)).toBeGreaterThan(100);
  });

  it("analogous: first color is -30° from original", () => {
    const colors = (colordx("#ff0000") as any).harmonies("analogous");
    // red hue = 0; rotate(-30) → normalizes to 330
    expect(colors[0].hue()).toBeCloseTo(330, 0);
  });

  it("harmonies work on non-primary colors", () => {
    const colors = (colordx("#3b82f6") as any).harmonies("complementary");
    expect(colors).toHaveLength(2);
    expect(colors[0]).toBeInstanceOf(Colordx);
    expect(colors[1]).toBeInstanceOf(Colordx);
  });
});

describe("mix plugin: additional cases", () => {
  it("tints(2) returns [original, white]", () => {
    const t = (colordx("#ff0000") as any).tints(2);
    expect(t[0].toHex()).toBe("#ff0000");
    expect(t[1].toHex()).toBe("#ffffff");
  });

  it("shades(2) returns [original, black]", () => {
    const s = (colordx("#ff0000") as any).shades(2);
    expect(s[0].toHex()).toBe("#ff0000");
    expect(s[1].toHex()).toBe("#000000");
  });

  it("tones(2) returns [original, gray]", () => {
    const t = (colordx("#ff0000") as any).tones(2);
    expect(t[0].toHex()).toBe("#ff0000");
    expect(t[1].toHex()).toBe("#808080");
  });

  it("palette: first element is original color", () => {
    const palette = (colordx("#ff0000") as any).palette(5);
    expect(palette[0].toHex()).toBe("#ff0000");
  });

  it("palette: last element is white (default target)", () => {
    const palette = (colordx("#ff0000") as any).palette(5);
    expect(palette[4].toHex()).toBe("#ffffff");
  });

  it("palette: all elements are Colordx instances", () => {
    const palette = (colordx("#ff0000") as any).palette(4);
    for (const c of palette) {
      expect(c).toBeInstanceOf(Colordx);
    }
  });

  it("tints(0) returns empty array", () => {
    expect((colordx("#ff0000") as any).tints(0)).toEqual([]);
  });

  it("tints(1) returns array containing just the original color", () => {
    const t = (colordx("#ff0000") as any).tints(1);
    expect(t).toHaveLength(1);
    expect(t[0].toHex()).toBe("#ff0000");
  });

  it("shades(0) returns empty array", () => {
    expect((colordx("#ff0000") as any).shades(0)).toEqual([]);
  });

  it("shades(1) returns array containing just the original color", () => {
    const s = (colordx("#ff0000") as any).shades(1);
    expect(s).toHaveLength(1);
    expect(s[0].toHex()).toBe("#ff0000");
  });

  it("palette(0) returns empty array", () => {
    expect((colordx("#ff0000") as any).palette(0)).toEqual([]);
  });

  it("palette(1) returns array containing just the original color", () => {
    const p = (colordx("#ff0000") as any).palette(1);
    expect(p).toHaveLength(1);
    expect(p[0].toHex()).toBe("#ff0000");
  });
});

describe("minify plugin: additional cases", () => {
  it("minified output is always a valid color", () => {
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#000000", "#c06060", "#3b82f6"];
    for (const c of colors) {
      const minified = (colordx(c) as any).minify();
      expect(colordx(minified).isValid()).toBe(true);
    }
  });

  it("minify with name:false does not use color names", () => {
    const result = (colordx("#ff0000") as any).minify({ name: false });
    expect(result).not.toBe("red");
  });

  it("transparent option: rgba(0,0,0,0) becomes 'transparent'", () => {
    expect((colordx("rgba(0,0,0,0)") as any).minify({ transparent: true })).toBe("transparent");
  });

  it("transparent option does not apply to opaque black", () => {
    const result = (colordx("#000000") as any).minify({ transparent: true });
    expect(result).not.toBe("transparent");
  });

  it("minify never produces a longer output than 6-digit hex", () => {
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#c06060", "#3b82f6"];
    for (const c of colors) {
      const minified = (colordx(c) as any).minify();
      expect(minified.length).toBeLessThanOrEqual(7); // #xxxxxx
    }
  });

  it("returns targetHex without crashing when all candidate formats are disabled", () => {
    // Previously: reduce on empty array threw; now guarded by candidates.length === 0 check
    const result = (colordx("#ff0000") as any).minify({ hex: false, rgb: false, hsl: false });
    expect(colordx(result).isValid()).toBe(true);
    expect(colordx(result).toHex()).toBe("#ff0000");
  });

  it("returns targetHex for semi-transparent when hex is disabled and alphaHex is false", () => {
    // alpha < 1 with hex:true alphaHex:false → no hex candidate; rgb and hsl still produce candidates
    // But with hex:false, rgb:false, hsl:false → empty candidates → returns targetHex (8-char)
    const result = (colordx({ r: 255, g: 0, b: 0, alpha: 0.5 }) as any).minify({ hex: false, rgb: false, hsl: false });
    expect(colordx(result).isValid()).toBe(true);
  });
});

// Deterministic LCG so results are reproducible across runs
const lcg = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
};

describe("minify fuzz: 10k random colors", () => {
  const rand = lcg(42);
  const N = 10_000;

  // Generate colors with uniform r/g/b (0-255) and alpha covering full 0-1
  // including extremes: 0, 1, and fine-grained steps near 0 and 1
  const colors: { r: number; g: number; b: number; alpha: number }[] = [];
  for (let i = 0; i < N; i++) {
    colors.push({
      r: Math.floor(rand() * 256),
      g: Math.floor(rand() * 256),
      b: Math.floor(rand() * 256),
      alpha: Math.round(rand() * 1000) / 1000, // 3dp precision, covers 0.000–1.000
    });
  }

  it("minified output is always a valid color", () => {
    for (const c of colors) {
      const minified = (colordx(c) as any).minify();
      expect(colordx(minified).isValid()).toBe(true);
    }
  });

  it("minified output round-trips r/g/b within ±1", () => {
    for (const c of colors) {
      const minified = (colordx(c) as any).minify();
      const rt = colordx(minified).toRgb();
      expect(Math.abs(rt.r - c.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(rt.g - c.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(rt.b - c.b)).toBeLessThanOrEqual(1);
    }
  });

  it("minified output round-trips alpha within ±0.01", () => {
    for (const c of colors) {
      const minified = (colordx(c) as any).minify();
      const rt = colordx(minified).toRgb();
      expect(Math.abs(rt.alpha - c.alpha)).toBeLessThanOrEqual(0.01);
    }
  });

  it("alphaHex minified output round-trips alpha within ±0.01", () => {
    for (const c of colors) {
      const minified = (colordx(c) as any).minify({ alphaHex: true });
      const rt = colordx(minified).toRgb();
      expect(Math.abs(rt.alpha - c.alpha)).toBeLessThanOrEqual(0.01);
    }
  });

});

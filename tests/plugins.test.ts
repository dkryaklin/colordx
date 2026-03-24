import { describe, it, expect, beforeAll } from "vitest";
import { colordx, extend, getFormat, Colordx } from "../src/index.js";
import names from "../src/plugins/names.js";
import a11y from "../src/plugins/a11y.js";
import harmonies from "../src/plugins/harmonies.js";
import mix from "../src/plugins/mix.js";
import minify from "../src/plugins/minify.js";

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
    expect((colordx({ r: 0, g: 0, b: 0, a: 0 }) as any).minify({ transparent: true })).toBe("transparent");
  });

  it("handles alphaHex option", () => {
    const result = (colordx({ r: 255, g: 0, b: 0, a: 0.5 }) as any).minify({ alphaHex: true });
    expect(result.length).toBeLessThanOrEqual("rgba(255,0,0,.5)".length);
  });

  it("produces short 4-digit alphaHex when all channel pairs match", () => {
    // r=255=ff, g=0=00, b=0=00, a=0.4→102=0x66 → #ff000066 → #f006
    const result = (colordx({ r: 255, g: 0, b: 0, a: 0.4 }) as any).minify({ alphaHex: true });
    expect(result).toBe("#f006");
  });

  it("minified output round-trips to the same RGB (lossless)", () => {
    // cssnano#1515: integer HSL rounding caused lossy minification
    // e.g. rgb(143,101,98) → hsla(4,19%,47%) → rgb(143,100,97) — off by 1
    const colors = [
      { r: 143, g: 101, b: 98, a: 0.43 },
      { r: 14, g: 14, b: 14, a: 0.5 },  // colord#130: becomes hsl(0,0%,5%) → rgb(13,13,13)
      { r: 100, g: 150, b: 200, a: 1 },
      { r: 64, g: 128, b: 192, a: 1 },
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
    const color = colordx({ r: 255, g: 0, b: 0, a: 1 }); // pure red — exact in HSL
    const minified = (color as any).minify({ rgb: false });
    const result = colordx(minified).toRgb();
    expect(result.r).toBe(255);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });
});

describe("mix plugin", () => {
  it("creates tint", () => {
    const tint = (colordx("#ff0000") as any).tint(0.5);
    expect(tint.toRgb().r).toBe(255);
    expect(tint.toRgb().g).toBeGreaterThan(0);
  });

  it("creates shade", () => {
    const shade = (colordx("#ff0000") as any).shade(0.5);
    expect(shade.toRgb().r).toBeLessThan(255);
  });

  it("creates tone", () => {
    const tone = (colordx("#ff0000") as any).tone(0.5);
    expect(tone.toRgb().r).toBeLessThan(255);
    expect(tone.toRgb().g).toBeGreaterThan(0);
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
  it("tint at 0 returns original color", () => {
    expect((colordx("#ff0000") as any).tint(0).toHex()).toBe("#ff0000");
  });

  it("tint at 1 returns white", () => {
    expect((colordx("#ff0000") as any).tint(1).toHex()).toBe("#ffffff");
  });

  it("shade at 0 returns original color", () => {
    expect((colordx("#ff0000") as any).shade(0).toHex()).toBe("#ff0000");
  });

  it("shade at 1 returns black", () => {
    expect((colordx("#ff0000") as any).shade(1).toHex()).toBe("#000000");
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
});

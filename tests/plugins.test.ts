import { describe, it, expect, beforeAll } from "vitest";
import { colordx, extend } from "../src/index.js";
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

  it("calculates APCA contrast (positive = dark text on light bg)", () => {
    // Black on white: max positive contrast ~106
    expect((colordx("#000000") as any).apcaContrast("#ffffff")).toBeCloseTo(106, 0);
    // White on black: max negative contrast ~-108
    expect((colordx("#ffffff") as any).apcaContrast("#000000")).toBeCloseTo(-108, 0);
    // Same color: near zero
    expect((colordx("#ffffff") as any).apcaContrast("#ffffff")).toBe(0);
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

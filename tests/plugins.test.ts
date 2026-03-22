import { describe, it, expect, beforeAll } from "vitest";
import { colordx, extend } from "../src/index.js";
import names from "../src/plugins/names.js";
import a11y from "../src/plugins/a11y.js";
import harmonies from "../src/plugins/harmonies.js";
import mix from "../src/plugins/mix.js";

beforeAll(() => {
  extend([names, a11y, harmonies, mix]);
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

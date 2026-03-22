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
});

describe("harmonies plugin", () => {
  it("generates complementary colors", () => {
    const colors = (colordx("#ff0000") as any).harmonies("complementary");
    expect(colors).toHaveLength(2);
  });

  it("generates triadic colors", () => {
    const colors = (colordx("#ff0000") as any).harmonies("triadic");
    expect(colors).toHaveLength(3);
  });

  it("generates tetradic colors", () => {
    const colors = (colordx("#ff0000") as any).harmonies("tetradic");
    expect(colors).toHaveLength(4);
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

  it("creates palette", () => {
    const palette = (colordx("#ff0000") as any).palette(5);
    expect(palette).toHaveLength(5);
  });
});

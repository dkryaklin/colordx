import { describe, it, expect } from "vitest";
import { colordx, extend, random, Colordx } from "../src/index.js";

describe("parsing", () => {
  it("parses hex colors", () => {
    expect(colordx("#fff").toRgb()).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(colordx("#ff0000").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(colordx("#ff000080").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });

  it("parses rgb strings", () => {
    expect(colordx("rgb(255, 0, 0)").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(colordx("rgba(255, 0, 0, 0.5)").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });

  it("parses hsl strings", () => {
    expect(colordx("hsl(0, 100%, 50%)").toHex()).toBe("#ff0000");
  });

  it("parses rgb objects", () => {
    expect(colordx({ r: 255, g: 0, b: 0, a: 1 }).toHex()).toBe("#ff0000");
  });

  it("parses hsl objects", () => {
    expect(colordx({ h: 0, s: 100, l: 50, a: 1 }).toHex()).toBe("#ff0000");
  });
});

describe("conversion", () => {
  it("converts to hex", () => {
    expect(colordx("rgb(255, 0, 0)").toHex()).toBe("#ff0000");
  });

  it("converts to rgb string", () => {
    expect(colordx("#ff0000").toRgbString()).toBe("rgb(255, 0, 0)");
    expect(colordx({ r: 255, g: 0, b: 0, a: 0.5 }).toRgbString()).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("converts to hsl", () => {
    const hsl = colordx("#ff0000").toHsl();
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
    expect(hsl.a).toBe(1);
  });

  it("converts to hsl string", () => {
    expect(colordx("#ff0000").toHslString()).toBe("hsl(0, 100%, 50%)");
  });

  it("converts to hsv", () => {
    const hsv = colordx("#ff0000").toHsv();
    expect(hsv.h).toBe(0);
    expect(hsv.s).toBe(100);
    expect(hsv.v).toBe(100);
  });
});

describe("manipulation", () => {
  it("lightens", () => {
    const l1 = colordx("#ff0000").toHsl().l;
    const l2 = colordx("#ff0000").lighten(0.1).toHsl().l;
    expect(l2).toBeGreaterThan(l1);
  });

  it("darkens", () => {
    const l1 = colordx("#ff0000").toHsl().l;
    const l2 = colordx("#ff0000").darken(0.1).toHsl().l;
    expect(l2).toBeLessThan(l1);
  });

  it("saturates", () => {
    const s1 = colordx("#c06060").toHsl().s;
    const s2 = colordx("#c06060").saturate(0.1).toHsl().s;
    expect(s2).toBeGreaterThan(s1);
  });

  it("desaturates", () => {
    const s1 = colordx("#ff0000").toHsl().s;
    const s2 = colordx("#ff0000").desaturate(0.1).toHsl().s;
    expect(s2).toBeLessThan(s1);
  });

  it("inverts", () => {
    expect(colordx("#ff0000").invert().toHex()).toBe("#00ffff");
    expect(colordx("#ffffff").invert().toHex()).toBe("#000000");
  });

  it("rotates hue", () => {
    expect(colordx("#ff0000").rotate(180).toHex()).toBe("#00ffff");
  });

  it("grayscale", () => {
    const gray = colordx("#ff0000").grayscale().toHsl();
    expect(gray.s).toBe(0);
  });

  it("mixes colors", () => {
    const mixed = colordx("#ff0000").mix("#0000ff", 0.5).toRgb();
    expect(mixed.r).toBe(128);
    expect(mixed.b).toBe(128);
  });

  it("chains operations", () => {
    const result = colordx("#ff0000").lighten(0.1).saturate(0.1).rotate(30);
    expect(result).toBeInstanceOf(Colordx);
  });
});

describe("getters", () => {
  it("gets brightness", () => {
    expect(colordx("#ffffff").brightness()).toBe(1);
    expect(colordx("#000000").brightness()).toBe(0);
  });

  it("isDark / isLight", () => {
    expect(colordx("#000000").isDark()).toBe(true);
    expect(colordx("#ffffff").isLight()).toBe(true);
  });

  it("gets luminance", () => {
    expect(colordx("#ffffff").luminance()).toBe(1);
    expect(colordx("#000000").luminance()).toBe(0);
  });

  it("calculates contrast", () => {
    expect(colordx("#000000").contrast("#ffffff")).toBe(21);
    expect(colordx("#ffffff").contrast("#ffffff")).toBe(1);
  });

  it("gets/sets alpha", () => {
    expect(colordx("#ff0000").alpha()).toBe(1);
    expect(colordx("#ff0000").alpha(0.5).alpha()).toBe(0.5);
  });

  it("gets/sets hue", () => {
    expect(colordx("#ff0000").hue()).toBe(0);
    expect(colordx("#ff0000").hue(240).toHex()).toBe("#0000ff");
  });

  it("checks equality", () => {
    expect(colordx("#ff0000").isEqual("#ff0000")).toBe(true);
    expect(colordx("#ff0000").isEqual("rgb(255, 0, 0)")).toBe(true);
    expect(colordx("#ff0000").isEqual("#00ff00")).toBe(false);
  });
});

describe("random", () => {
  it("generates a valid color", () => {
    const c = random();
    expect(c).toBeInstanceOf(Colordx);
    expect(c.isValid()).toBe(true);
  });
});

describe("toString", () => {
  it("returns hex string", () => {
    expect(String(colordx("#ff0000"))).toBe("#ff0000");
    expect(`${colordx("#ffffff")}`).toBe("#ffffff");
  });
});

describe("hsv object parsing", () => {
  it("parses HSV object", () => {
    expect(colordx({ h: 0, s: 100, v: 100, a: 1 }).toHex()).toBe("#ff0000");
    expect(colordx({ h: 120, s: 100, v: 100, a: 1 }).toHex()).toBe("#00ff00");
    expect(colordx({ h: 240, s: 100, v: 100, a: 1 }).toHex()).toBe("#0000ff");
    expect(colordx({ h: 0, s: 0, v: 0, a: 1 }).toHex()).toBe("#000000");
  });
});

describe("invalid input", () => {
  it("falls back to black for invalid color", () => {
    expect(colordx("notacolor").toRgb()).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(colordx("notacolor").isValid()).toBe(false);
  });

  it("returns null from parse for invalid input", () => {
    expect(colordx({} as any).toRgb()).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("rejects invalid rgb object", () => {
    expect(colordx({ r: "x", g: 0, b: 0, a: 1 } as any).toRgb()).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe("delta", () => {
  it("same color returns 0", () => {
    expect(colordx("#ff0000").delta("#ff0000")).toBe(0);
  });

  it("defaults to white", () => {
    expect(colordx("#000000").delta()).toBeCloseTo(colordx("#000000").delta("#fff"), 5);
  });

  it("black vs white is max distance", () => {
    expect(colordx("#000000").delta("#ffffff")).toBeGreaterThan(0.9);
  });
});

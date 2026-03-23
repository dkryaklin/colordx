import { describe, it, expect } from "vitest";
import { colordx, nearest, random, Colordx, getFormat } from "../src/index.js";

describe("parsing", () => {
  it("parses hex colors", () => {
    expect(colordx("#fff").toRgb()).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(colordx("#ff0000").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    // Alpha is stored at 3dp — the minimum precision for all 256 hex byte values (n/255)
    // to survive a round-trip without corruption. 128/255 = 0.50196… → 0.502, not 0.5.
    // Values set directly (e.g. alpha(0.5)) are unaffected: round(0.5, 3) = 0.5.
    expect(colordx("#ff000080").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 0.502 });
  });

  it("parses rgb strings", () => {
    expect(colordx("rgb(255, 0, 0)").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(colordx("rgba(255, 0, 0, 0.5)").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });

  it("parses modern rgb space syntax", () => {
    expect(colordx("rgb(255 0 0)").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(colordx("rgb(255 0 0 / 0.5)").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(colordx("rgb(255 0 0 / 50%)").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });

  it("parses hsl strings", () => {
    expect(colordx("hsl(0, 100%, 50%)").toHex()).toBe("#ff0000");
  });

  it("parses modern hsl space syntax", () => {
    expect(colordx("hsl(0 100% 50%)").toHex()).toBe("#ff0000");
    expect(colordx("hsl(0 100% 50% / 0.5)").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(colordx("hsl(0 100% 50% / 50%)").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
    expect(colordx("hsl(120deg 100% 50%)").toHex()).toBe("#00ff00");
    expect(colordx("hsl(240deg 100% 50%)").toHex()).toBe("#0000ff");
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

  it("converts to number", () => {
    expect(colordx("#ff0000").toNumber()).toBe(0xff0000);
    expect(colordx("#ffffff").toNumber()).toBe(0xffffff);
    expect(colordx("#000000").toNumber()).toBe(0);
    expect(colordx("#3b82f6").toNumber()).toBe(0x3b82f6);
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
    expect(colordx({ r: 255, g: 0, b: 0, a: 0.5 }).toHslString()).toBe("hsla(0, 100%, 50%, 0.5)");
  });

  it("converts to hsv", () => {
    const hsv = colordx("#ff0000").toHsv();
    expect(hsv.h).toBe(0);
    expect(hsv.s).toBe(100);
    expect(hsv.v).toBe(100);
  });

  it("converts to hsv string", () => {
    expect(colordx("#ff0000").toHsvString()).toBe("hsv(0, 100%, 100%)");
    expect(colordx("rgba(255, 0, 0, 0.5)").toHsvString()).toBe("hsva(0, 100%, 100%, 0.5)");
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

  it("gets/sets lightness (OKLCH)", () => {
    const c = colordx("#ff0000");
    expect(c.lightness()).toBeCloseTo(0.6279, 3);
    // setting lightness on a low-chroma color round-trips cleanly
    expect(colordx("#3b82f6").lightness(0.5).lightness()).toBeCloseTo(0.5, 2);
    // achromatic colors round-trip exactly
    expect(colordx("#777777").lightness(0).toHex()).toBe("#000000");
    expect(colordx("#777777").lightness(1).toHex()).toBe("#ffffff");
  });

  it("gets/sets chroma (OKLCH)", () => {
    const c = colordx("#ff0000");
    expect(c.chroma()).toBeGreaterThan(0);
    // chroma(0) produces a gray at the same lightness
    expect(c.chroma(0).chroma()).toBeCloseTo(0, 2);
  });

  it("checks equality", () => {
    expect(colordx("#ff0000").isEqual("#ff0000")).toBe(true);
    expect(colordx("#ff0000").isEqual("rgb(255, 0, 0)")).toBe(true);
    expect(colordx("#ff0000").isEqual("#00ff00")).toBe(false);
  });
});

describe("nearest", () => {
  const palette = ['#f00', '#ff0', '#00f'];

  it("finds the nearest color from a palette", () => {
    expect(nearest('#800', palette)).toBe('#f00');
    expect(nearest('#ffe', palette)).toBe('#ff0');
    expect(nearest('#0000cc', palette)).toBe('#00f');
  });

  it("returns the exact color if it is in the palette", () => {
    expect(nearest('#ff0000', palette)).toBe('#f00');
  });

  it("works with hex, rgb, and object inputs", () => {
    expect(nearest('rgb(200, 0, 0)', palette)).toBe('#f00');
    expect(nearest({ r: 0, g: 0, b: 200, a: 1 }, palette)).toBe('#00f');
  });

  it("preserves candidate type", () => {
    const objects = [{ r: 255, g: 0, b: 0, a: 1 }, { r: 0, g: 0, b: 255, a: 1 }];
    expect(nearest('#800', objects)).toEqual({ r: 255, g: 0, b: 0, a: 1 });
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

  it("covers gn < bn branch in rgbToHsv (red-dominant, g < b)", () => {
    // #ff0055: r=255, g=0, b=85 — red is max, green < blue → hits the +6 hue branch
    const hsv = colordx("#ff0055").toHsv();
    expect(hsv.h).toBeGreaterThan(330);
    expect(hsv.h).toBeLessThan(360);
  });

  it("rejects HSV object with NaN alpha", () => {
    expect(colordx({ h: 0, s: 100, v: 100, a: NaN } as any).isValid()).toBe(false);
  });
});

describe("transparent", () => {
  it("parses transparent as rgba(0,0,0,0)", () => {
    expect(colordx("transparent").toRgb()).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(colordx("transparent").isValid()).toBe(true);
    expect(colordx("transparent").isEqual("rgba(0,0,0,0)")).toBe(true);
    expect(colordx("transparent").isEqual("#000")).toBe(false);
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

  it("rejects 5-char hex as invalid", () => {
    expect(colordx("#fffff").isValid()).toBe(false);
  });

  it("round-trips 4-digit hex with alpha through rgb string", () => {
    // regression: 2dp alpha caused #cc88 → rgba(..., 0.53) → #cccc8887 (wrong byte)
    expect(colordx(colordx("#cc88").toRgbString()).toHex()).toBe("#cccc8888");
    expect(colordx(colordx("#f008").toRgbString()).toHex()).toBe("#ff000088");
  });

  it("rejects HWB object with NaN alpha", () => {
    expect(colordx({ h: 0, w: 0, b: 0, a: NaN } as any).isValid()).toBe(false);
  });

  it("rejects OKLCH object with l > 1 (disambiguates from CIE LCH)", () => {
    expect(colordx({ l: 50, c: 0.2, h: 180 } as any).isValid()).toBe(false);
  });
});

describe("getFormat", () => {
  it("detects hex", () => {
    expect(getFormat("#ff0000")).toBe("hex");
    expect(getFormat("#fff")).toBe("hex");
  });

  it("detects rgb string", () => {
    expect(getFormat("rgb(255, 0, 0)")).toBe("rgb");
    expect(getFormat("rgba(255, 0, 0, 0.5)")).toBe("rgb");
  });

  it("detects hsl string", () => {
    expect(getFormat("hsl(0, 100%, 50%)")).toBe("hsl");
  });

  it("detects rgb object", () => {
    expect(getFormat({ r: 255, g: 0, b: 0, a: 1 })).toBe("rgb");
  });

  it("detects hsl object", () => {
    expect(getFormat({ h: 0, s: 100, l: 50, a: 1 })).toBe("hsl");
  });

  it("detects hsv object", () => {
    expect(getFormat({ h: 0, s: 100, v: 100, a: 1 })).toBe("hsv");
  });

  it("returns undefined for invalid input", () => {
    expect(getFormat("notacolor")).toBeUndefined();
  });
});

describe("toHsl precision option", () => {
  it("rounds to integers with precision=0", () => {
    const { h, s, l } = colordx("#c06060").toHsl(0);
    expect(Number.isInteger(h)).toBe(true);
    expect(Number.isInteger(s)).toBe(true);
    expect(Number.isInteger(l)).toBe(true);
  });

  it("default precision=2 matches existing behavior", () => {
    expect(colordx("#c06060").toHsl()).toEqual(colordx("#c06060").toHsl(2));
  });

  it("precision=4 provides more digits than precision=2 when needed", () => {
    // #c06060 → h≈0, s≈33.33%, l≈56.47% — s and l need more than 2 decimals for full precision
    const hsl2 = colordx("#3d7a9f").toHsl(2);
    const hsl4 = colordx("#3d7a9f").toHsl(4);
    // Higher precision should not lose info vs lower
    expect(Math.abs(hsl4.s - hsl2.s)).toBeLessThan(0.01);
    // But 4-decimal value should differ from 2-decimal for colors that need it
    const hsl2s = hsl2.s.toString().split(".")[1]?.length ?? 0;
    const hsl4s = hsl4.s.toString().split(".")[1]?.length ?? 0;
    expect(hsl4s).toBeGreaterThanOrEqual(hsl2s);
  });

  it("toHslString uses precision argument", () => {
    const str0 = colordx("#c06060").toHslString(0);
    expect(str0).not.toMatch(/\d\.\d/); // no decimals
    const str4 = colordx("#c06060").toHslString(4);
    // with 4 decimal places, string should be parseable and round-trip accurately
    const rgb = colordx(str4).toRgb();
    expect(Math.abs(rgb.r - 0xc0)).toBeLessThanOrEqual(1);
  });
});

describe("toHwb precision option", () => {
  it("default precision=0 matches existing behavior", () => {
    expect(colordx("#c06060").toHwb()).toEqual(colordx("#c06060").toHwb(0));
  });

  it("precision=2 provides sub-integer whiteness/blackness", () => {
    const hwb0 = colordx("#c06060").toHwb(0);
    const hwb2 = colordx("#c06060").toHwb(2);
    expect(Number.isInteger(hwb0.w)).toBe(true);
    expect(Number.isInteger(hwb0.b)).toBe(true);
    // At precision=2 values may have decimals
    const wDecimals = hwb2.w.toString().split(".")[1]?.length ?? 0;
    const bDecimals = hwb2.b.toString().split(".")[1]?.length ?? 0;
    expect(wDecimals).toBeLessThanOrEqual(2);
    expect(bDecimals).toBeLessThanOrEqual(2);
  });
});

// Regression: double `% 360` in hue normalization caused binary FP artifacts
// e.g. (209.81 + 360) % 360 = 209.80999999999995 instead of 209.81
describe("string output precision", () => {
  // Helper: assert no long floating-point tails (> 4 significant decimal digits)
  const noFpArtifacts = (str: string) =>
    expect(str).not.toMatch(/\d\.\d{5,}/);

  it("toHslString has no floating-point artifacts", () => {
    // oklab(0.746 -0.0469 -0.1278) → rgb(100, 178, 255), hue ≈ 209.81
    noFpArtifacts(colordx("oklab(0.746 -0.0469 -0.1278)").toHslString());
    noFpArtifacts(colordx("#ff0000").toHslString());
    noFpArtifacts(colordx("#c06060").toHslString());
  });

  it("toHslString produces the exact expected value for the reported case", () => {
    expect(colordx("oklab(0.746 -0.0469 -0.1278)").toHslString()).toBe(
      "hsl(209.81, 100%, 69.61%)"
    );
  });

  it("toHwbString has no floating-point artifacts", () => {
    noFpArtifacts(colordx("oklab(0.746 -0.0469 -0.1278)").toHwbString());
    noFpArtifacts(colordx("#c06060").toHwbString());
  });

  it("toOklchString has no floating-point artifacts", () => {
    noFpArtifacts(colordx("#ff0000").toOklchString());
    noFpArtifacts(colordx("#00ff00").toOklchString());
    noFpArtifacts(colordx("#0000ff").toOklchString());
    noFpArtifacts(colordx("#c06060").toOklchString());
  });

  it("hue is within [0, 360) for all outputs", () => {
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#c06060", "oklab(0.746 -0.0469 -0.1278)"];
    for (const input of colors) {
      const { h } = colordx(input).toHsl();
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});


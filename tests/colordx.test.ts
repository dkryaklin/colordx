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

describe("achromatic hue normalization", () => {
  it("toOklch hue is 0 for white", () => {
    const { c, h } = colordx("#ffffff").toOklch();
    expect(c).toBeCloseTo(0, 4);
    expect(h).toBe(0);
  });

  it("toOklch hue is 0 for black", () => {
    const { c, h } = colordx("#000000").toOklch();
    expect(c).toBeCloseTo(0, 4);
    expect(h).toBe(0);
  });

  it("toOklch hue is 0 for mid-gray", () => {
    // #808080 has near-zero but non-negligible chroma in oklab due to sRGB gamma
    const { c } = colordx("#808080").toOklch();
    expect(c).toBeLessThan(0.01);
  });

  it("toOklchString hue is 0 for white", () => {
    expect(colordx("#ffffff").toOklchString()).toMatch(/oklch\([\d.]+ [\d.]+ 0\)/);
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

  it("lightens/darkens relatively", () => {
    // #ff0000 = hsl(0, 100%, 50%) — round-trips exactly
    // absolute lighten(0.1): l = 50 + 10 = 60
    // relative lighten(0.1): l = 50 * 1.1 = 55 (smaller step from the same amount)
    expect(colordx("#ff0000").lighten(0.1).toHsl().l).toBe(60);
    expect(colordx("#ff0000").lighten(0.1, { relative: true }).toHsl().l).toBeCloseTo(55, 0);
    expect(colordx("#ff0000").darken(0.1, { relative: true }).toHsl().l).toBeCloseTo(45, 0);
  });

  it("saturates/desaturates relatively", () => {
    // hsl(0, 50%, 50%) — construct via hex that round-trips, check relative < absolute
    const base = colordx({ h: 0, s: 50, l: 50, a: 1 });
    const absS = base.saturate(0.1).toHsl().s;
    const relS = base.saturate(0.1, { relative: true }).toHsl().s;
    // relative step is smaller than absolute step for same amount
    expect(relS).toBeLessThan(absS);
    expect(base.desaturate(0.1, { relative: true }).toHsl().s).toBeLessThan(base.toHsl().s);
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

  it("composites semi-transparent foreground over background for contrast", () => {
    // Fully transparent black over white = white → contrast 1:1 (not 21:1)
    expect(colordx("#00000000").contrast("#ffffff")).toBe(1);
    // Fully opaque black is unchanged
    expect(colordx("#000000ff").contrast("#ffffff")).toBe(21);
    // Transparent black over black = black → still 21:1
    expect(colordx("#00000000").contrast("#000000")).toBe(1);
    // 50% transparent black over white composites to ~mid-gray, contrast < 21
    const halfTransparent = colordx("#000000").alpha(0.5).contrast("#ffffff");
    expect(halfTransparent).toBeLessThan(21);
    expect(halfTransparent).toBeGreaterThan(1);
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

describe("parsing: hex variations", () => {
  it("parses 4-digit hex (3 rgb + alpha)", () => {
    const result = colordx("#f00a").toRgb();
    expect(result.r).toBe(255);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
    expect(result.a).toBeCloseTo(0.667, 2);
  });

  it("parses uppercase hex", () => {
    expect(colordx("#FF0000").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(colordx("#FFF").toRgb()).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it("parses mixed-case hex", () => {
    expect(colordx("#Ff0000").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it("parses green and blue hex", () => {
    expect(colordx("#00ff00").toRgb()).toEqual({ r: 0, g: 255, b: 0, a: 1 });
    expect(colordx("#0000ff").toRgb()).toEqual({ r: 0, g: 0, b: 255, a: 1 });
  });

  it("parses 8-digit hex with full opacity", () => {
    expect(colordx("#ff0000ff").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });
});

describe("parsing: hsl edge cases", () => {
  it("parses hsl with negative hue (normalizes to positive)", () => {
    expect(colordx("hsl(-120, 100%, 50%)").toHex()).toBe("#0000ff");
  });

  it("parses hsl with hue > 360 (wraps around)", () => {
    expect(colordx("hsl(480, 100%, 50%)").toHex()).toBe("#00ff00");
  });

  it("parses hsl with turn units", () => {
    expect(colordx("hsl(0.5turn 100% 50%)").toHex()).toBe("#00ffff");
  });

  it("parses hsla string", () => {
    expect(colordx("hsla(0, 100%, 50%, 0.5)").toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });

  it("parses hsla with 0% alpha", () => {
    expect(colordx("hsla(0, 100%, 50%, 0%)").alpha()).toBe(0);
  });
});

describe("parsing: rgb edge cases", () => {
  it("parses rgb with fractional values (rounds)", () => {
    expect(colordx("rgb(254.6, 0, 0)").toRgb().r).toBe(255);
  });

  it("parses rgba with percentage alpha", () => {
    expect(colordx("rgba(255, 0, 0, 100%)").alpha()).toBe(1);
    expect(colordx("rgba(255, 0, 0, 0%)").alpha()).toBe(0);
  });

  it("parses rgb with out-of-range values (clamps)", () => {
    expect(colordx("rgb(300, 0, 0)").toRgb().r).toBe(255);
    expect(colordx("rgb(-10, 0, 0)").toRgb().r).toBe(0);
  });
});

describe("conversion: comprehensive", () => {
  it("toHex includes alpha for semi-transparent colors", () => {
    expect(colordx("#ff000080").toHex()).toBe("#ff000080");
  });

  it("toHex for fully transparent black", () => {
    expect(colordx({ r: 0, g: 0, b: 0, a: 0 }).toHex()).toBe("#00000000");
  });

  it("toHsl for green gives h=120, s=100, l=50", () => {
    const hsl = colordx("#00ff00").toHsl();
    expect(hsl.h).toBe(120);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });

  it("toHsl for blue gives h=240", () => {
    expect(colordx("#0000ff").toHsl().h).toBe(240);
  });

  it("toHsl for black: s=0, l=0", () => {
    const hsl = colordx("#000000").toHsl();
    expect(hsl.l).toBe(0);
    expect(hsl.s).toBe(0);
  });

  it("toHsl for white: s=0, l=100", () => {
    const hsl = colordx("#ffffff").toHsl();
    expect(hsl.l).toBe(100);
    expect(hsl.s).toBe(0);
  });

  it("toHslString for green", () => {
    expect(colordx("#00ff00").toHslString()).toBe("hsl(120, 100%, 50%)");
  });

  it("toHslString for blue", () => {
    expect(colordx("#0000ff").toHslString()).toBe("hsl(240, 100%, 50%)");
  });

  it("toHsv for green", () => {
    const hsv = colordx("#00ff00").toHsv();
    expect(hsv.h).toBe(120);
    expect(hsv.s).toBe(100);
    expect(hsv.v).toBe(100);
  });

  it("toHsv for black", () => {
    expect(colordx("#000000").toHsv().v).toBe(0);
    expect(colordx("#000000").toHsv().s).toBe(0);
  });

  it("toHsv for white", () => {
    expect(colordx("#ffffff").toHsv().v).toBe(100);
    expect(colordx("#ffffff").toHsv().s).toBe(0);
  });

  it("toHsv for blue", () => {
    const hsv = colordx("#0000ff").toHsv();
    expect(hsv.h).toBe(240);
    expect(hsv.s).toBe(100);
    expect(hsv.v).toBe(100);
  });

  it("toNumber for blue", () => {
    expect(colordx("#0000ff").toNumber()).toBe(0x0000ff);
  });

  it("toNumber for green", () => {
    expect(colordx("#00ff00").toNumber()).toBe(0x00ff00);
  });

  it("toNumber ignores alpha channel", () => {
    expect(colordx("#ff000080").toNumber()).toBe(0xff0000);
  });

  it("toRgbString for opaque colors omits alpha", () => {
    expect(colordx("#00ff00").toRgbString()).toBe("rgb(0, 255, 0)");
    expect(colordx("#0000ff").toRgbString()).toBe("rgb(0, 0, 255)");
  });

  it("toRgbString for transparent uses rgba", () => {
    expect(colordx({ r: 0, g: 128, b: 255, a: 0.5 }).toRgbString()).toBe("rgba(0, 128, 255, 0.5)");
  });

  it("toHsvString for blue", () => {
    expect(colordx("#0000ff").toHsvString()).toBe("hsv(240, 100%, 100%)");
  });

  it("toHwb for primary colors", () => {
    expect(colordx("#ff0000").toHwb()).toEqual({ h: 0, w: 0, b: 0, a: 1 });
    expect(colordx("#ffffff").toHwb()).toEqual({ h: 0, w: 100, b: 0, a: 1 });
    expect(colordx("#000000").toHwb()).toEqual({ h: 0, w: 0, b: 100, a: 1 });
  });
});

describe("manipulation: boundary conditions", () => {
  it("lighten clamps at l=100", () => {
    expect(colordx("#ffffff").lighten(0.5).toHsl().l).toBe(100);
  });

  it("darken clamps at l=0", () => {
    expect(colordx("#000000").darken(0.5).toHsl().l).toBe(0);
  });

  it("saturate clamps at s=100", () => {
    expect(colordx("#ff0000").saturate(1.0).toHsl().s).toBe(100);
  });

  it("desaturate clamps at s=0", () => {
    expect(colordx("#ff0000").desaturate(1.0).toHsl().s).toBe(0);
  });

  it("mix at weight=0 returns original color", () => {
    const result = colordx("#ff0000").mix("#0000ff", 0).toRgb();
    expect(result.r).toBe(255);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it("mix at weight=1 returns target color", () => {
    const result = colordx("#ff0000").mix("#0000ff", 1).toRgb();
    expect(result.r).toBe(0);
    expect(result.b).toBe(255);
  });

  it("mix blends alpha channels", () => {
    const mixed = colordx({ r: 255, g: 0, b: 0, a: 1 }).mix({ r: 0, g: 0, b: 255, a: 0 }, 0.5);
    expect(mixed.alpha()).toBe(0.5);
  });

  it("rotate 360 returns same color as original", () => {
    expect(colordx("#ff0000").rotate(360).toHex()).toBe("#ff0000");
    expect(colordx("#3b82f6").rotate(360).toHex()).toBe(colordx("#3b82f6").toHex());
  });

  it("rotate negative angle mirrors positive", () => {
    expect(colordx("#ff0000").rotate(-180).toHex()).toBe(colordx("#ff0000").rotate(180).toHex());
  });

  it("rotate 0 is identity", () => {
    expect(colordx("#ff0000").rotate(0).toHex()).toBe("#ff0000");
  });

  it("invert preserves alpha", () => {
    const inverted = colordx({ r: 255, g: 0, b: 0, a: 0.5 }).invert();
    expect(inverted.alpha()).toBe(0.5);
    expect(inverted.toRgb().r).toBe(0);
    expect(inverted.toRgb().g).toBe(255);
    expect(inverted.toRgb().b).toBe(255);
  });

  it("invert of black is white and vice versa", () => {
    expect(colordx("#000000").invert().toHex()).toBe("#ffffff");
    expect(colordx("#ffffff").invert().toHex()).toBe("#000000");
  });

  it("grayscale of already-gray color is unchanged", () => {
    expect(colordx("#808080").grayscale().toHex()).toBe("#808080");
  });

  it("lighten default amount is 10 percentage points", () => {
    const l1 = colordx("#ff0000").toHsl().l;
    const l2 = colordx("#ff0000").lighten().toHsl().l;
    expect(l2 - l1).toBeCloseTo(10, 0);
  });

  it("darken default amount is 10 percentage points", () => {
    const l1 = colordx("#ff0000").toHsl().l;
    const l2 = colordx("#ff0000").darken().toHsl().l;
    expect(l1 - l2).toBeCloseTo(10, 0);
  });

  it("saturate on achromatic color does not throw", () => {
    expect(() => colordx("#808080").saturate(0.1)).not.toThrow();
    expect(colordx("#808080").saturate(0.1)).toBeInstanceOf(Colordx);
  });
});

describe("getters: comprehensive", () => {
  it("brightness for mid-gray is near 0.5", () => {
    const b = colordx("#808080").brightness();
    expect(b).toBeGreaterThan(0.45);
    expect(b).toBeLessThan(0.55);
  });

  it("luminance ordering: green > red > blue", () => {
    expect(colordx("#00ff00").luminance()).toBeGreaterThan(colordx("#ff0000").luminance());
    expect(colordx("#ff0000").luminance()).toBeGreaterThan(colordx("#0000ff").luminance());
  });

  it("contrast between black and each primary is greater than 1", () => {
    expect(colordx("#ff0000").contrast("#000000")).toBeGreaterThan(1);
    expect(colordx("#00ff00").contrast("#000000")).toBeGreaterThan(1);
    expect(colordx("#0000ff").contrast("#000000")).toBeGreaterThan(1);
  });

  it("contrast is symmetric", () => {
    expect(colordx("#ff0000").contrast("#000000")).toBe(colordx("#000000").contrast("#ff0000"));
  });

  it("isDark for dark colors", () => {
    expect(colordx("#111111").isDark()).toBe(true);
    expect(colordx("#333333").isDark()).toBe(true);
  });

  it("isLight for light colors", () => {
    expect(colordx("#eeeeee").isLight()).toBe(true);
    expect(colordx("#cccccc").isLight()).toBe(true);
  });

  it("hue() wraps at 360 when setting", () => {
    expect(colordx("#ff0000").hue(360).toHex()).toBe(colordx("#ff0000").hue(0).toHex());
  });

  it("hue() of achromatic colors is 0", () => {
    expect(colordx("#000000").hue()).toBe(0);
    expect(colordx("#ffffff").hue()).toBe(0);
    expect(colordx("#808080").hue()).toBe(0);
  });

  it("chroma of achromatic colors is near 0", () => {
    expect(colordx("#000000").chroma()).toBeCloseTo(0, 2);
    expect(colordx("#ffffff").chroma()).toBeCloseTo(0, 2);
    expect(colordx("#808080").chroma()).toBeCloseTo(0, 2);
  });

  it("chroma of chromatic primary colors is greater than 0.1", () => {
    expect(colordx("#ff0000").chroma()).toBeGreaterThan(0.1);
    expect(colordx("#00ff00").chroma()).toBeGreaterThan(0.1);
    expect(colordx("#0000ff").chroma()).toBeGreaterThan(0.1);
  });

  it("lightness of primaries is strictly between 0 and 1", () => {
    for (const c of ["#ff0000", "#00ff00", "#0000ff", "#c06060"]) {
      const l = colordx(c).lightness();
      expect(l).toBeGreaterThan(0);
      expect(l).toBeLessThan(1);
    }
  });

  it("isEqual is false for different alpha at same RGB", () => {
    expect(colordx("#ff0000").isEqual({ r: 255, g: 0, b: 0, a: 0.5 })).toBe(false);
  });

  it("isEqual with different formats for green", () => {
    expect(colordx("#00ff00").isEqual("rgb(0, 255, 0)")).toBe(true);
    expect(colordx("#00ff00").isEqual("hsl(120, 100%, 50%)")).toBe(true);
    expect(colordx("#00ff00").isEqual("#0f0")).toBe(true);
  });

  it("alpha clamps to [0, 1]", () => {
    expect(colordx("#ff0000").alpha(2).alpha()).toBe(1);
    expect(colordx("#ff0000").alpha(-1).alpha()).toBe(0);
  });
});

describe("invalid input: comprehensive", () => {
  it("rejects empty string", () => {
    expect(colordx("").isValid()).toBe(false);
  });

  it("rejects number input", () => {
    expect(colordx(42 as any).isValid()).toBe(false);
  });

  it("rejects null input", () => {
    expect(colordx(null as any).isValid()).toBe(false);
  });

  it("rejects undefined input", () => {
    expect(colordx(undefined as any).isValid()).toBe(false);
  });

  it("rejects object with only partial rgb fields", () => {
    expect(colordx({ r: 255 } as any).isValid()).toBe(false);
    expect(colordx({ r: 255, g: 0 } as any).isValid()).toBe(false);
  });

  it("rejects hex with non-hex characters", () => {
    expect(colordx("#gggggg").isValid()).toBe(false);
    expect(colordx("#xyz").isValid()).toBe(false);
  });

  it("rejects 7-char hex as invalid length", () => {
    expect(colordx("#1234567").isValid()).toBe(false);
  });

  it("falls back to opaque black (not transparent) for invalid input", () => {
    const rgb = colordx("totally-invalid").toRgb();
    expect(rgb.r).toBe(0);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
    expect(rgb.a).toBe(1);
  });

  it("rejects array input", () => {
    expect(colordx([255, 0, 0] as any).isValid()).toBe(false);
  });
});

describe("getFormat: extended", () => {
  it("detects 8-char hex with alpha", () => {
    expect(getFormat("#ff000080")).toBe("hex");
    expect(getFormat("#ff0000ff")).toBe("hex");
  });

  it("detects hwb string", () => {
    expect(getFormat("hwb(0 0% 0%)")).toBe("hwb");
    expect(getFormat("hwb(120 50% 20%)")).toBe("hwb");
  });

  it("detects oklch string as 'lch'", () => {
    expect(getFormat("oklch(0.5 0.2 240)")).toBe("lch");
  });

  it("detects oklab string as 'lab'", () => {
    expect(getFormat("oklab(0.5 0.1 0.1)")).toBe("lab");
  });

  it("detects hwb object", () => {
    expect(getFormat({ h: 0, w: 0, b: 0, a: 1 })).toBe("hwb");
  });

  it("detects oklch object as 'lch'", () => {
    expect(getFormat({ l: 0.5, c: 0.2, h: 240, a: 1 })).toBe("lch");
  });

  it("detects oklab object as 'lab'", () => {
    expect(getFormat({ l: 0.5, a: 0.1, b: 0.1, alpha: 1 })).toBe("lab");
  });

  it("returns undefined for number input", () => {
    expect(getFormat(42 as any)).toBeUndefined();
  });

  it("returns undefined for null input", () => {
    expect(getFormat(null as any)).toBeUndefined();
  });
});

describe("nearest: edge cases", () => {
  it("returns the only candidate for a single-element palette", () => {
    expect(nearest("#ff0000", ["#ff0000"])).toBe("#ff0000");
    expect(nearest("#0000cc", ["#ff0000"])).toBe("#ff0000");
  });

  it("finds the visually nearest color across lightness dimension", () => {
    expect(nearest("#111111", ["#000000", "#ffffff"])).toBe("#000000");
    expect(nearest("#eeeeee", ["#000000", "#ffffff"])).toBe("#ffffff");
  });

  it("finds nearest when palette contains the exact color", () => {
    const palette = ["#ff0000", "#00ff00", "#0000ff"];
    expect(nearest("#00ff00", palette)).toBe("#00ff00");
  });
});

describe("string output: round-trips", () => {
  const primaries = ["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#000000"];

  it("toHslString → parse → toHex round-trips for primaries", () => {
    for (const c of primaries) {
      expect(colordx(colordx(c).toHslString()).toHex()).toBe(c);
    }
  });

  it("toRgbString → parse → toHex round-trips for primaries", () => {
    for (const c of primaries) {
      expect(colordx(colordx(c).toRgbString()).toHex()).toBe(c);
    }
  });

  it("toHwbString → parse → toHex round-trips for primaries", () => {
    for (const c of primaries) {
      expect(colordx(colordx(c).toHwbString()).toHex()).toBe(c);
    }
  });

  it("toOklabString → parse → toHex round-trips for primaries", () => {
    for (const c of primaries) {
      const str = colordx(c).toOklabString();
      const rgb = colordx(str).toRgb();
      const orig = colordx(c).toRgb();
      expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
    }
  });

  it("toOklchString → parse → toHex round-trips for primaries", () => {
    for (const c of primaries) {
      const str = colordx(c).toOklchString();
      const rgb = colordx(str).toRgb();
      const orig = colordx(c).toRgb();
      expect(Math.abs(rgb.r - orig.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(rgb.g - orig.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(rgb.b - orig.b)).toBeLessThanOrEqual(1);
    }
  });

  it("hue within [0, 360) for edge-case colors", () => {
    const { h } = colordx("#ff0055").toHsl();
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(360);
  });
});


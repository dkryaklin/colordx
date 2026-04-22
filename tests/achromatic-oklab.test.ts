import { describe, it, expect, beforeAll } from "vitest";
import { colordx, extend, Colordx } from "../src/index.js";
import {
  oklabToLinear,
  oklabToLinearInto,
  oklabToRgb,
  oklabToRgbUnclamped,
} from "../src/colorModels/oklab.js";
import hwb from "../src/plugins/hwb.js";
import hsv from "../src/plugins/hsv.js";
import p3 from "../src/plugins/p3.js";
import rec2020 from "../src/plugins/rec2020.js";

beforeAll(() => {
  extend([hwb, hsv, p3, rec2020]);
});

// Regression for the bug reported in the colordx picker migration:
// colordx({l:1,c:0,h:0}) produced hsl(145.71 100% 100%) because the OKLab→linear
// matrix leaves ~1 ULP of noise in r/g/b for achromatic inputs, which rgbToHslRaw
// amplifies into a phantom hue. `toRgb()` rounded the noise away, but `toHsl()`
// read the raw internal buffer and saw max ≠ min.

describe("achromatic OKLab/OKLCH → internal sRGB invariant", () => {
  it("oklabToLinear returns exactly equal channels for a=0,b=0", () => {
    const [lr, lg, lb] = oklabToLinear(1, 0, 0);
    expect(lr).toBe(lg);
    expect(lg).toBe(lb);
  });

  it("oklabToLinear(l,0,0) = [l^3, l^3, l^3] mathematically", () => {
    for (const l of [0, 0.1, 0.25, 0.5, 0.7, 0.999, 1]) {
      const [lr, lg, lb] = oklabToLinear(l, 0, 0);
      const expected = l ** 3;
      expect(lr).toBe(expected);
      expect(lg).toBe(expected);
      expect(lb).toBe(expected);
    }
  });

  it("oklabToLinearInto writes exactly equal channels for a=0,b=0", () => {
    const out = [NaN, NaN, NaN];
    oklabToLinearInto(out, 0.6, 0, 0);
    expect(out[0]).toBe(out[1]);
    expect(out[1]).toBe(out[2]);
    expect(out[0]).toBe(0.6 ** 3);
  });

  it("oklabToLinearInto also works with Float64Array", () => {
    const out = new Float64Array(3);
    oklabToLinearInto(out, 0.42, 0, 0);
    expect(out[0]).toBe(out[1]);
    expect(out[1]).toBe(out[2]);
  });

  it("oklabToRgb (clamped) returns r === g === b for achromatic", () => {
    for (const l of [0, 0.25, 0.5, 0.75, 1]) {
      const { r, g, b } = oklabToRgb({ l, a: 0, b: 0, alpha: 1 });
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it("oklabToRgbUnclamped returns r === g === b for achromatic", () => {
    for (const l of [0, 0.25, 0.5, 0.75, 1]) {
      const { r, g, b } = oklabToRgbUnclamped({ l, a: 0, b: 0, alpha: 1 });
      expect(r).toBe(g);
      expect(g).toBe(b);
    }
  });

  it("non-achromatic path is unchanged (a≠0 or b≠0)", () => {
    // Red-ish: regression guard — the short-circuit must not fire for chromatic input.
    const [lr, lg, lb] = oklabToLinear(0.628, 0.225, 0.126);
    // Values should clearly differ for non-achromatic — no accidental short-circuit.
    expect(lr).not.toBe(lg);
    expect(lg).not.toBe(lb);
  });

  it("tiny but non-zero a survives (no false short-circuit)", () => {
    // If we ever replace the `=== 0` guard with a threshold, this would flag it.
    // With the current exact-zero guard, the three channels end up distinct.
    const [lr, lg, lb] = oklabToLinear(0.5, 1e-10, 0);
    // Either they are exactly equal (guard fired) or they differ — we assert the
    // current behavior: guard is exact, so tiny a produces tiny channel split.
    const allEqual = lr === lg && lg === lb;
    expect(allEqual).toBe(false);
  });
});

describe("Regression: OKLCH-object → HSL (reported bug)", () => {
  it("white via OKLCH object produces hsl(0 0% 100%)", () => {
    expect(colordx({ l: 1, c: 0, h: 0, alpha: 1 }).toHslString()).toBe(
      "hsl(0 0% 100%)"
    );
  });

  it("white via OKLCH object produces h=0, s=0", () => {
    const { h, s } = colordx({ l: 1, c: 0, h: 0, alpha: 1 }).toHsl();
    expect(h).toBe(0);
    expect(s).toBe(0);
  });

  it("white via OKLCH with non-zero h still achromatic when c=0", () => {
    // c=0 must force achromatic regardless of h value
    for (const h of [0, 90, 180, 270, 359.9, -45, 720]) {
      const hsl = colordx({ l: 1, c: 0, h, alpha: 1 }).toHsl();
      expect(hsl.h).toBe(0);
      expect(hsl.s).toBe(0);
      expect(hsl.l).toBe(100);
    }
  });

  it("gray via OKLCH object produces s=0 with stable h=0", () => {
    const { h, s } = colordx({ l: 0.5999, c: 0, h: 0, alpha: 1 }).toHsl();
    expect(h).toBe(0);
    expect(s).toBe(0);
  });

  it("black via OKLCH object produces hsl(0 0% 0%)", () => {
    expect(colordx({ l: 0, c: 0, h: 0, alpha: 1 }).toHslString()).toBe(
      "hsl(0 0% 0%)"
    );
  });

  it("various achromatic lightnesses via OKLCH all produce h=0 s=0", () => {
    for (const l of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      const { h, s } = colordx({ l, c: 0, h: 0, alpha: 1 }).toHsl();
      expect(h).toBe(0);
      expect(s).toBe(0);
    }
  });
});

describe("Regression: OKLab-object → HSL", () => {
  it("oklab object with a=0,b=0 produces achromatic HSL", () => {
    for (const l of [0, 0.25, 0.5, 0.75, 1]) {
      const { h, s } = colordx({ l, a: 0, b: 0, alpha: 1 }).toHsl();
      expect(h).toBe(0);
      expect(s).toBe(0);
    }
  });

  it("oklab(1 0 0) string produces hsl(0 0% 100%)", () => {
    expect(colordx("oklab(1 0 0)").toHslString()).toBe("hsl(0 0% 100%)");
  });

  it("oklab(0 0 0) string produces hsl(0 0% 0%)", () => {
    expect(colordx("oklab(0 0 0)").toHslString()).toBe("hsl(0 0% 0%)");
  });
});

describe("Regression: OKLCH-string → HSL", () => {
  it("oklch(1 0 none) produces hsl(0 0% 100%)", () => {
    expect(colordx("oklch(1 0 none)").toHslString()).toBe("hsl(0 0% 100%)");
  });

  it("oklch(1 0 0) produces hsl(0 0% 100%)", () => {
    expect(colordx("oklch(1 0 0)").toHslString()).toBe("hsl(0 0% 100%)");
  });

  it("oklch(0.5 0 180) produces s=0 and h=0", () => {
    const { h, s } = colordx("oklch(0.5 0 180)").toHsl();
    expect(h).toBe(0);
    expect(s).toBe(0);
  });
});

describe("Regression: internal RGB invariants for OKLCH-sourced achromatic", () => {
  it("_rawRgb has r === g === b for white via OKLCH", () => {
    const c = colordx({ l: 1, c: 0, h: 0, alpha: 1 });
    const { r, g, b } = c._rawRgb();
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("_rawRgb has r === g === b for gray via OKLCH", () => {
    const c = colordx({ l: 0.6, c: 0, h: 45, alpha: 1 });
    const { r, g, b } = c._rawRgb();
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("_rawRgb has r === g === b for black via OKLCH", () => {
    const c = colordx({ l: 0, c: 0, h: 180, alpha: 1 });
    const { r, g, b } = c._rawRgb();
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});

describe("Regression: HSL-dependent methods for OKLCH-sourced achromatic", () => {
  const white = () => colordx({ l: 1, c: 0, h: 0, alpha: 1 });

  it("hue() returns 0", () => {
    expect(white().hue()).toBe(0);
  });

  it("lighten(-0.1) darkens without introducing color", () => {
    const hex = white().lighten(-0.1).toHex();
    // Must remain on the grayscale diagonal
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBeLessThan(255);
    expect(r).toBeGreaterThan(200); // ~230, give some tolerance
  });

  it("darken(0.2) produces neutral gray", () => {
    const hex = white().darken(0.2).toHex();
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("saturate() on achromatic is a no-op (s=0 can't increase via HSL saturate)", () => {
    // HSL saturate only clamps; since there's no hue to lean into, the color
    // must stay on the grayscale diagonal.
    const hex = white().saturate(0.5).toHex();
    expect(hex).toBe("#ffffff");
  });

  it("grayscale() on OKLCH white stays white", () => {
    expect(white().grayscale().toHex()).toBe("#ffffff");
  });

  it("rotate() on achromatic introduces no color", () => {
    for (const deg of [0, 45, 90, 180, 270]) {
      const hex = white().rotate(deg).toHex();
      expect(hex).toBe("#ffffff");
    }
  });

  it("desaturate() on OKLCH gray is a no-op", () => {
    const gray = colordx({ l: 0.6, c: 0, h: 120, alpha: 1 });
    const before = gray.toHex();
    expect(gray.desaturate(0.5).toHex()).toBe(before);
  });
});

describe("Regression: HWB/HSV for OKLCH-sourced achromatic", () => {
  it("toHwbString for OKLCH white has no phantom hue", () => {
    const str = colordx({ l: 1, c: 0, h: 0, alpha: 1 }).toHwbString();
    // white: w=100, b=0, hue irrelevant but must be a clean number
    expect(str).not.toMatch(/\d\.\d{5,}/);
    expect(str).toMatch(/^hwb\(0 100% 0%\)$/);
  });

  it("toHsvString for OKLCH white produces s=0", () => {
    const { s } = (colordx({ l: 1, c: 0, h: 0, alpha: 1 }) as Colordx & {
      toHsv(): { h: number; s: number; v: number; alpha: number };
    }).toHsv();
    expect(s).toBe(0);
  });
});

describe("Regression: wide-gamut output for OKLCH-sourced achromatic", () => {
  it("toP3 for OKLCH white produces (1, 1, 1) with equal channels", () => {
    const { r, g, b } = (colordx({ l: 1, c: 0, h: 0, alpha: 1 }) as Colordx & {
      toP3(): { r: number; g: number; b: number; alpha: number };
    }).toP3();
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("toRec2020 for OKLCH white produces equal channels", () => {
    const { r, g, b } = (colordx({ l: 1, c: 0, h: 0, alpha: 1 }) as Colordx & {
      toRec2020(): { r: number; g: number; b: number; alpha: number };
    }).toRec2020();
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
});

describe("Non-regression: chromatic OKLCH input still converts correctly", () => {
  it("red-ish OKLCH produces a real hue", () => {
    const { h, s } = colordx({ l: 0.628, c: 0.2577, h: 29.23, alpha: 1 }).toHsl();
    expect(s).toBeGreaterThan(50);
    // Red sits near HSL hue 0, which wraps through 360 — accept either side.
    expect(h < 30 || h > 330).toBe(true);
  });

  it("blue-ish OKLCH produces a real hue in blue range", () => {
    const { h, s } = colordx({ l: 0.452, c: 0.3133, h: 264.05, alpha: 1 }).toHsl();
    expect(s).toBeGreaterThan(50);
    expect(h).toBeGreaterThan(200);
    expect(h).toBeLessThan(260);
  });

  it("green-ish OKLCH produces a real hue in green range", () => {
    const { h, s } = colordx({ l: 0.866, c: 0.2947, h: 142.5, alpha: 1 }).toHsl();
    expect(s).toBeGreaterThan(50);
    expect(h).toBeGreaterThan(100);
    expect(h).toBeLessThan(160);
  });
});

describe("Non-regression: hex-sourced achromatic still works", () => {
  it("#ffffff toHslString", () => {
    expect(colordx("#ffffff").toHslString()).toBe("hsl(0 0% 100%)");
  });
  it("#808080 toHslString", () => {
    expect(colordx("#808080").toHslString()).toBe("hsl(0 0% 50.2%)");
  });
  it("#000000 toHslString", () => {
    expect(colordx("#000000").toHslString()).toBe("hsl(0 0% 0%)");
  });
});

describe("Round-trip: OKLCH achromatic survives sRGB round-trip", () => {
  it("OKLCH-white → hex → OKLCH stays achromatic", () => {
    const hex = colordx({ l: 1, c: 0, h: 0, alpha: 1 }).toHex();
    const { c } = colordx(hex).toOklch();
    expect(c).toBeLessThan(0.0001);
  });

  it("OKLCH-mid-gray → hex → HSL stays h=0 s=0", () => {
    const hex = colordx({ l: 0.5, c: 0, h: 210, alpha: 1 }).toHex();
    const { h, s } = colordx(hex).toHsl();
    expect(h).toBe(0);
    expect(s).toBe(0);
  });
});

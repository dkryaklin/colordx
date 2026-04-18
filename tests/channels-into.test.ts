import { describe, expect, it } from 'vitest';
import {
  oklchToLinear,
  oklchToLinearAndSrgb,
  oklchToLinearAndSrgbInto,
  oklchToLinearInto,
  oklchToRgbChannels,
  oklchToRgbChannelsInto,
} from '../src/channels.js';
import {
  linearSrgbToOklab,
  linearSrgbToOklabInto,
  oklabToLinear,
  oklabToLinearInto,
} from '../src/colorModels/oklab.js';
import {
  linearP3ToSrgb,
  linearP3ToSrgbInto,
  oklabToLinearP3,
  oklabToLinearP3Into,
  srgbLinearToP3Linear,
  srgbLinearToP3LinearInto,
} from '../src/colorModels/p3.js';
import {
  linearRec2020ToSrgb,
  linearRec2020ToSrgbInto,
  oklabToLinearRec2020,
  oklabToLinearRec2020Into,
  srgbLinearToRec2020Linear,
  srgbLinearToRec2020LinearInto,
} from '../src/colorModels/rec2020.js';
import { xyzD50ToLinearSrgb, xyzD50ToLinearSrgbInto } from '../src/colorModels/xyz.js';
import {
  linearToP3Channels,
  linearToP3ChannelsInto,
  oklchToP3Channels,
  oklchToP3ChannelsInto,
} from '../src/plugins/p3.js';
import {
  linearToRec2020Channels,
  linearToRec2020ChannelsInto,
  oklchToRec2020Channels,
  oklchToRec2020ChannelsInto,
} from '../src/plugins/rec2020.js';

// Sweep of OKLCH triplets covering sRGB, P3, Rec2020, and out-of-gamut regions.
const OKLCH_CASES: Array<[number, number, number]> = [
  [0, 0, 0],
  [1, 0, 0],
  [0.5, 0, 0],
  [0.5, 0.05, 0],
  [0.5, 0.05, 90],
  [0.5, 0.05, 180],
  [0.5, 0.05, 270],
  [0.7, 0.15, 145],
  [0.6, 0.25, 145],
  [0.5, 0.37, 30],
  [0.8, 0.1, 60],
  [0.3, 0.08, 300],
];

// Corresponding OKLab triplets (l, a, b) covering similar regions.
const OKLAB_CASES: Array<[number, number, number]> = [
  [0, 0, 0],
  [1, 0, 0],
  [0.5, 0.1, 0.1],
  [0.5, -0.1, 0.1],
  [0.5, 0.1, -0.1],
  [0.5, -0.1, -0.1],
  [0.7, 0.15, 0.12],
  [0.3, 0.08, -0.15],
  [0.5, 0.2, 0.2],
];

// Linear-sRGB triplets for the linear-domain matrices.
const LINEAR_CASES: Array<[number, number, number]> = [
  [0, 0, 0],
  [1, 1, 1],
  [0.5, 0.5, 0.5],
  [0.2, 0.4, 0.6],
  [0.9, 0.1, 0.3],
  [-0.2, 0.5, 1.3], // out-of-gamut
];

const XYZ_CASES: Array<[number, number, number]> = [
  [0, 0, 0],
  [50, 50, 50],
  [25, 70, 40],
  [96.43, 100, 82.51], // D50 white
];

const expectTripleEqual = (got: ArrayLike<number>, want: readonly [number, number, number]) => {
  // Expect bit-for-bit identical output to the allocating sibling — same math, same order.
  expect(got[0]).toBe(want[0]);
  expect(got[1]).toBe(want[1]);
  expect(got[2]).toBe(want[2]);
};

describe('channels *Into parity (Float64Array out)', () => {
  const out = new Float64Array(3);

  it('oklchToLinearInto matches oklchToLinear', () => {
    for (const [l, c, h] of OKLCH_CASES) {
      const want = oklchToLinear(l, c, h);
      oklchToLinearInto(out, l, c, h);
      expectTripleEqual(out, want);
    }
  });

  it('oklchToRgbChannelsInto matches oklchToRgbChannels', () => {
    for (const [l, c, h] of OKLCH_CASES) {
      const want = oklchToRgbChannels(l, c, h);
      oklchToRgbChannelsInto(out, l, c, h);
      expectTripleEqual(out, want);
    }
  });

  it('oklchToLinearAndSrgbInto matches oklchToLinearAndSrgb', () => {
    const linOut = new Float64Array(3);
    const srgbOut = new Float64Array(3);
    for (const [l, c, h] of OKLCH_CASES) {
      const [wantLin, wantSrgb] = oklchToLinearAndSrgb(l, c, h);
      oklchToLinearAndSrgbInto(linOut, srgbOut, l, c, h);
      expectTripleEqual(linOut, wantLin);
      expectTripleEqual(srgbOut, wantSrgb);
    }
  });
});

describe('oklab *Into parity', () => {
  const out = new Float64Array(3);

  it('oklabToLinearInto matches oklabToLinear', () => {
    for (const [l, a, b] of OKLAB_CASES) {
      const want = oklabToLinear(l, a, b);
      oklabToLinearInto(out, l, a, b);
      expectTripleEqual(out, want);
    }
  });

  it('linearSrgbToOklabInto matches linearSrgbToOklab', () => {
    for (const [lr, lg, lb] of LINEAR_CASES) {
      const want = linearSrgbToOklab(lr, lg, lb);
      linearSrgbToOklabInto(out, lr, lg, lb);
      expectTripleEqual(out, want);
    }
  });
});

describe('xyz *Into parity', () => {
  const out = new Float64Array(3);

  it('xyzD50ToLinearSrgbInto matches xyzD50ToLinearSrgb', () => {
    for (const [x, y, z] of XYZ_CASES) {
      const want = xyzD50ToLinearSrgb(x, y, z);
      xyzD50ToLinearSrgbInto(out, x, y, z);
      expectTripleEqual(out, want);
    }
  });
});

describe('p3 model *Into parity', () => {
  const out = new Float64Array(3);

  it('srgbLinearToP3LinearInto matches srgbLinearToP3Linear', () => {
    for (const [r, g, b] of LINEAR_CASES) {
      const want = srgbLinearToP3Linear(r, g, b);
      srgbLinearToP3LinearInto(out, r, g, b);
      expectTripleEqual(out, want);
    }
  });

  it('linearP3ToSrgbInto matches linearP3ToSrgb', () => {
    for (const [r, g, b] of LINEAR_CASES) {
      const want = linearP3ToSrgb(r, g, b);
      linearP3ToSrgbInto(out, r, g, b);
      expectTripleEqual(out, want);
    }
  });

  it('oklabToLinearP3Into matches oklabToLinearP3', () => {
    for (const [l, a, b] of OKLAB_CASES) {
      const want = oklabToLinearP3(l, a, b);
      oklabToLinearP3Into(out, l, a, b);
      expectTripleEqual(out, want);
    }
  });
});

describe('rec2020 model *Into parity', () => {
  const out = new Float64Array(3);

  it('srgbLinearToRec2020LinearInto matches srgbLinearToRec2020Linear', () => {
    for (const [r, g, b] of LINEAR_CASES) {
      const want = srgbLinearToRec2020Linear(r, g, b);
      srgbLinearToRec2020LinearInto(out, r, g, b);
      expectTripleEqual(out, want);
    }
  });

  it('linearRec2020ToSrgbInto matches linearRec2020ToSrgb', () => {
    for (const [r, g, b] of LINEAR_CASES) {
      const want = linearRec2020ToSrgb(r, g, b);
      linearRec2020ToSrgbInto(out, r, g, b);
      expectTripleEqual(out, want);
    }
  });

  it('oklabToLinearRec2020Into matches oklabToLinearRec2020', () => {
    for (const [l, a, b] of OKLAB_CASES) {
      const want = oklabToLinearRec2020(l, a, b);
      oklabToLinearRec2020Into(out, l, a, b);
      expectTripleEqual(out, want);
    }
  });
});

describe('p3 plugin *Into parity', () => {
  const out = new Float64Array(3);

  it('linearToP3ChannelsInto matches linearToP3Channels', () => {
    for (const [lr, lg, lb] of LINEAR_CASES) {
      const want = linearToP3Channels(lr, lg, lb);
      linearToP3ChannelsInto(out, lr, lg, lb);
      expectTripleEqual(out, want);
    }
  });

  it('oklchToP3ChannelsInto matches oklchToP3Channels', () => {
    for (const [l, c, h] of OKLCH_CASES) {
      const want = oklchToP3Channels(l, c, h);
      oklchToP3ChannelsInto(out, l, c, h);
      expectTripleEqual(out, want);
    }
  });
});

describe('rec2020 plugin *Into parity', () => {
  const out = new Float64Array(3);

  it('linearToRec2020ChannelsInto matches linearToRec2020Channels', () => {
    for (const [lr, lg, lb] of LINEAR_CASES) {
      const want = linearToRec2020Channels(lr, lg, lb);
      linearToRec2020ChannelsInto(out, lr, lg, lb);
      expectTripleEqual(out, want);
    }
  });

  it('oklchToRec2020ChannelsInto matches oklchToRec2020Channels', () => {
    for (const [l, c, h] of OKLCH_CASES) {
      const want = oklchToRec2020Channels(l, c, h);
      oklchToRec2020ChannelsInto(out, l, c, h);
      expectTripleEqual(out, want);
    }
  });
});

describe('*Into accepts number[] (not just Float64Array)', () => {
  it('works with plain Array', () => {
    const out: number[] = [0, 0, 0];
    oklchToLinearInto(out, 0.5, 0.15, 120);
    const want = oklchToLinear(0.5, 0.15, 120);
    expectTripleEqual(out, want);
  });

  it('does not allocate — reusing the same buffer produces fresh values', () => {
    const out = new Float64Array(3);
    oklchToLinearInto(out, 0.5, 0.15, 120);
    const first = [out[0], out[1], out[2]];
    oklchToLinearInto(out, 0.8, 0.05, 30);
    // Second call should have overwritten the buffer.
    expect([out[0], out[1], out[2]]).not.toEqual(first);
  });
});

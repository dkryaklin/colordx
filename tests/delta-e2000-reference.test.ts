import { describe, expect, it } from 'vitest';
import { deltaE2000 } from '../src/colorModels/lab.js';
import type { LabColor } from '../src/types.js';

/**
 * The supplementary test data from Sharma, Wu & Dalal, "The CIEDE2000 Color-Difference Formula:
 * Implementation Notes, Supplementary Test Data and Mathematical Observations" (Color Research &
 * Application, 2005). Reference values: http://www2.ece.rochester.edu/~gsharma/ciede2000/
 *
 * The set is built to exercise the parts of the formula that are easy to get wrong and that no
 * round-trip test can reach: the hue-difference wrap-around (pairs 1-6), the discontinuity at
 * C' = 0 (7-16), and the blue-region rotation term (17-20). The last one is worth spelling out:
 * `R_C` takes the mean of the *rotated* chromas C1'/C2', not the original C1/C2 that feed `G`.
 * Reusing the unadjusted mean understates the rotation for saturated blues and still passes every
 * hand-picked assertion — colord shipped that form for years (omgovich/colord#140).
 *
 * These run against `deltaE2000` rather than `colordx().delta()` on purpose: the public method
 * goes through sRGB, so Lab input is quantized to a displayable color before it reaches the
 * formula, and the result is then divided by 100 and rounded.
 */
const referencePairs: [[number, number, number], [number, number, number], number][] = [
  [[50.0, 2.6772, -79.7751], [50.0, 0.0, -82.7485], 2.0425],
  [[50.0, 3.1571, -77.2803], [50.0, 0.0, -82.7485], 2.8615],
  [[50.0, 2.8361, -74.02], [50.0, 0.0, -82.7485], 3.4412],
  [[50.0, -1.3802, -84.2814], [50.0, 0.0, -82.7485], 1.0],
  [[50.0, -1.1848, -84.8006], [50.0, 0.0, -82.7485], 1.0],
  [[50.0, -0.9009, -85.5211], [50.0, 0.0, -82.7485], 1.0],
  [[50.0, 0.0, 0.0], [50.0, -1.0, 2.0], 2.3669],
  [[50.0, -1.0, 2.0], [50.0, 0.0, 0.0], 2.3669],
  [[50.0, 2.49, -0.001], [50.0, -2.49, 0.0009], 7.1792],
  [[50.0, 2.49, -0.001], [50.0, -2.49, 0.001], 7.1792],
  [[50.0, 2.49, -0.001], [50.0, -2.49, 0.0011], 7.2195],
  [[50.0, 2.49, -0.001], [50.0, -2.49, 0.0012], 7.2195],
  [[50.0, -0.001, 2.49], [50.0, 0.0009, -2.49], 4.8045],
  [[50.0, -0.001, 2.49], [50.0, 0.001, -2.49], 4.8045],
  [[50.0, -0.001, 2.49], [50.0, 0.0011, -2.49], 4.7461],
  [[50.0, 2.5, 0.0], [50.0, 0.0, -2.5], 4.3065],
  [[50.0, 2.5, 0.0], [73.0, 25.0, -18.0], 27.1492],
  [[50.0, 2.5, 0.0], [61.0, -5.0, 29.0], 22.8977],
  [[50.0, 2.5, 0.0], [56.0, -27.0, -3.0], 31.903],
  [[50.0, 2.5, 0.0], [58.0, 24.0, 15.0], 19.4535],
  [[50.0, 2.5, 0.0], [50.0, 3.1736, 0.5854], 1.0],
  [[50.0, 2.5, 0.0], [50.0, 3.2972, 0.0], 1.0],
  [[50.0, 2.5, 0.0], [50.0, 1.8634, 0.5757], 1.0],
  [[50.0, 2.5, 0.0], [50.0, 3.2592, 0.335], 1.0],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
  [[61.2901, 3.7196, -5.3901], [61.4292, 2.248, -4.962], 1.8731],
  [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
  [[36.4612, 47.858, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146],
  [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
  [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
  [[6.7747, -0.2908, -2.4247], [5.8714, -0.0985, -2.2286], 0.6377],
  [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
];

const lab = (l: number, a: number, b: number): LabColor => ({ l, a, b, alpha: 1, colorSpace: 'lab' });

describe('CIEDE2000 — Sharma reference data', () => {
  it.each(referencePairs)('%j vs %j → %f', ([l1, a1, b1], [l2, a2, b2], expected) => {
    expect(deltaE2000(lab(l1, a1, b1), lab(l2, a2, b2))).toBeCloseTo(expected, 4);
  });

  // The formula averages both colors everywhere it combines them, so swapping the arguments has to
  // land on the same number exactly, not just to the reference data's four decimals.
  it('is symmetric', () => {
    for (const [[l1, a1, b1], [l2, a2, b2]] of referencePairs) {
      const forward = deltaE2000(lab(l1, a1, b1), lab(l2, a2, b2));
      const backward = deltaE2000(lab(l2, a2, b2), lab(l1, a1, b1));
      expect(backward).toBeCloseTo(forward, 10);
    }
  });
});

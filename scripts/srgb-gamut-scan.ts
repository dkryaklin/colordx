/**
 * Exhaustive scan: convert every 8-bit sRGB color to OKLCH, then verify
 * inGamutSrgb returns true for the rounded OKLCH values.
 *
 * A failure means EPS in gamut.ts is too tight for that rounding artifact.
 */
import { colordx, inGamutSrgb } from '../src/index.js';

const total = 256 ** 3;
let failures = 0;
let worstLinearDev = 0;
let worstColor = '';

const t0 = performance.now();

for (let r = 0; r < 256; r++) {
  for (let g = 0; g < 256; g++) {
    for (let b = 0; b < 256; b++) {
      const hex = '#' +
        r.toString(16).padStart(2, '0') +
        g.toString(16).padStart(2, '0') +
        b.toString(16).padStart(2, '0');

      const ok = colordx(hex).toOklch();
      const inGamut = inGamutSrgb({ l: ok.l, c: ok.c, h: ok.h, alpha: 1 });

      if (!inGamut) {
        failures++;
        if (failures <= 10) {
          console.log(`FAIL: ${hex} → oklch(${ok.l.toFixed(4)} ${ok.c.toFixed(4)} ${ok.h.toFixed(2)})`);
        }
      }
    }
  }
  if (r % 32 === 0) {
    const pct = ((r + 1) / 256 * 100).toFixed(0);
    process.stdout.write(`\r${pct}% (${r * 256 * 256} colors checked, ${failures} failures so far)`);
  }
}

const elapsed = ((performance.now() - t0) / 1000).toFixed(2);
console.log(`\n\nDone in ${elapsed}s`);
console.log(`Total colors: ${total.toLocaleString()}`);
console.log(`Failures:     ${failures.toLocaleString()}`);
console.log(failures === 0 ? '✓ All sRGB colors pass inGamutSrgb after OKLCH round-trip' : '✗ Some colors failed');

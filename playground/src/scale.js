import { colordx } from './lib.js';
import { fmtValue } from './theme.js';

// Mirrors `colordx scale` from @colordx/cli without anchors: an OKLCH ramp, 50 to 950, one hue.
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// Lightness and chroma of Tailwind v4 blue, one entry per step. The ramp keeps this shape.
const L = [0.97, 0.932, 0.882, 0.809, 0.707, 0.623, 0.546, 0.488, 0.424, 0.379, 0.282];
const C = [0.014, 0.032, 0.062, 0.1, 0.165, 0.214, 0.222, 0.217, 0.199, 0.146, 0.091];

/** Returns [{ step, hex, seed }] with the seed at the step nearest its lightness. */
export function buildScale(seed) {
  const { l, c, h } = colordx(seed).toOklch(6);
  const at = L.reduce((best, v, i) => (Math.abs(v - l) < Math.abs(L[best] - l) ? i : best), 0);
  return STEPS.map((step, i) => {
    const li = i === at ? l : L[i];
    const ci = (C[i] / C[at]) * c;
    return { step, hex: colordx({ l: li, c: ci, h }).mapSrgb().toHex(), seed: i === at };
  });
}

export function scaleToCss(ramp, name, format) {
  return [':root {', ...ramp.map((s) => `  --${name}-${s.step}: ${fmtValue(s.hex, format)};`), '}', ''].join('\n');
}

export function scaleToTailwind(ramp, name, format) {
  return ['@theme {', ...ramp.map((s) => `  --color-${name}-${s.step}: ${fmtValue(s.hex, format)};`), '}', ''].join('\n');
}

export function scaleToJson(ramp, name, format) {
  const obj = { [name]: Object.fromEntries(ramp.map((s) => [s.step, { $type: 'color', $value: fmtValue(s.hex, format) }])) };
  return JSON.stringify(obj, null, 2) + '\n';
}

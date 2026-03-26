import { bench, group, run } from 'mitata';
import { toLinear } from '../src/colorModels/oklab.js';
import * as culori from 'culori';

const _LIN_ARR = Array.from({ length: 256 }, (_, i) => toLinear(i));
const _LIN_F64 = new Float64Array(256);
for (let i = 0; i < 256; i++) _LIN_F64[i] = toLinear(i);

const base = (r: number, g: number, b: number) => {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const lv = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const mv = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const sv = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(lv), m_ = Math.cbrt(mv), s_ = Math.cbrt(sv);
  const oa = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const ob = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const ol = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  return Math.sqrt(oa * oa + ob * ob) + (Math.atan2(ob, oa) * 180) / Math.PI + ol;
};

const lutArr = (r: number, g: number, b: number) => {
  const lr = _LIN_ARR[r | 0]!, lg = _LIN_ARR[g | 0]!, lb = _LIN_ARR[b | 0]!;
  const lv = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const mv = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const sv = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(lv), m_ = Math.cbrt(mv), s_ = Math.cbrt(sv);
  const oa = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const ob = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const ol = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  return Math.sqrt(oa * oa + ob * ob) + (Math.atan2(ob, oa) * 180) / Math.PI + ol;
};

const lutF64 = (r: number, g: number, b: number) => {
  const lr = _LIN_F64[r | 0]!, lg = _LIN_F64[g | 0]!, lb = _LIN_F64[b | 0]!;
  const lv = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const mv = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const sv = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(lv), m_ = Math.cbrt(mv), s_ = Math.cbrt(sv);
  const oa = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const ob = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const ol = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  return Math.sqrt(oa * oa + ob * ob) + (Math.atan2(ob, oa) * 180) / Math.PI + ol;
};

group('rgbToOklch math only (r=52, g=152, b=219)', () => {
  bench('base (toLinear/Math.pow)', () => base(52, 152, 219));
  bench('LUT Array[r|0]', () => lutArr(52, 152, 219));
  bench('LUT Float64Array[r|0]', () => lutF64(52, 152, 219));
  bench('culori (full hex parse)', () => culori.oklch(culori.parse('#3498db')));
});

await run({ format: 'mitata' });

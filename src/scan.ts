import { isWs } from './helpers.js';

// Hand-written single-pass scanners for the hot CSS string formats.
// They replace regex + parseNum + group-indexing with one charCode walk that
// produces final numeric channels directly. Grammar is byte-for-byte the same
// as the regexes they replace (NUM = [+-]?(\d*\.\d+|\d+), plus the `none` keyword).

// Scanner cursor + per-channel flags. Parsing is synchronous and non-reentrant,
// so module-level scratch is safe and avoids an allocation per channel.
let _p = 0;
let _pct = false;
let _none = false;

export const skipWs = (s: string, i: number, n: number): number => {
  while (i < n && isWs(s.charCodeAt(i))) i++;
  return i;
};

/** Scans NUM or the `none` keyword. Returns NaN on failure; sets _p / _none. */
const scanNum = (s: string, i: number, n: number): number => {
  _none = false;
  const c = s.charCodeAt(i);
  if ((c | 32) === 110) {
    if (
      n - i >= 4 &&
      (s.charCodeAt(i + 1) | 32) === 111 &&
      (s.charCodeAt(i + 2) | 32) === 110 &&
      (s.charCodeAt(i + 3) | 32) === 101
    ) {
      _p = i + 4;
      _none = true;
      return 0;
    }
    return NaN;
  }
  const start = i;
  let sign = 1;
  if (c === 43) i++;
  else if (c === 45) {
    sign = -1;
    i++;
  }
  // Accumulate one integer mantissa across the decimal point and divide once.
  // Splitting into integer + fractional parts and adding them rounds twice and
  // drifts from Number() (e.g. 13.64365 -> 13.643650000000001).
  let v = 0,
    digits = 0,
    scale = 1;
  while (i < n) {
    const d = s.charCodeAt(i) - 48;
    if (d < 0 || d > 9) break;
    v = v * 10 + d;
    digits++;
    i++;
  }
  const before = digits;
  if (i < n && s.charCodeAt(i) === 46) {
    i++;
    let after = 0;
    while (i < n) {
      const d = s.charCodeAt(i) - 48;
      if (d < 0 || d > 9) break;
      v = v * 10 + d;
      scale *= 10;
      digits++;
      after++;
      i++;
    }
    if (after === 0) return NaN; // "5." is not a valid NUM
  } else if (before === 0) return NaN;
  _p = i;
  // Beyond 2^53 the integer mantissa is no longer exact; defer to Number().
  if (digits > 15) return Number(s.slice(start, i));
  return sign * (v / scale);
};

/** NUM/none followed by an optional `%`. Sets _p / _pct / _none. */
const scanChannel = (s: string, i: number, n: number): number => {
  const v = scanNum(s, i, n);
  if (v !== v) return NaN;
  i = _p;
  _pct = false;
  if (i < n && s.charCodeAt(i) === 37) {
    _pct = true;
    i++;
  }
  _p = i;
  return v;
};

export const scanPos = (): number => _p;
export const scanPct = (): boolean => _pct;
export const scanNone = (): boolean => _none;
export { scanChannel };

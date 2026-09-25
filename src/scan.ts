import { ANGLE_UNITS, isWs } from './helpers.js';

let _p = 0;
let _pct = false;
let _none = false;

export const skipWs = (s: string, i: number, n: number): number => {
  while (i < n && isWs(s.charCodeAt(i))) i++;
  return i;
};

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
    if (after === 0) return NaN;
  } else if (before === 0) return NaN;
  if (i < n && (s.charCodeAt(i) | 32) === 101) {
    let j = i + 1;
    if (j < n && (s.charCodeAt(j) === 43 || s.charCodeAt(j) === 45)) j++;
    const expStart = j;
    while (j < n) {
      const d = s.charCodeAt(j) - 48;
      if (d < 0 || d > 9) break;
      j++;
    }
    if (j > expStart) {
      _p = j;
      return Number(s.slice(start, j));
    }
  }
  _p = i;
  if (digits > 15) return Number(s.slice(start, i));
  return sign * (v / scale);
};

const scanChannel = (s: string, i: number, n: number): number => {
  const v = scanNum(s, i, n);
  if (v !== v) return NaN;
  i = _p;
  _pct = false;
  if (i < n && s.charCodeAt(i) === 37) {
    if (_none) return NaN;
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

export const SC = [0, 0, 0, 1, 1];
let _pctMask = 0;
export const scanPctMask = (): number => _pctMask;

export const scanFunc = (s: string, name: string, hueAt: number, nch = 3): boolean => {
  const n = s.length;
  let i = skipWs(s, 0, n);
  for (let j = 0; j < name.length; j++) {
    const p = name.charCodeAt(j);
    const c = s.charCodeAt(i);
    if (p === 40) {
      if (c !== 40) return false;
      i = skipWs(s, i + 1, n);
    } else if (p === 32) {
      const k = skipWs(s, i, n);
      if (k === i) return false;
      i = k;
    } else if (c === p || (p >= 97 && (c | 32) === p)) i++;
    else return false;
  }
  _pctMask = 0;
  for (let c = 0; c < nch; c++) {
    if (c > 0) {
      const j = skipWs(s, i, n);
      if (j === i) return false;
      i = j;
    }
    let v = scanChannel(s, i, n);
    if (v !== v) return false;
    i = _p;
    if (_pct) {
      if (c === hueAt) return false;
      _pctMask |= 1 << c;
    } else if (c === hueAt) {
      let u = i;
      while (u < n && (s.charCodeAt(u) | 32) >= 97 && (s.charCodeAt(u) | 32) <= 122) u++;
      if (u > i) {
        if (_none) return false;
        const f = ANGLE_UNITS[s.slice(i, u).toLowerCase()];
        if (typeof f !== 'number') return false;
        v *= f;
        i = u;
      }
    }
    SC[c] = v;
  }
  let j = skipWs(s, i, n);
  SC[nch] = 1;
  if (s.charCodeAt(j) === 47) {
    j = skipWs(s, j + 1, n);
    const a = scanChannel(s, j, n);
    if (a !== a) return false;
    SC[nch] = _pct ? a / 100 : a;
    j = skipWs(s, _p, n);
  }
  return s.charCodeAt(j) === 41 && skipWs(s, j + 1, n) === n;
};

export const scanColorRgb = (s: unknown, prefix: string): boolean => {
  if (typeof s !== 'string' || !scanFunc(s, prefix, -1)) return false;
  for (let c = 0; c < 3; c++) if (_pctMask & (1 << c)) SC[c]! /= 100;
  const a = SC[3]!;
  SC[3] = a > 0 ? (a < 1 ? a : 1) : 0;
  return true;
};

export const scanHsx = (str: string, c3: number): boolean => {
  const n = str.length;
  let i = skipWs(str, 0, n);

  if ((str.charCodeAt(i) | 32) !== 104) return false;
  if ((str.charCodeAt(i + 1) | 32) !== 115) return false;
  if ((str.charCodeAt(i + 2) | 32) !== c3) return false;
  i += 3;
  if ((str.charCodeAt(i) | 32) === 97) i++;
  if (str.charCodeAt(i) !== 40) return false;
  i = skipWs(str, i + 1, n);

  let h = scanChannel(str, i, n);
  if (h !== h || _pct) return false;
  const hNone = _none;
  i = _p;
  let u = i;
  while (u < n && (str.charCodeAt(u) | 32) >= 97 && (str.charCodeAt(u) | 32) <= 122) u++;
  if (u > i) {
    if (hNone) return false;
    const factor = ANGLE_UNITS[str.slice(i, u).toLowerCase()];
    if (typeof factor !== 'number') return false;
    h *= factor;
    i = u;
  }

  let j = skipWs(str, i, n);
  const comma = str.charCodeAt(j) === 44;
  if (comma) {
    if (hNone) return false;
    j = skipWs(str, j + 1, n);
  } else if (j === i) return false;

  const s = scanChannel(str, j, n);
  if (s !== s || (comma && (!_pct || _none))) return false;
  j = _p;

  let k = skipWs(str, j, n);
  if (comma) {
    if (str.charCodeAt(k) !== 44) return false;
    k = skipWs(str, k + 1, n);
  } else if (k === j) return false;

  const l = scanChannel(str, k, n);
  if (l !== l || (comma && (!_pct || _none))) return false;
  k = _p;

  let m = skipWs(str, k, n);
  let alpha = 1;
  if (str.charCodeAt(m) === (comma ? 44 : 47)) {
    m = skipWs(str, m + 1, n);
    const a = scanChannel(str, m, n);
    if (a !== a || (comma && _none)) return false;
    alpha = _pct ? a / 100 : a;
    m = skipWs(str, _p, n);
  }
  if (str.charCodeAt(m) !== 41) return false;
  if (skipWs(str, m + 1, n) !== n) return false;

  SC[0] = h;
  SC[1] = s;
  SC[2] = l;
  SC[3] = alpha;
  return true;
};

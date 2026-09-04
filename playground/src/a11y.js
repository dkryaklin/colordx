import { colordx } from './lib.js';

// Same numbers as @colordx/cli thresholds.json (WCAG 2.2, APCA 0.0.98G-4g).
export const THRESHOLDS = {
  wcag: { body: { AA: 4.5, AAA: 7 }, large: { AA: 3, AAA: 4.5 }, ui: { AA: 3, AAA: 3 } },
  apca: { body: { AA: 75, AAA: 90 }, large: { AA: 60, AAA: 75 }, ui: { AA: 45, AAA: 60 } },
  cvdDistinct: 15,
};

export const USES = ['body', 'large', 'ui'];
export const LEVELS = ['AA', 'AAA'];
export const CVD_TYPES = ['protanopia', 'deuteranopia', 'tritanopia'];

export const gates = (use, level) => ({ wcag: THRESHOLDS.wcag[use][level], apca: THRESHOLDS.apca[use][level] });

/** Cut toward zero so a shown number at or past the gate always means a pass. */
export const cut = (n, d = 2) => Math.trunc(Math.abs(n) * 10 ** d + 1e-6) / 10 ** d;

/** One pair: fg on bg. Returns ratios, both gate results, and pass / warn / fail. */
export function check(fg, bg, use = 'body', level = 'AA') {
  const a = colordx(fg);
  const b = colordx(bg);
  if (!a.isValid() || !b.isValid()) return null;
  const g = gates(use, level);
  const ratio = a.contrast(b, 4);
  const lc = Math.abs(a.apcaContrast(b, { precision: 2 }));
  const wcag = ratio >= g.wcag;
  const apca = lc >= g.apca;
  return { ratio, lc, min: g, wcag, apca, result: wcag ? (apca ? 'pass' : 'warn') : 'fail' };
}

/** The fg moved until it passes both gates. Keeps hue. Null when nothing with that hue passes. */
export function fix(fg, bg, use = 'body', level = 'AA') {
  const g = gates(use, level);
  const r = colordx(fg).fixContrast(bg, { wcag: g.wcag, apca: g.apca });
  return r ? r.toHex() : null;
}

/** The bg moved in lightness until the fg passes both gates on it. Keeps hue. Null when nothing passes. */
export function fixBg(fg, bg, use = 'body', level = 'AA') {
  const g = gates(use, level);
  const base = colordx(bg);
  if (!base.isValid() || !colordx(fg).isValid()) return null;
  const { l, c, h } = base.toOklch(6);
  const at = (li) => colordx({ l: li, c, h }).mapSrgb().toHex();
  const passes = (hexBg) => {
    const r = check(fg, hexBg, use, level);
    return r !== null && r.result === 'pass';
  };
  if (passes(base.toHex())) return base.toHex();
  const search = (extreme) => {
    if (!passes(at(extreme))) return null;
    let lo = l;
    let hi = extreme;
    let best = at(extreme);
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (passes(at(mid))) {
        hi = mid;
        best = at(mid);
      } else lo = mid;
    }
    return best;
  };
  const fgDark = colordx(fg).luminance() <= base.luminance();
  return search(fgDark ? 1 : 0) ?? search(fgDark ? 0 : 1);
}

/** CVD types under which two distinct colors become the same. */
export function collapses(a, b) {
  const x = colordx(a);
  const y = colordx(b);
  if (x.delta(y, 6) * 100 < THRESHOLDS.cvdDistinct) return [];
  return CVD_TYPES.filter((t) => x.simulate(t).delta(y.simulate(t), 6) * 100 < THRESHOLDS.cvdDistinct);
}

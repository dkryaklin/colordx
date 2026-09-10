import { useMemo } from 'react';
import { persistentAtom } from '@nanostores/persistent';
import { useStore } from '@nanostores/react';
import { colordx } from './lib.js';

const DEFAULT = { l: 0.7, c: 0.1, h: 220, alpha: 1 };

const valid = (v) => !!v && [v.l, v.c, v.h, v.alpha].every(Number.isFinite);

/**
 * The active color, shared across pages. Astro serves each page as its own
 * document, so this lives outside React and rehydrates from localStorage.
 */
export const $color = persistentAtom('colordx:color', DEFAULT, {
  encode: JSON.stringify,
  decode: (raw) => {
    try {
      const v = JSON.parse(raw);
      return valid(v) ? v : DEFAULT;
    } catch {
      return DEFAULT;
    }
  },
});

/** Accepts a value or an updater, like React's setState. */
export function setS(next) {
  $color.set(typeof next === 'function' ? next($color.get()) : next);
}

/** Set the active color from any parseable input. Keeps alpha unless the input has one. */
export function setColor(input, keepAlpha = false) {
  const p = colordx(input);
  if (!p.isValid()) return false;
  const ok = p.toOklch();
  setS((prev) => ({ l: ok.l, c: ok.c, h: ok.h, alpha: keepAlpha ? prev.alpha : ok.alpha }));
  return true;
}

export function useColor() {
  const S = useStore($color);
  return useMemo(() => {
    const color = colordx({ l: S.l, c: S.c, h: S.h, alpha: S.alpha });
    return { S, setS, setColor, color, hex: color.mapSrgb().alpha(1).toHex() };
  }, [S]);
}

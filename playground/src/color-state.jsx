import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { colordx } from './lib.js';

const KEY = 'colordx:color';
const DEFAULT = { l: 0.7, c: 0.1, h: 220, alpha: 1 };

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && [v.l, v.c, v.h, v.alpha].every(Number.isFinite)) return v;
  } catch {
    /* fall through */
  }
  return DEFAULT;
}

const Ctx = createContext(null);

export function ColorProvider({ children }) {
  const [S, setS] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch {
      /* private mode */
    }
  }, [S]);

  /** Set the active color from any parseable input. Keeps alpha unless the input has one. */
  const setColor = useCallback((input, keepAlpha = false) => {
    const p = colordx(input);
    if (!p.isValid()) return false;
    const ok = p.toOklch();
    setS((prev) => ({ l: ok.l, c: ok.c, h: ok.h, alpha: keepAlpha ? prev.alpha : ok.alpha }));
    return true;
  }, []);

  const value = useMemo(() => {
    const color = colordx({ l: S.l, c: S.c, h: S.h, alpha: S.alpha });
    return { S, setS, setColor, color, hex: color.mapSrgb().alpha(1).toHex() };
  }, [S, setColor]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useColor = () => useContext(Ctx);

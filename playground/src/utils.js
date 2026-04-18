export const f = (n, d = 4) => parseFloat(n.toFixed(d)).toString();

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function randomOklch() {
  const h = Math.random() * 360;
  const c = 0.08 + Math.random() * 0.22;
  const l = 0.38 + Math.random() * 0.42;
  return {
    l: parseFloat(l.toFixed(4)),
    c: parseFloat(c.toFixed(4)),
    h: parseFloat(h.toFixed(2)),
    alpha: 1,
  };
}

export function shortestArc(from, to) {
  const delta = ((to - from) % 360 + 540) % 360 - 180;
  return from + delta;
}

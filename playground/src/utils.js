export const f = (n, d = 4) => parseFloat(n.toFixed(d)).toString();

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** { l, c, h, alpha } → 'oklch(l c h / a)' */
export function oklchCss(S, withAlpha = true) {
  const a = withAlpha && S.alpha < 1 ? ` / ${f(S.alpha, 2)}` : '';
  return `oklch(${f(S.l)} ${f(S.c)} ${f(S.h, 2)}${a})`;
}

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

export function copyText(text) {
  return navigator.clipboard?.writeText(text) ?? Promise.resolve();
}

export function downloadText(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

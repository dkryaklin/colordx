import { Colordx, colordx, extend, inGamutSrgb, oklchToLinear } from '/index.mjs';
import a11y from '/plugins/a11y.mjs';
import harmoniesPlugin from '/plugins/harmonies.mjs';
import hsvPlugin from '/plugins/hsv.mjs';
import hwbPlugin from '/plugins/hwb.mjs';
import labPlugin from '/plugins/lab.mjs';
import lchPlugin from '/plugins/lch.mjs';
import mixPlugin from '/plugins/mix.mjs';
import p3Plugin, { oklchToP3Channels } from '/plugins/p3.mjs';

extend([a11y, harmoniesPlugin, hsvPlugin, hwbPlugin, labPlugin, lchPlugin, mixPlugin, p3Plugin]);

// Always stored as OKLCH
let S = { l: 0.6279, c: 0.2577, h: 29.23, alpha: 1 };
let mode = 'oklch';

const f = (n, d = 4) => parseFloat(n.toFixed(d)).toString();
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function cx() {
  return colordx({ l: S.l, c: S.c, h: S.h, a: S.alpha });
}
function oklab() {
  const o = cx().toOklab();
  return { l: o.l, a: o.a, b: o.b, alpha: o.alpha };
}

function setOklch(patch) {
  S = { ...S, ...patch };
}
function setOklab({ l, a: oa, b: ob, alpha }) {
  const c = Math.sqrt(oa * oa + ob * ob);
  const h = ((((Math.atan2(ob, oa) * 180) / Math.PI) % 360) + 360) % 360;
  S = { l, c, h, alpha };
}

const CFGS = {
  oklch: [
    {
      key: 'l',
      label: 'Lightness',
      badge: 'L',
      min: 0,
      max: 1,
      step: 0.001,
      get: () => S.l,
      set: (v) => setOklch({ l: v }),
      grad: () =>
        `linear-gradient(to right,oklch(0 ${f(S.c)} ${f(S.h, 1)}),oklch(.5 ${f(S.c)} ${f(S.h, 1)}),oklch(1 ${f(S.c)} ${f(S.h, 1)}))`,
    },
    {
      key: 'c',
      label: 'Chroma',
      badge: 'C',
      min: 0,
      max: 0.4,
      step: 0.001,
      get: () => S.c,
      set: (v) => setOklch({ c: v }),
      grad: () => `linear-gradient(to right,oklch(${f(S.l)} 0 ${f(S.h, 1)}),oklch(${f(S.l)} .4 ${f(S.h, 1)}))`,
    },
    {
      key: 'h',
      label: 'Hue',
      badge: 'H',
      min: 0,
      max: 360,
      step: 0.1,
      get: () => S.h,
      set: (v) => setOklch({ h: v }),
      grad: () =>
        `linear-gradient(to right,${[0, 45, 90, 135, 180, 225, 270, 315, 360].map((d) => `oklch(${f(S.l)} ${f(S.c)} ${d})`).join(',')})`,
    },
    {
      key: 'alpha',
      label: 'Alpha',
      badge: 'A',
      min: 0,
      max: 1,
      step: 0.01,
      get: () => S.alpha,
      set: (v) => setOklch({ alpha: v }),
      grad: null,
    },
  ],
  oklab: [
    {
      key: 'l',
      label: 'Lightness',
      badge: 'L',
      min: 0,
      max: 1,
      step: 0.001,
      get: () => oklab().l,
      set: (v) => setOklab({ ...oklab(), l: v }),
      grad: () => {
        const o = oklab();
        return `linear-gradient(to right,oklab(0 ${f(o.a)} ${f(o.b)}),oklab(1 ${f(o.a)} ${f(o.b)}))`;
      },
    },
    {
      key: 'oa',
      label: 'a axis',
      badge: 'a',
      min: -0.4,
      max: 0.4,
      step: 0.001,
      get: () => oklab().a,
      set: (v) => setOklab({ ...oklab(), a: v }),
      grad: () => {
        const o = oklab();
        return `linear-gradient(to right,oklab(${f(o.l)} -.4 ${f(o.b)}),oklab(${f(o.l)} 0 ${f(o.b)}),oklab(${f(o.l)} .4 ${f(o.b)}))`;
      },
    },
    {
      key: 'ob',
      label: 'b axis',
      badge: 'b',
      min: -0.4,
      max: 0.4,
      step: 0.001,
      get: () => oklab().b,
      set: (v) => setOklab({ ...oklab(), b: v }),
      grad: () => {
        const o = oklab();
        return `linear-gradient(to right,oklab(${f(o.l)} ${f(o.a)} -.4),oklab(${f(o.l)} ${f(o.a)} 0),oklab(${f(o.l)} ${f(o.a)} .4))`;
      },
    },
    {
      key: 'alpha',
      label: 'Alpha',
      badge: 'A',
      min: 0,
      max: 1,
      step: 0.01,
      get: () => S.alpha,
      set: (v) => setOklch({ alpha: v }),
      grad: null,
    },
  ],
};

function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  CFGS[mode].forEach((cfg) => {
    const isAlpha = cfg.key === 'alpha';
    const el = document.createElement('div');
    el.className = 'card sc';
    el.innerHTML = `
      <div class="sc-head">
        <span class="sc-title">${cfg.label}</span>
        <div class="sc-right">
          <span class="badge">${cfg.badge}</span>
          <input type="number" class="sc-num" id="num-${cfg.key}"
            min="${cfg.min}" max="${cfg.max}" step="${cfg.step}">
        </div>
      </div>
      <div class="sw${isAlpha ? ' checker' : ''}" id="sw-${cfg.key}">
        ${isAlpha ? '<div class="alpha-overlay" id="aov"></div>' : `<div class="sw-bg" id="bg-${cfg.key}"></div>`}
        <input type="range" class="rng" id="rng-${cfg.key}"
          min="${cfg.min}" max="${cfg.max}" step="${cfg.step}">
      </div>`;
    grid.appendChild(el);

    const rng = el.querySelector(`#rng-${cfg.key}`);
    const num = el.querySelector(`#num-${cfg.key}`);

    rng.addEventListener('input', () => {
      cfg.set(parseFloat(rng.value));
      updateGrid();
      updateLeft();
    });
    num.addEventListener('change', () => {
      const v = clamp(parseFloat(num.value) || 0, cfg.min, cfg.max);
      cfg.set(v);
      updateGrid();
      updateLeft();
    });
  });
}

function updateGrid() {
  const rgb = cx().toRgb();
  CFGS[mode].forEach((cfg) => {
    const val = cfg.get();
    const rng = document.getElementById(`rng-${cfg.key}`);
    const num = document.getElementById(`num-${cfg.key}`);
    if (rng) rng.value = val;
    if (num) num.value = f(val, 4);

    if (cfg.key === 'alpha') {
      const ov = document.getElementById('aov');
      if (ov)
        ov.style.background = `linear-gradient(to right,rgba(${rgb.r},${rgb.g},${rgb.b},0),rgba(${rgb.r},${rgb.g},${rgb.b},1))`;
    } else {
      const bg = document.getElementById(`bg-${cfg.key}`);
      if (bg && cfg.grad) bg.style.background = cfg.grad();
    }
  });
}

function updateLeft({ skipBg = false } = {}) {
  const c = cx();
  const rgb = c.toRgb();
  const ob = oklab();

  document.getElementById('swatch').style.backgroundColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${S.alpha})`;

  const prim =
    mode === 'oklch'
      ? `oklch(${f(S.l)} ${f(S.c)} ${f(S.h, 2)}${S.alpha < 1 ? ` / ${f(S.alpha, 2)}` : ''})`
      : `oklab(${f(ob.l)} ${f(ob.a)} ${f(ob.b)}${ob.alpha < 1 ? ` / ${f(ob.alpha, 2)}` : ''})`;
  document.getElementById('prim-val').value = prim;
  document.getElementById('prim-badge').textContent = mode === 'oklch' ? 'OKLCH' : 'OKLab';

  const inGamut = inGamutSrgb({ l: S.l, c: S.c, h: S.h, a: S.alpha });
  document.getElementById('gamut-dot').className = `gamut-dot ${inGamut ? 'ok' : 'out'}`;
  const gamutLbl = document.getElementById('gamut-lbl');
  gamutLbl.textContent = inGamut ? 'In sRGB gamut' : 'Out of sRGB gamut';
  gamutLbl.className = `gamut-lbl${inGamut ? '' : ' out'}`;
  document.getElementById('gamut-map').style.display = inGamut ? 'none' : '';

  // Normalize through hex so sRGB-based formats use exact integer channels,
  // avoiding precision artifacts (e.g. 99.99%) from the rounded OKLCH storage.
  const cs = colordx(c.toHex());

  // Raw (unclamped) channel values direct from OKLCH — may exceed [0, 1] for out-of-gamut colors
  const [linR, linG, linB] = oklchToLinear(S.l, S.c, S.h);
  const [p3R, p3G, p3B] = oklchToP3Channels(S.l, S.c, S.h);
  const toHex2 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');

  const rows = [
    { lbl: 'OKLCH', val: `oklch(${f(S.l)} ${f(S.c)} ${f(S.h, 2)})` },
    { lbl: 'OKLCH bare', val: `${f(S.l, 2)}, ${f(S.c, 2)}, ${f(S.h, 2)}` },
    { lbl: 'OKLab', val: `oklab(${f(ob.l)} ${f(ob.a)} ${f(ob.b)})` },
    { lbl: 'HEX', val: cs.toHex() },
    { lbl: 'RGB', val: cs.toRgbString() },
    { lbl: 'HSL', val: cs.toHslString() },
    { lbl: 'HSV', val: cs.toHsvString() },
    { lbl: 'HWB', val: cs.toHwbString() },
    { lbl: 'LCH', val: cs.toLchString() },
    { lbl: 'Lab', val: cs.toLabString() },
    { lbl: 'P3', val: `color(display-p3 ${f(p3R, 4)} ${f(p3G, 4)} ${f(p3B, 4)})` },
    { lbl: 'Linear RGB', val: `color(srgb-linear ${f(linR, 5)} ${f(linG, 5)} ${f(linB, 5)})` },
    { lbl: 'Figma P3', val: `#${toHex2(p3R)}${toHex2(p3G)}${toHex2(p3B)}${toHex2(S.alpha)}` },
  ];

  document.getElementById('outputs').innerHTML = rows
    .map(
      (r) => `
    <div class="out-row" data-v="${r.val}">
      <span class="out-lbl">${r.lbl}</span>
      <span class="out-val">${r.val}</span>
      <button class="out-cp">⎘</button>
    </div>`
    )
    .join('');

  document.querySelectorAll('.out-row').forEach((row) => {
    row.addEventListener('click', () => copy(row.dataset.v, row.querySelector('.out-cp')));
  });

  updateManip();
  updateHarmonies();
  if (!skipBg) updateBodyBackground(false);
}

// Accumulated hue values — never reset to 0 to avoid wrap-around sparks
let bgH1 = S.h;
let bgH2 = (S.h + 150) % 360;
let bgH3 = (S.h + 210) % 360;

function shortestArc(from, to) {
  const delta = ((to - from) % 360 + 540) % 360 - 180;
  return from + delta;
}

function updateBodyBackground(animate = false) {
  bgH1 = shortestArc(bgH1, S.h);
  bgH2 = shortestArc(bgH2, (S.h + 150) % 360);
  bgH3 = shortestArc(bgH3, (S.h + 210) % 360);

  if (animate) document.body.classList.add('bg-anim');
  document.body.style.setProperty('--gh1', f(bgH1, 1));
  document.body.style.setProperty('--gh2', f(bgH2, 1));
  document.body.style.setProperty('--gh3', f(bgH3, 1));
  if (animate) {
    const onEnd = () => { document.body.classList.remove('bg-anim'); document.body.removeEventListener('transitionend', onEnd); };
    document.body.addEventListener('transitionend', onEnd);
  }
}

function randomOklch() {
  const h = Math.random() * 360;
  const c = 0.08 + Math.random() * 0.22;
  const l = 0.38 + Math.random() * 0.42;
  return { l: parseFloat(l.toFixed(4)), c: parseFloat(c.toFixed(4)), h: parseFloat(h.toFixed(2)), alpha: 1 };
}

function updateA11yFromColor() {
  const bgHex = cx().toHex();
  const darkContrast = colordx('#1c1a16').contrast(bgHex);
  const lightContrast = colordx('#f5f2ec').contrast(bgHex);
  const txtHex = darkContrast >= lightContrast ? '#1c1a16' : '#f5f2ec';
  document.getElementById('a11y-txt-hex').value = txtHex;
  document.getElementById('a11y-bg-hex').value = bgHex;
  updateA11y();
}

function render() {
  buildGrid();
  updateGrid();
  updateLeft();
}

// ── Manipulation section ──

function setColorFromHex(hex) {
  const p = colordx(hex);
  if (!p.isValid()) return;
  const ok = p.toOklch();
  S = { l: ok.l, c: ok.c, h: ok.h, alpha: S.alpha };
  updateGrid();
  updateLeft();
}

function makeSwatches(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = items
    .map(
      (item) => `
    <div class="ms${item.current ? ' ms-current' : ''}" style="background:${item.bg}" data-hex="${item.hex}" title="${item.label}: ${item.hex}">
      <span class="ms-lbl">${item.label}</span>
    </div>`
    )
    .join('');
  el.querySelectorAll('.ms:not(.ms-current)').forEach((s) => {
    s.addEventListener('click', () => setColorFromHex(s.dataset.hex));
  });
}

function swatchItem(color, label, isCurrent = false) {
  const rgb = color.toRgb();
  return { label, current: isCurrent, bg: `rgb(${rgb.r},${rgb.g},${rgb.b})`, hex: color.toHex() };
}

function updateManip() {
  const c = cx();
  makeSwatches('ms-light', [
    swatchItem(c.darken(0.2), '−20%'),
    swatchItem(c.darken(0.1), '−10%'),
    swatchItem(c, 'base', true),
    swatchItem(c.lighten(0.1), '+10%'),
    swatchItem(c.lighten(0.2), '+20%'),
  ]);
  makeSwatches('ms-chroma', [
    swatchItem(c.desaturate(0.2), '−0.2'),
    swatchItem(c.desaturate(0.1), '−0.1'),
    swatchItem(c, 'base', true),
    swatchItem(c.saturate(0.1), '+0.1'),
    swatchItem(c.saturate(0.2), '+0.2'),
  ]);
  makeSwatches('ms-hue', [
    swatchItem(c.rotate(-60), '−60°'),
    swatchItem(c.rotate(-30), '−30°'),
    swatchItem(c, 'base', true),
    swatchItem(c.rotate(30), '+30°'),
    swatchItem(c.rotate(60), '+60°'),
  ]);
  makeSwatches('ms-effects', [
    swatchItem(c.grayscale(), 'grayscale'),
    swatchItem(c.invert(), 'invert'),
    swatchItem(c.mix('#000000', 0.3), '×black'),
    swatchItem(c.mix('#ffffff', 0.3), '×white'),
  ]);
}

// ── Harmonies section ──

let harmMode = 'complementary';

function updateHarmonies() {
  const colors = cx().harmonies(harmMode);
  const el = document.getElementById('harm-swatches');
  if (!el) return;
  el.innerHTML = colors
    .map((h) => {
      const rgb = h.toRgb();
      const hex = h.toHex();
      return `<div class="hs" style="background:rgb(${rgb.r},${rgb.g},${rgb.b})" data-hex="${hex}">
        <span class="hs-hex">${hex}</span>
      </div>`;
    })
    .join('');
  el.querySelectorAll('.hs').forEach((s) => {
    s.addEventListener('click', () => setColorFromHex(s.dataset.hex));
  });
}

document.querySelectorAll('.harm-tab').forEach((t) =>
  t.addEventListener('click', () => {
    harmMode = t.dataset.harm;
    document.querySelectorAll('.harm-tab').forEach((x) => x.classList.toggle('on', x.dataset.harm === harmMode));
    updateHarmonies();
  })
);

function copy(text, btn) {
  navigator.clipboard?.writeText(text);
  if (!btn) return;
  const was = btn.textContent;
  btn.textContent = '✓';
  btn.classList.add('ok');
  setTimeout(() => {
    btn.textContent = was;
    btn.classList.remove('ok');
  }, 1400);
}

document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    mode = t.dataset.mode;
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x.dataset.mode === mode));
    render();
  })
);

document
  .getElementById('prim-copy')
  .addEventListener('click', () =>
    copy(document.getElementById('prim-val').value, document.getElementById('prim-copy'))
  );

let timer;
document.getElementById('any-in').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const v = e.target.value.trim();
    if (!v) {
      e.target.classList.remove('err');
      return;
    }
    const p = colordx(v);
    if (p.isValid()) {
      e.target.classList.remove('err');
      const ok = p.toOklch();
      S = { l: ok.l, c: ok.c, h: ok.h, alpha: ok.a };
      updateGrid();
      updateLeft();
    } else {
      e.target.classList.add('err');
    }
  }, 220);
});

document.getElementById('gamut-map').addEventListener('click', () => {
  const mapped = Colordx.toGamutSrgb({ l: S.l, c: S.c, h: S.h, a: S.alpha });
  const ok = mapped.toOklch();
  S = { l: ok.l, c: ok.c, h: ok.h, alpha: ok.a };
  updateGrid();
  updateLeft();
});

render();

// ── A11y section ──

function updateA11y() {
  const txtHex = document.getElementById('a11y-txt-hex').value.trim();
  const bgHex = document.getElementById('a11y-bg-hex').value.trim();
  const txt = colordx(txtHex);
  const bg = colordx(bgHex);
  if (!txt.isValid() || !bg.isValid()) return;

  const preview = document.getElementById('a11y-preview');
  preview.style.backgroundColor = bg.toHex();
  document.getElementById('a11y-sample').style.color = txt.toHex();
  document.getElementById('a11y-sample-sm').style.color = txt.toHex();
  document.getElementById('a11y-txt-picker').value = txt.toHex();
  document.getElementById('a11y-bg-picker').value = bg.toHex();

  const wcag = txt.contrast(bgHex);
  document.getElementById('wcag-val').textContent = wcag.toFixed(2) + ' : 1';

  const apca = txt.apcaContrast(bgHex);
  document.getElementById('apca-val').textContent = 'Lc ' + apca.toFixed(1);

  const wcagBadges = [
    { label: 'AA Normal', pass: txt.isReadable(bgHex) },
    { label: 'AA Large', pass: txt.isReadable(bgHex, { size: 'large' }) },
    { label: 'AAA Normal', pass: txt.isReadable(bgHex, { level: 'AAA' }) },
    { label: 'AAA Large', pass: txt.isReadable(bgHex, { level: 'AAA', size: 'large' }) },
  ];
  document.getElementById('wcag-badges').innerHTML = wcagBadges
    .map((b) => `<span class="a11y-badge ${b.pass ? 'pass' : 'fail'}">${b.label}</span>`)
    .join('');

  const apcaBadges = [
    { label: 'Body text (≥75)', pass: txt.isReadableApca(bgHex) },
    { label: 'Large text (≥60)', pass: txt.isReadableApca(bgHex, { size: 'large' }) },
  ];
  document.getElementById('apca-badges').innerHTML = apcaBadges
    .map((b) => `<span class="a11y-badge ${b.pass ? 'pass' : 'fail'}">${b.label}</span>`)
    .join('');
}

function syncPicker(pickerId, hexId) {
  document.getElementById(pickerId).addEventListener('input', (e) => {
    document.getElementById(hexId).value = e.target.value;
    updateA11y();
  });
  document.getElementById(hexId).addEventListener('input', () => updateA11y());
}

syncPicker('a11y-txt-picker', 'a11y-txt-hex');
syncPicker('a11y-bg-picker', 'a11y-bg-hex');

document.getElementById('a11y-swap').addEventListener('click', () => {
  const txtHex = document.getElementById('a11y-txt-hex');
  const bgHex = document.getElementById('a11y-bg-hex');
  [txtHex.value, bgHex.value] = [bgHex.value, txtHex.value];
  updateA11y();
});

updateA11y();

document.getElementById('random-btn').addEventListener('click', () => {
  S = randomOklch();
  updateGrid();
  updateBodyBackground(true);
  updateLeft({ skipBg: true });
  updateA11yFromColor();
});

// ── Export section ──

globalThis.Colordx = Colordx;
globalThis.colordx = colordx;

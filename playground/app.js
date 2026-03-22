import { colordx, inGamutSrgb, toGamutSrgb } from '/index.mjs';

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

function updateLeft() {
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

  const rows = [
    { lbl: 'OKLCH', val: `oklch(${f(S.l)} ${f(S.c)} ${f(S.h, 2)})` },
    { lbl: 'OKLab', val: `oklab(${f(ob.l)} ${f(ob.a)} ${f(ob.b)})` },
    { lbl: 'HEX', val: c.toHex() },
    { lbl: 'RGB', val: c.toRgbString() },
    { lbl: 'HSL', val: c.toHslString() },
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
}

function render() {
  buildGrid();
  updateGrid();
  updateLeft();
}

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
  const mapped = toGamutSrgb({ l: S.l, c: S.c, h: S.h, a: S.alpha });
  const ok = mapped.toOklch();
  S = { l: ok.l, c: ok.c, h: ok.h, alpha: ok.a };
  updateGrid();
  updateLeft();
});

render();

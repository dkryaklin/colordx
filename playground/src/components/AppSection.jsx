import { useState, useRef, useEffect } from 'react';
import { colordx, Colordx, inGamutSrgb, oklchToLinear, oklchToP3Channels } from '../lib.js';
import { f, clamp } from '../utils.js';

function findGamutBoundariesC(l, h) {
  if (inGamutSrgb({ l, c: 0.4, h, alpha: 1 })) return [];
  if (!inGamutSrgb({ l, c: 0, h, alpha: 1 })) return [0];
  let lo = 0, hi = 0.4;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamutSrgb({ l, c: mid, h, alpha: 1 })) lo = mid; else hi = mid;
  }
  return [(lo + hi) / 2];
}

function findGamutBoundariesAxis(check, min, max, steps = 64) {
  const boundaries = [];
  let prev = check(min);
  for (let i = 1; i <= steps; i++) {
    const v = min + (max - min) * (i / steps);
    const curr = check(v);
    if (curr !== prev) {
      let lo = min + (max - min) * ((i - 1) / steps), hi = v;
      for (let j = 0; j < 18; j++) {
        const mid = (lo + hi) / 2;
        if (check(mid) === prev) lo = mid; else hi = mid;
      }
      boundaries.push((lo + hi) / 2);
      prev = curr;
    }
  }
  return boundaries;
}

const CFGS = [
  {
    key: 'l',
    label: 'Lightness',
    badge: 'L',
    min: 0,
    max: 1,
    step: 0.001,
    get: (S) => S.l,
    set: (v) => ({ l: v }),
    grad: (S) =>
      `linear-gradient(to right,oklch(0 ${f(S.c)} ${f(S.h, 1)}),oklch(.5 ${f(S.c)} ${f(S.h, 1)}),oklch(1 ${f(S.c)} ${f(S.h, 1)}))`,
    getBoundaries: (S) =>
      findGamutBoundariesAxis((l) => inGamutSrgb({ l, c: S.c, h: S.h, alpha: 1 }), 0, 1),
  },
  {
    key: 'c',
    label: 'Chroma',
    badge: 'C',
    min: 0,
    max: 0.4,
    step: 0.001,
    get: (S) => S.c,
    set: (v) => ({ c: v }),
    grad: (S) =>
      `linear-gradient(to right,oklch(${f(S.l)} 0 ${f(S.h, 1)}),oklch(${f(S.l)} .4 ${f(S.h, 1)}))`,
    getBoundaries: (S) => findGamutBoundariesC(S.l, S.h),
  },
  {
    key: 'h',
    label: 'Hue',
    badge: 'H',
    min: 0,
    max: 360,
    step: 0.1,
    get: (S) => S.h,
    set: (v) => ({ h: v }),
    grad: (S) =>
      `linear-gradient(to right,${[0, 45, 90, 135, 180, 225, 270, 315, 360]
        .map((d) => `oklch(${f(S.l)} ${f(S.c)} ${d})`)
        .join(',')})`,
    getBoundaries: (S) =>
      findGamutBoundariesAxis((h) => inGamutSrgb({ l: S.l, c: S.c, h, alpha: 1 }), 0, 360, 72),
  },
  {
    key: 'alpha',
    label: 'Alpha',
    badge: 'A',
    min: 0,
    max: 1,
    step: 0.01,
    get: (S) => S.alpha,
    set: (v) => ({ alpha: v }),
    grad: null,
    getBoundaries: () => [],
  },
];

function CopyButton({ text, className }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      className={`${className}${copied ? ' ok' : ''}`}
      onClick={handleCopy}
      title="Copy"
    >
      {copied ? '✓' : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  );
}

function OutRow({ label, value }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="out-row" onClick={handleCopy}>
      <span className="out-lbl">{label}</span>
      <span className="out-val">{value}</span>
      <button className={`out-cp${copied ? ' ok' : ''}`}>
        {copied ? '✓' : '⎘'}
      </button>
    </div>
  );
}

function SliderCard({ cfg, S, setS, inGamut }) {
  const isAlpha = cfg.key === 'alpha';
  const val = cfg.get(S);

  function handleRange(e) {
    setS((prev) => ({ ...prev, ...cfg.set(parseFloat(e.target.value)) }));
  }

  function handleNum(e) {
    const v = clamp(parseFloat(e.target.value) || 0, cfg.min, cfg.max);
    setS((prev) => ({ ...prev, ...cfg.set(v) }));
  }

  const alphaOverlayStyle = isAlpha
    ? {
        background: `linear-gradient(to right,oklch(${f(S.l)} ${f(S.c)} ${f(S.h, 1)} / 0),oklch(${f(S.l)} ${f(S.c)} ${f(S.h, 1)} / 1))`,
      }
    : undefined;

  const bgStyle =
    !isAlpha && cfg.grad ? { background: cfg.grad(S) } : undefined;

  const boundaries = cfg.getBoundaries(S);
  const tickStyles = boundaries.map((v) => {
    const pct = ((v - cfg.min) / (cfg.max - cfg.min)) * 100;
    const color =
      cfg.key === 'l' ? colordx({ l: v, c: S.c, h: S.h, alpha: 1 }) :
      cfg.key === 'c' ? colordx({ l: S.l, c: v, h: S.h, alpha: 1 }) :
      colordx({ l: S.l, c: S.c, h: v, alpha: 1 });
    const bg = color.isDark()
      ? 'rgba(255,255,255,0.45)'
      : 'rgba(0,0,0,0.22)';
    return { left: `${pct}%`, background: bg };
  });

  return (
    <div className="card sc">
      <div className="sc-head">
        <span className="sc-title">{cfg.label}</span>
        <div className="sc-right">
          <span className="badge">{cfg.badge}</span>
          <input
            type="number"
            className="sc-num"
            min={cfg.min}
            max={cfg.max}
            step={cfg.step}
            value={f(val, 4)}
            onChange={handleNum}
          />
        </div>
      </div>
      <div className={`sw${isAlpha ? ' checker' : ''}${!inGamut && !isAlpha ? ' sw--out' : ''}`}>
        {isAlpha ? (
          <div className="alpha-overlay" style={alphaOverlayStyle} />
        ) : (
          <div className="sw-bg" style={bgStyle} />
        )}
        {tickStyles.map((style, i) => (
          <div key={i} className="gamut-tick" style={style} />
        ))}
        <input
          type="range"
          className="rng"
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          value={val}
          onChange={handleRange}
        />
      </div>
    </div>
  );
}

export default function AppSection({ S, setS, onRandom }) {
  const [inputVal, setInputVal] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [inputError, setInputError] = useState(false);
  const timerRef = useRef(null);

  const oklchString = `oklch(${f(S.l)} ${f(S.c)} ${f(S.h, 2)}${S.alpha < 1 ? ` / ${f(S.alpha, 2)}` : ''})`;

  useEffect(() => {
    if (!inputFocused) {
      setInputVal(oklchString);
      setInputError(false);
    }
  }, [S, inputFocused, oklchString]);

  function handleFocus() {
    setInputFocused(true);
  }

  function handleBlur() {
    setInputFocused(false);
    setInputError(false);
    setInputVal(oklchString);
  }

  function handleInputChange(e) {
    const v = e.target.value;
    setInputVal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!v.trim()) {
        setInputError(false);
        return;
      }
      const p = colordx(v.trim());
      if (p.isValid()) {
        setInputError(false);
        const ok = p.toOklch();
        setS({ l: ok.l, c: ok.c, h: ok.h, alpha: ok.alpha });
      } else {
        setInputError(true);
      }
    }, 220);
  }

  function handleGamutMap() {
    const mapped = Colordx.toGamutSrgb({ l: S.l, c: S.c, h: S.h, alpha: S.alpha });
    const ok = mapped.toOklch();
    setS({ l: ok.l, c: ok.c, h: ok.h, alpha: ok.alpha });
  }

  const c = colordx({ l: S.l, c: S.c, h: S.h, alpha: S.alpha });
  const rgb = c.toRgb();
  const ob = c.toOklab();
  const cs = colordx(c.toHex());
  const [linR, linG, linB] = oklchToLinear(S.l, S.c, S.h);
  const [p3R, p3G, p3B] = oklchToP3Channels(S.l, S.c, S.h);
  const toHex2 = (v) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');

  const hexAlpha = S.alpha < 1 ? Math.round(S.alpha * 255).toString(16).padStart(2, '0') : '';
  const rgbVal =
    S.alpha < 1
      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${f(S.alpha, 2)})`
      : cs.toRgbString();

  const inGamut = inGamutSrgb({ l: S.l, c: S.c, h: S.h, alpha: S.alpha });

  const outputRows = [
    { lbl: 'OKLab', val: `oklab(${f(ob.l)} ${f(ob.a)} ${f(ob.b)}${ob.alpha < 1 ? ` / ${f(ob.alpha, 2)}` : ''})` },
    { lbl: 'HEX', val: cs.toHex() + hexAlpha },
    { lbl: 'RGB', val: rgbVal },
    { lbl: 'HSL', val: cs.toHslString() },
    { lbl: 'HSV', val: cs.toHsvString() },
    { lbl: 'HWB', val: cs.toHwbString() },
    { lbl: 'LCH', val: cs.toLchString() },
    { lbl: 'Lab', val: cs.toLabString() },
    { lbl: 'P3', val: `color(display-p3 ${f(p3R, 4)} ${f(p3G, 4)} ${f(p3B, 4)})` },
    { lbl: 'Linear RGB', val: `color(srgb-linear ${f(linR, 5)} ${f(linG, 5)} ${f(linB, 5)})` },
    { lbl: 'Figma P3', val: `#${toHex2(p3R)}${toHex2(p3G)}${toHex2(p3B)}${toHex2(S.alpha)}` },
  ];

  return (
    <section className="app-section">
      <div className="app-wrap">
        <div className="card left">
          <div
            id="swatch"
            style={{
              backgroundColor: `oklch(${f(S.l)} ${f(S.c)} ${f(S.h, 2)} / ${S.alpha})`,
            }}
          />
          <div className="left-body">
            <button className="random-btn" onClick={onRandom}>↺ Random color</button>

            <div className="row">
              <input
                className={`txt${inputError ? ' err' : ''}`}
                id="color-input"
                placeholder="Paste any color…"
                spellCheck="false"
                autoComplete="off"
                value={inputVal}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={handleInputChange}
              />
              <CopyButton text={oklchString} className="ibtn" />
            </div>
            {inputError && <p className="color-error">Not a valid color</p>}

            <div className="gamut-row">
              <span className={`gamut-dot ${inGamut ? 'ok' : 'out'}`} />
              <span className={`gamut-lbl${inGamut ? '' : ' out'}`}>
                {inGamut ? 'In sRGB gamut' : 'Out of sRGB · values clipped to nearest'}
              </span>
              {!inGamut && (
                <button className="gamut-btn" style={{ display: 'inline-flex' }} onClick={handleGamutMap}>
                  Map to sRGB →
                </button>
              )}
            </div>

            <hr className="div" />
            <div id="outputs">
              {outputRows.map((r) => (
                <OutRow key={r.lbl} label={r.lbl} value={r.val} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid">
          {CFGS.map((cfg) => (
            <SliderCard key={cfg.key} cfg={cfg} S={S} setS={setS} inGamut={inGamut} />
          ))}
        </div>
      </div>
    </section>
  );
}

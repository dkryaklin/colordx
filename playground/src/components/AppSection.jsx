import { useState, useRef, useEffect } from 'react';
import { Shuffle, Check, Copy } from 'lucide-react';
import { math } from '@colordx/gpu';
import { colordx, Colordx, inGamutSrgb, oklchToLinear, oklchToP3Channels, oklchToRec2020Channels } from '../lib.js';
import { f, oklchCss } from '../utils.js';
import { CopyButton, useCopied } from './ui.jsx';

// gamut classification consistent with the GPU charts
const WITHIN = (n) => n >= -1e-4 && n <= 1 + 1e-4;
function gamutFlags(l, c, h) {
  const [r, g, b] = math.oklchToLinearSrgb(l, c, h);
  const srgb = WITHIN(r) && WITHIN(g) && WITHIN(b);
  const p3 = srgb || math.srgbLinearToP3Linear(r, g, b).every(WITHIN);
  const rec2020 = p3 || math.srgbLinearToRec2020Linear(r, g, b).every(WITHIN);
  return { srgb, p3, rec2020 };
}

// what the display can show, via CSS color-gamut media queries
function readDisplayGamut() {
  if (typeof window === 'undefined' || !window.matchMedia) return { p3: false, rec2020: false };
  return {
    p3: window.matchMedia('(color-gamut: p3)').matches,
    rec2020: window.matchMedia('(color-gamut: rec2020)').matches,
  };
}

function useDisplayGamut() {
  const [g, setG] = useState(readDisplayGamut);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mqs = ['(color-gamut: p3)', '(color-gamut: rec2020)'].map((q) => window.matchMedia(q));
    const onChange = () => setG(readDisplayGamut());
    mqs.forEach((mq) => mq.addEventListener('change', onChange));
    return () => mqs.forEach((mq) => mq.removeEventListener('change', onChange));
  }, []);
  return g;
}

function OutRow({ label, value }) {
  const [copied, copy] = useCopied();
  return (
    <button type="button" className="out-row" onClick={() => copy(value)} title="Copy">
      <span className="out-lbl">{label}</span>
      <span className="out-val">{value}</span>
      <span className={`out-cp${copied ? ' ok' : ''}`}>{copied ? <Check size={13} /> : <Copy size={13} />}</span>
    </button>
  );
}

export default function AppSection({ S, setS, setColor, onRandom }) {
  const [inputVal, setInputVal] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [inputError, setInputError] = useState(false);
  const errTimer = useRef(null);

  const oklchString = oklchCss(S);

  // follow the active color while the field is not being edited
  useEffect(() => {
    if (!inputFocused) setInputVal(oklchString);
  }, [oklchString, inputFocused]);

  function handleInputChange(e) {
    const v = e.target.value;
    setInputVal(v);
    clearTimeout(errTimer.current);
    const ok = !v.trim() || setColor(v.trim());
    if (ok) setInputError(false);
    // show the error only after typing stops, so a half-typed hex does not flash red
    else errTimer.current = setTimeout(() => setInputError(true), 450);
  }

  function handleBlur() {
    clearTimeout(errTimer.current);
    setInputFocused(false);
    setInputError(false);
    setInputVal(oklchString);
  }

  function handleKey(e) {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      setInputVal(oklchString);
      e.currentTarget.blur();
    }
  }

  function handleGamutMap() {
    const ok = Colordx.toGamutSrgb({ l: S.l, c: S.c, h: S.h, alpha: S.alpha }).toOklch();
    setS({ l: ok.l, c: ok.c, h: ok.h, alpha: ok.alpha });
  }

  const c = colordx({ l: S.l, c: S.c, h: S.h, alpha: S.alpha });
  const ob = c.toOklab();
  const cs = colordx(c.toHex()); // the sRGB-clipped color, what a browser shows
  const [linR, linG, linB] = oklchToLinear(S.l, S.c, S.h);
  const [p3R, p3G, p3B] = oklchToP3Channels(S.l, S.c, S.h);
  const [r2R, r2G, r2B] = oklchToRec2020Channels(S.l, S.c, S.h);
  const toHex2 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');

  const inGamut = inGamutSrgb({ l: S.l, c: S.c, h: S.h, alpha: S.alpha });
  const gamut = gamutFlags(S.l, S.c, S.h);
  const display = useDisplayGamut();

  // the browser maps each CSS function itself, so the native half shows the true wide-gamut color
  const sm = c.mapSrgb().toRgb();
  const srgbCss = `rgb(${sm.r} ${sm.g} ${sm.b} / ${S.alpha})`;
  const p3Css = `color(display-p3 ${f(p3R, 4)} ${f(p3G, 4)} ${f(p3B, 4)} / ${S.alpha})`;
  const rec2020Css = `color(rec2020 ${f(r2R, 4)} ${f(r2G, 4)} ${f(r2B, 4)} / ${S.alpha})`;

  const wide = !gamut.srgb; // outside sRGB
  const nativeSpace = gamut.p3 ? 'P3' : gamut.rec2020 ? 'Rec.2020' : null;
  const nativeCss = gamut.p3 ? p3Css : rec2020Css;
  const nativeSupported = gamut.p3 ? display.p3 : display.rec2020;
  const split = wide && nativeSpace !== null;

  const closestName = cs.toName({ closest: true });
  const outputRows = [
    { lbl: 'OKLCH', val: oklchString },
    { lbl: 'OKLab', val: `oklab(${f(ob.l)} ${f(ob.a)} ${f(ob.b)}${ob.alpha < 1 ? ` / ${f(ob.alpha, 2)}` : ''})` },
    { lbl: 'HEX', val: cs.toHex() },
    { lbl: 'RGB', val: cs.toRgbString() },
    { lbl: 'HSL', val: cs.toHslString() },
    { lbl: 'HWB', val: cs.toHwbString() },
    { lbl: 'HSV', val: cs.toHsvString() },
    { lbl: 'Lab', val: cs.toLabString() },
    { lbl: 'LCH', val: cs.toLchString() },
    { lbl: 'P3', val: `color(display-p3 ${f(p3R, 4)} ${f(p3G, 4)} ${f(p3B, 4)}${S.alpha < 1 ? ` / ${f(S.alpha, 2)}` : ''})` },
    { lbl: 'Rec.2020', val: `color(rec2020 ${f(r2R, 4)} ${f(r2G, 4)} ${f(r2B, 4)}${S.alpha < 1 ? ` / ${f(S.alpha, 2)}` : ''})` },
    { lbl: 'Linear', val: `color(srgb-linear ${f(linR, 4)} ${f(linG, 4)} ${f(linB, 4)})` },
    { lbl: 'Figma P3', val: `#${toHex2(p3R)}${toHex2(p3G)}${toHex2(p3B)}${S.alpha < 1 ? toHex2(S.alpha) : ''}` },
    { lbl: 'Short', val: cs.minify({ alphaHex: true, name: true }) },
    { lbl: 'Name', val: cs.toName() ?? `${closestName} (near)` },
  ];

  const alphaGrad = `linear-gradient(to right, ${oklchCss({ ...S, alpha: 0 })}, ${oklchCss({ ...S, alpha: 1 })})`;

  return (
    <>
      <div className="card left">
        <div className="swatch checker">
          {!split && <div className="swatch-fill" style={{ background: srgbCss }} />}
          {split && (
            <>
              <div className="swatch-half left" style={{ background: nativeCss }} />
              <div className="swatch-half right" style={{ background: srgbCss }} />
              <span className="swatch-tag swatch-tag-native">{nativeSpace}</span>
              <span className="swatch-tag swatch-tag-srgb">sRGB</span>
              {!nativeSupported && <div className="swatch-note">Your display can’t show {nativeSpace}</div>}
            </>
          )}
          {wide && !split && <span className="swatch-tag swatch-tag-native">outside Rec.2020 · mapped</span>}
          {!inGamut && (
            <button type="button" className="swatch-fix" onClick={handleGamutMap} title="Reduce chroma until it fits sRGB">
              Fit to sRGB
            </button>
          )}
        </div>
        <div className="left-body">
          <div className="alpha-row">
            <span className="alpha-cap">A</span>
            <div className="alpha-track checker">
              <div className="alpha-grad" style={{ background: alphaGrad }} />
              <input
                type="range"
                className="alpha-rng"
                min={0}
                max={1}
                step={0.01}
                value={S.alpha}
                aria-label="Alpha"
                onChange={(e) => setS((prev) => ({ ...prev, alpha: parseFloat(e.target.value) }))}
              />
            </div>
            <span className="alpha-val">{f(S.alpha, 2)}</span>
          </div>
          <div className="row">
            <input
              className={`txt${inputError ? ' err' : ''}`}
              id="color-input"
              placeholder="Paste any CSS color"
              spellCheck="false"
              autoComplete="off"
              value={inputVal}
              onFocus={() => setInputFocused(true)}
              onBlur={handleBlur}
              onChange={handleInputChange}
              onKeyDown={handleKey}
              aria-label="Color"
            />
            <CopyButton text={oklchString} />
            <button type="button" className="ibtn" onClick={onRandom} title="Random color" aria-label="Random color">
              <Shuffle size={15} />
            </button>
          </div>
          <p className={`color-error${inputError ? ' show' : ''}`}>Not a color. Try #ff6b35, rgb(), hsl(), oklch(), or a name.</p>
        </div>
      </div>

      <div className="card out-card">
        <div id="outputs">
          {outputRows.map((r) => (
            <OutRow key={r.lbl} label={r.lbl} value={r.val} />
          ))}
        </div>
      </div>
    </>
  );
}

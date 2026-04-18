import './lib.js';
import { useState, useRef, useEffect } from 'react';
import { f, randomOklch, shortestArc } from './utils.js';
import AppSection from './components/AppSection.jsx';
import Manipulation from './components/Manipulation.jsx';
import Harmonies from './components/Harmonies.jsx';
import Accessibility from './components/Accessibility.jsx';

function CodeCopyButton({ code }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button className="code-copy" onClick={handleCopy}>
      {copied ? '✓' : '⎘'}
    </button>
  );
}

export default function App() {
  const [S, setS] = useState({ l: 0.7, c: 0.1, h: 220, alpha: 1 });

  const bgH1 = useRef(S.h);
  const bgH2 = useRef((S.h + 55) % 360);
  const bgH3 = useRef((S.h + 260) % 360);

  useEffect(() => {
    bgH1.current = shortestArc(bgH1.current, S.h);
    bgH2.current = shortestArc(bgH2.current, (S.h + 55) % 360);
    bgH3.current = shortestArc(bgH3.current, (S.h + 260) % 360);

    document.body.style.setProperty('--gh1', f(bgH1.current, 1));
    document.body.style.setProperty('--gh2', f(bgH2.current, 1));
    document.body.style.setProperty('--gh3', f(bgH3.current, 1));
  }, [S.h]);

  function handleRandom() {
    const next = randomOklch();
    setS(next);

    bgH1.current = shortestArc(bgH1.current, next.h);
    bgH2.current = shortestArc(bgH2.current, (next.h + 55) % 360);
    bgH3.current = shortestArc(bgH3.current, (next.h + 260) % 360);

    document.body.classList.add('bg-anim');
    document.body.style.setProperty('--gh1', f(bgH1.current, 1));
    document.body.style.setProperty('--gh2', f(bgH2.current, 1));
    document.body.style.setProperty('--gh3', f(bgH3.current, 1));

    const onEnd = () => {
      document.body.classList.remove('bg-anim');
      document.body.removeEventListener('transitionend', onEnd);
    };
    document.body.addEventListener('transitionend', onEnd);
  }

  return (
    <>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-heading">
            <img className="hero-logo" src="/favicon.svg" alt="" width="96" height="96" />
            <h1 className="hero-title">colordx</h1>
          </div>
          <div className="hero-links">
            <a className="hero-link" href="https://www.npmjs.com/package/@colordx/core" target="_blank" rel="noopener noreferrer">npm ↗</a>
            <a className="hero-link" href="https://github.com/dkryaklin/colordx" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </div>
          <p className="hero-desc">
            Convert between OKLCH, OKLab, HEX, RGB, HSL and more.<br />
            Zero dependencies, fully typed, tree-shakeable.
          </p>
        </div>
      </section>

      <AppSection S={S} setS={setS} onRandom={handleRandom} />

      <Manipulation S={S} setS={setS} />

      <Harmonies S={S} setS={setS} />

      <Accessibility S={S} />

      <section className="gs-section">
        <div className="section-wrap">
          <h2 className="section-title">Getting Started</h2>
          <div className="gs-steps">
            <div className="gs-step">
              <div className="gs-step-label">Install</div>
              <div className="code-block">
                <pre><code>npm install @colordx/core</code></pre>
                <CodeCopyButton code="npm install @colordx/core" />
              </div>
            </div>

            <div className="gs-step">
              <div className="gs-step-label">Convert colors</div>
              <div className="code-block">
                <pre><code>{`import { colordx } from '@colordx/core';

const color = colordx('#ff6b35');
color.toHex()           // '#ff6b35'
color.toRgbString()     // 'rgb(255, 107, 53)'
color.toHslString()     // 'hsl(19.2, 100%, 60%)'
color.toOklch()         // { l: 0.68, c: 0.19, h: 38.18 }
color.toOklchString()   // 'oklch(0.6827 0.1946 38.18)'
color.toOklab()         // { l: 0.68, a: 0.149, b: 0.118 }`}</code></pre>
                <CodeCopyButton code={`import { colordx } from '@colordx/core';`} />
              </div>
            </div>

            <div className="gs-step">
              <div className="gs-step-label">Gamut checking &amp; mapping</div>
              <div className="code-block">
                <pre><code>{`import { colordx, inGamutSrgb } from '@colordx/core';

inGamutSrgb('oklch(0.5 0.4 180)')   // false — out of sRGB
inGamutSrgb('oklch(0.5 0.1 180)')   // true  — in sRGB

// .toRgbString() / .toHex() already naive-clip to match the browser:
colordx('oklch(0.5 0.4 180)').toRgbString()         // 'rgb(0, 152, 108)'

// .mapSrgb() — CSS Color 4 gamut mapping (preserves lightness + hue)
colordx('oklch(0.5 0.4 180)').mapSrgb().toOklchString()
// → 'oklch(0.5091 0.0938 177.85)'`}</code></pre>
                <CodeCopyButton code={`import { colordx, inGamutSrgb } from '@colordx/core';`} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="faq-section">
        <div className="section-wrap">
          <h2 className="section-title">Accessibility</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h3 className="faq-q">What is APCA?</h3>
              <p className="faq-a">
                APCA (Accessible Perceptual Contrast Algorithm) is the contrast model proposed for WCAG 3.0. Unlike the
                WCAG 2.x ratio, it accounts for polarity (dark-on-light vs light-on-dark), spatial frequency, and human
                contrast sensitivity — producing results that align much more closely with how people actually perceive
                text readability.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Why is WCAG 2.x contrast not enough?</h3>
              <p className="faq-a">
                WCAG 2.x uses a simple luminance ratio that treats dark-on-light and light-on-dark pairs symmetrically,
                which does not reflect human vision. It is known to fail on mid-tone and dark backgrounds — sometimes
                rating a barely visible combination as passing, or a clearly readable one as failing. APCA fixes this
                with a polarity-aware model.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">How do I use APCA in colordx?</h3>
              <p className="faq-a">
                Load the <code>a11y</code> plugin and call <code>apcaContrast(background)</code> to get the signed Lc
                value, or <code>isReadableApca(background)</code> to check against APCA thresholds — Lc&nbsp;75 for body
                text, Lc&nbsp;60 for large text. The existing <code>contrast()</code> and <code>isReadable()</code>
                methods continue to use WCAG 2.x.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">What do positive and negative Lc values mean?</h3>
              <p className="faq-a">
                A positive Lc value means dark text on a light background; negative means light text on a dark
                background. The absolute value is what determines readability — Lc&nbsp;−75 and Lc&nbsp;75 are equally
                readable. The sign only indicates polarity, which APCA uses internally to apply different contrast
                curves for each direction.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="faq-section">
        <div className="section-wrap">
          <h2 className="section-title">Why OKLCH?</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h3 className="faq-q">What is OKLCH?</h3>
              <p className="faq-a">
                OKLCH is a perceptually uniform color space derived from OKLab. It represents colors using Lightness (L),
                Chroma (C), and Hue (H). Unlike sRGB or HSL, equal steps in OKLCH correspond to equal perceived
                differences — making it far more predictable when building color palettes and design systems.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Why use OKLCH in CSS?</h3>
              <p className="faq-a">
                Modern browsers support OKLCH natively via CSS Color Level 4. OKLCH lets you adjust lightness and chroma
                independently without the perceptual distortions that come with HSL. It's especially powerful for design
                tokens, accessible color systems, and dynamic theming.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">OKLab vs OKLCH — what's the difference?</h3>
              <p className="faq-a">
                OKLab uses Cartesian coordinates (L, a, b) where <em>a</em> is the green–red axis and <em>b</em> is the
                blue–yellow axis. OKLCH is OKLab converted to polar coordinates — the same color described by Lightness,
                Chroma (distance from neutral), and Hue (angle). OKLCH is more intuitive; OKLab is better for
                programmatic color math.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Does colordx support gamut mapping?</h3>
              <p className="faq-a">
                Yes. <code>inGamutSrgb()</code> checks whether a color is within the sRGB gamut. For conversion,
                <code>.toRgbString()</code> and <code>.toHex()</code> already naive-clip to match browser rendering — no
                explicit gamut mapping needed for the common case. When you want hue stability,
                <code>.mapSrgb()</code> applies the CSS Color 4 chroma-reduction algorithm (preserves lightness and hue,
                reduces chroma). <code>.clampSrgb()</code> returns a Colordx at the naive-clip boundary for when you need
                the browser's clipped color expressed as oklch.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">What color formats are supported?</h3>
              <p className="faq-a">
                Core: HEX, RGB, HSL, HWB, OKLab, OKLCH. Optional plugins add CIE Lab, CIE LCH, XYZ, CMYK, color delta
                (ΔE), and named CSS colors. The plugin system keeps the core bundle small — import only what you need.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Is colordx compatible with colord?</h3>
              <p className="faq-a">
                colordx is API-compatible with colord and designed as a drop-in upgrade. It adds first-class OKLCH/OKLab
                support, gamut utilities, and a fully-typed plugin system. Most colord usage can be migrated by replacing
                the import.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="faq-section">
        <div className="section-wrap">
          <h2 className="section-title">Color Formats</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h3 className="faq-q">OKLab</h3>
              <p className="faq-a">
                OKLab uses Cartesian coordinates — L (lightness), a (green–red axis), and b (blue–yellow axis) — in a
                perceptually uniform space. Equal numeric distances correspond to equal perceived color differences, making
                it ideal for color interpolation, palette generation, and any operation where consistency matters more than
                intuition. Use <code>toOklab()</code> or <code>toOklabString()</code> to convert.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">HEX</h3>
              <p className="faq-a">
                Hexadecimal (<code>#rrggbb</code>) is the most compact CSS color notation and the default format for
                design tools, HTML attributes, and image editors. colordx parses both 3-digit (<code>#f00</code>) and
                6-digit forms and always outputs lowercase 6-digit hex. Use <code>toHex()</code> to convert from any
                input format.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">RGB</h3>
              <p className="faq-a">
                <code>rgb()</code> expresses colors as red, green, and blue channel values from 0 to 255 — the native
                encoding of the sRGB color space used by screens. It is the most direct format for canvas operations,
                WebGL, and any API that consumes integer channels. colordx outputs rounded integer channels via
                <code>toRgb()</code> and <code>toRgbString()</code>.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">HSL</h3>
              <p className="faq-a">
                <code>hsl()</code> describes colors by Hue (0–360°), Saturation (0–100%), and Lightness (0–100%). It maps
                more intuitively to how designers think about color than RGB does, making it popular in CSS theming and
                design tokens. Note that HSL lightness is not perceptually uniform — OKLCH is a better choice when
                consistent brightness steps matter.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">HSV</h3>
              <p className="faq-a">
                HSV (Hue, Saturation, Value) is the color model used internally by most design tools — Photoshop,
                Figma, and Sketch all show HSV pickers. Value represents the brightness of the fully saturated hue,
                which maps well to the concept of "how much color" is present. colordx exposes it via the
                <code>hsv</code> plugin with <code>toHsv()</code> and <code>toHsvString()</code>.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">HWB</h3>
              <p className="faq-a">
                HWB (Hue, Whiteness, Blackness) is a CSS Color Level 4 format designed to be the most human-readable
                color model. You start with a pure hue and mix in white or black to lighten or darken it. All modern
                browsers support <code>hwb()</code> natively. colordx adds <code>toHwb()</code> and
                <code>toHwbString()</code> via the <code>hwb</code> plugin.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Display P3</h3>
              <p className="faq-a">
                Display P3 is a wide-gamut color space used by Apple displays, modern smartphones, and high-end monitors.
                Its gamut is roughly 25% larger than sRGB, allowing more vivid reds, greens, and cyans that sRGB cannot
                reproduce. CSS supports it via <code>color(display-p3 r g b)</code>. colordx converts to P3 with
                <code>toP3()</code> and <code>toP3String()</code> via the <code>p3</code> plugin.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">toNumber / integer format</h3>
              <p className="faq-a">
                <code>toNumber()</code> returns the color as a 24-bit integer (<code>0xff0000</code> for red) — the
                format used by PixiJS, Discord embeds, Three.js, and other libraries that encode color as a single
                number. It is equivalent to parsing the hex string as a base-16 integer and works for any fully opaque
                sRGB color.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <p>Made by <a href="https://dkryaklin.com" target="_blank" rel="noopener noreferrer">dkryaklin.com</a></p>
      </footer>
    </>
  );
}

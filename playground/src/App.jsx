import './lib.js';
import { useState } from 'react';
import {
  Pipette,
  SlidersHorizontal,
  Blend,
  Contrast,
  Terminal,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { randomOklch } from './utils.js';
import SectionHead from './components/SectionHead.jsx';
import AppSection from './components/AppSection.jsx';
import GamutCharts from './components/GamutCharts.jsx';
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
    <button className="code-copy" onClick={handleCopy} title="Copy">
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export default function App() {
  const [S, setS] = useState({ l: 0.7, c: 0.1, h: 220, alpha: 1 });
  const [showP3, setShowP3] = useState(true);
  const [showRec2020, setShowRec2020] = useState(false);

  function handleRandom() {
    setS(randomOklch());
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#top">
            <img className="brand-mark" src="/favicon.svg" alt="" width="26" height="26" />
            <span className="brand-name">colordx</span>
          </a>
          <nav className="topnav">
            <a href="#picker">
              <Pipette size={15} />
              <span>Picker</span>
            </a>
            <a href="#manipulate">
              <SlidersHorizontal size={15} />
              <span>Manipulate</span>
            </a>
            <a href="#harmonies">
              <Blend size={15} />
              <span>Harmonies</span>
            </a>
            <a href="#accessibility">
              <Contrast size={15} />
              <span>Contrast</span>
            </a>
          </nav>
          <span className="topbar-divider" />
          <a
            className="ext-link"
            href="https://www.npmjs.com/package/@colordx/core"
            target="_blank"
            rel="noopener noreferrer"
          >
            npm ↗
          </a>
          <a
            className="ext-link"
            href="https://github.com/dkryaklin/colordx"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
        </div>
      </header>

      <main id="top">
        <section className="workstation" id="picker">
          <SectionHead
            icon={<Pipette size={13} />}
            eyebrow="OKLCH Picker"
            title="Pick a color"
            desc="Three GPU-rendered gamut slices of OKLCH space — drag any chart to set two components at once. Every dimension is an axis on two charts, so the whole space is reachable by dragging."
          />
          <div className="ws-grid">
            <div className="studio-controls">
              <AppSection
                S={S}
                setS={setS}
                onRandom={handleRandom}
                showP3={showP3}
                showRec2020={showRec2020}
              />
            </div>
            <div className="studio-charts">
              <GamutCharts
                S={S}
                setS={setS}
                showP3={showP3}
                setShowP3={setShowP3}
                showRec2020={showRec2020}
                setShowRec2020={setShowRec2020}
              />
            </div>
          </div>
        </section>

        <section className="section" id="manipulate">
          <Manipulation S={S} setS={setS} />
        </section>

        <section className="section" id="harmonies">
          <Harmonies S={S} setS={setS} />
        </section>

        <section className="section" id="accessibility">
          <Accessibility S={S} />
        </section>

        <section className="section">
          <SectionHead
            icon={<Terminal size={13} />}
            eyebrow="Getting Started"
            title="Drop it in"
            desc="Zero dependencies, fully typed, tree-shakeable. Import only what you need."
          />
          <div className="gs-steps">
            <div className="gs-step">
              <div className="gs-step-label">Install</div>
              <div className="code-block">
                <pre>
                  <code>npm install @colordx/core</code>
                </pre>
                <CodeCopyButton code="npm install @colordx/core" />
              </div>
            </div>

            <div className="gs-step">
              <div className="gs-step-label">Convert colors</div>
              <div className="code-block">
                <pre>
                  <code>{`import { colordx } from '@colordx/core';

const color = colordx('#ff6b35');
color.toHex()           // '#ff6b35'
color.toRgbString()     // 'rgb(255 107 53)'
color.toHslString()     // 'hsl(19.2 100% 60%)'
color.toOklch()         // { l: 0.68, c: 0.19, h: 38.18 }
color.toOklchString()   // 'oklch(0.6827 0.1946 38.18)'
color.toOklab()         // { l: 0.68, a: 0.149, b: 0.118 }`}</code>
                </pre>
                <CodeCopyButton code={`import { colordx } from '@colordx/core';`} />
              </div>
            </div>

            <div className="gs-step">
              <div className="gs-step-label">Gamut checking &amp; mapping</div>
              <div className="code-block">
                <pre>
                  <code>{`import { colordx, inGamutSrgb } from '@colordx/core';

inGamutSrgb('oklch(0.5 0.4 180)')   // false — out of sRGB
inGamutSrgb('oklch(0.5 0.1 180)')   // true  — in sRGB

// .mapSrgb() — CSS Color 4 gamut mapping (preserves lightness + hue)
colordx('oklch(0.5 0.4 180)').mapSrgb().toOklchString()
// → 'oklch(0.5091 0.0938 177.85)'`}</code>
                </pre>
                <CodeCopyButton code={`import { colordx, inGamutSrgb } from '@colordx/core';`} />
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <SectionHead
            icon={<HelpCircle size={13} />}
            eyebrow="FAQ"
            title="Why OKLCH?"
            desc="A perceptually uniform color space — equal steps look equally different."
          />
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
                blue–yellow axis. OKLCH is OKLab in polar coordinates — the same color described by Lightness, Chroma
                (distance from neutral), and Hue (angle). OKLCH is more intuitive; OKLab is better for programmatic math.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Does colordx support gamut mapping?</h3>
              <p className="faq-a">
                Yes. <code>inGamutSrgb()</code> checks whether a color is within sRGB. <code>.toRgbString()</code> and{' '}
                <code>.toHex()</code> naive-clip to match browser rendering, while <code>.mapSrgb()</code> applies the CSS
                Color 4 chroma-reduction algorithm — preserving lightness and hue.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">What color formats are supported?</h3>
              <p className="faq-a">
                Core: HEX, RGB, HSL, HWB, OKLab, OKLCH. Optional plugins add CIE Lab, CIE LCH, XYZ, CMYK, color delta
                (ΔE), Display-P3, and named CSS colors. The plugin system keeps the core bundle small.
              </p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Is colordx compatible with colord?</h3>
              <p className="faq-a">
                colordx is API-compatible with colord and designed as a drop-in upgrade. It adds first-class OKLCH/OKLab
                support, gamut utilities, and a fully-typed plugin system. Most colord usage migrates by replacing the
                import.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span className="footer-mark">colordx</span>
        <p>
          Made by{' '}
          <a href="https://dkryaklin.com" target="_blank" rel="noopener noreferrer">
            dkryaklin.com
          </a>
        </p>
      </footer>
    </>
  );
}

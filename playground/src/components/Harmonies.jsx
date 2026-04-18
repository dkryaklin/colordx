import { useState } from 'react';
import { colordx } from '../lib.js';
import { f } from '../utils.js';

const HARM_MODES = [
  { key: 'complementary', label: 'Complementary' },
  { key: 'analogous', label: 'Analogous' },
  { key: 'triadic', label: 'Triadic' },
  { key: 'tetradic', label: 'Tetradic' },
  { key: 'split-complementary', label: 'Split' },
  { key: 'rectangle', label: 'Rectangle' },
  { key: 'double-split-complementary', label: 'Double Split' },
];

export default function Harmonies({ S, setS }) {
  const [harmMode, setHarmMode] = useState('complementary');

  const c = colordx({ l: S.l, c: S.c, h: S.h, alpha: S.alpha });
  const colors = c.harmonies(harmMode);

  function handleSelect(hex) {
    const p = colordx(hex);
    if (!p.isValid()) return;
    const ok = p.toOklch();
    setS({ l: ok.l, c: ok.c, h: ok.h, alpha: S.alpha });
  }

  return (
    <section className="harm-section">
      <div className="section-wrap">
        <h2 className="section-title">Harmonies</h2>
        <p className="section-desc">
          Generate color palettes using hue rotation in OKLCH space. Seven schemes: complementary, analogous, triadic, tetradic, split-complementary, rectangle, and double-split-complementary. Click any swatch to set it as the active color.
        </p>
        <div className="card harm-wrap">
          <div className="harm-tabs">
            {HARM_MODES.map((mode) => (
              <button
                key={mode.key}
                className={`harm-tab${harmMode === mode.key ? ' on' : ''}`}
                onClick={() => setHarmMode(mode.key)}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="harm-swatches">
            {colors.map((h, i) => {
              const ok = h.toOklch();
              const hex = h.toHex();
              return (
                <div
                  key={i}
                  className="hs"
                  style={{ background: `oklch(${f(ok.l)} ${f(ok.c)} ${f(ok.h, 2)})` }}
                  onClick={() => handleSelect(hex)}
                >
                  <span className="hs-hex">{hex}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

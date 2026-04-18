import { useState, useEffect } from 'react';
import { colordx } from '../lib.js';

export default function Accessibility({ S }) {
  const [txtHex, setTxtHex] = useState('#1c1a16');
  const [bgHex, setBgHex] = useState('#cf674a');
  const initialSyncDone = useState(false);

  useEffect(() => {
    const newBgHex = colordx({ l: S.l, c: S.c, h: S.h, alpha: S.alpha }).toHex();
    const darkContrast = colordx('#1c1a16').contrast(newBgHex);
    const lightContrast = colordx('#f5f2ec').contrast(newBgHex);
    const newTxtHex = darkContrast >= lightContrast ? '#1c1a16' : '#f5f2ec';
    setBgHex(newBgHex);
    setTxtHex(newTxtHex);
  }, [S]);

  const txt = colordx(txtHex);
  const bg = colordx(bgHex);
  const bothValid = txt.isValid() && bg.isValid();

  const wcag = bothValid ? txt.contrast(bgHex) : null;
  const apca = bothValid ? txt.apcaContrast(bgHex) : null;

  const wcagBadges = bothValid
    ? [
        { label: 'AA Normal', pass: txt.isReadable(bgHex) },
        { label: 'AA Large', pass: txt.isReadable(bgHex, { size: 'large' }) },
        { label: 'AAA Normal', pass: txt.isReadable(bgHex, { level: 'AAA' }) },
        { label: 'AAA Large', pass: txt.isReadable(bgHex, { level: 'AAA', size: 'large' }) },
      ]
    : [];

  const apcaBadges = bothValid
    ? [
        { label: 'Body text (≥75)', pass: txt.isReadableApca(bgHex) },
        { label: 'Large text (≥60)', pass: txt.isReadableApca(bgHex, { size: 'large' }) },
      ]
    : [];

  function handleSwap() {
    setTxtHex(bgHex);
    setBgHex(txtHex);
  }

  function handleTxtPickerChange(e) {
    setTxtHex(e.target.value);
  }

  function handleBgPickerChange(e) {
    setBgHex(e.target.value);
  }

  function handleTxtHexChange(e) {
    setTxtHex(e.target.value);
  }

  function handleBgHexChange(e) {
    setBgHex(e.target.value);
  }

  const previewBgColor = bg.isValid() ? bg.toHex() : undefined;
  const sampleColor = txt.isValid() ? txt.toHex() : undefined;
  const txtPickerVal = txt.isValid() ? txt.toHex() : '#000000';
  const bgPickerVal = bg.isValid() ? bg.toHex() : '#ffffff';

  return (
    <section className="a11y-section">
      <div className="section-wrap">
        <h2 className="section-title">Accessibility</h2>
        <p className="section-desc">
          Check contrast between any two colors against WCAG 2.x (AA and AAA) and APCA — the perceptually accurate contrast model proposed for WCAG 3.0. The active color is automatically used as the background.
        </p>
        <div className="a11y-wrap">
          <div className="card a11y-left">
            <div
              className="a11y-preview"
              style={{ backgroundColor: previewBgColor }}
            >
              <span className="a11y-sample" style={{ color: sampleColor }}>
                Sample Text
              </span>
              <span className="a11y-sample sm" style={{ color: sampleColor }}>
                Small body text for reading
              </span>
            </div>
            <div className="a11y-controls">
              <div className="a11y-pair">
                <label className="a11y-label">Text</label>
                <div className="a11y-color-row">
                  <input
                    type="color"
                    className="a11y-picker"
                    value={txtPickerVal}
                    onChange={handleTxtPickerChange}
                  />
                  <input
                    type="text"
                    className="txt a11y-hex"
                    value={txtHex}
                    spellCheck="false"
                    onChange={handleTxtHexChange}
                  />
                </div>
              </div>
              <button className="a11y-swap" title="Swap colors" onClick={handleSwap}>
                ⇅
              </button>
              <div className="a11y-pair">
                <label className="a11y-label">Background</label>
                <div className="a11y-color-row">
                  <input
                    type="color"
                    className="a11y-picker"
                    value={bgPickerVal}
                    onChange={handleBgPickerChange}
                  />
                  <input
                    type="text"
                    className="txt a11y-hex"
                    value={bgHex}
                    spellCheck="false"
                    onChange={handleBgHexChange}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="a11y-metrics">
            <div className="card a11y-metric-card">
              <div className="a11y-metric-header">
                <span className="a11y-metric-title">WCAG 2.x</span>
                <span className="a11y-metric-val">
                  {wcag !== null ? `${wcag.toFixed(2)} : 1` : '—'}
                </span>
              </div>
              <div className="a11y-badge-row">
                {wcagBadges.map((b) => (
                  <span key={b.label} className={`a11y-badge ${b.pass ? 'pass' : 'fail'}`}>
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="card a11y-metric-card">
              <div className="a11y-metric-header">
                <span className="a11y-metric-title">APCA</span>
                <a
                  className="a11y-metric-link"
                  href="https://git.apcacontrast.com/documentation/APCAeasyIntro"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WCAG 3.0 candidate ↗
                </a>
                <span className="a11y-metric-val">
                  {apca !== null ? `Lc ${apca.toFixed(1)}` : '—'}
                </span>
              </div>
              <div className="a11y-badge-row">
                {apcaBadges.map((b) => (
                  <span key={b.label} className={`a11y-badge ${b.pass ? 'pass' : 'fail'}`}>
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

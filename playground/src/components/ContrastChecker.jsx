import { useEffect, useState } from 'react';
import { Contrast, ArrowLeftRight, Wand2, Eye } from 'lucide-react';
import { colordx } from '../lib.js';
import { check, fix, fixBg, CVD_TYPES, collapses } from '../a11y.js';
import { SectionHead, Segmented, ColorField, Badge, CodeBlock } from './ui.jsx';

const USE_OPTS = [{ key: 'body', label: 'Body text' }, { key: 'large', label: 'Large text' }, { key: 'ui', label: 'UI' }];
const LEVEL_OPTS = [{ key: 'AA', label: 'AA' }, { key: 'AAA', label: 'AAA' }];

function Result({ r }) {
  if (!r) return <p className="empty">Both fields need a color.</p>;
  const tone = r.result === 'pass' ? 'pass' : r.result === 'warn' ? 'warn' : 'fail';
  return (
    <div className="res">
      <div className="res-row">
        <span className="res-name">WCAG 2.2</span>
        <span className="res-val">{r.ratio.toFixed(2)}<small> : 1</small></span>
        <span className="res-min">min {r.min.wcag}</span>
        <Badge ok={r.wcag}>{r.wcag ? 'pass' : 'fail'}</Badge>
      </div>
      <div className="res-row">
        <span className="res-name">APCA</span>
        <span className="res-val">Lc {r.lc.toFixed(1)}</span>
        <span className="res-min">min {r.min.apca}</span>
        <Badge ok={r.apca}>{r.apca ? 'pass' : 'fail'}</Badge>
      </div>
      <div className={`res-sum ${tone}`}>
        {r.result === 'pass' && 'Pass. Both gates.'}
        {r.result === 'warn' && 'Warn. WCAG passes, APCA does not.'}
        {r.result === 'fail' && 'Fail. WCAG does not pass.'}
      </div>
    </div>
  );
}

export default function ContrastChecker({ hex }) {
  const [fg, setFg] = useState('#1c1a16');
  const [bg, setBg] = useState(hex);
  const [use, setUse] = useState('body');
  const [level, setLevel] = useState('AA');
  const [touched, setTouched] = useState(false);

  // follow the active color until the user edits the pair
  useEffect(() => {
    if (touched) return;
    const dark = colordx('#1c1a16').contrast(hex) >= colordx('#f5f2ec').contrast(hex);
    setBg(hex);
    setFg(dark ? '#1c1a16' : '#f5f2ec');
  }, [hex, touched]);

  const edit = (set) => (v) => {
    setTouched(true);
    set(v);
  };

  const a = colordx(fg);
  const b = colordx(bg);
  const valid = a.isValid() && b.isValid();
  const r = valid ? check(fg, bg, use, level) : null;
  const fixed = r && r.result !== 'pass' ? fix(fg, bg, use, level) : null;
  const fixedBg = r && r.result !== 'pass' ? fixBg(fg, bg, use, level) : null;

  const fgCss = valid ? a.toHex() : '#000';
  const bgCss = valid ? b.toHex() : '#fff';

  const cvd = valid
    ? CVD_TYPES.map((t) => {
        const sf = a.simulate(t).toHex();
        const sb = b.simulate(t).toHex();
        return { t, fg: sf, bg: sb, r: check(sf, sb, use, level) };
      })
    : [];

  return (
    <>
      <SectionHead
        icon={<Contrast size={13} />}
        eyebrow="Contrast"
        title="Check a pair"
        desc="Text on a background. WCAG 2.2 and APCA, both at once. A fix moves lightness until the pair passes and keeps the hue."
        right={
          <>
            <Segmented small options={USE_OPTS} value={use} onChange={setUse} />
            <Segmented small options={LEVEL_OPTS} value={level} onChange={setLevel} />
          </>
        }
      />
      <div className="a11y-wrap">
        <div className="card a11y-left">
          <div className="a11y-preview" style={{ backgroundColor: bgCss, color: fgCss }}>
            {use === 'ui' ? (
              <div className="a11y-ui">
                <span className="a11y-ui-box" style={{ borderColor: fgCss }}>input</span>
                <span className="a11y-ui-icon" style={{ background: fgCss }} />
              </div>
            ) : (
              <>
                <span className={`a11y-sample${use === 'large' ? ' lg' : ''}`}>The quick brown fox</span>
                <span className="a11y-sample sm">jumps over the lazy dog. 0123456789</span>
              </>
            )}
          </div>
          <div className="a11y-controls">
            <ColorField label="Text" value={fg} onChange={edit(setFg)} />
            <button
              type="button"
              className="ibtn a11y-swap"
              title="Swap"
              aria-label="Swap text and background"
              onClick={() => {
                setTouched(true);
                setFg(bg);
                setBg(fg);
              }}
            >
              <ArrowLeftRight size={15} />
            </button>
            <ColorField label="Background" value={bg} onChange={edit(setBg)} />
          </div>
          <div className="a11y-foot">
            {r?.result === 'pass' ? (
              <span className="a11y-ok">Passes both gates.</span>
            ) : (
              <>
                <button type="button" className="btn btn-accent" disabled={!fixed} onClick={() => edit(setFg)(fixed)} title="Move the text lightness until it passes">
                  <Wand2 size={14} />
                  {fixed ? `Fix text → ${fixed}` : 'No text on this hue passes'}
                </button>
                <button type="button" className="btn" disabled={!fixedBg} onClick={() => edit(setBg)(fixedBg)} title="Move the background lightness until it passes">
                  {fixedBg ? `Fix background → ${fixedBg}` : 'No background on this hue passes'}
                </button>
              </>
            )}
            {touched && (
              <button type="button" className="btn" onClick={() => setTouched(false)}>
                Use active color
              </button>
            )}
          </div>
        </div>
        <div className="a11y-metrics">
          <div className="card a11y-metric-card">
            <Result r={r} />
          </div>
          <div className="card a11y-metric-card">
            <div className="cvd-head">
              <Eye size={14} />
              <span>With color blindness</span>
            </div>
            <div className="cvd-grid">
              {cvd.map((x) => {
                const hit = collapses(fg, bg).includes(x.t);
                return (
                  <div key={x.t} className="cvd-item" style={{ background: x.bg, color: x.fg }}>
                    <span className="cvd-type">{x.t}</span>
                    <span className="cvd-sample">Aa</span>
                    <span className="cvd-num">{x.r.ratio.toFixed(1)} : 1</span>
                    {hit && <span className="cvd-warn">colors collapse</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {valid && (
        <CodeBlock
          code={`colordx('${a.toHex()}').contrast('${b.toHex()}');      // ${r.ratio.toFixed(2)}
colordx('${a.toHex()}').apcaContrast('${b.toHex()}');  // ${a.apcaContrast(b).toFixed(1)}
colordx('${a.toHex()}').isReadable('${b.toHex()}', { level: '${level}'${use === 'large' ? ", size: 'large'" : ''} });  // ${r.wcag}
colordx('${a.toHex()}').fixContrast('${b.toHex()}', { wcag: ${r.min.wcag}, apca: ${r.min.apca} });  // ${fixed ? `'${fixed}'` : r.result === 'pass' ? 'unchanged' : 'null'}`}
        />
      )}
    </>
  );
}

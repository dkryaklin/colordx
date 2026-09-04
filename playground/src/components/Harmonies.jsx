import { useState } from 'react';
import { Blend } from 'lucide-react';
import { colordx } from '../lib.js';
import { f } from '../utils.js';
import { SectionHead, Segmented, useCopied } from './ui.jsx';

const MODES = [
  { key: 'complementary', label: 'Complementary', deg: [0, 180] },
  { key: 'analogous', label: 'Analogous', deg: [-30, 0, 30] },
  { key: 'triadic', label: 'Triadic', deg: [0, 120, 240] },
  { key: 'tetradic', label: 'Tetradic', deg: [0, 90, 180, 270] },
  { key: 'split', label: 'Split', deg: [0, 150, 210] },
  { key: 'rectangle', label: 'Rectangle', deg: [0, 60, 180, 240] },
  { key: 'double', label: 'Double split', deg: [-30, 0, 30, 150, 210] },
];

function Swatch({ color, onUse }) {
  const [copied, copy] = useCopied();
  const ok = color.toOklch();
  const hex = color.mapSrgb().toHex();
  return (
    <div className="hs" style={{ background: `oklch(${f(ok.l)} ${f(ok.c)} ${f(ok.h, 2)})` }}>
      <div className={`hs-actions${color.isDark() ? '' : ' on-light'}`}>
        <button type="button" onClick={() => copy(hex)}>{copied ? 'copied' : hex}</button>
        <button type="button" onClick={() => onUse(hex)}>use</button>
      </div>
    </div>
  );
}

export default function Harmonies({ S, setColor }) {
  const [mode, setMode] = useState('complementary');
  const m = MODES.find((x) => x.key === mode);
  const colors = m.deg.map((d) => colordx({ l: S.l, c: S.c, h: (S.h + d + 360) % 360, alpha: 1 }));

  return (
    <>
      <SectionHead
        icon={<Blend size={13} />}
        eyebrow="Harmonies"
        title="Rotate the hue"
        desc="Seven classic schemes. Lightness and chroma stay put, so every color has the same weight."
      />
      <div className="card harm-wrap">
        <Segmented options={MODES} value={mode} onChange={setMode} />
        <div className="harm-swatches">
          {colors.map((c, i) => (
            <Swatch key={i} color={c} onUse={(hex) => setColor(hex, true)} />
          ))}
        </div>
      </div>
    </>
  );
}

import { useState } from 'react';
import { Blend } from 'lucide-react';
import { colordx } from '../lib.js';
import { f } from '../utils.js';
import { SectionHead, Segmented, CodeBlock, useCopied } from './ui.jsx';

const MODES = [
  { key: 'complementary', label: 'Complementary' },
  { key: 'analogous', label: 'Analogous' },
  { key: 'triadic', label: 'Triadic' },
  { key: 'tetradic', label: 'Tetradic' },
  { key: 'split-complementary', label: 'Split' },
  { key: 'rectangle', label: 'Rectangle' },
  { key: 'double-split-complementary', label: 'Double split' },
];
const SPACES = [{ key: 'oklch', label: 'OKLCH' }, { key: 'hsl', label: 'HSL' }];

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
  const [space, setSpace] = useState('oklch');
  // the HSL wheel lives on the sRGB cube, so it starts from the mapped color
  const seed = colordx({ l: S.l, c: S.c, h: S.h, alpha: 1 });
  const base = space === 'oklch' ? seed : seed.mapSrgb();
  const colors = base.harmonies(mode, { space });
  const hex = seed.mapSrgb().toHex();
  const call = space === 'oklch' ? `harmonies('${mode}', { space: 'oklch' })` : `harmonies('${mode}')`;
  const out = colors.map((c) => `'${c.mapSrgb().toHex()}'`).join(', ');

  return (
    <>
      <SectionHead
        icon={<Blend size={13} />}
        eyebrow="Harmonies"
        title="Rotate the hue"
        desc="Seven classic schemes. In OKLCH, lightness and chroma stay put, so every color has the same weight. HSL is the classic wheel, where the same rotation can land much lighter or darker."
        right={<Segmented small options={SPACES} value={space} onChange={setSpace} />}
      />
      <div className="card harm-wrap">
        <Segmented options={MODES} value={mode} onChange={setMode} />
        <div className="harm-swatches">
          {colors.map((c, i) => (
            <Swatch key={i} color={c} onUse={(hex) => setColor(hex, true)} />
          ))}
        </div>
        <CodeBlock code={`colordx('${hex}').${call}.map((c) => c.mapSrgb().toHex());\n// [${out}]`} />
      </div>
    </>
  );
}

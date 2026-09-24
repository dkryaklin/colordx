import { useState } from 'react';
import { GitMerge } from 'lucide-react';
import { colordx } from '../lib.js';
import { SectionHead, Segmented, ColorField, CodeBlock, useCopied } from './ui.jsx';

function Stop({ hex }) {
  const [copied, copy] = useCopied();
  const c = colordx(hex);
  // a mostly transparent stop shows the dark checker through it
  const dark = c.alpha() < 0.5 || c.isDark();
  return (
    <button type="button" className="stop checker" onClick={() => copy(hex)} title="Copy">
      <span className="stop-fill" style={{ background: hex }} />
      <span className={`stop-hex${dark ? '' : ' on-light'}`}>{copied ? 'copied' : hex}</span>
    </button>
  );
}

export default function Mixer({ hex }) {
  const [target, setTarget] = useState('#ffffff');
  const [steps, setSteps] = useState(7);
  const [space, setSpace] = useState('oklab');

  const a = colordx(hex);
  const b = colordx(target);
  const valid = b.isValid();
  const stops = valid
    ? Array.from({ length: steps }, (_, i) => {
        const t = i / (steps - 1);
        return (space === 'oklab' ? a.mixOklab(b, t) : a.mix(b, t)).toHex();
      })
    : [];
  const gradient = valid ? `linear-gradient(in ${space === 'oklab' ? 'oklab' : 'srgb'} to right, ${hex}, ${b.toHex()})` : '';
  const code = valid
    ? space === 'oklab'
      ? `colordx('${hex}').mixOklab('${b.toHex()}', 0.5).toHex(); // '${a.mixOklab(b, 0.5).toHex()}'`
      : `colordx('${hex}').mix('${b.toHex()}', 0.5).toHex(); // '${a.mix(b, 0.5).toHex()}'`
    : '';

  return (
    <>
      <SectionHead
        icon={<GitMerge size={13} />}
        eyebrow="Mix"
        title="Blend two colors"
        desc="Stops between the active color and a target. sRGB mixes like CSS did. OKLab keeps the path even, with no gray dip in the middle. Alpha is premultiplied like CSS color-mix(), so a fade to transparent keeps its hue."
      />
      <div className="card mix-card">
        <div className="mix-controls">
          <ColorField label="Target" value={target} onChange={setTarget} />
          <div className="cf">
            <label className="cf-label">Space</label>
            <Segmented options={[{ key: 'oklab', label: 'OKLab' }, { key: 'srgb', label: 'sRGB' }]} value={space} onChange={setSpace} />
          </div>
          <div className="cf">
            <label className="cf-label">Stops · {steps}</label>
            <input type="range" className="rng-plain" min={3} max={12} step={1} value={steps} onChange={(e) => setSteps(+e.target.value)} aria-label="Stops" />
          </div>
        </div>
        {valid ? (
          <>
            <div className="mix-strip">
              {stops.map((s, i) => (
                <Stop key={i} hex={s} />
              ))}
            </div>
            <div className="mix-grad checker">
              <div className="mix-grad-fill" style={{ background: gradient }} />
            </div>
            <CodeBlock code={`background: ${gradient};\n\n${code}`} />
          </>
        ) : (
          <p className="empty">Target is not a color.</p>
        )}
      </div>
    </>
  );
}

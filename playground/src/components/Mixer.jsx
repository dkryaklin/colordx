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

const SPACES = [{ key: 'oklch', label: 'OKLCH' }, { key: 'oklab', label: 'OKLab' }, { key: 'srgb', label: 'sRGB' }];
const HUES = [
  { key: 'shorter', label: 'Shorter' },
  { key: 'longer', label: 'Longer' },
  { key: 'increasing', label: 'Increasing' },
  { key: 'decreasing', label: 'Decreasing' },
];

export default function Mixer({ hex }) {
  const [target, setTarget] = useState('#ffffff');
  const [steps, setSteps] = useState(7);
  const [space, setSpace] = useState('oklab');
  const [hue, setHue] = useState('shorter');

  const a = colordx(hex);
  const b = colordx(target);
  const valid = b.isValid();
  // an OKLCH arc between two sRGB colors can bulge outside sRGB, so its stops are gamut-mapped
  const at = (t) =>
    space === 'oklch' ? a.mixOklch(b, t, { hue }).mapSrgb() : space === 'oklab' ? a.mixOklab(b, t) : a.mix(b, t);
  const stops = valid ? Array.from({ length: steps }, (_, i) => at(i / (steps - 1)).toHex()) : [];
  const method = space === 'oklch' && hue !== 'shorter' ? `oklch ${hue} hue` : space;
  const gradient = valid ? `linear-gradient(in ${method} to right, ${hex}, ${b.toHex()})` : '';
  const call =
    space === 'oklch'
      ? `mixOklch('${b.toHex()}', 0.5${hue === 'shorter' ? '' : `, { hue: '${hue}' }`}).mapSrgb()`
      : space === 'oklab'
        ? `mixOklab('${b.toHex()}', 0.5)`
        : `mix('${b.toHex()}', 0.5)`;
  const code = valid ? `colordx('${hex}').${call}.toHex(); // '${at(0.5).toHex()}'` : '';

  return (
    <>
      <SectionHead
        icon={<GitMerge size={13} />}
        eyebrow="Mix"
        title="Blend two colors"
desc="Stops between the active color and a target. sRGB mixes like CSS did. OKLab keeps the path even, with no gray dip in the middle. OKLCH travels around the hue circle and keeps the chroma, in the direction you pick. Alpha is premultiplied like CSS color-mix(), so a fade to transparent keeps its hue."
      />
      <div className="card mix-card">
        <div className="mix-controls">
          <ColorField label="Target" value={target} onChange={setTarget} />
          <div className="cf">
            <label className="cf-label">Space</label>
            <Segmented options={SPACES} value={space} onChange={setSpace} />
          </div>
          <div className="cf">
            <label className="cf-label">Stops · {steps}</label>
            <input type="range" className="rng-plain" min={3} max={12} step={1} value={steps} onChange={(e) => setSteps(+e.target.value)} aria-label="Stops" />
          </div>
        </div>
        {space === 'oklch' && (
          <div className="cf mix-hue">
            <label className="cf-label">Hue direction</label>
            <Segmented small options={HUES} value={hue} onChange={setHue} />
          </div>
        )}
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

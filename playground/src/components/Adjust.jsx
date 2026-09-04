import { SlidersHorizontal } from 'lucide-react';
import { colordx } from '../lib.js';
import { clamp, f } from '../utils.js';
import { SectionHead } from './ui.jsx';

function item(color, label, current = false) {
  const ok = color.toOklch();
  return {
    label,
    current,
    bg: `oklch(${f(ok.l)} ${f(ok.c)} ${f(ok.h, 2)})`,
    hex: color.mapSrgb().toHex(),
    dark: color.isDark(),
  };
}

function Row({ label, items, onSelect }) {
  return (
    <div className="card manip-row-card">
      <div className="manip-row-label">{label}</div>
      <div className="manip-swatches">
        {items.map((it) => (
          <button
            type="button"
            key={it.label}
            className={`ms${it.current ? ' ms-current' : ''}`}
            style={{ background: it.bg }}
            title={it.hex}
            disabled={it.current}
            onClick={() => onSelect(it.hex)}
          >
            <span className={`ms-lbl${it.dark ? '' : ' on-light'}`}>{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Adjust({ S, setColor }) {
  const c = colordx({ l: S.l, c: S.c, h: S.h, alpha: 1 });
  const at = (p) => colordx({ ...{ l: S.l, c: S.c, h: S.h, alpha: 1 }, ...p });
  const onSelect = (hex) => setColor(hex, true);

  const light = [-0.2, -0.1, 0, 0.1, 0.2].map((d) =>
    d === 0 ? item(c, 'base', true) : item(at({ l: clamp(S.l + d, 0, 1) }), `L ${d > 0 ? '+' : '−'}${Math.abs(d)}`)
  );
  const chroma = [-0.1, -0.05, 0, 0.05, 0.1].map((d) =>
    d === 0 ? item(c, 'base', true) : item(at({ c: clamp(S.c + d, 0, 0.4) }), `C ${d > 0 ? '+' : '−'}${Math.abs(d)}`)
  );
  const hue = [-60, -30, 0, 30, 60].map((d) =>
    d === 0 ? item(c, 'base', true) : item(at({ h: (S.h + d + 360) % 360 }), `H ${d > 0 ? '+' : '−'}${Math.abs(d)}°`)
  );
  const mixes = [
    item(c.mixOklab('#000000', 0.3), 'mix black'),
    item(c.mixOklab('#ffffff', 0.3), 'mix white'),
    item(c.mixOklab('#808080', 0.5), 'mix gray'),
    item(c.grayscale(), 'grayscale'),
    item(c.invert(), 'invert'),
  ];

  return (
    <>
      <SectionHead
        icon={<SlidersHorizontal size={13} />}
        eyebrow="Adjust"
        title="Shift one channel"
        desc="Steps in OKLCH. Equal steps look equal. Mixes run in OKLab. Click a swatch to use it."
      />
      <div className="manip-grid">
        <Row label="Lightness" items={light} onSelect={onSelect} />
        <Row label="Chroma" items={chroma} onSelect={onSelect} />
        <Row label="Hue" items={hue} onSelect={onSelect} />
        <Row label="Mix" items={mixes} onSelect={onSelect} />
      </div>
    </>
  );
}

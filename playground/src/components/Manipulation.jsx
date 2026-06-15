import { SlidersHorizontal } from 'lucide-react';
import { colordx } from '../lib.js';
import { f } from '../utils.js';
import SectionHead from './SectionHead.jsx';

function swatchOklch(color) {
  const ok = color.toOklch();
  return `oklch(${f(ok.l)} ${f(ok.c)} ${f(ok.h, 2)})`;
}

function ManipRow({ label, items, currentHex, onSelect }) {
  return (
    <div className="card manip-row-card">
      <div className="manip-row-label">{label}</div>
      <div className="manip-swatches">
        {items.map((item) => (
          <div
            key={item.label}
            className={`ms${item.current ? ' ms-current' : ''}`}
            style={{ background: item.bg }}
            title={`${item.label}: ${item.hex}`}
            onClick={() => !item.current && onSelect(item.hex)}
          >
            <span className={`ms-lbl${item.dark ? '' : ' on-light'}`}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function makeItem(color, label, isCurrent = false) {
  const ok = color.toOklch();
  return {
    label,
    current: isCurrent,
    bg: `oklch(${f(ok.l)} ${f(ok.c)} ${f(ok.h, 2)})`,
    hex: color.toHex(),
    dark: color.isDark(),
  };
}

export default function Manipulation({ S, setS }) {
  const c = colordx({ l: S.l, c: S.c, h: S.h, alpha: S.alpha });

  function handleSelect(hex) {
    const p = colordx(hex);
    if (!p.isValid()) return;
    const ok = p.toOklch();
    setS({ l: ok.l, c: ok.c, h: ok.h, alpha: S.alpha });
  }

  const lightItems = [
    makeItem(c.darken(0.2), '−20%'),
    makeItem(c.darken(0.1), '−10%'),
    makeItem(c, 'base', true),
    makeItem(c.lighten(0.1), '+10%'),
    makeItem(c.lighten(0.2), '+20%'),
  ];

  const chromaItems = [
    makeItem(c.desaturate(0.2), '−0.2'),
    makeItem(c.desaturate(0.1), '−0.1'),
    makeItem(c, 'base', true),
    makeItem(c.saturate(0.1), '+0.1'),
    makeItem(c.saturate(0.2), '+0.2'),
  ];

  const hueItems = [
    makeItem(c.rotate(-60), '−60°'),
    makeItem(c.rotate(-30), '−30°'),
    makeItem(c, 'base', true),
    makeItem(c.rotate(30), '+30°'),
    makeItem(c.rotate(60), '+60°'),
  ];

  const effectItems = [
    makeItem(c.grayscale(), 'grayscale'),
    makeItem(c.invert(), 'invert'),
    makeItem(c.mix('#000000', 0.3), '×black'),
    makeItem(c.mix('#ffffff', 0.3), '×white'),
  ];

  return (
    <>
      <SectionHead
        icon={<SlidersHorizontal size={13} />}
        eyebrow="Manipulation"
        title="Adjust & remix"
        desc="Shift lightness, chroma, and hue independently in OKLCH space — perceptually uniform steps that HSL cannot produce. Mix, grayscale, invert, and more. Every method is immutable and chainable. Click a swatch to make it active."
      />
      <div className="manip-grid">
        <ManipRow label="Lightness" items={lightItems} onSelect={handleSelect} />
        <ManipRow label="Chroma" items={chromaItems} onSelect={handleSelect} />
        <ManipRow label="Hue rotation" items={hueItems} onSelect={handleSelect} />
        <ManipRow label="Effects" items={effectItems} onSelect={handleSelect} />
      </div>
    </>
  );
}

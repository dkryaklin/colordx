import { Terminal, HelpCircle, Layers, Contrast, Palette, ArrowRight } from 'lucide-react';
import { Link } from '../router.jsx';
import { SectionHead, CodeBlock } from './ui.jsx';

export function ToolsGrid() {
  const tools = [
    { to: '/palette', icon: <Layers size={16} />, title: 'Palette', desc: 'A ramp, harmonies, and mixes from one seed. Export to CSS, Tailwind, or JSON.' },
    { to: '/contrast', icon: <Contrast size={16} />, title: 'Contrast', desc: 'WCAG and APCA. Fix a pair. See it with color blindness. Keep status colors apart.' },
    { to: '/theme', icon: <Palette size={16} />, title: 'Theme', desc: 'A light and dark theme from three seeds. Every pair checked. shadcn-ready.' },
  ];
  return (
    <div className="tools">
      {tools.map((t) => (
        <Link key={t.to} to={t.to} className="tool">
          <span className="tool-icon">{t.icon}</span>
          <span className="tool-title">{t.title}</span>
          <span className="tool-desc">{t.desc}</span>
          <span className="tool-go">
            Open <ArrowRight size={13} />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function GettingStarted() {
  const convert = `import { colordx } from '@colordx/core';

const color = colordx('#ff6b35');
color.toHex()           // '#ff6b35'
color.toRgbString()     // 'rgb(255 107 53)'
color.toHslString()     // 'hsl(16.04 100% 60.39%)'
color.toOklchString()   // 'oklch(0.70452 0.19259 39.23079)'
color.lighten(0.1).toHex()   // '#ff9068'`;
  const gamut = `import { colordx, inGamutSrgb } from '@colordx/core';

inGamutSrgb('oklch(0.5 0.4 180)')   // false
colordx('oklch(0.5 0.4 180)').toHex()                     // '#00986c'  clipped, like a browser
colordx('oklch(0.5 0.4 180)').mapSrgb().toOklchString()   // 'oklch(0.50907 0.09379 177.84892)'  CSS Color 4`;
  const plugins = `import { colordx, extend } from '@colordx/core';
import a11y from '@colordx/core/plugins/a11y';
import p3 from '@colordx/core/plugins/p3';

extend([a11y, p3]);

colordx('#777').contrast('#fff')          // 4.48
colordx('#777').fixContrast('#fff')       // Colordx at 4.5, same hue
colordx('#ff0000').toP3String()           // 'color(display-p3 0.9175 0.2003 0.1386)'`;
  return (
    <>
      <SectionHead
        icon={<Terminal size={13} />}
        eyebrow="Library"
        title="Use it in code"
        desc="8 KB gzipped. Zero dependencies. Typed. Tree-shakeable. Plugins add what you need and nothing else."
      />
      <div className="gs-steps">
        <div className="gs-step">
          <div className="gs-step-label">Install</div>
          <CodeBlock code="npm install @colordx/core" />
        </div>
        <div className="gs-step">
          <div className="gs-step-label">Convert and adjust</div>
          <CodeBlock code={convert} />
        </div>
        <div className="gs-step">
          <div className="gs-step-label">Gamut</div>
          <CodeBlock code={gamut} />
        </div>
        <div className="gs-step">
          <div className="gs-step-label">Plugins</div>
          <CodeBlock code={plugins} />
        </div>
      </div>
      <div className="cli-links">
        <a href="https://github.com/dkryaklin/colordx#readme" target="_blank" rel="noopener noreferrer">
          Full API ↗
        </a>
        <a href="https://github.com/dkryaklin/colordx#migrating-from-tinycolor2" target="_blank" rel="noopener noreferrer">
          From tinycolor2 ↗
        </a>
      </div>
    </>
  );
}

export function Faq() {
  const items = [
    ['What is OKLCH?', 'A color space where equal steps look equal. L is lightness, C is chroma, H is hue. Change one and the others hold. HSL cannot do that.'],
    ['Why not HSL?', 'HSL lightness is not perceptual. Yellow at 50% is bright, blue at 50% is dark. OKLCH fixes that, so ramps and themes come out even.'],
    ['What is gamut?', 'The set of colors a screen can show. sRGB is the base. P3 is wider. OKLCH can describe colors outside both. The picker shows where the edges are.'],
    ['Clip or map?', 'toHex() clips, like a browser. mapSrgb() reduces chroma and keeps hue and lightness, per CSS Color 4. Use it for tokens and palettes.'],
    ['WCAG or APCA?', 'WCAG 2.2 is the law in most places. APCA is the better model and a WCAG 3 candidate. Check both. The tools here do.'],
    ['Which formats?', 'Core: HEX, RGB, HSL, OKLab, OKLCH. Plugins: HWB, HSV, Lab, LCH, XYZ, CMYK, P3, Rec.2020, A98, ProPhoto, names, contrast, color blindness, mixing.'],
  ];
  return (
    <>
      <SectionHead icon={<HelpCircle size={13} />} eyebrow="FAQ" title="Short answers" />
      <div className="faq-grid">
        {items.map(([q, a]) => (
          <div key={q} className="faq-item">
            <h3 className="faq-q">{q}</h3>
            <p className="faq-a">{a}</p>
          </div>
        ))}
      </div>
    </>
  );
}

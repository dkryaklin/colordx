import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { colordx } from '../lib.js';
import { buildScale, scaleToCss, scaleToJson, scaleToTailwind } from '../scale.js';
import { check } from '../a11y.js';
import { SectionHead, Segmented, ExportBlock, useCopied } from './ui.jsx';

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'color';
}

function Step({ s }) {
  const [copied, copy] = useCopied();
  const onWhite = check(s.hex, '#ffffff', 'body', 'AA');
  const onBlack = check(s.hex, '#000000', 'body', 'AA');
  const dark = colordx(s.hex).isDark();
  return (
    <button type="button" className={`step${s.seed ? ' step-seed' : ''}`} style={{ background: s.hex }} onClick={() => copy(s.hex)} title="Copy">
      <span className={`step-n${dark ? '' : ' on-light'}`}>{s.step}</span>
      <span className={`step-hex${dark ? '' : ' on-light'}`}>{copied ? 'copied' : s.hex}</span>
      <span className="step-badges">
        <span className={`step-badge ${onWhite.wcag ? 'pass' : 'fail'}`} title="WCAG ratio on white">
          W {onWhite.ratio.toFixed(1)}
        </span>
        <span className={`step-badge ${onBlack.wcag ? 'pass' : 'fail'}`} title="WCAG ratio on black">
          B {onBlack.ratio.toFixed(1)}
        </span>
      </span>
    </button>
  );
}

export default function Scale({ hex }) {
  const [format, setFormat] = useState('oklch');
  const ramp = useMemo(() => buildScale(hex), [hex]);
  const name = slug(colordx(hex).toName({ closest: true }) ?? 'color');

  const tabs = [
    { key: 'css', label: 'CSS', code: scaleToCss(ramp, name, format), filename: `${name}.css` },
    { key: 'tw', label: 'Tailwind v4', code: scaleToTailwind(ramp, name, format), filename: `${name}.css` },
    { key: 'json', label: 'JSON', code: scaleToJson(ramp, name, format), filename: `${name}.tokens.json`, hint: 'DTCG format. Style Dictionary and Tokens Studio read it.' },
  ];

  return (
    <>
      <SectionHead
        icon={<Layers size={13} />}
        eyebrow="Scale"
        title="Build a ramp"
        desc="Eleven steps from the active color, 50 to 950. Same shape as Tailwind. Each step shows its WCAG ratio on white and on black. 4.5 passes AA for text."
      />
      <div className="card scale-card">
        <div className="scale-row">
          {ramp.map((s) => (
            <Step key={s.step} s={s} />
          ))}
        </div>
      </div>
      <ExportBlock
        tabs={tabs}
        extra={<Segmented small options={[{ key: 'oklch', label: 'oklch' }, { key: 'hex', label: 'hex' }]} value={format} onChange={setFormat} />}
      />
      <p className="aside">
        Need a step to pass on a given background? <code>npx @colordx/cli scale {hex} --anchor 600:#fff</code> pins it and reshapes the ramp.
      </p>
    </>
  );
}

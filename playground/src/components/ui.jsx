import { useState } from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { colordx } from '../lib.js';
import { copyText, downloadText } from '../utils.js';

export function SectionHead({ icon, eyebrow, title, desc, right }) {
  return (
    <div className="section-head">
      <div className="section-head-main">
        <span className="section-eyebrow">
          {icon}
          {eyebrow}
        </span>
        <h2 className="section-title">{title}</h2>
        {desc ? <p className="section-desc">{desc}</p> : null}
      </div>
      {right ? <div className="section-head-right">{right}</div> : null}
    </div>
  );
}

export function useCopied(delay = 1400) {
  const [copied, setCopied] = useState(false);
  function copy(text) {
    copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), delay);
  }
  return [copied, copy];
}

export function CopyButton({ text, className = 'ibtn', size = 15, label }) {
  const [copied, copy] = useCopied();
  return (
    <button
      type="button"
      className={`${className}${copied ? ' ok' : ''}`}
      onClick={() => copy(text)}
      title="Copy"
      aria-label={label ?? 'Copy'}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
      {label ? <span>{copied ? 'Copied' : label}</span> : null}
    </button>
  );
}

/** Tabs (a segmented control). options: [{ key, label }] */
export function Segmented({ options, value, onChange, small }) {
  return (
    <div className={`seg${small ? ' seg--sm' : ''}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          className={`seg-btn${value === o.key ? ' on' : ''}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A swatch + text input for one color. Accepts any CSS color. */
export function ColorField({ label, value, onChange, hint, allowEmpty = false, placeholder }) {
  const parsed = colordx(value);
  const valid = parsed.isValid();
  const showErr = !valid && !(allowEmpty && value === '');
  const hex = valid ? parsed.mapSrgb().alpha(1).toHex() : '#000000';
  return (
    <div className="cf">
      {label ? <label className="cf-label">{label}</label> : null}
      <div className="cf-row">
        <span className="cf-swatch checker" style={{ '--sw': valid ? value : 'transparent' }}>
          <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={`${label ?? 'color'} picker`} />
        </span>
        <input
          className={`txt${showErr ? ' err' : ''}`}
          value={value}
          placeholder={placeholder}
          spellCheck="false"
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          aria-label={label ?? 'color'}
        />
      </div>
      {hint ? <span className="cf-hint">{hint}</span> : null}
    </div>
  );
}

export function CodeBlock({ code, copy = code, lang }) {
  return (
    <div className="code-block">
      <pre>
        <code data-lang={lang}>{code}</code>
      </pre>
      <CopyButton text={copy} className="code-copy" size={14} />
    </div>
  );
}

/** Tabbed export: tabs = [{ key, label, code, filename, hint }] */
export function ExportBlock({ tabs, extra }) {
  const [key, setKey] = useState(tabs[0].key);
  const tab = tabs.find((t) => t.key === key) ?? tabs[0];
  const [copied, copy] = useCopied();
  return (
    <div className="export">
      <div className="export-bar">
        <Segmented small options={tabs.map((t) => ({ key: t.key, label: t.label }))} value={tab.key} onChange={setKey} />
        <div className="export-actions">
          {extra}
          <button type="button" className={`btn${copied ? ' ok' : ''}`} onClick={() => copy(tab.code)}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="btn" onClick={() => downloadText(tab.filename, tab.code)}>
            <Download size={14} />
            Download
          </button>
        </div>
      </div>
      {tab.hint ? <p className="export-hint">{tab.hint}</p> : null}
      <pre className="export-code">
        <code>{tab.code}</code>
      </pre>
    </div>
  );
}

export function Badge({ ok, children, tone }) {
  const cls = tone ?? (ok ? 'pass' : 'fail');
  return <span className={`a11y-badge ${cls}`}>{children}</span>;
}

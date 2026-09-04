import { useEffect, useMemo, useState } from 'react';
import { Palette, Sun, Moon } from 'lucide-react';
import { colordx } from '../lib.js';
import { defaultNeutral, solveTheme, themeToCss, themeToJson, themeToTailwind, ROLES } from '../theme.js';
import { SectionHead, Segmented, ColorField, ExportBlock, Badge, useCopied } from './ui.jsx';

const LEVEL_OPTS = [{ key: 'AA', label: 'AA' }, { key: 'AAA', label: 'AAA' }];
const MODE_OPTS = [{ key: 'light', label: 'Light' }, { key: 'dark', label: 'Dark' }];

function Preview({ v }) {
  const style = Object.fromEntries(ROLES.map((r) => [`--${r}`, v[r]]));
  return (
    <div className="tp" style={style}>
      <div className="tp-card">
        <div className="tp-title">Invoice #1042</div>
        <div className="tp-text">Sent to Ada Lovelace. Due in 14 days.</div>
        <div className="tp-muted">Paid invoices are archived after 90 days.</div>
        <div className="tp-input">ada@example.com</div>
        <div className="tp-btns">
          <span className="tp-btn tp-primary">Send</span>
          <span className="tp-btn tp-secondary">Save draft</span>
          <span className="tp-btn tp-destructive">Delete</span>
        </div>
      </div>
    </div>
  );
}

function RoleRow({ rec, v }) {
  const [copied, copy] = useCopied();
  const tone = rec.result === 'pass' ? 'pass' : rec.result === 'warn' ? 'warn' : 'fail';
  return (
    <tr>
      <td>
        <button type="button" className="role" onClick={() => copy(v[rec.fg])} title="Copy">
          <i className="dot" style={{ background: v[rec.fg] }} />
          --{rec.fg}
        </button>
      </td>
      <td>
        <button type="button" className="role" onClick={() => copy(v[rec.bg])} title="Copy">
          <i className="dot" style={{ background: v[rec.bg] }} />
          --{rec.bg}
        </button>
      </td>
      <td className="mono">{rec.use}</td>
      <td className="mono">{rec.ratio.toFixed(2)}</td>
      <td className="mono">{rec.lc.toFixed(1)}</td>
      <td>
        <Badge tone={tone}>{copied ? 'copied' : rec.result}</Badge>
        {rec.note && <span className="note"> {rec.note}</span>}
      </td>
    </tr>
  );
}

export default function ThemeBuilder({ hex }) {
  const [primary, setPrimary] = useState(hex);
  const [neutral, setNeutral] = useState('');
  const [destructive, setDestructive] = useState('#e7000b');
  const [level, setLevel] = useState('AA');
  const [mode, setMode] = useState('light');
  const [format, setFormat] = useState('oklch');
  const [followed, setFollowed] = useState(true);

  useEffect(() => {
    if (followed) setPrimary(hex);
  }, [hex, followed]);

  const p = colordx(primary);
  const n = colordx(neutral);
  const d = colordx(destructive);
  const valid = p.isValid() && d.isValid() && (neutral === '' || n.isValid());
  const neutralHex = neutral === '' ? (p.isValid() ? defaultNeutral(p.toHex()) : '#808080') : n.toHex();

  const theme = useMemo(
    () => (valid ? solveTheme({ primary: p.toHex(), neutral: neutralHex, destructive: d.toHex(), level }) : null),
    [valid, primary, neutralHex, destructive, level] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const tabs = theme
    ? [
        { key: 'css', label: 'CSS', code: themeToCss(theme, format), filename: 'theme.css', hint: 'shadcn/ui shape. Works with Tailwind v4 via the @theme inline block.' },
        { key: 'tw', label: 'Tailwind v4', code: themeToTailwind(theme, format), filename: 'theme.css', hint: 'Plain Tailwind v4, without shadcn.' },
        { key: 'json', label: 'JSON', code: themeToJson(theme, format), filename: 'theme.tokens.json', hint: 'DTCG format. Style Dictionary and Tokens Studio read it, and Tokens Studio pushes it into Figma variables.' },
      ]
    : [];

  const fails = theme ? Object.values(theme).flatMap((m) => m.records).filter((r) => r.result !== 'pass').length : 0;

  return (
    <>
      <SectionHead
        icon={<Palette size={13} />}
        eyebrow="Theme"
        title="Build a theme"
        desc="Three seeds in. Nineteen roles out, in light and dark. Every text color is moved until it passes WCAG and APCA on its background. Dark is solved, not inverted."
        right={<Segmented small options={LEVEL_OPTS} value={level} onChange={setLevel} />}
      />
      <div className="theme-grid">
        <div className="card theme-seeds">
          <ColorField
            label="Primary"
            value={primary}
            onChange={(v) => {
              setFollowed(false);
              setPrimary(v);
            }}
            hint={followed ? 'Follows the active color.' : undefined}
          />
          <ColorField label="Neutral" value={neutral} onChange={setNeutral} allowEmpty placeholder="auto" hint={neutral === '' ? `Empty means from primary: ${neutralHex}` : undefined} />
          <ColorField label="Destructive" value={destructive} onChange={setDestructive} />
          {!followed && (
            <button type="button" className="btn" onClick={() => setFollowed(true)}>
              Use active color
            </button>
          )}
        </div>
        <div className="card theme-preview-card">
          <div className="theme-preview-bar">
            <Segmented small options={MODE_OPTS.map((o) => ({ ...o, label: o.label }))} value={mode} onChange={setMode} />
            <span className="theme-status">
              {mode === 'light' ? <Sun size={13} /> : <Moon size={13} />}
              {theme ? (fails === 0 ? 'every pair passes' : `${fails} pair${fails === 1 ? '' : 's'} need a look`) : 'seeds need a color'}
            </span>
          </div>
          {theme && <Preview v={theme[mode].values} />}
        </div>
      </div>

      {theme && (
        <>
          <div className="card table-card">
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Text</th>
                    <th>Background</th>
                    <th>Use</th>
                    <th>WCAG</th>
                    <th>APCA</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {theme[mode].records.map((rec) => (
                    <RoleRow key={rec.fg} rec={rec} v={theme[mode].values} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ExportBlock
            tabs={tabs}
            extra={<Segmented small options={[{ key: 'oklch', label: 'oklch' }, { key: 'hex', label: 'hex' }]} value={format} onChange={setFormat} />}
          />
          <p className="aside">
            Same solver as <code>npx @colordx/cli theme --primary {p.isValid() ? p.toHex() : '#3b82f6'}</code>. Run it in CI to keep the theme honest.
          </p>
        </>
      )}
    </>
  );
}

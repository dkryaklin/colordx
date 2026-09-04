import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { colordx } from '../lib.js';
import { CVD_TYPES, THRESHOLDS } from '../a11y.js';
import { SectionHead, ColorField, Badge } from './ui.jsx';

const DEFAULT = ['#16a34a', '#f59e0b', '#dc2626'];
const LABELS = ['Success', 'Warning', 'Error'];

export default function StatusSet() {
  const [colors, setColors] = useState(DEFAULT);
  const parsed = colors.map((c) => colordx(c));
  const valid = parsed.every((p) => p.isValid());
  const pairs = [[0, 1], [0, 2], [1, 2]];
  const d = THRESHOLDS.cvdDistinct;

  const set = (i) => (v) => setColors((prev) => prev.map((c, j) => (j === i ? v : c)));

  return (
    <>
      <SectionHead
        icon={<CircleAlert size={13} />}
        eyebrow="Status colors"
        title="Keep them apart"
        desc={`Success, warning, and error must stay distinct for every viewer. Each pair is simulated for the three types. ΔE under ${d} means they look the same.`}
      />
      <div className="card status-card">
        <div className="status-fields">
          {colors.map((c, i) => (
            <ColorField key={i} label={LABELS[i]} value={c} onChange={set(i)} />
          ))}
        </div>
        {valid ? (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th>Normal</th>
                  {CVD_TYPES.map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pairs.map(([i, j]) => {
                  const a = parsed[i];
                  const b = parsed[j];
                  const cell = (x, y) => {
                    const v = x.delta(y, 6) * 100;
                    return (
                      <td key={`${i}${j}${x.toHex()}`}>
                        <span className="pair-dots">
                          <i style={{ background: x.toHex() }} />
                          <i style={{ background: y.toHex() }} />
                        </span>
                        <Badge tone={v < d ? 'warn' : 'pass'}>ΔE {v.toFixed(0)}</Badge>
                      </td>
                    );
                  };
                  return (
                    <tr key={`${i}-${j}`}>
                      <td>{LABELS[i]} · {LABELS[j]}</td>
                      {cell(a, b)}
                      {CVD_TYPES.map((t) => cell(a.simulate(t), b.simulate(t)))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">All three fields need a color.</p>
        )}
      </div>
    </>
  );
}

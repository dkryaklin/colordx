import { useEffect, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { useColor } from '../color-state.jsx';
import { Link } from '../router.jsx';
import { oklchCss, randomOklch } from '../utils.js';
import { CopyButton } from './ui.jsx';

/** The active color, on every tool page: swatch, editable value, random. */
export default function ActiveBar() {
  const { S, setS, setColor, hex } = useColor();
  const css = oklchCss(S);
  const [val, setVal] = useState(css);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setVal(css);
  }, [css, focus]);

  return (
    <div className="active-bar">
      <div className="active-inner">
        <span className="active-sw" style={{ background: hex }} />
        <span className="active-lbl">Active color</span>
        <input
          className="txt active-txt"
          value={val}
          spellCheck="false"
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            setVal(css);
          }}
          onChange={(e) => {
            setVal(e.target.value);
            setColor(e.target.value.trim());
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="Active color"
        />
        <CopyButton text={css} />
        <button type="button" className="ibtn" title="Random color" aria-label="Random color" onClick={() => setS(randomOklch())}>
          <Shuffle size={15} />
        </button>
        <Link to="/" className="active-link">
          Open in picker
        </Link>
      </div>
    </div>
  );
}

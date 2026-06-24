import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Grid2x2 } from 'lucide-react';
import { createChartRenderer } from '@colordx/gpu';
import { inGamutSrgb } from '../lib.js';
import { f, clamp } from '../utils.js';

const C_MAX = 0.37;
const DPR = Math.max(1, Math.round(window.devicePixelRatio || 1));

// sRGB edge is always drawn; each wider gamut, when toggled on, fills its
// region and draws its own boundary line in a distinct color. cMax is how far
// the chroma axis must stretch to show that gamut's slice. Gamuts are
// independent layers in @colordx/gpu ≥0.4 — a98 and p3 are siblings, so their
// boundaries genuinely cross.
const SRGB_BORDER = [1, 1, 1, 0.92];
const GAMUTS = {
  p3: { label: 'P3', border: [0.4, 1, 0.62, 0.9], cMax: 0.37 },
  a98: { label: 'A98', border: [0.35, 0.85, 1, 0.92], cMax: 0.4 },
  rec2020: { label: 'Rec.2020', border: [0.78, 0.52, 1, 0.9], cMax: 0.47 },
  prophoto: { label: 'ProPhoto', border: [1, 0.66, 0.26, 0.92], cMax: 0.57 },
};
const GAMUT_ORDER = ['p3', 'a98', 'rec2020', 'prophoto'];

// Each chart is one slice plane of OKLCH space. `plane` matches @colordx/gpu's
// renderer: 'ch' = hue×chroma (fixed L), 'lh' = hue×lightness (fixed C),
// 'cl' = lightness×chroma (fixed H). mx/my map S → marker position (0–1),
// set maps a drag (0–1, bottom-left origin) back into S. Every component is an
// axis on two charts, so dragging alone reaches all of L/C/H.
const CHARTS = [
  {
    key: 'L', plane: 'ch', title: 'Hue × Chroma', fixed: 'L',
    xLabel: 'Hue →', yLabel: '↑ Chroma',
    val: (S) => S.l, valFmt: (S) => f(S.l, 3),
    xMax: () => 360, yMax: (cm) => cm,
    mx: (S) => S.h / 360, my: (S, cm) => S.c / cm,
    set: (nx, ny, cm) => ({ h: clamp(nx * 360, 0, 360), c: clamp(ny * cm, 0, cm) }),
  },
  {
    key: 'C', plane: 'lh', title: 'Hue × Lightness', fixed: 'C',
    xLabel: 'Hue →', yLabel: '↑ Lightness',
    val: (S) => S.c, valFmt: (S) => f(S.c, 3),
    xMax: () => 360, yMax: () => 1,
    mx: (S) => S.h / 360, my: (S) => S.l,
    set: (nx, ny) => ({ h: clamp(nx * 360, 0, 360), l: clamp(ny, 0, 1) }),
  },
  {
    key: 'H', plane: 'cl', title: 'Lightness × Chroma', fixed: 'H',
    xLabel: 'Lightness →', yLabel: '↑ Chroma',
    val: (S) => S.h, valFmt: (S) => f(S.h, 1) + '°',
    xMax: () => 1, yMax: (cm) => cm,
    mx: (S) => S.l, my: (S, cm) => S.c / cm,
    set: (nx, ny, cm) => ({ l: clamp(nx, 0, 1), c: clamp(ny * cm, 0, cm) }),
  },
];

function ChartCard({ cfg, S, setS, gamuts, cm }) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const draggingRef = useRef(false);

  const paint = useCallback(() => {
    const r = rendererRef.current;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!r || !canvas || !stage) return;
    // keep the backing store in sync with the (responsive) CSS box
    const w = Math.max(1, Math.round(stage.clientWidth * DPR));
    const h = Math.max(1, Math.round(stage.clientHeight * DPR));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    r.paint({
      plane: cfg.plane,
      value: cfg.val(S),
      xMax: cfg.xMax(cm),
      yMax: cfg.yMax(cm),
      gamuts,
      borderWidth: 2,
    });
  }, [cfg, S, gamuts, cm]);

  // keep a stable ref so the ResizeObserver never needs re-subscribing
  const paintRef = useRef(paint);
  paintRef.current = paint;

  // create the WebGL2 renderer once (destroy() is StrictMode-safe — it keeps
  // the context so a remount on the same canvas can recreate the program)
  useEffect(() => {
    rendererRef.current = createChartRenderer(canvasRef.current, { model: 'oklch' });
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  // repaint on any state/toggle change
  useEffect(() => {
    paint();
  }, [paint]);

  // repaint on resize
  useEffect(() => {
    const ro = new ResizeObserver(() => paintRef.current());
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []);

  const onPointer = useCallback(
    (e) => {
      const rect = stageRef.current.getBoundingClientRect();
      const nx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const ny = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
      setS((prev) => ({ ...prev, ...cfg.set(nx, ny, cm) }));
    },
    [cfg, setS, cm],
  );

  function handleDown(e) {
    draggingRef.current = true;
    stageRef.current.setPointerCapture(e.pointerId);
    onPointer(e);
  }
  function handleMove(e) {
    if (draggingRef.current) onPointer(e);
  }
  function handleUp(e) {
    draggingRef.current = false;
    stageRef.current.releasePointerCapture(e.pointerId);
  }

  const inGamut = inGamutSrgb({ l: S.l, c: S.c, h: S.h, alpha: 1 });
  const markerStyle = {
    left: `${cfg.mx(S, cm) * 100}%`,
    top: `${(1 - cfg.my(S, cm)) * 100}%`,
    background: `oklch(${f(S.l)} ${f(S.c)} ${f(S.h, 2)})`,
  };

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <span className="chart-title">{cfg.title}</span>
        <span className="chart-fixed">
          {cfg.fixed} <b>{cfg.valFmt(S)}</b>
        </span>
      </div>
      <div
        className="chart-stage"
        ref={stageRef}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
      >
        <canvas ref={canvasRef} className="chart-canvas" />
        <span className="chart-axis chart-axis-y">{cfg.yLabel}</span>
        <span className="chart-axis chart-axis-x">{cfg.xLabel}</span>
        <div className={`chart-marker${inGamut ? '' : ' out'}`} style={markerStyle} />
      </div>
    </div>
  );
}

export default function GamutCharts({ S, setS, showP3, setShowP3, showRec2020, setShowRec2020 }) {
  // a98 / prophoto live locally — they only drive the GPU charts, not the rest
  // of the app, so there's no need to thread them through App state.
  const [showA98, setShowA98] = useState(false);
  const [showProphoto, setShowProphoto] = useState(false);

  const on = { p3: showP3, a98: showA98, rec2020: showRec2020, prophoto: showProphoto };
  const set = {
    p3: setShowP3,
    a98: setShowA98,
    rec2020: setShowRec2020,
    prophoto: setShowProphoto,
  };

  const gamuts = useMemo(() => {
    const layers = [{ space: 'srgb', fill: true, border: SRGB_BORDER }];
    for (const g of GAMUT_ORDER) {
      if (on[g]) layers.push({ space: g, fill: true, border: GAMUTS[g].border });
    }
    return layers;
  }, [showP3, showA98, showRec2020, showProphoto]);

  const cm = useMemo(
    () => Math.max(C_MAX, ...GAMUT_ORDER.filter((g) => on[g]).map((g) => GAMUTS[g].cMax)),
    [showP3, showA98, showRec2020, showProphoto],
  );

  return (
    <div className="charts-stack">
      <div className="charts-bar">
        <span className="charts-bar-title">
          <Grid2x2 size={15} />
          Gamut slices
        </span>
        <div className="charts-toggles">
          {GAMUT_ORDER.map((g) => (
            <label key={g}>
              <input type="checkbox" checked={on[g]} onChange={(e) => set[g](e.target.checked)} />{' '}
              {GAMUTS[g].label}
            </label>
          ))}
        </div>
      </div>
      <div className="charts-col">
        {CHARTS.map((cfg) => (
          <ChartCard key={cfg.key} cfg={cfg} S={S} setS={setS} gamuts={gamuts} cm={cm} />
        ))}
      </div>
    </div>
  );
}

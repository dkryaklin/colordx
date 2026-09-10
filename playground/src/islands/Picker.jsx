import { useState } from 'react';
import { useColor } from '../color-state.jsx';
import { randomOklch } from '../utils.js';
import AppSection from '../components/AppSection.jsx';
import GamutCharts from '../components/GamutCharts.jsx';

export default function Picker() {
  const { S, setS, setColor } = useColor();
  const [showP3, setShowP3] = useState(true);
  const [showRec2020, setShowRec2020] = useState(false);

  return (
    <div className="ws-grid">
      <div className="studio-controls">
        <AppSection S={S} setS={setS} setColor={setColor} onRandom={() => setS(randomOklch())} />
      </div>
      <div className="studio-charts">
        <GamutCharts
          S={S}
          setS={setS}
          showP3={showP3}
          setShowP3={setShowP3}
          showRec2020={showRec2020}
          setShowRec2020={setShowRec2020}
        />
      </div>
    </div>
  );
}

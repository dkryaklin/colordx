import { useState } from 'react';
import { Pipette, Wrench } from 'lucide-react';
import { useColor } from '../color-state.jsx';
import { useTitle } from '../router.jsx';
import { randomOklch } from '../utils.js';
import { SectionHead } from '../components/ui.jsx';
import AppSection from '../components/AppSection.jsx';
import GamutCharts from '../components/GamutCharts.jsx';
import Adjust from '../components/Adjust.jsx';
import { ToolsGrid, GettingStarted, Faq } from '../components/Content.jsx';
import Cli from '../components/Cli.jsx';

export default function Home() {
  useTitle('colordx · OKLCH color picker, contrast and theme tools');
  const { S, setS, setColor } = useColor();
  const [showP3, setShowP3] = useState(true);
  const [showRec2020, setShowRec2020] = useState(false);

  return (
    <>
      <section className="workstation" id="picker">
        <SectionHead
          icon={<Pipette size={13} />}
          eyebrow="OKLCH picker"
          title="Pick a color"
          desc="Drag a chart. Each one sets two channels. Or paste any CSS color. Every format below is one click to copy."
        />
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
      </section>

      <section className="section" id="adjust">
        <Adjust S={S} setColor={setColor} />
      </section>

      <section className="section" id="tools">
        <SectionHead icon={<Wrench size={13} />} eyebrow="Tools" title="Take it further" desc="The active color follows you to every page." />
        <ToolsGrid />
      </section>

      <section className="section" id="library">
        <GettingStarted />
      </section>

      <section className="section" id="cli">
        <Cli />
      </section>

      <section className="section" id="faq">
        <Faq />
      </section>
    </>
  );
}

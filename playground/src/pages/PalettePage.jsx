import { useColor } from '../color-state.jsx';
import { useTitle } from '../router.jsx';
import ActiveBar from '../components/ActiveBar.jsx';
import Scale from '../components/Scale.jsx';
import Harmonies from '../components/Harmonies.jsx';
import Mixer from '../components/Mixer.jsx';

export default function PalettePage() {
  useTitle('Palette · colordx');
  const { S, setColor, hex } = useColor();
  return (
    <>
      <ActiveBar />
      <section className="section" id="scale">
        <Scale hex={hex} />
      </section>
      <section className="section" id="harmonies">
        <Harmonies S={S} setColor={setColor} />
      </section>
      <section className="section" id="mix">
        <Mixer hex={hex} />
      </section>
    </>
  );
}

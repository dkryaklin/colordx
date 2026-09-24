import { useColor } from '../color-state.jsx';
import ActiveBar from '../components/ActiveBar.jsx';
import Scale from '../components/Scale.jsx';
import Harmonies from '../components/Harmonies.jsx';
import Mixer from '../components/Mixer.jsx';

export default function PaletteApp() {
  const { S, setColor, hex, color } = useColor();
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
        {/* keeps the active alpha, so the mix shows premultiplied blending */}
        <Mixer hex={color.mapSrgb().toHex()} />
      </section>
    </>
  );
}

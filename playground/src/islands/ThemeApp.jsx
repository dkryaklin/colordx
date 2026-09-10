import { useColor } from '../color-state.jsx';
import ActiveBar from '../components/ActiveBar.jsx';
import ThemeBuilder from '../components/ThemeBuilder.jsx';

export default function ThemeApp() {
  const { hex } = useColor();
  return (
    <>
      <ActiveBar />
      <section className="section" id="theme">
        <ThemeBuilder hex={hex} />
      </section>
    </>
  );
}

import { useColor } from '../color-state.jsx';
import { useTitle } from '../router.jsx';
import ActiveBar from '../components/ActiveBar.jsx';
import ThemeBuilder from '../components/ThemeBuilder.jsx';

export default function ThemePage() {
  useTitle('Theme · colordx');
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

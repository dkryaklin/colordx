import { useColor } from '../color-state.jsx';
import ActiveBar from '../components/ActiveBar.jsx';
import ContrastChecker from '../components/ContrastChecker.jsx';
import StatusSet from '../components/StatusSet.jsx';

export default function ContrastApp() {
  const { hex } = useColor();
  return (
    <>
      <ActiveBar />
      <section className="section" id="check">
        <ContrastChecker hex={hex} />
      </section>
      <section className="section" id="status">
        <StatusSet />
      </section>
    </>
  );
}

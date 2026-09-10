import { useColor } from '../color-state.jsx';
import Adjust from '../components/Adjust.jsx';

export default function AdjustSection() {
  const { S, setColor } = useColor();
  return <Adjust S={S} setColor={setColor} />;
}

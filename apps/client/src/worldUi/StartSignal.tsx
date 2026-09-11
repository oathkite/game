import start from "../../../../assets/runtime/world-v1/start.webp";
import "./startSignal.css";
export const StartSignal = ({ visible }: { readonly visible: boolean }) => visible
  ? <div className="battle-start" role="status" aria-label="START!"><img src={start} alt="" /></div> : null;

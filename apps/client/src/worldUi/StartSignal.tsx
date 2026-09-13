import "./startSignal.css";
export const StartSignal = ({ visible }: { readonly visible: boolean }) => visible
  ? <div className="battle-start" role="status" aria-label="START!"><strong style={{ color: "#33ff66", background: "#000", border: "2px solid currentColor", padding: "12px 28px", fontFamily: "var(--font-jp)", fontSize: "clamp(28px, 6vw, 64px)" }}>START!</strong></div> : null;

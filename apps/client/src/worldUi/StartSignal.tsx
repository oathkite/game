import { useState } from "react";
import { charCount, prefersReducedMotion, typedText } from "./motion";
import { useTicks } from "./useTicks";
import "./startSignal.css";

export const START_TEXT = "START!";
export const START_TYPE_MS = 40;

/** 1 文字 40 ms で打ち出す。まだ出ていない文字は場所だけ取って枠の大きさを保つ。 */
const StartText = () => {
  const [reduced] = useState(prefersReducedMotion);
  const typed = typedText(START_TEXT, useTicks(START_TYPE_MS, charCount(START_TEXT), !reduced) * START_TYPE_MS, START_TYPE_MS);
  return <strong aria-hidden="true" style={{ color: "#33ff66", background: "#000", border: "2px solid currentColor", padding: "12px 28px", fontFamily: "var(--font-jp)", fontSize: "clamp(28px, 6vw, 64px)" }}>
    {typed}<span className="battle-start-rest">{START_TEXT.slice(typed.length)}</span>
  </strong>;
};

export const StartSignal = ({ visible }: { readonly visible: boolean }) => visible
  ? <div className="battle-start" role="status" aria-label={START_TEXT}><span className="battle-start-sr">{START_TEXT}</span><StartText /></div> : null;

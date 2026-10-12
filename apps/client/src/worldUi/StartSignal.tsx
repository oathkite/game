import { useState } from "react";
import { charCount, prefersReducedMotion, typedText } from "./motion";
import { useTicks } from "./useTicks";
import "./startSignal.css";
import "./roomFlow.css";

export const START_TEXT = "START!";
export const START_TYPE_MS = 40;

/** 1 文字 40 ms で打ち出す。まだ出ていない文字は場所だけ取って枠の大きさを保つ。 */
const StartText = () => {
  const [reduced] = useState(prefersReducedMotion);
  const typed = typedText(START_TEXT, useTicks(START_TYPE_MS, charCount(START_TEXT), !reduced) * START_TYPE_MS, START_TYPE_MS);
  // 見た目は roomFlow.css のトークンから取る（設計書 45.6）
  return <strong aria-hidden="true" className="battle-start-text">
    {typed}<span className="battle-start-rest">{START_TEXT.slice(typed.length)}</span>
  </strong>;
};

export const StartSignal = ({ visible }: { readonly visible: boolean }) => visible
  ? <div className="battle-start" role="status" aria-label={START_TEXT}><span className="battle-start-sr">{START_TEXT}</span><StartText /></div> : null;

import { useState, type JSX } from "react";
import { charCount, prefersReducedMotion, typedText } from "./motion";
import { filledDots, LOADING_DELAY_MS, LOADING_DOTS, LOADING_TYPE_MS, loadingAnnouncement, showsProgress, type LoadingStep } from "./sceneLoadingModel";
import { useTicks } from "./useTicks";
import "./sceneLoading.css";

export type { LoadingStep } from "./sceneLoadingModel";

const LEADER = " ......";

const ActiveLine = ({ label }: { readonly label: string }) => {
  const [reduced] = useState(prefersReducedMotion);
  const typed = useTicks(LOADING_TYPE_MS, charCount(label), !reduced);
  return <>{typedText(label, typed * LOADING_TYPE_MS, LOADING_TYPE_MS)}<span className="scene-loading-cursor" /></>;
};

const StepLine = ({ step }: { readonly step: LoadingStep }) => <li data-state={step.state}>
  <span className="scene-loading-prompt">&gt; </span>
  {step.state === "active" ? <ActiveLine label={step.label} /> : <>{step.label}{LEADER} <b>{step.state === "done" ? "OK" : "NG"}</b></>}
</li>;

const ProgressDots = ({ filled }: { readonly filled: number }) => <span className="scene-loading-dots">
  {Array.from({ length: LOADING_DOTS }, (_, index) => <i key={index} data-filled={index < filled} />)}
</span>;

/** 表示の遅延を済ませたあとの見た目。遅延なしで描けるので静的な描画のテストにも使う。 */
export const SceneLoadingView = ({ steps, className }: { readonly steps: readonly LoadingStep[]; readonly className?: string | undefined }): JSX.Element | null => {
  if (steps.length === 0) return null;
  return <div className={`scene-loading${className ? ` ${className}` : ""}`} role="status">
    <span className="scene-loading-sr">{loadingAnnouncement(steps)}</span>
    <ol aria-hidden="true">{steps.map((step, index) => <StepLine key={`${index}:${step.label}`} step={step} />)}</ol>
    {showsProgress(steps) && <ProgressDots filled={filledDots(steps)} />}
  </div>;
};

/** 端末ログ風の待ち表示。150 ms 以内に消える待ちでは何も出さない。 */
export const SceneLoading = ({ steps, className }: { readonly steps: readonly LoadingStep[]; readonly className?: string }): JSX.Element | null => {
  const shown = useTicks(LOADING_DELAY_MS, 1) === 1;
  return shown ? <SceneLoadingView steps={steps} className={className} /> : null;
};

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./motion";
import { listenForSkip, RESULT_COUNT_STEP_MS, resultMotionEndMs } from "./resultMotion";
import { useTicks } from "./useTicks";

/**
 * リザルトの経過時間（delayMs の後を 0 とする）。動きが終わったら playing を下ろす。
 * 動きを減らす設定では最初から、クリックかキー入力の後はその場で最後の姿にする。
 */
export const useResultMotion = (rows: number, delayMs = 0): { readonly playing: boolean; readonly elapsedMs: number } => {
  const [reduced] = useState(prefersReducedMotion);
  const [skipped, setSkipped] = useState(false);
  const steps = Math.ceil((delayMs + resultMotionEndMs(rows)) / RESULT_COUNT_STEP_MS);
  const tick = useTicks(RESULT_COUNT_STEP_MS, steps, !reduced && !skipped);
  const playing = tick < steps;
  useEffect(() => playing ? listenForSkip(window, () => setSkipped(true)) : undefined, [playing]);
  return { playing, elapsedMs: tick * RESULT_COUNT_STEP_MS - delayMs };
};

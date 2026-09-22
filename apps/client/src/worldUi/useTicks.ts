import { useEffect, useState } from "react";
import { startTicker } from "./motion";

/**
 * マウントから stepMs ごとに 0..steps と数える。running が false なら最初から steps を返す。
 * 刻みの長さ・数・running が変わったら 0 から数え直す。同じ設定で数え直したいときは呼び出し側で key を変えて作り直す。
 */
export const useTicks = (stepMs: number, steps: number, running = true): number => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick(0);
    return running ? startTicker(stepMs, steps, setTick) : undefined;
  }, [stepMs, steps, running]);
  return running ? Math.min(tick, steps) : steps;
};

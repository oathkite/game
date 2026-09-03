import { handle } from "./engine.js";
import type { Effect, EngineEvent, EngineState } from "./types.js";

// エンジンを時計とタイマーにつなぐ薄い殻。サーバーとクライアントの solo モードが共有する。
// 時計とタイマーは注入するので、テストでは偽の時計で進められる。

export type Clock = {
  readonly now: () => number;
  /** 指定時刻に fn を呼ぶ。返り値で取り消す */
  readonly schedule: (at: number, fn: () => void) => () => void;
};

export const realClock: Clock = {
  now: () => Date.now(),
  schedule: (at, fn) => {
    const id = setTimeout(fn, Math.max(0, at - Date.now()));
    return () => clearTimeout(id);
  },
};

export type MatchHost = {
  readonly state: () => EngineState;
  readonly dispatch: (event: EngineEvent) => readonly Effect[];
  readonly stop: () => void;
};

/**
 * エンジンを動かす。dispatch のたびに effects を onEffect へ渡し、wakeAt にあわせて tick を予約する。
 */
export const createMatchHost = (initial: EngineState, clock: Clock, onEffect: (effect: Effect) => void): MatchHost => {
  let state = initial;
  let cancel: (() => void) | null = null;
  let stopped = false;

  const arm = (wakeAt: number | null): void => {
    if (cancel) cancel();
    cancel = null;
    if (wakeAt === null || stopped) return;
    cancel = clock.schedule(wakeAt, () => {
      cancel = null;
      dispatch({ type: "tick" });
    });
  };

  const dispatch = (event: EngineEvent): readonly Effect[] => {
    if (stopped) return [];
    const step = handle(state, event, clock.now());
    state = step.state;
    for (const e of step.effects) onEffect(e);
    arm(step.wakeAt);
    return step.effects;
  };

  return {
    state: () => state,
    dispatch,
    stop: () => {
      stopped = true;
      if (cancel) cancel();
      cancel = null;
    },
  };
};

import { TURN_LIMIT, TURN_SECONDS } from "@game/protocol";
import type { EngineConfig } from "./types.js";

export type EngineTiming = Omit<EngineConfig, "rng">;

/** 設計書 01、04 の初期値 */
export const DEFAULT_ENGINE_TIMING: EngineTiming = {
  turnMs: TURN_SECONDS * 1000,
  graceMs: 1000,
  replayWaitMs: 10_000,
  reconnectWaitMs: 60_000,
  turnLimit: TURN_LIMIT,
};

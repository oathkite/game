import type { ClientMessageOf, Seat, ServerMessage } from "@game/protocol";
import { createEngine, DEFAULT_ENGINE_TIMING, handle, type Effect, type EngineState, type Step } from "../src/index.js";

// rng を 0.5 に固定すると、左右の入れ替えなし、先攻は席 0、風は 0 のまま変わらない。

export const fixedRng = (): number => 0.5;

export const newEngine = (rng: () => number = fixedRng): EngineState =>
  createEngine(
    { ...DEFAULT_ENGINE_TIMING, rng },
    {
      roomCode: "ABCDEF",
      mapName: "valley",
      players: [
        { nickname: "alpha", colors: { primary: "red", secondary: "red" } },
        { nickname: "beta", colors: { primary: "blue", secondary: "blue" } },
      ],
    },
  );

/** 両者が読み込みを終え、最初のターンが始まった状態 */
export const started = (t0 = 1_000_000): Step => {
  const a = handle(newEngine(), { type: "loaded", seat: 0 }, t0);
  return handle(a.state, { type: "loaded", seat: 1 }, t0);
};

export const fireMsg = (state: EngineState, seat: Seat, over: Partial<ClientMessageOf<"turn.fire">> = {}): ClientMessageOf<"turn.fire"> => ({
  type: "turn.fire",
  facing: state.match.players[seat].facing,
  elevation: 45,
  power: 50,
  x: state.match.players[seat].x,
  ...over,
});

export const types = (effects: readonly Effect[]): string[] => effects.map((e) => e.message.type);

export const find = <T extends ServerMessage["type"]>(effects: readonly Effect[], type: T): Extract<ServerMessage, { type: T }> | undefined =>
  effects.map((e) => e.message).find((m): m is Extract<ServerMessage, { type: T }> => m.type === type);

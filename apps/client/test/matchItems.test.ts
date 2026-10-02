import { createEngine, DEFAULT_ENGINE_TIMING, handle, setupMessage } from "@game/engine";
import type { ClientMessageOf, ServerMessage, ServerMessageOf } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { applyItem } from "@/match/control";
import { reduce, type ReduceOptions } from "@/match/reduce";
import { EMPTY_VIEW, type MatchView } from "@/match/types";

// 2 人対戦の表示状態のアイテム（設計書 42）。選び方、再計算の一致、使用済みの記録、ダブルシュートの 1 発目の終わり

const opts: ReduceOptions = { followCurrentSeat: false, mySeat: 0, spectator: false };
const state = createEngine({ ...DEFAULT_ENGINE_TIMING, rng: () => 0.5 }, {
  roomCode: "ABCDEF", mapName: "valley",
  players: [
    { nickname: "a", colors: { primary: "red", secondary: "red" }, loadout: ["cannon", "digger"] },
    { nickname: "b", colors: { primary: "blue", secondary: "blue" }, loadout: ["triple", "floater"] },
  ],
});
const apply = (view: MatchView, messages: readonly ServerMessage[]): MatchView => messages.reduce((v, m, i) => reduce(v, m, opts, i + 1).view, view);
const begin = () => {
  const s2 = handle(handle(state, { type: "loaded", seat: 0 }, 0).state, { type: "loaded", seat: 1 }, 0);
  return { engine: s2.state, view: apply(EMPTY_VIEW, [setupMessage(state), s2.effects[0]!.message]) };
};
const fire = (patch: Partial<ClientMessageOf<"turn.fire">>): ClientMessageOf<"turn.fire"> => ({ type: "turn.fire", slot: 0, facing: 1, elevation: 45, power: 60, x: 75, ...patch });

describe("アイテムの選択", () => {
  it("自分の手番の間だけ選べ、null で外せる。手番の始めは選んでいない", () => {
    const { view } = begin();
    expect(view.control?.item).toBeNull();
    const chosen = applyItem(view, "double");
    expect(chosen.control?.item).toBe("double");
    expect(applyItem(chosen, null).control?.item).toBeNull();
    expect(applyItem({ ...view, phase: "waiting" }, "double")).toEqual({ ...view, phase: "waiting" });
  });

  it("使い終えたアイテムは選べない", () => {
    const { view } = begin();
    const used: MatchView = { ...view, players: [{ ...view.players![0], itemsUsed: ["teleport"] }, view.players![1]] };
    expect(applyItem(used, "teleport")).toBe(used);
    expect(applyItem(used, "double").control?.item).toBe("double");
  });
});

describe("アイテムを使った結果", () => {
  for (const item of ["double", "teleport"] as const) {
    it(`${item} の結果を再計算してサーバーと一致し、撃った側の使用済みに足す`, () => {
      const { engine, view } = begin();
      const fired = handle(engine, { type: "fire", seat: 0, fire: fire({ item }) }, 1000);
      const result = fired.effects[0]!.message as ServerMessageOf<"turn.result">;
      const r = reduce(view, result, opts, 3);
      expect(r.mismatch).toBe(false);
      expect(r.view.replay!.playersAfter[0].itemsUsed).toEqual([item]);
      expect(r.view.replay!.playersAfter[1].itemsUsed).toBeUndefined();
    });
  }

  it("ダブルシュートで 2 発目を撃ったら、再生に 1 発目の終わりを持たせる", () => {
    const { engine, view } = begin();
    const result = handle(engine, { type: "fire", seat: 0, fire: fire({ item: "double" }) }, 1000).effects[0]!.message as ServerMessageOf<"turn.result">;
    const job = reduce(view, result, opts, 3).view.replay!;
    expect(job.firstShot?.paths).toBe(1);
    expect(job.paths).toHaveLength(2);
    expect(job.firstShot?.positions).toHaveLength(2);
  });
});

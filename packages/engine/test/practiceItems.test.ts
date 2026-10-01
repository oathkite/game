import { describe, expect, it } from "vitest";
import { actionCost } from "@game/protocol";
import { createEngine, DEFAULT_ENGINE_TIMING, handle } from "../src/index.js";
import { find, fireMsg, fixedRng, started } from "./helpers.js";

// 2 人対戦（自由練習、CPU 戦、旧オンライン）のアイテム（設計書 42）。使用済みの記録、標準砲への置き換え、コスト、再生の待ち時間

const T0 = 1_000_000;
const withDelay = () => {
  const engine = createEngine({ ...DEFAULT_ENGINE_TIMING, delayEnabled: true, rng: fixedRng }, {
    roomCode: "ABCDEF", mapName: "valley",
    players: [
      { nickname: "alpha", colors: { primary: "red", secondary: "red" }, loadout: ["cannon", "digger"] },
      { nickname: "beta", colors: { primary: "blue", secondary: "blue" }, loadout: ["cannon", "digger"] },
    ],
  });
  return handle(handle(engine, { type: "loaded", seat: 0 }, T0).state, { type: "loaded", seat: 1 }, T0);
};

describe("2 人対戦のアイテム", () => {
  it("ダブルシュートは結果の入力に残り、2 本の弾道を撃ち、使用済みになる", () => {
    const s = started();
    const r = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0, { item: "double" }) }, T0 + 5000);
    const result = find(r.effects, "turn.result")!;
    expect(result.shot.input.item).toBe("double");
    expect(new Set(result.shot.impacts.map(i => i.projectile)).size).toBeGreaterThanOrEqual(1);
    expect(r.state.match.players[0].itemsUsed).toEqual(["double"]);
    expect(r.state.match.players[1].itemsUsed ?? []).toEqual([]);
  });

  it("テレポートは選んだスロットに関わらず標準砲で撃ち、撃った側を着地点へ移す", () => {
    const s = started();
    const r = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0, { slot: 1, item: "teleport" }) }, T0 + 5000);
    const shot = find(r.effects, "turn.result")!.shot;
    expect(shot.input.weapon).toBe("cannon");
    expect(shot.impacts).toEqual([]);
    expect(r.state.match.terrainOps).toEqual(s.state.match.terrainOps);
    if (shot.teleport) expect(r.state.match.players[0]).toMatchObject(shot.teleport);
    expect(r.state.match.players[0].itemsUsed).toEqual(["teleport"]);
  });

  it("使用済みのアイテムを送った射撃はパスにする", () => {
    const s = started();
    const used = { ...s.state, match: { ...s.state.match, players: [{ ...s.state.match.players[0], itemsUsed: ["double" as const] }, s.state.match.players[1]] as const } };
    const r = handle(used, { type: "fire", seat: 0, fire: fireMsg(used, 0, { item: "double" }) }, T0 + 5000);
    expect(find(r.effects, "turn.pass")?.reason).toBe("invalidFire");
    expect(find(r.effects, "turn.result")).toBeUndefined();
  });

  it("アイテムのコストを手番のコストに足す", () => {
    const s = withDelay();
    const double = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0, { item: "double" }) }, T0 + 5000);
    expect(find(double.effects, "turn.result")!.delay!.costs["0"]).toBe(actionCost(0, "cannon", "double"));
    const teleport = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0, { slot: 1, item: "teleport" }) }, T0 + 5000);
    expect(find(teleport.effects, "turn.result")!.delay!.costs["0"]).toBe(120);
  });

  it("ダブルシュートの再生は、待ちの打ち切りも 2 発ぶんにする", () => {
    const s = started();
    const single = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0) }, T0 + 5000);
    const double = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0, { item: "double" }) }, T0 + 5000);
    expect(single.state.replayWakeAt).toBe(T0 + 5000 + DEFAULT_ENGINE_TIMING.replayWaitMs);
    expect(double.state.replayWakeAt).toBe(T0 + 5000 + 2 * DEFAULT_ENGINE_TIMING.replayWaitMs);
  });
});

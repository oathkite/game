import { DEFAULT_ENGINE_TIMING } from "@game/engine";
import { DEFAULT_LOADOUT } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { deserializeState, serializeState } from "../src/persist.js";
import { handleCommand } from "../src/server.js";
import { DEFAULT_SERVER_TIMING } from "../src/state.js";
import { harness, last, startedMatch, T0 } from "./helpers.js";

// 状態の保存と復元。復元した状態で対戦を続けられることを確認する。

describe("serializeState / deserializeState", () => {
  it("対戦中の状態を JSON にして戻しても、地形と対戦が同じまま続けられる", () => {
    const h = harness();
    startedMatch(h);
    h.at(T0 + 1000);
    h.send("a", { type: "turn.fire", slot: "main", facing: 1, elevation: 45, power: 60, x: 75 });
    const json = JSON.parse(JSON.stringify(serializeState(h.state))) as ReturnType<typeof serializeState>;
    const restored = deserializeState(json, { ...DEFAULT_SERVER_TIMING, rng: () => 0.5 }, { ...DEFAULT_ENGINE_TIMING, rng: () => 0.5 });
    const room = [...restored.rooms.values()][0];
    const original = [...h.state.rooms.values()][0];
    expect(room?.engine?.mask.cells).toEqual(original?.engine?.mask.cells);
    expect(room?.engine?.match).toEqual(original?.engine?.match);
    expect(room?.members.map((m) => m.connId)).toEqual(original?.members.map((m) => m.connId));
    // 復元した状態で再生完了を受け、次のターンへ進む
    const r1 = handleCommand(restored, { type: "message", connId: "a", message: { type: "turn.replayDone" } }, T0 + 2000);
    const r2 = handleCommand(restored, { type: "message", connId: "b", message: { type: "turn.replayDone" } }, T0 + 2100);
    expect(r1.effects).toEqual([]);
    expect(last(r2.effects.filter((e) => e.connId === "a").map((e) => e.message), "turn.start")?.turnNumber).toBe(2);
  });

  it("武器を持たない古い保存を戻すと、参加者と対戦の両方に既定の装備が入る", () => {
    const h = harness();
    startedMatch(h);
    const json = JSON.parse(JSON.stringify(serializeState(h.state))) as ReturnType<typeof serializeState>;
    // 保存済みの JSON から loadout を消して、武器の導入前の形にする
    const strip = <T extends object>(o: T): T => {
      const { loadout: _loadout, ...rest } = o as T & { loadout?: unknown };
      return rest as T;
    };
    const old = {
      ...json,
      rooms: json.rooms.map((room) => ({
        ...room,
        members: room.members.map(strip),
        engine: room.engine ? { ...room.engine, match: { ...room.engine.match, players: room.engine.match.players.map(strip) } } : null,
      })),
    } as unknown as ReturnType<typeof serializeState>;
    const restored = deserializeState(old, { ...DEFAULT_SERVER_TIMING, rng: () => 0.5 }, { ...DEFAULT_ENGINE_TIMING, rng: () => 0.5 });
    const room = [...restored.rooms.values()][0];
    expect(room?.members.map((m) => m.loadout)).toEqual([DEFAULT_LOADOUT, DEFAULT_LOADOUT]);
    expect(room?.engine?.match.players.map((p) => p.loadout)).toEqual([DEFAULT_LOADOUT, DEFAULT_LOADOUT]);
    // 復元した状態で撃てる
    const r = handleCommand(restored, { type: "message", connId: "a", message: { type: "turn.fire", slot: "sub", facing: 1, elevation: 45, power: 60, x: 75 } }, T0 + 1000);
    expect(last(r.effects.filter((e) => e.connId === "a").map((e) => e.message), "turn.result")?.shot.input.weapon).toBe("digger");
  });
});

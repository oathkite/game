import { createEngine, DEFAULT_ENGINE_TIMING, handle, setupMessage, type EngineState } from "@game/engine";
import type { ClientMessage, ServerMessage, ServerMessageOf } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { createMatchStore } from "@/match/matchStore";
import { createListeners, type Connection } from "@/net/connection";

// ストアの操作。偽の接続でサーバーの通知を流し、送ったメッセージを記録する。

const fakeConnection = () => {
  const sent: ClientMessage[] = [];
  const listeners = createListeners<ServerMessage>();
  const connection: Connection = {
    send: (m) => sent.push(m),
    subscribe: listeners.add,
    onStatus: () => () => {},
    status: () => "open",
    close: () => {},
  };
  return { connection, sent, push: (m: ServerMessage) => listeners.emit(m) };
};

const startedEngine = (): { state: EngineState; setup: ServerMessage; start: ServerMessageOf<"turn.start"> } => {
  const created = createEngine(
    { ...DEFAULT_ENGINE_TIMING, rng: () => 0.5 },
    {
      roomCode: "ABCDEF",
      mapName: "valley",
      players: [
        { nickname: "a", colors: { primary: "red", secondary: "red" } },
        { nickname: "b", colors: { primary: "blue", secondary: "blue" } },
      ],
    },
  );
  const s1 = handle(created, { type: "loaded", seat: 0 }, 0);
  const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
  return { state: s2.state, setup: setupMessage(created), start: s2.effects[0]?.message as ServerMessageOf<"turn.start"> };
};

describe("createMatchStore", () => {
  it("match.setup を受けたら match.ready を送る", () => {
    const f = fakeConnection();
    const store = createMatchStore(f.connection, { followCurrentSeat: false, mySeat: 0, spectator: false });
    f.push(startedEngine().setup);
    expect(f.sent.map((m) => m.type)).toEqual(["match.ready"]);
    store.dispose();
  });

  it("移動は 1 歩ずつ歩数を減らし、向きを変える", () => {
    const f = fakeConnection();
    const store = createMatchStore(f.connection, { followCurrentSeat: false, mySeat: 0, spectator: false });
    const e = startedEngine();
    f.push(e.setup);
    f.push(e.start);
    const x0 = store.getView().control?.x ?? 0;
    store.moveStep(1);
    store.moveStep(1);
    store.moveStep(-1);
    expect(store.getView().control).toMatchObject({ x: x0 + 1, stepsLeft: 12, facing: -1 });
    store.dispose();
  });

  it("歩数を使い切っても向きだけは変わる", () => {
    const f = fakeConnection();
    const store = createMatchStore(f.connection, { followCurrentSeat: false, mySeat: 0, spectator: false });
    const e = startedEngine();
    f.push(e.setup);
    f.push(e.start);
    for (let i = 0; i < 15; i++) store.moveStep(1);
    const x = store.getView().control?.x;
    store.moveStep(-1);
    expect(store.getView().control).toMatchObject({ x, stepsLeft: 0, facing: -1 });
    expect(store.canStep(1)).toBe(false);
    store.dispose();
  });

  it("仰角は 10 から 90 に収まる", () => {
    const f = fakeConnection();
    const store = createMatchStore(f.connection, { followCurrentSeat: false, mySeat: 0, spectator: false });
    const e = startedEngine();
    f.push(e.setup);
    f.push(e.start);
    for (let i = 0; i < 100; i++) store.changeElevation(1);
    expect(store.getView().control?.elevation).toBe(90);
    for (let i = 0; i < 100; i++) store.changeElevation(-1);
    expect(store.getView().control?.elevation).toBe(10);
    store.dispose();
  });

  it("射撃は向き、仰角、パワー、移動後の x をまとめて送り、phase を fired にする", () => {
    const f = fakeConnection();
    const store = createMatchStore(f.connection, { followCurrentSeat: false, mySeat: 0, spectator: false });
    const e = startedEngine();
    f.push(e.setup);
    f.push(e.start);
    store.moveStep(1);
    store.changeElevation(5);
    store.fire(77);
    expect(f.sent[1]).toEqual({ type: "turn.fire", facing: 1, elevation: 50, power: 77, x: 56 });
    expect(store.getView().phase).toBe("fired");
    // 2 回目は送らない
    store.fire(50);
    expect(f.sent.length).toBe(2);
    store.dispose();
  });

  it("再生が終わったら地形と HP を確定し turn.replayDone を送る", () => {
    const f = fakeConnection();
    const store = createMatchStore(f.connection, { followCurrentSeat: false, mySeat: 0, spectator: false });
    const e = startedEngine();
    f.push(e.setup);
    f.push(e.start);
    const fired = handle(e.state, { type: "fire", seat: 0, fire: { type: "turn.fire", facing: 1, elevation: 45, power: 60, x: 55 } }, 1000);
    f.push(fired.effects[0]?.message as ServerMessage);
    const job = store.getView().replay;
    expect(job).not.toBeNull();
    store.completeReplay(job?.id ?? -1);
    expect(store.getView().phase).toBe("waiting");
    expect(store.getView().replay).toBeNull();
    expect(store.getView().mask).toBe(job?.maskAfter);
    expect(f.sent.map((m) => m.type)).toEqual(["match.ready", "turn.replayDone"]);
    store.dispose();
  });

  it("観戦者は turn.replayDone を送らない", () => {
    const f = fakeConnection();
    const store = createMatchStore(f.connection, { followCurrentSeat: false, mySeat: null, spectator: true });
    const e = startedEngine();
    f.push(e.setup);
    f.push(e.start);
    expect(store.getView().phase).toBe("waiting");
    const fired = handle(e.state, { type: "fire", seat: 0, fire: { type: "turn.fire", facing: 1, elevation: 45, power: 60, x: 55 } }, 1000);
    f.push(fired.effects[0]?.message as ServerMessage);
    store.completeReplay(store.getView().replay?.id ?? -1);
    expect(f.sent.map((m) => m.type)).toEqual(["match.ready"]);
    store.dispose();
  });
});

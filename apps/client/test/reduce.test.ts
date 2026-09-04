import { createEngine, DEFAULT_ENGINE_TIMING, handle, setupMessage } from "@game/engine";
import type { ServerMessage, ServerMessageOf } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { applyElevation } from "@/match/control";
import { reduce, type ReduceOptions } from "@/match/reduce";
import { EMPTY_VIEW, type MatchView } from "@/match/types";

// サーバーの通知を表示状態に畳み込む reduce のテスト。エンジンを使って本物のメッセージを作る。

const opts: ReduceOptions = { followCurrentSeat: false, mySeat: 0, spectator: false };

const engine = () =>
  createEngine(
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

const apply = (view: MatchView, messages: readonly ServerMessage[], o = opts): MatchView =>
  messages.reduce((v, m, i) => reduce(v, m, o, i + 1).view, view);

describe("reduce", () => {
  const state = engine();
  const setup = setupMessage(state);

  it("match.setup でマップと両者を持ち、match.ready を返す", () => {
    const r = reduce(EMPTY_VIEW, setup, opts, 1);
    expect(r.reply).toBe("match.ready");
    expect(r.view.phase).toBe("loading");
    expect(r.view.mask?.width).toBe(400);
    expect(r.view.players?.[0].hp).toBe(100);
    expect(r.view.players?.[0].facing).toBe(1);
    expect(r.view.players?.[1].facing).toBe(-1);
  });

  it("自分の手番の turn.start で acting になり、歩数が全回復する", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const start = s2.effects[0]?.message as ServerMessageOf<"turn.start">;
    const view = apply(EMPTY_VIEW, [setup, start]);
    expect(view.phase).toBe("acting");
    expect(view.control).toMatchObject({ x: 75, facing: 1, elevation: 45, stepsLeft: 15, fell: false });
    expect(view.deadlineAt).toBe(start.deadlineAt);
  });

  it("相手の手番の turn.start では waiting になる", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const start = s2.effects[0]?.message as ServerMessageOf<"turn.start">;
    const view = apply(EMPTY_VIEW, [setup, start], { ...opts, mySeat: 1 });
    expect(view.phase).toBe("waiting");
    expect(view.control).toBeNull();
  });

  it("turn.result を再計算し、サーバーの値と一致すれば不整合を数えない", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const start = s2.effects[0]?.message as ServerMessageOf<"turn.start">;
    const fired = handle(s2.state, { type: "fire", seat: 0, fire: { type: "turn.fire", facing: 1, elevation: 45, power: 60, x: 75 } }, 1000);
    const result = fired.effects[0]?.message as ServerMessageOf<"turn.result">;
    const before = apply(EMPTY_VIEW, [setup, start]);
    const r = reduce(before, result, opts, 3);
    expect(r.mismatch).toBe(false);
    expect(r.view.phase).toBe("replaying");
    expect(r.view.replay?.path.length).toBeGreaterThan(10);
    expect(r.view.replay?.maskAfter).not.toBe(before.mask);
    expect(r.view.mismatches).toBe(0);
  });

  it("サーバーの結果が食い違えば不整合を数え、サーバーの値で上書きする", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const start = s2.effects[0]?.message as ServerMessageOf<"turn.start">;
    const fired = handle(s2.state, { type: "fire", seat: 0, fire: { type: "turn.fire", facing: 1, elevation: 45, power: 60, x: 75 } }, 1000);
    const result = fired.effects[0]?.message as ServerMessageOf<"turn.result">;
    const tampered: ServerMessageOf<"turn.result"> = { ...result, shot: { ...result.shot, hpAfter: [100, 1] } };
    const before = apply(EMPTY_VIEW, [setup, start]);
    const r = reduce(before, tampered, opts, 3);
    expect(r.mismatch).toBe(true);
    expect(r.view.mismatches).toBe(1);
    expect(r.view.replay?.playersAfter[1].hp).toBe(1);
  });

  it("turn.pass で操作を捨てて waiting になる", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const start = s2.effects[0]?.message as ServerMessageOf<"turn.start">;
    const view = apply(EMPTY_VIEW, [setup, start, { type: "turn.pass", turnNumber: 1, reason: "timeout" }]);
    expect(view.phase).toBe("waiting");
    expect(view.control).toBeNull();
    expect(view.deadlineAt).toBeNull();
  });

  it("match.finished は再生中なら結果だけ持ち、再生後に finished へ移す", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const start = s2.effects[0]?.message as ServerMessageOf<"turn.start">;
    const fired = handle(s2.state, { type: "fire", seat: 0, fire: { type: "turn.fire", facing: 1, elevation: 45, power: 60, x: 75 } }, 1000);
    const result = fired.effects[0]?.message as ServerMessageOf<"turn.result">;
    const finished: ServerMessage = {
      type: "match.finished",
      result: { winner: 1, reason: "surrender", turns: 1, stats: [{ damageDealt: 0, directHits: 0 }, { damageDealt: 0, directHits: 0 }] },
    };
    const view = apply(EMPTY_VIEW, [setup, start, result, finished]);
    expect(view.phase).toBe("replaying");
    expect(view.result?.reason).toBe("surrender");
  });

  it("自分の手番の途中で再接続すると、conn.state から acting と操作を復元する", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const view = apply(EMPTY_VIEW, [{ type: "conn.state", match: s2.state.match, seat: 0 }]);
    expect(view.phase).toBe("acting");
    expect(view.control).toMatchObject({ x: 75, stepsLeft: 15 });
    expect(view.deadlineAt).toBe(20_000);
  });

  it("conn.state から地形と状態を復元する", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const fired = handle(s2.state, { type: "fire", seat: 0, fire: { type: "turn.fire", facing: 1, elevation: 45, power: 60, x: 75 } }, 1000);
    const view = apply(EMPTY_VIEW, [{ type: "conn.state", match: fired.state.match, seat: 1 }], { ...opts, mySeat: 1 });
    expect(view.mask).not.toBeNull();
    expect(view.mySeat).toBe(1);
    expect(view.turnNumber).toBe(1);
    expect(view.phase).toBe("waiting");
    // 地形は terrainOps を適用した後の形
    const solidCount = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);
    expect(solidCount(view.mask?.cells ?? new Uint8Array())).toBeLessThan(solidCount(reduce(EMPTY_VIEW, setup, opts, 1).view.mask?.cells ?? new Uint8Array()));
  });

  it("再生が終わる前の turn.start は再生を打ち切り、削れた地形と HP を確定する", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const start = s2.effects[0]?.message as ServerMessageOf<"turn.start">;
    const fired = handle(s2.state, { type: "fire", seat: 0, fire: { type: "turn.fire", facing: 1, elevation: 45, power: 60, x: 60 } }, 1000);
    const result = fired.effects[0]?.message as ServerMessageOf<"turn.result">;
    const next = handle(fired.state, { type: "tick" }, 12_000);
    const start2 = next.effects[0]?.message as ServerMessageOf<"turn.start">;
    const replaying = apply(EMPTY_VIEW, [setup, start, result]);
    const view = reduce(replaying, start2, opts, 9).view;
    expect(view.replay).toBeNull();
    expect(view.mask).toBe(replaying.replay?.maskAfter);
    expect(view.players?.[0].x).toBe(60);
    expect(view.turnNumber).toBe(2);
  });

  it("Replaying の途中に再接続したら、送り直された turn.result は再生せず replayDone を返す", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const fired = handle(s2.state, { type: "fire", seat: 0, fire: { type: "turn.fire", facing: 1, elevation: 45, power: 60, x: 75 } }, 1000);
    const dropped = handle(fired.state, { type: "disconnect", seat: 1 }, 1500);
    const back = handle(dropped.state, { type: "reconnect", seat: 1 }, 2000);
    const toMe = back.effects.filter((e) => e.to === 1).map((e) => e.message);
    expect(toMe.map((m) => m.type)).toEqual(["conn.state", "turn.result"]);
    const restored = reduce(EMPTY_VIEW, toMe[0] as ServerMessage, { ...opts, mySeat: 1 }, 1);
    expect(restored.view.skipNextResult).toBe(true);
    const r = reduce(restored.view, toMe[1] as ServerMessage, { ...opts, mySeat: 1 }, 2);
    expect(r.reply).toBe("turn.replayDone");
    expect(r.mismatch).toBe(false);
    expect(r.view.replay).toBeNull();
    expect(r.view.skipNextResult).toBe(false);
    expect(r.view.players?.[0].x).toBe(75);
  });

  it("Loading 中の再接続では match.ready を送り直し、表示も loading にする", () => {
    const r = reduce(EMPTY_VIEW, { type: "conn.state", match: state.match, seat: 0 }, opts, 1);
    expect(r.reply).toBe("match.ready");
    expect(r.view.phase).toBe("loading");
  });

  it("手番側の相手が切断したら、こちらの残り時間の表示も止める", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const start = s2.effects[0]?.message as ServerMessageOf<"turn.start">;
    // 席 1 から見ると、手番の席 0 が切れた
    const view = apply(EMPTY_VIEW, [setup, start, { type: "conn.opponentDisconnected", deadlineAt: 65_000 }], { ...opts, mySeat: 1 });
    expect(view.deadlineAt).toBeNull();
    expect(view.opponentDisconnectedUntil).toBe(65_000);
  });
  it("発射角は自分の次の手番へ引き継ぐ", () => {
    const s1 = handle(state, { type: "loaded", seat: 0 }, 0);
    const s2 = handle(s1.state, { type: "loaded", seat: 1 }, 0);
    const start = s2.effects[0]?.message as ServerMessageOf<"turn.start">;
    const mine = apply(EMPTY_VIEW, [setup, start]);
    expect(mine.control?.elevation).toBe(45);

    // 仰角を 70 に変えて撃つ
    const aimed = applyElevation(mine, 25);
    expect(aimed.lastElevation).toBe(70);

    const fired = handle(s2.state, { type: "fire", seat: 0, fire: { type: "turn.fire", facing: 1, elevation: 70, power: 60, x: 75 } }, 1000);
    const result = fired.effects[0]?.message as ServerMessageOf<"turn.result">;
    const next = handle(fired.state, { type: "tick" }, 12_000);
    const opponentTurn = next.effects[0]?.message as ServerMessageOf<"turn.start">;

    // 相手の手番を挟んでも lastElevation は保つ
    const waiting = apply(aimed, [result, opponentTurn]);
    expect(waiting.lastElevation).toBe(70);
    expect(waiting.control).toBeNull();

    // 自分の手番に戻ったら 70 から始まる
    const mineAgain = reduce(waiting, { ...opponentTurn, turnNumber: 3, seat: 0 }, opts, 20).view;
    expect(mineAgain.control?.elevation).toBe(70);
  });

});

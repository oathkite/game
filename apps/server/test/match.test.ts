import { describe, expect, it } from "vitest";
import { harness, last, startedMatch, T0, types } from "./helpers.js";

// 対戦中のサーバーの振る舞い。設計書 07 の 7.5 の server のテスト。

describe("対戦の開始", () => {
  it("両者の match.ready で turn.start が全員に届く", () => {
    const h = harness();
    startedMatch(h);
    const start = last(h.inbox("a"), "turn.start");
    expect(start?.turnNumber).toBe(1);
    expect(start?.seat).toBe(0);
    expect(start?.deadlineAt).toBe(T0 + 20_000);
    expect(last(h.inbox("b"), "turn.start")).toEqual(start);
  });
});

describe("turn.fire の検証", () => {
  it("手番でない席の射撃は無視される", () => {
    const h = harness();
    startedMatch(h);
    const out = h.send("b", { type: "turn.fire", facing: -1, elevation: 45, power: 50, x: 344 });
    expect(out).toEqual([]);
  });

  it("歩数超過はパスになる", () => {
    const h = harness();
    startedMatch(h);
    h.send("a", { type: "turn.fire", facing: 1, elevation: 45, power: 50, x: 75 + 16 });
    expect(last(h.inbox("b"), "turn.pass")?.reason).toBe("invalidFire");
    expect(last(h.inbox("b"), "turn.start")?.turnNumber).toBe(2);
  });

  it("観戦者の turn.fire は拒否される", () => {
    const h = harness();
    const { code } = startedMatch(h);
    h.open("s");
    h.send("s", { type: "room.spectate", code, playerId: "player-spec", nickname: "spec" });
    expect(last(h.inbox("s"), "conn.state")?.seat).toBeNull();
    h.send("s", { type: "turn.fire", facing: 1, elevation: 45, power: 50, x: 75 });
    expect(last(h.inbox("s"), "room.error")?.reason).toBe("notMember");
  });

  it("正しい射撃は turn.result として両者と観戦者に届く", () => {
    const h = harness();
    const { code } = startedMatch(h);
    h.open("s");
    h.send("s", { type: "room.spectate", code, playerId: "player-spec", nickname: "spec" });
    h.at(T0 + 3000);
    h.send("a", { type: "turn.fire", facing: 1, elevation: 45, power: 50, x: 60 });
    expect(last(h.inbox("a"), "turn.result")?.shot.input.x).toBe(60);
    expect(last(h.inbox("b"), "turn.result")).toBeDefined();
    expect(last(h.inbox("s"), "turn.result")).toBeDefined();
  });
});

describe("制限時間と再生", () => {
  it("制限時間切れで自動的にパスになる", () => {
    const h = harness();
    startedMatch(h);
    h.at(T0 + 20_999);
    h.tick();
    expect(last(h.inbox("a"), "turn.pass")).toBeUndefined();
    h.at(T0 + 21_000);
    h.tick();
    expect(last(h.inbox("a"), "turn.pass")?.reason).toBe("timeout");
    expect(last(h.inbox("a"), "turn.start")?.seat).toBe(1);
  });

  it("両者の replayDone で次のターンへ進む", () => {
    const h = harness();
    startedMatch(h);
    h.at(T0 + 3000);
    h.send("a", { type: "turn.fire", facing: 1, elevation: 45, power: 50, x: 75 });
    h.send("a", { type: "turn.replayDone" });
    expect(last(h.inbox("a"), "turn.start")?.turnNumber).toBe(1);
    h.send("b", { type: "turn.replayDone" });
    expect(last(h.inbox("a"), "turn.start")?.turnNumber).toBe(2);
  });
});

describe("切断と再接続", () => {
  it("対戦中の切断で相手に通知され、トークンで再接続すると状態が復元される", () => {
    const h = harness();
    const { tokenA } = startedMatch(h);
    h.at(T0 + 2000);
    h.close("a");
    expect(last(h.inbox("b"), "conn.opponentDisconnected")?.deadlineAt).toBe(T0 + 62_000);
    expect(last(h.inbox("b"), "room.state")?.room.members.find((m) => m.seat === 0)?.connected ?? true).toBe(true);
    h.at(T0 + 10_000);
    h.open("a2");
    h.send("a2", { type: "conn.resume", token: tokenA });
    expect(types(h.inbox("a2"))).toEqual(["room.joined", "conn.state", "room.state"]);
    const st = last(h.inbox("a2"), "conn.state");
    expect(st?.seat).toBe(0);
    // 手番側が切れていたので制限時間は止まり、残り 18 秒から再開する
    expect(st?.match.deadlineAt).toBe(T0 + 10_000 + 18_000);
    expect(last(h.inbox("b"), "conn.opponentReconnected")).toBeDefined();
  });

  it("再接続の期限切れで切断側の負けになり、部屋はリザルトへ移る", () => {
    const h = harness();
    startedMatch(h);
    h.at(T0 + 2000);
    h.close("b");
    h.at(T0 + 62_000);
    h.tick();
    const finished = last(h.inbox("a"), "match.finished");
    expect(finished?.result).toMatchObject({ winner: 0, reason: "disconnect" });
    expect(last(h.inbox("a"), "room.state")?.room.phase).toBe("result");
  });

  it("無効なトークンは拒否される", () => {
    const h = harness();
    h.open("x");
    h.send("x", { type: "conn.resume", token: "nope-nope-nope" });
    expect(last(h.inbox("x"), "room.error")?.reason).toBe("invalidToken");
  });
});

describe("決着とリザルト", () => {
  it("降参で決着し、全員が閉じると部屋は募集中に戻る", () => {
    const h = harness();
    startedMatch(h);
    h.send("b", { type: "match.surrender" });
    expect(last(h.inbox("a"), "match.finished")?.result).toMatchObject({ winner: 0, reason: "surrender" });
    expect(last(h.inbox("a"), "room.state")?.room.phase).toBe("result");
    h.send("a", { type: "result.close" });
    expect(last(h.inbox("a"), "room.state")?.room.phase).toBe("result");
    h.send("b", { type: "result.close" });
    const reopened = last(h.inbox("a"), "room.state");
    expect(reopened?.room.phase).toBe("open");
    expect(reopened?.room.members.every((m) => !m.ready)).toBe(true);
  });

  it("誰も閉じなくても 60 秒で募集中に戻る", () => {
    const h = harness();
    startedMatch(h);
    h.at(T0 + 5000);
    h.send("b", { type: "match.surrender" });
    expect(h.lastWakeAt()).toBe(T0 + 65_000);
    h.at(T0 + 65_000);
    h.tick();
    expect(last(h.inbox("a"), "room.state")?.room.phase).toBe("open");
  });

  it("対戦中の退出は降参扱いで、部屋に残った側がオーナーになる", () => {
    const h = harness();
    startedMatch(h);
    h.send("a", { type: "room.leave" });
    expect(last(h.inbox("b"), "match.finished")?.result).toMatchObject({ winner: 1, reason: "surrender" });
    const state = last(h.inbox("b"), "room.state");
    expect(state?.room.ownerSeat).toBe(1);
    expect(state?.room.members.length).toBe(1);
  });

  it("対戦中の解散は勝者なしで終わり、部屋が消える", () => {
    const h = harness();
    startedMatch(h);
    h.send("a", { type: "room.dissolve" });
    expect(last(h.inbox("b"), "match.finished")?.result).toMatchObject({ winner: null, reason: "dissolved" });
    expect(last(h.inbox("b"), "room.closed")?.reason).toBe("dissolved");
    expect(h.state.rooms.size).toBe(0);
  });

  it("リザルトの自動クローズで切断中の参加者は外れ、残った側がオーナーになる", () => {
    const h = harness();
    startedMatch(h);
    h.at(T0 + 2000);
    h.close("a");
    h.at(T0 + 62_000);
    h.tick();
    expect(last(h.inbox("b"), "room.state")?.room.phase).toBe("result");
    h.at(T0 + 62_000 + 60_000);
    h.tick();
    const reopened = last(h.inbox("b"), "room.state");
    expect(reopened?.room.phase).toBe("open");
    expect(reopened?.room.members.map((m) => m.seat)).toEqual([1]);
    expect(reopened?.room.ownerSeat).toBe(1);
  });

  it("両者が切断したまま決着した部屋は、リザルトの自動クローズで消える", () => {
    const h = harness();
    startedMatch(h);
    h.at(T0 + 2000);
    h.close("a");
    h.at(T0 + 3000);
    h.close("b");
    h.at(T0 + 62_000);
    h.tick();
    h.at(T0 + 122_000);
    h.tick();
    expect(h.state.rooms.size).toBe(0);
  });
});

describe("半開きの接続", () => {
  it("古い接続が閉じていなくても、トークンで新しい接続に席を移す", () => {
    const h = harness();
    const { tokenA } = startedMatch(h);
    h.at(T0 + 2000);
    h.open("a2");
    h.send("a2", { type: "conn.resume", token: tokenA });
    expect(last(h.inbox("a2"), "room.joined")?.seat).toBe(0);
    expect(last(h.inbox("a"), "room.closed")).toBeDefined();
    // 古い接続が後から閉じても、席には影響しない
    h.close("a");
    expect(last(h.inbox("b"), "conn.opponentDisconnected")).toBeUndefined();
    h.send("a2", { type: "turn.fire", facing: 1, elevation: 45, power: 50, x: 75 });
    expect(last(h.inbox("b"), "turn.result")).toBeDefined();
  });
});

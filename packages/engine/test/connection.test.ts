import { describe, expect, it } from "vitest";
import { createMatchHost, handle, type Clock, type Effect } from "../src/index.js";
import { find, fireMsg, newEngine, started, types } from "./helpers.js";

const T0 = 1_000_000;

describe("切断と再接続", () => {
  it("手番側が切れると制限時間が止まり、再接続で残り時間から再開する", () => {
    const s = started();
    const d = handle(s.state, { type: "disconnect", seat: 0 }, T0 + 5000);
    expect(d.state.match.deadlineAt).toBeNull();
    expect(d.state.match.players[0].connected).toBe(false);
    expect(d.effects).toEqual([{ to: 1, message: { type: "conn.opponentDisconnected", deadlineAt: T0 + 65_000 } }]);
    // 本来の期限を過ぎてもパスにならない
    const t = handle(d.state, { type: "tick" }, T0 + 30_000);
    expect(t.effects).toEqual([]);
    expect(t.state.match.turnNumber).toBe(1);
    const r = handle(t.state, { type: "reconnect", seat: 0 }, T0 + 40_000);
    expect(r.state.match.deadlineAt).toBe(T0 + 40_000 + 15_000);
    // 相手には再開後の期限を turn.start で配り直す
    expect(types(r.effects)).toEqual(["conn.opponentReconnected", "conn.state", "turn.start"]);
    expect(r.effects[2]?.to).toBe(1);
    expect(find(r.effects, "turn.start")?.deadlineAt).toBe(T0 + 55_000);
    const st = find(r.effects, "conn.state");
    expect(st?.seat).toBe(0);
    expect(st?.match.deadlineAt).toBe(T0 + 55_000);
  });

  it("相手側が切れても手番側の制限時間は動き続ける", () => {
    const s = started();
    const d = handle(s.state, { type: "disconnect", seat: 1 }, T0 + 5000);
    expect(d.state.match.deadlineAt).toBe(T0 + 20_000);
    const t = handle(d.state, { type: "tick" }, T0 + 21_000);
    expect(find(t.effects, "turn.pass")?.reason).toBe("timeout");
  });

  it("相手が切断中なら再生完了を待たずに次のターンへ進む", () => {
    const s = started();
    const d = handle(s.state, { type: "disconnect", seat: 1 }, T0 + 1000);
    const r = handle(d.state, { type: "fire", seat: 0, fire: fireMsg(d.state, 0) }, T0 + 2000);
    expect(r.state.match.phase).toBe("replaying");
    const done = handle(r.state, { type: "replayDone", seat: 0 }, T0 + 3000);
    expect(done.state.match.phase).toBe("acting");
    expect(done.state.match.turnNumber).toBe(2);
    // 手番が切断中の席に移ったので、制限時間は止まっている
    expect(done.state.match.deadlineAt).toBeNull();
  });

  it("再接続を 60 秒待っても戻らなければ切れた側の負け", () => {
    const s = started();
    const d = handle(s.state, { type: "disconnect", seat: 1 }, T0 + 5000);
    const before = handle(d.state, { type: "tick" }, T0 + 64_999);
    expect(before.state.match.phase).not.toBe("finished");
    const after = handle(d.state, { type: "tick" }, T0 + 65_000);
    expect(after.state.match.result).toMatchObject({ winner: 0, reason: "disconnect" });
  });

  it("Replaying 中に再接続すると状態と最後の結果を送り直す", () => {
    const s = started();
    const r = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0) }, T0 + 2000);
    const d = handle(r.state, { type: "disconnect", seat: 0 }, T0 + 2500);
    const back = handle(d.state, { type: "reconnect", seat: 0 }, T0 + 3000);
    expect(types(back.effects)).toEqual(["conn.opponentReconnected", "conn.state", "turn.result"]);
  });
});

describe("createMatchHost", () => {
  const fakeClock = () => {
    let now = T0;
    const timers: { at: number; fn: () => void }[] = [];
    const clock: Clock = {
      now: () => now,
      schedule: (at, fn) => {
        const entry = { at, fn };
        timers.push(entry);
        return () => {
          const i = timers.indexOf(entry);
          if (i >= 0) timers.splice(i, 1);
        };
      },
    };
    const advanceTo = (t: number): void => {
      now = t;
      const due = timers.filter((x) => x.at <= now);
      for (const d of due) {
        timers.splice(timers.indexOf(d), 1);
        d.fn();
      }
    };
    return { clock, advanceTo, pending: () => timers.length };
  };

  it("wakeAt にあわせて tick を予約し、期限切れで自動的にパスする", () => {
    const { clock, advanceTo, pending } = fakeClock();
    const out: Effect[] = [];
    const host = createMatchHost(newEngine(), clock, (e) => out.push(e));
    host.dispatch({ type: "loaded", seat: 0 });
    host.dispatch({ type: "loaded", seat: 1 });
    expect(pending()).toBe(1);
    advanceTo(T0 + 21_000);
    expect(out.map((e) => e.message.type)).toEqual(["turn.start", "turn.pass", "turn.start"]);
    expect(host.state().match.turnNumber).toBe(2);
    host.stop();
    expect(pending()).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { STEPS_PER_TURN } from "@game/sim";
import { handle } from "../src/index.js";
import { find, fireMsg, newEngine, started, types } from "./helpers.js";

const T0 = 1_000_000;

describe("Loading", () => {
  it("両者の読み込み完了で最初のターンが始まる", () => {
    const one = handle(newEngine(), { type: "loaded", seat: 0 }, T0);
    expect(one.state.match.phase).toBe("loading");
    expect(one.effects).toEqual([]);
    const two = handle(one.state, { type: "loaded", seat: 1 }, T0);
    expect(two.state.match.phase).toBe("acting");
    expect(two.state.match.turnNumber).toBe(1);
    expect(two.state.match.currentSeat).toBe(0);
    const start = find(two.effects, "turn.start");
    expect(start?.deadlineAt).toBe(T0 + 20_000);
    expect(two.wakeAt).toBe(T0 + 21_000);
  });

  it("解散で勝者なしの Finished になる", () => {
    const s = handle(newEngine(), { type: "dissolve" }, T0);
    expect(s.state.match.phase).toBe("finished");
    expect(s.state.match.result).toMatchObject({ winner: null, reason: "dissolved" });
  });
});

describe("Acting と Resolving", () => {
  it("正しい射撃で turn.result が配信され Replaying に入る", () => {
    const s = started();
    const r = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0) }, T0 + 5000);
    expect(types(r.effects)).toEqual(["turn.result"]);
    expect(r.state.match.phase).toBe("replaying");
    expect(r.wakeAt).toBe(T0 + 15_000);
    const done0 = handle(r.state, { type: "replayDone", seat: 0 }, T0 + 6000);
    expect(done0.state.match.phase).toBe("replaying");
    const done1 = handle(done0.state, { type: "replayDone", seat: 1 }, T0 + 7000);
    expect(done1.state.match.phase).toBe("acting");
    expect(done1.state.match.turnNumber).toBe(2);
    expect(done1.state.match.currentSeat).toBe(1);
  });

  it("手番でない席の射撃は無視する", () => {
    const s = started();
    const r = handle(s.state, { type: "fire", seat: 1, fire: fireMsg(s.state, 1) }, T0 + 1000);
    expect(r.effects).toEqual([]);
    expect(r.state).toBe(s.state);
  });

  it("同じターンの 2 回目の射撃は無視する", () => {
    const s = started();
    const r = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0) }, T0 + 1000);
    const again = handle(r.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0) }, T0 + 1100);
    expect(again.effects).toEqual([]);
  });

  it("歩数を超えた移動はパスになる", () => {
    const s = started();
    const x = s.state.match.players[0].x + STEPS_PER_TURN + 1;
    const r = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0, { x }) }, T0 + 1000);
    expect(types(r.effects)).toEqual(["turn.pass", "turn.start"]);
    expect(find(r.effects, "turn.pass")?.reason).toBe("invalidFire");
    expect(r.state.match.turnNumber).toBe(2);
    expect(r.state.match.players[0].x).toBe(s.state.match.players[0].x);
  });

  it("15 歩以内の平坦な移動は受理され、位置と向きが更新される", () => {
    const s = started();
    const x = s.state.match.players[0].x + 10;
    const r = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0, { x, facing: 1 }) }, T0 + 1000);
    expect(types(r.effects)).toEqual(["turn.result"]);
    expect(r.state.match.players[0].x).toBe(x);
    expect(find(r.effects, "turn.result")?.shot.input.x).toBe(x);
  });

  it("制限時間と猶予を過ぎた tick でパスになる", () => {
    const s = started();
    const early = handle(s.state, { type: "tick" }, T0 + 20_500);
    expect(early.effects).toEqual([]);
    const late = handle(s.state, { type: "tick" }, T0 + 21_000);
    expect(find(late.effects, "turn.pass")?.reason).toBe("timeout");
    expect(late.state.match.turnNumber).toBe(2);
  });

  it("期限後 1 秒以内に届いた射撃は受理し、それを超えたものは捨てる", () => {
    const s = started();
    const ok = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0) }, T0 + 20_900);
    expect(types(ok.effects)).toEqual(["turn.result"]);
    const late = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0) }, T0 + 21_001);
    expect(late.effects).toEqual([]);
  });
});

describe("Replaying", () => {
  it("再生完了を 10 秒待ったら次のターンへ進む", () => {
    const s = started();
    const r = handle(s.state, { type: "fire", seat: 0, fire: fireMsg(s.state, 0) }, T0 + 1000);
    const waited = handle(r.state, { type: "tick" }, T0 + 11_000);
    expect(waited.state.match.phase).toBe("acting");
    expect(waited.state.match.turnNumber).toBe(2);
  });
});

describe("決着", () => {
  it("降参した側の負けになる", () => {
    const s = started();
    const r = handle(s.state, { type: "surrender", seat: 1 }, T0 + 1000);
    expect(r.state.match.result).toMatchObject({ winner: 0, reason: "surrender", turns: 1 });
    expect(types(r.effects)).toEqual(["match.finished"]);
  });

  it("ターン上限に達したら HP の多い側の勝ち、同じなら引き分け", () => {
    let step = started();
    for (let i = 0; i < 20; i++) {
      step = handle(step.state, { type: "tick" }, T0 + 30_000 * (i + 1));
    }
    expect(step.state.match.phase).toBe("finished");
    expect(step.state.match.result).toMatchObject({ winner: null, reason: "turnLimit", turns: 20 });
  });

  it("相手にダメージを与え続ければ HP で決着し、成績に与ダメージが残る", () => {
    // 地形が削れると同じ照準では当たらないので、手番ごとに最もダメージの大きい射撃を探す
    const bestShot = (state: typeof step.state): { elevation: number; power: number } => {
      let best = { elevation: 45, power: 50, damage: -1 };
      for (let elevation = 20; elevation <= 70; elevation += 2) {
        for (let power = 40; power <= 100; power += 2) {
          const trial = handle(state, { type: "fire", seat: 0, fire: fireMsg(state, 0, { elevation, power }) }, T0 + 100);
          const res = find(trial.effects, "turn.result");
          const damage = res ? res.shot.damage[1] - res.shot.damage[0] : -1;
          if (damage > best.damage) best = { elevation, power, damage };
        }
      }
      return { elevation: best.elevation, power: best.power };
    };
    let step = started();
    let now = T0;
    let guard = 0;
    while (step.state.match.phase !== "finished" && guard++ < 40) {
      now += 1000;
      if (step.state.match.currentSeat === 0) {
        step = handle(step.state, { type: "fire", seat: 0, fire: fireMsg(step.state, 0, bestShot(step.state)) }, now);
      } else {
        now += 21_000;
        step = handle(step.state, { type: "tick" }, now);
        continue;
      }
      if (step.state.match.phase === "replaying") {
        step = handle(step.state, { type: "replayDone", seat: 0 }, now);
        step = handle(step.state, { type: "replayDone", seat: 1 }, now);
      }
    }
    expect(step.state.match.result?.reason).toBe("hp");
    expect(step.state.match.result?.winner).toBe(0);
    expect(step.state.match.result?.stats[0].damageDealt).toBeGreaterThanOrEqual(100);
    expect(step.state.match.result?.stats[1].damageDealt).toBe(0);
  });
});

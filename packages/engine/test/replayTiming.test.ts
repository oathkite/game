import { describe, expect, it } from "vitest";
import { DAMAGE_HOLD_MS, IMPACT_HOLD_MS, REPLAY_SETTLE_MS, replayHoldMs, replayTailMs, TELEPORT_HOLD_MS } from "../src/multiplayer/replayTiming.js";

// 着弾の後に留める長さ。設計書 41.8

describe("replayHoldMs", () => {
  it("外れは足さず、着弾は 700、ダメージは 1300 を足す", () => {
    expect(replayHoldMs([])).toBe(0);
    expect(replayHoldMs([{ damage: [{ amount: 0 }] }])).toBe(IMPACT_HOLD_MS);
    expect(replayHoldMs([{ damage: [{ amount: 0 }] }, { damage: [{ amount: 12 }] }])).toBe(DAMAGE_HOLD_MS);
  });
  it("練習の席ごとの数の列でも同じ値になる", () => {
    expect(replayHoldMs([{ damage: [0, 0] }])).toBe(IMPACT_HOLD_MS);
    expect(replayHoldMs([{ damage: [0, 35] }])).toBe(DAMAGE_HOLD_MS);
  });
  it("飛翔の終わりから次の手番まで、外れ 300、着弾 1000、ダメージ 1600 ms", () => {
    expect(replayTailMs([])).toBe(300);
    expect(replayTailMs([{ damage: [] }])).toBe(1000);
    expect(replayTailMs([{ damage: [{ amount: 1 }] }])).toBe(1600);
    expect(REPLAY_SETTLE_MS + DAMAGE_HOLD_MS).toBe(1600);
  });
});

describe("テレポートの演出の長さ（設計書 42.3）", () => {
  it("着地点へ移れたテレポートは、光の柱と出現を見せる長さを足す。移れなかったら足さない", () => {
    expect(replayHoldMs([], true)).toBe(TELEPORT_HOLD_MS);
    expect(replayTailMs([], true)).toBe(REPLAY_SETTLE_MS + TELEPORT_HOLD_MS);
    expect(replayHoldMs([], false)).toBe(0);
    expect(REPLAY_SETTLE_MS + TELEPORT_HOLD_MS).toBeGreaterThanOrEqual(1100);
  });
});

describe("サーバーの再生の長さ", () => {
  it("テレポートの再生も、endsAt から replayTailMs を引くと飛翔の終わりになる", async () => {
    const { MULTIPLAYER_MAPS } = await import("@game/maps");
    const { COMBAT_TICK_MS } = await import("@game/sim");
    const { createBattle } = await import("../src/multiplayer/create.js");
    const { createBattleSession, fireInSession } = await import("../src/multiplayer/session.js");
    const members = [{ playerId: "p0", teamId: "t0" }, { playerId: "p1", teamId: "t1" }];
    const landed = new Set<boolean>();
    for (const power of [5, 30, 55, 80, 100]) {
      const initial = createBattleSession(createBattle(members, 7, MULTIPLAYER_MAPS[0]!), "tp", 1000, { p0: ["cannon", "digger"], p1: ["cannon", "digger"] }, power);
      const shot = fireInSession(initial, initial.movement.playerId, { version: 2, type: "turn.fire", matchId: "tp", turnId: 1, commandId: `t${power}`, ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power, item: "teleport" }, 1100);
      const replay = shot.state.replay!, teleported = Boolean(replay.shot.teleport);
      landed.add(teleported);
      const flight = Math.min(8000, Math.max(500, replay.shot.ticks * COMBAT_TICK_MS + REPLAY_SETTLE_MS)) - REPLAY_SETTLE_MS;
      expect(replay.endsAt - replay.startsAt - replayTailMs(replay.shot.impacts, teleported)).toBeCloseTo(flight, 6);
    }
    expect(landed.has(true)).toBe(true);
  });

  it("endsAt から replayTailMs を引くと、クライアントが逆算する飛翔の終わりがサーバーの tick の終わりと一致する", async () => {
    const { MULTIPLAYER_MAPS } = await import("@game/maps");
    const { COMBAT_TICK_MS } = await import("@game/sim");
    const { createBattle } = await import("../src/multiplayer/create.js");
    const { createBattleSession, fireInSession } = await import("../src/multiplayer/session.js");
    const members = [{ playerId: "p0", teamId: "t0" }, { playerId: "p1", teamId: "t1" }];
    const outcomes = new Set<number>();
    for (const power of [5, 40, 70, 100]) {
      const initial = createBattleSession(createBattle(members, 7, MULTIPLAYER_MAPS[0]!), "timing", 1000, { p0: ["cannon", "digger"], p1: ["cannon", "digger"] }, power);
      const shot = fireInSession(initial, initial.movement.playerId, { version: 2, type: "turn.fire", matchId: "timing", turnId: 1, commandId: `c${power}`, ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power }, 1100);
      const replay = shot.state.replay!;
      const flight = Math.min(8000, Math.max(500, replay.shot.ticks * COMBAT_TICK_MS + REPLAY_SETTLE_MS)) - REPLAY_SETTLE_MS;
      expect(replay.endsAt - replay.startsAt - replayTailMs(replay.shot.impacts)).toBeCloseTo(flight, 6);
      outcomes.add(replayHoldMs(replay.shot.impacts));
    }
    expect(outcomes.size).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from "vitest";
import { TEST_ARENA } from "@game/maps";
import { actionCost } from "@game/protocol";
import { resolveBattleShot, type BattlePlayer } from "../src/multiplayer/combat";
import { createBattle } from "../src/multiplayer/create";
import { createBattleSession, fireInSession, tickSession } from "../src/multiplayer/session";
import { restoreBattle, serializeBattle } from "../src/multiplayer/snapshot";
import type { RosterMember } from "../src/multiplayer/rules";

// オンライン対戦のアイテム（設計書 42）。使用済みの記録、コスト、テレポートの位置、ダブルシュートの 2 発目と試合の決着。

const start = () => createBattleSession(createBattle(Array.from({ length: 4 }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i % 2}` })), 42, TEST_ARENA), "match", 1000);
type Session = ReturnType<typeof start>;
const fire = (state: Session, patch: Record<string, unknown> = {}) => ({ version: 2, type: "turn.fire", matchId: "match", turnId: state.roster.turnId,
  commandId: `fire-${state.roster.turnId}`, ackMoveSeq: state.movement.ackMoveSeq, slot: 0, facing: 1, elevation: 45, power: 30, ...patch });
const steps = (state: Session) => 30 - state.movement.stepsLeft;

describe("アイテムの使用", () => {
  it("どの参加者もアイテムを使っていない状態で始まる", () => {
    const state = start();
    expect(state.itemsUsed).toEqual({ p0: [], p1: [], p2: [], p3: [] });
  });

  it("ダブルシュートを使うと使用済みになり、武器コストをもう一度払う", () => {
    const state = start(), actor = state.movement.playerId;
    const shot = fireInSession(state, actor, fire(state, { item: "double" }), 1100);
    expect(shot.reason).toBe("accepted");
    expect(shot.state.itemsUsed[actor]).toEqual(["double"]);
    expect(shot.state.roster.delay!.costs[actor]).toBe(actionCost(steps(state), "cannon", "double"));
    expect(shot.state.replay!.shot.paths).toHaveLength(2);
    expect(shot.state.replay!.shot.firstShot).toBeDefined();
  });

  it("使用済みのアイテムは item-used で拒否し、状態を変えない。もう一方のアイテムは使える", () => {
    const initial = start(), actor = initial.movement.playerId;
    const state = { ...initial, itemsUsed: { ...initial.itemsUsed, [actor]: ["double" as const] } };
    const rejected = fireInSession(state, actor, fire(state, { item: "double" }), 1100);
    expect(rejected.reason).toBe("item-used");
    expect(rejected.state).toBe(state);
    const teleport = fireInSession(state, actor, fire(state, { item: "teleport" }), 1100);
    expect(teleport.reason).toBe("accepted");
    expect(teleport.state.itemsUsed[actor]).toEqual(["double", "teleport"]);
  });

  it("テレポートは選んだ武器に関わらず標準砲で飛び、削らずに撃った側を着地点へ移す", () => {
    const state = start(), actor = state.movement.playerId;
    const shot = fireInSession(state, actor, fire(state, { slot: 1, item: "teleport" }), 1100);
    expect(shot.reason).toBe("accepted");
    const { replay } = shot.state;
    expect(replay!.shot.weapon).toBe("cannon");
    expect(replay!.shot.impacts).toEqual([]);
    expect(shot.state.terrainOps).toEqual(state.terrainOps);
    expect(shot.state.players.map(p => p.hp)).toEqual(state.players.map(p => p.hp));
    const landing = replay!.shot.teleport;
    expect(landing).not.toBeNull();
    expect(shot.state.players.find(p => p.playerId === actor)).toMatchObject(landing!);
    expect(shot.state.roster.delay!.costs[actor]).toBe(actionCost(steps(state), "digger", "teleport"));
    expect(shot.state.roster.delay!.costs[actor]).toBe(120 + steps(state));
  });

  it("撃たずに手番が終わってもアイテムは使用済みにならない", () => {
    const state = start(), actor = state.movement.playerId;
    expect(tickSession(state, state.movement.deadlineAt).itemsUsed[actor]).toEqual([]);
  });

  it("ダブルシュートの再生は 1 発のときの上限を超えてよい", () => {
    const state = start(), actor = state.movement.playerId;
    const replay = fireInSession(state, actor, fire(state, { item: "double", slot: 1, power: 100, elevation: 80 }), 1100).state.replay!;
    expect(replay.endsAt - replay.startsAt).toBeLessThanOrEqual(16000 + 1300);
  });

  it("使用済みの記録は保存と復元を往復する", () => {
    const state = start(), actor = state.movement.playerId;
    const shot = fireInSession(state, actor, fire(state, { item: "double" }), 1100).state;
    const restored = restoreBattle(JSON.parse(JSON.stringify(serializeBattle(shot))));
    expect(restored.itemsUsed).toEqual(shot.itemsUsed);
  });
});

describe("ダブルシュートの 2 発目と試合の決着（設計書 42.2）", () => {
  /** 撃つ側の次の相手を HP 1 にし、1 発で倒せる仰角とパワーを探す。見つからなければ null */
  const killing = (members: readonly RosterMember[]) => {
    const battle = createBattle(members, 7, TEST_ARENA);
    const shooterId = battle.roster.turnRing[0]!, targetId = members.find(m => m.playerId !== shooterId && members.find(s => s.playerId === shooterId)!.teamId !== m.teamId)!.playerId;
    const players: BattlePlayer[] = battle.players.map(p => p.playerId === targetId ? { ...p, hp: 1 } : p);
    const target = players.find(p => p.playerId === targetId)!, shooter = players.find(p => p.playerId === shooterId)!;
    const facing: -1 | 1 = target.x > shooter.x ? 1 : -1;
    for (let elevation = 10; elevation <= 85; elevation += 5) for (let power = 10; power <= 100; power += 2) {
      const input = { playerId: shooterId, weapon: "cannon" as const, wind: 0, facing, elevation, power };
      const one = resolveBattleShot(battle.roster, battle.mask, players, input);
      const others = one.players.filter(p => p.playerId !== targetId);
      if (one.roster.eliminated.includes(targetId) && others.every(p => p.hp === players.find(q => q.playerId === p.playerId)!.hp && !one.roster.eliminated.includes(p.playerId))) {
        return { battle, players, input };
      }
    }
    return null;
  };

  it("1 対 1 で相手を倒したら、試合が決まったので 2 発目を撃たない", () => {
    const found = killing([{ playerId: "a", teamId: "t0" }, { playerId: "b", teamId: "t1" }]);
    expect(found).not.toBeNull();
    const { battle, players, input } = found!;
    const shot = resolveBattleShot(battle.roster, battle.mask, players, { ...input, item: "double" });
    expect(shot.paths).toHaveLength(1);
    expect(shot.outcome.type).toBe("win");
  });

  it("3 チームで狙った相手を倒しても、敵のチームが残っていれば 2 発目を撃つ", () => {
    const found = killing([{ playerId: "a", teamId: "t0" }, { playerId: "b", teamId: "t1" }, { playerId: "c", teamId: "t2" }]);
    expect(found).not.toBeNull();
    const { battle, players, input } = found!;
    const shot = resolveBattleShot(battle.roster, battle.mask, players, { ...input, item: "double" });
    expect(shot.paths).toHaveLength(2);
    expect(shot.outcome.type).toBe("ongoing");
  });
});

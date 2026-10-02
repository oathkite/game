import { expect, it } from "vitest";
import { TEST_ARENA } from "@game/maps";
import { createBattle, createBattleSession, fireInSession } from "@game/engine/multiplayer";
import { labFrameSchema } from "@game/protocol/v2-lab";
import { replayFrame } from "../src/lab/replay";

// 再生の frame にアイテム（設計書 42）を載せる。クライアントは schema を通した値だけを使うので、schema も通ること

const start = () => createBattleSession(createBattle(Array.from({ length: 4 }, (_, i) => ({ playerId: `p${i}`, teamId: `t${i % 2}` })), 42, TEST_ARENA), "match", 1000);
const shoot = (item?: "double" | "teleport") => {
  const state = start(), actor = state.movement.playerId;
  const fired = fireInSession(state, actor, { version: 2, type: "turn.fire", matchId: "match", turnId: 1, commandId: "f", ackMoveSeq: 0, slot: 0, facing: 1, elevation: 45, power: 30, ...(item ? { item } : {}) }, 1100);
  return { actor, state: fired.state, replay: replayFrame(fired.state) };
};
const parse = (replay: ReturnType<typeof replayFrame>) => labFrameSchema.shape.replay.parse(replay);

it("アイテムを使わない再生にはアイテムの項目を持たない", () => {
  const replay = parse(shoot().replay)!;
  expect(replay.shooter.item).toBeUndefined();
  expect("teleport" in replay).toBe(false);
  expect("firstShot" in replay).toBe(false);
});

it("ダブルシュートの再生は、使ったアイテムと 1 発目の終わりの位置を持つ", () => {
  const { state, replay } = shoot("double");
  const parsed = parse(replay)!;
  expect(parsed.shooter.item).toBe("double");
  expect(parsed.paths).toHaveLength(2);
  expect(parsed.firstShot!.tick).toBe(state.replay!.shot.firstShot!.tick);
  expect(parsed.firstShot!.players.map(p => p.playerId).sort()).toEqual(["p0", "p1", "p2", "p3"]);
  expect(parsed.firstShot!.tick).toBeLessThan(parsed.paths[1]!.launchTick);
});

it("テレポートの再生は着地点を持ち、着弾を持たない", () => {
  const { actor, state, replay } = shoot("teleport");
  const parsed = parse(replay)!;
  expect(parsed.shooter).toMatchObject({ item: "teleport", weapon: "cannon" });
  expect(parsed.impacts).toEqual([]);
  expect(parsed.teleport).toEqual(state.replay!.shot.teleport);
  expect(state.players.find(p => p.playerId === actor)).toMatchObject(parsed.teleport!);
});
